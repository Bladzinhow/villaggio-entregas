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
