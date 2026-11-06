-- ============================================================
-- MIGRAÇÃO ÚNICA (SEGURA PARA RODAR DE NOVO)
-- Não importa se parte disso já foi aplicada antes — este script
-- pula automaticamente o que já existe e só adiciona o que falta.
-- Pode rodar sem medo, quantas vezes precisar.
-- ============================================================

-- ---------- 002: cadastro público do entregador (submissions) ----------

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  recipient_name text not null,
  street text not null,
  house_number text,
  carrier text not null default 'Outro'
    check (carrier in ('Shopee','Mercado Livre','Amazon','Correios','Transportadora','Outro')),
  tracking_code text,
  description text,
  courier_name text,
  courier_cpf text,
  courier_phone text,
  status text not null default 'pendente' check (status in ('pendente','aceito','recusado')),
  rejection_reason text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists submissions_status_idx on submissions (status);

alter table packages add column if not exists submission_id uuid references submissions(id);

alter table submissions enable row level security;

drop policy if exists "submissions: qualquer um pode enviar" on submissions;
drop policy if exists "submissions: qualquer um pode enviar (horario util)" on submissions;
drop policy if exists "submissions: leitura para autenticados" on submissions;
drop policy if exists "submissions: atualizacao para autenticados" on submissions;

create policy "submissions: leitura para autenticados"
  on submissions for select to authenticated using (true);

create policy "submissions: atualizacao para autenticados"
  on submissions for update to authenticated using (true);

-- ---------- 003: quem retirou a encomenda ----------

alter table packages add column if not exists picked_up_by text;

-- ---------- 004: ocorrências (avaria, extravio) ----------

alter table packages add column if not exists occurrence_type text;
do $$ begin
  alter table packages add constraint packages_occurrence_type_check
    check (occurrence_type in ('avaria', 'extravio', 'outro'));
exception when duplicate_object then null;
end $$;
alter table packages add column if not exists occurrence_note text;
alter table packages add column if not exists occurrence_at timestamptz;
alter table packages add column if not exists occurrence_by uuid references profiles(id);

-- ---------- 005: fotos das encomendas ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'package-photos', 'package-photos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

drop policy if exists "package-photos: qualquer um pode enviar foto" on storage.objects;
create policy "package-photos: qualquer um pode enviar foto"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'package-photos');

alter table packages add column if not exists photo_url text;
alter table submissions add column if not exists photo_url text;

-- ---------- 006: cadastro só em horário útil ----------

drop policy if exists "submissions: qualquer um pode enviar (horario util)" on submissions;

create policy "submissions: qualquer um pode enviar (horario util)"
  on submissions for insert
  to anon, authenticated
  with check (
    status = 'pendente'
    and (
      (
        extract(isodow from (now() at time zone 'America/Sao_Paulo')) between 1 and 5
        and (now() at time zone 'America/Sao_Paulo')::time between '07:00' and '18:00'
      )
      or
      (
        extract(isodow from (now() at time zone 'America/Sao_Paulo')) = 6
        and (now() at time zone 'America/Sao_Paulo')::time between '07:00' and '14:00'
      )
    )
  );

-- ---------- 007: papéis de acesso (síndico vs. porteiro) ----------

drop policy if exists "profiles: sindico pode atualizar papeis" on profiles;

create policy "profiles: sindico pode atualizar papeis"
  on profiles for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'sindico'
    )
  );

alter table packages add column if not exists delivered_by uuid references profiles(id);

-- ---------- 008: configurações, notificação por e-mail, retirada por link e IA ----------

create table if not exists app_settings (
  id boolean primary key default true,
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

drop policy if exists "app_settings: leitura publica" on app_settings;
create policy "app_settings: leitura publica"
  on app_settings for select
  to anon, authenticated
  using (true);

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

alter table residents add column if not exists email text;

alter table packages add column if not exists pickup_token uuid not null default gen_random_uuid();

create unique index if not exists packages_pickup_token_idx on packages (pickup_token);

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

grant execute on function public.get_package_by_pickup_token(uuid) to anon, authenticated;
grant execute on function public.confirm_pickup_by_token(uuid, text) to anon, authenticated;
