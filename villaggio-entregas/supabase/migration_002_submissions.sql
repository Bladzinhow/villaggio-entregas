-- ============================================================
-- Migração 002: cadastro público do entregador (submissions)
-- Rode isso no SQL Editor do Supabase — não precisa rodar o
-- schema.sql de novo, isso aqui só ADICIONA o que falta.
-- ============================================================

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

alter table packages add column submission_id uuid references submissions(id);

alter table submissions enable row level security;

create policy "submissions: qualquer um pode enviar"
  on submissions for insert
  to anon, authenticated
  with check (status = 'pendente');

create policy "submissions: leitura para autenticados"
  on submissions for select to authenticated using (true);

create policy "submissions: atualizacao para autenticados"
  on submissions for update to authenticated using (true);
