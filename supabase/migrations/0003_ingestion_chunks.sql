-- Migration 0003 NexaMind AI (story 2.2 — FR-6, AD-3).
-- Idempotente : rejouable sans doublon.
-- À exécuter dans le SQL Editor du projet Supabase (la clé publique
-- ne permet pas le DDL : copiez ce fichier dans Dashboard > SQL Editor > Run).
-- Prérequis : migration 0001_init.sql et 0002_storage_resources.sql jouées.

-- 1. Suivi d'ingestion sur resources (story 2.2 : raison d'échec + compteur).
alter table public.resources
  add column if not exists error_message text;
alter table public.resources
  add column if not exists chunk_count integer not null default 0;

-- 2. Un couple (ressource, index) unique : la ré-ingestion remplace les
-- morceaux au lieu d'en créer des doublons (idempotence FR-6).
create unique index if not exists document_chunks_resource_chunk_uidx
  on public.document_chunks (resource_id, chunk_index);

-- 3. Sécurité : le pipeline d'ingestion écrit via la clé publique + RLS
-- (le rôle admin est vérifié côté serveur Next.js avant chaque écriture,
-- AD-2 : défense en profondeur, l'anonyme reste verrouillé).
drop policy if exists "authenticated_update_resources" on public.resources;
create policy "authenticated_update_resources" on public.resources
  for update to authenticated using (true) with check (true);

drop policy if exists "authenticated_insert_chunks" on public.document_chunks;
create policy "authenticated_insert_chunks" on public.document_chunks
  for insert to authenticated with check (true);

drop policy if exists "authenticated_delete_chunks" on public.document_chunks;
create policy "authenticated_delete_chunks" on public.document_chunks
  for delete to authenticated using (true);
