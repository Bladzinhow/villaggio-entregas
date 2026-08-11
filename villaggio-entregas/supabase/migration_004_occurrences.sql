-- ============================================================
-- Migração 004: registro de ocorrências (avaria, extravio, etc.)
-- Rode isso no SQL Editor do Supabase.
-- ============================================================

alter table packages add column occurrence_type text
  check (occurrence_type in ('avaria', 'extravio', 'outro'));
alter table packages add column occurrence_note text;
alter table packages add column occurrence_at timestamptz;
alter table packages add column occurrence_by uuid references profiles(id);
