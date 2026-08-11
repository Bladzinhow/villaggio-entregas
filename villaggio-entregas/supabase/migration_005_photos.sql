-- ============================================================
-- Migração 005: fotos das encomendas (prova de recebimento)
-- Rode isso no SQL Editor do Supabase.
-- ============================================================

-- Cria o "espaço de armazenamento" de fotos (bucket).
-- É público para leitura (a foto abre pelo link direto), mas só
-- quem está autenticado ou usando o app consegue enviar arquivos —
-- não existe uma "lista" pública de todas as fotos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'package-photos',
  'package-photos',
  true,
  5242880, -- 5 MB por foto
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "package-photos: qualquer um pode enviar foto"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'package-photos');

-- Campo para guardar o link da foto em cada encomenda
alter table packages add column if not exists photo_url text;

-- E também no cadastro feito pelo entregador (a foto pode ser tirada
-- por ele, antes mesmo da conferência)
alter table submissions add column photo_url text;
