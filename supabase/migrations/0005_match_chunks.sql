-- Migration 0005 NexaMind AI (story 3.1 — FR-9, AD-1/AD-3).
-- Idempotente : rejouable sans doublon.
-- À exécuter dans le SQL Editor du projet Supabase (la clé publique
-- ne permet pas le DDL : copiez ce fichier dans Dashboard > SQL Editor > Run).
-- Prérequis : migrations 0001_init.sql et 0004_embeddings_vector_storage.sql jouées
-- (table document_chunks avec embedding vector(768) + index hnsw).

-- Fonction de recherche par similarité cosinus sur pgvector.
-- - query_embedding : vecteur de requête 768d (text-embedding-004, AD-3).
-- - match_threshold : similarité cosinus minimale (défaut 0.65 = seuil AD-1).
-- - match_count : nombre max de résultats (défaut 10, borné [1,50]).
-- Ne retourne QUE les morceaux de ressources au statut 'Prête'.
create or replace function public.match_chunks(
  query_embedding float[],
  match_threshold float default 0.65,
  match_count int default 10
)
returns table (
  chunk_id uuid,
  resource_id uuid,
  title text,
  category text,
  created_at timestamptz,
  content text,
  similarity float
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  query_vec vector(768);
  min_sim float := greatest(0.0, least(1.0, coalesce(match_threshold, 0.65)));
  max_rows int := greatest(1, least(50, coalesce(match_count, 10)));
begin
  if query_embedding is null then
    raise exception 'match_chunks: query_embedding ne doit pas être NULL.';
  end if;
  if array_length(query_embedding, 1) is distinct from 768 then
    raise exception 'match_chunks: dimension invalide (%) : 768 valeurs attendues (text-embedding-004).', coalesce(array_length(query_embedding, 1), 0);
  end if;

  query_vec := query_embedding::vector(768);

  return query
  select
    dc.id as chunk_id,
    r.id as resource_id,
    r.title as title,
    r.category as category,
    r.created_at as created_at,
    dc.content as content,
    (1 - (dc.embedding <=> query_vec))::float as similarity
  from public.document_chunks dc
  join public.resources r on r.id = dc.resource_id
  where dc.embedding is not null
    and r.status = 'Prête'
    and (1 - (dc.embedding <=> query_vec)) >= min_sim
  order by dc.embedding <=> query_vec
  limit max_rows;
end;
$$;

-- Sécurité (AD-2/AD-4) : exécution réservée aux authentifiés, jamais à l'anonyme.
revoke all on function public.match_chunks(float[], float, int) from public, anon;
grant execute on function public.match_chunks(float[], float, int) to authenticated;
