-- ============================================================
-- Migração 007: papéis de acesso (síndico vs. porteiro)
-- Rode isso no SQL Editor do Supabase.
-- ============================================================

-- Permite que um síndico altere o papel (role) de outros funcionários.
-- Sem essa política, ninguém consegue promover/rebaixar ninguém pelo app.
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

-- Nomes de recusa/aceite/registro de ocorrência já eram salvos (reviewed_by,
-- received_by, occurrence_by) — isso já existia, só não aparecia nas telas.

-- Faltava saber qual FUNCIONÁRIO confirmou cada entrega (só sabíamos o nome
-- de quem retirou, não quem da equipe atendeu). Corrigindo:
alter table packages add column if not exists delivered_by uuid references profiles(id);

