-- ============================================================
-- Migração 006: cadastro do entregador só em horário útil
-- Segunda a sexta, 07:00–18:00. Sábado, 07:00–14:00. Domingo: fechado.
-- Rode isso no SQL Editor do Supabase.
-- ============================================================

drop policy if exists "submissions: qualquer um pode enviar" on submissions;

create policy "submissions: qualquer um pode enviar (horario util)"
  on submissions for insert
  to anon, authenticated
  with check (
    status = 'pendente'
    and (
      -- Segunda(1) a sexta(5), 07:00–18:00, horário de Brasília
      (
        extract(isodow from (now() at time zone 'America/Sao_Paulo')) between 1 and 5
        and (now() at time zone 'America/Sao_Paulo')::time between '07:00' and '18:00'
      )
      or
      -- Sábado (6), 07:00–14:00
      (
        extract(isodow from (now() at time zone 'America/Sao_Paulo')) = 6
        and (now() at time zone 'America/Sao_Paulo')::time between '07:00' and '14:00'
      )
    )
  );
