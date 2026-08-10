-- ============================================================
-- Villaggio Paradiso - Controle de Entregas
-- Schema do banco de dados (rodar no SQL Editor do Supabase)
-- ============================================================

-- Extensão para gerar IDs únicos
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabela: profiles
-- Um registro por funcionário (porteiro/síndico) que faz login.
-- Criada automaticamente quando alguém se cadastra (ver trigger abaixo).
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'porteiro' check (role in ('porteiro', 'sindico')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela: residents (moradores)
-- ------------------------------------------------------------
create table residents (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  street text not null,
  house_number text,
  phone text, -- formato: 5511999999999 (padrão internacional, sem símbolos)
  notes text,
  created_at timestamptz not null default now()
);

create index residents_street_idx on residents (street);

-- ------------------------------------------------------------
-- Tabela: packages (encomendas)
-- ------------------------------------------------------------
create table packages (
  id uuid primary key default gen_random_uuid(),
  recipient_name text not null,
  street text not null,
  house_number text,
  resident_id uuid references residents(id) on delete set null,
  carrier text not null default 'Outro'
    check (carrier in ('Shopee','Mercado Livre','Amazon','Correios','Transportadora','Outro')),
  tracking_code text,
  description text,
  photo_url text,
  courier_name text,
  courier_cpf text, -- ver nota de segurança no README sobre este campo
  received_by uuid references profiles(id),
  received_at timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente','entregue')),
  delivered_at timestamptz,
  delivered_note text,
  whatsapp_notified boolean not null default false,
  created_at timestamptz not null default now()
);

create index packages_status_idx on packages (status);
create index packages_street_idx on packages (street);
create index packages_received_at_idx on packages (received_at desc);

-- ------------------------------------------------------------
-- Trigger: cria automaticamente um "profile" quando um funcionário
-- se cadastra (Supabase Auth cuida do login/senha; isso só espelha
-- o nome e papel dele na tabela profiles)
-- ------------------------------------------------------------
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'porteiro')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- Tabela: submissions (cadastro feito pelo próprio entregador)
-- Fica pendente até um porteiro conferir e aceitar/recusar.
-- ------------------------------------------------------------
create table submissions (
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

create index submissions_status_idx on submissions (status);

-- Liga uma encomenda aceita de volta à submissão de origem (rastreabilidade)
alter table packages add column submission_id uuid references submissions(id);

-- ============================================================
-- SEGURANÇA (Row Level Security)
-- Isto é o que faltou no app anterior: aqui, só quem está
-- logado (autenticado) consegue ler ou escrever qualquer dado.
-- ============================================================

alter table profiles enable row level security;
alter table residents enable row level security;
alter table packages enable row level security;

-- profiles: cada um vê o próprio perfil e os dos colegas (para exibir nomes)
create policy "profiles: leitura para autenticados"
  on profiles for select
  to authenticated
  using (true);

-- residents: leitura e escrita liberada para qualquer funcionário logado
create policy "residents: leitura para autenticados"
  on residents for select to authenticated using (true);
create policy "residents: insercao para autenticados"
  on residents for insert to authenticated with check (true);
create policy "residents: atualizacao para autenticados"
  on residents for update to authenticated using (true);
create policy "residents: exclusao para autenticados"
  on residents for delete to authenticated using (true);

-- packages: leitura e escrita liberada para qualquer funcionário logado
create policy "packages: leitura para autenticados"
  on packages for select to authenticated using (true);
create policy "packages: insercao para autenticados"
  on packages for insert to authenticated with check (true);
create policy "packages: atualizacao para autenticados"
  on packages for update to authenticated using (true);
create policy "packages: exclusao para autenticados"
  on packages for delete to authenticated using (true);

-- Nenhuma policy "to anon" (visitante sem login) foi criada de propósito:
-- isso significa que, por padrão, ninguém sem login consegue ler nada.

-- ------------------------------------------------------------
-- submissions: caso especial.
-- O entregador (sem login, "anon") pode CRIAR um registro, mas
-- nunca ler/ver nada — nem o que ele mesmo enviou, nem de outros.
-- Só o porteiro logado consegue ver e revisar a fila.
-- ------------------------------------------------------------
alter table submissions enable row level security;

create policy "submissions: qualquer um pode enviar"
  on submissions for insert
  to anon, authenticated
  with check (status = 'pendente'); -- não pode chegar já "aceito"

create policy "submissions: leitura para autenticados"
  on submissions for select to authenticated using (true);

create policy "submissions: atualizacao para autenticados"
  on submissions for update to authenticated using (true);
