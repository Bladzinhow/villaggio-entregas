-- ============================================================
-- Migração 003: registrar quem retirou a encomenda
-- Rode isso no SQL Editor do Supabase.
-- ============================================================

alter table packages add column picked_up_by text;
