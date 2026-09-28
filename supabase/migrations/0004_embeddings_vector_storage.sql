-- Migration 0004 NexaMind AI (story 2.3 — FR-6, AD-3, 768 dimensions).
-- Idempotente : rejouable sans doublon.
-- À exécuter dans le SQL Editor du projet Supabase (la clé publique
-- ne permet pas le DDL : copiez ce fichier dans Dashboard > SQL Editor > Run).
-- Prérequis : migrations 0001_init.sql, 0002_storage_resources.sql et 0003_ingestion_chunks.sql jouées.

-- 1. Sécurité : permettre les mises à jour (update) sur document_chunks
-- pour les utilisateurs authentifiés lors du stockage / enrichissement vectoriel.
drop policy if exists "authenticated_update_chunks" on public.document_chunks;
create policy "authenticated_update_chunks" on public.document_chunks
  for update to authenticated using (true) with check (true);

-- 2. Index vectoriel pour accélérer la recherche par similarité cosinus (epic 3 / FR-9).
-- pgvector supporte l'index hnsw avec la métrique cosine.
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);
