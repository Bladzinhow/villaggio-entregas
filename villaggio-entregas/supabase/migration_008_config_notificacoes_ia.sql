-- ============================================================
-- Migração 008: Configurações do síndico, e-mail automático ao
-- morador, retirada por link e leitura de etiqueta por IA.
-- Rode isso no SQL Editor do Supabase. Pode rodar quantas vezes
-- quiser (é seguro/idempotente).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela de configurações (uma única linha, editada pelo síndico)
-- ------------------------------------------------------------
create table if not exists app_settings (
  id boolean primary key default true, -- sempre "true": garante uma única linha
  aging_alert_days int not null default 7,
  aging_expire_days int not null default 30,
  custom_message text,
  notify_email_enabled boolean not null default false,
  ai_scan_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into app_settings (id) values (true)
  on conflict (id) do nothing;

alter table app_settings enable row level security;

-- Qualquer pessoa (inclusive o entregador na tela pública /nova) pode
-- LER as configurações — nada sensível aqui, só serve para saber se o
-- botão "Preencher com IA" deve aparecer, por exemplo.
drop policy if exists "app_settings: leitura publica" on app_settings;
create policy "app_settings: leitura publica"
  on app_settings for select
  to anon, authenticated
  using (true);

-- Só síndico pode alterar as configurações.
drop policy if exists "app_settings: sindico pode atualizar" on app_settings;
create policy "app_settings: sindico pode atualizar"
  on app_settings for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'sindico'
    )
  );

-- ------------------------------------------------------------
-- 2) E-mail do morador (para notificação automática de chegada)
-- ------------------------------------------------------------
alter table residents add column if not exists email text;

-- ------------------------------------------------------------
-- 3) Token de retirada — permite gerar um link único por encomenda
-- para o morador confirmar a própria retirada, sem precisar de login.
-- ------------------------------------------------------------
alter table packages add column if not exists pickup_token uuid not null default gen_random_uuid();

create unique index if not exists packages_pickup_token_idx on packages (pickup_token);

-- ------------------------------------------------------------
-- 4) Funções seguras para a tela pública de retirada (/retirar)
-- Em vez de abrir a tabela inteira para "anon", só expomos duas
-- funções que exigem conhecer o token exato (parte do link enviado
-- por e-mail) — ninguém consegue "adivinhar" ou listar encomendas.
-- ------------------------------------------------------------
create or replace function public.get_package_by_pickup_token(p_token uuid)
returns table (
  id uuid,
  recipient_name text,
  street text,
  house_number text,
  carrier text,
  description text,
  status text,
  received_at timestamptz,
  delivered_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, recipient_name, street, house_number, carrier, description,
         status, received_at, delivered_at
  from packages
  where pickup_token = p_token
  limit 1;
$$;

create or replace function public.confirm_pickup_by_token(p_token uuid, p_picked_up_by text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows int;
begin
  update packages
  set status = 'entregue',
      delivered_at = now(),
      picked_up_by = coalesce(nullif(trim(p_picked_up_by), ''), 'Confirmado pelo morador')
  where pickup_token = p_token
    and status = 'pendente';

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- Permite que visitantes sem login (o morador clicando no link do
-- e-mail) chamem essas duas funções — e só essas, nada mais.
grant execute on function public.get_package_by_pickup_token(uuid) to anon, authenticated;
grant execute on function public.confirm_pickup_by_token(uuid, text) to anon, authenticated;
