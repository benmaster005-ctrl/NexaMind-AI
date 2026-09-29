-- Migration 0009 NexaMind AI — suppression de la gestion des roles.
-- Idempotente : rejouable sans doublon.
-- A executer dans le SQL Editor du projet Supabase (la cle publique ne permet
-- pas le DDL). Prerequis : 0001 a 0008 jouees.
--
-- OBJECTIF
--   La gestion des roles (admin / collaborateur) est supprimee : tout
--   utilisateur authentifie peut deposer, modifier et supprimer des documents.
--   Cette migration retire donc le mecanique de role et rouvre l'ecriture
--   documentaire a tous les authentifies, comme avant la migration 0008.
--
--   0008 avait restreint les ecritures au role 'admin' lu dans `app_metadata`.
--   Sans role, ce verrou ne peut pas etre conserve : il condamnerait le depot
--   pour tout le monde.
--
-- SECURITE (ce qui reste en place)
--   - L'anonyme reste verrouille : toutes les policies sont `to authenticated`.
--   - L'historique (conversations, messages, recherches) reste strictement
--     personnel (R-7) : ces tables ne sont pas touchees ici.
--   - La suppression d'une ressource continue d'entrainer la cascade de ses
--     morceaux (`document_chunks` via `on delete cascade` de 0001_init.sql).
--
-- AVERTISSEMENT CONNAISSU
--   Un utilisateur authentifie peut desormais, via la cle publique, injecter
--   des morceaux arbitraires dans `document_chunks` (empoisonnement du corpus
--   RAG) ou supprimer un document depose par un autre. C'est un choix
--   fonctionnel assume : le fonds documentaire est desormais collectif. Pour
--   revenir a un depot reserve, rejouer 0008 apres avoir reattribue un role.

-- ---------------------------------------------------------------------------
-- 1. Purge du role : plus de donnee de role dans les metadonnees de compte.
-- ---------------------------------------------------------------------------
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
 where raw_app_meta_data ? 'role';

update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'role'
 where raw_user_meta_data ? 'role';

-- ---------------------------------------------------------------------------
-- 2. Retrait du trigger d'inscription (il ne faisait que poser le role) et de
--    la fonction de role `is_admin()`.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop function if exists public.is_admin();

-- ---------------------------------------------------------------------------
-- 3. `resources` : ecriture ouverte a tout utilisateur authentifie.
--    `created_by` reste renseigne par la Server Action de depot (tracabilite).
-- ---------------------------------------------------------------------------
drop policy if exists "admin_insert_resources" on public.resources;
drop policy if exists "authenticated_insert_resources" on public.resources;
create policy "authenticated_insert_resources" on public.resources
  for insert to authenticated with check (true);

drop policy if exists "admin_update_resources" on public.resources;
drop policy if exists "authenticated_update_resources" on public.resources;
create policy "authenticated_update_resources" on public.resources
  for update to authenticated using (true) with check (true);

drop policy if exists "admin_delete_resources" on public.resources;
drop policy if exists "authenticated_delete_resources" on public.resources;
create policy "authenticated_delete_resources" on public.resources
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 4. `document_chunks` : ecriture ouverte (pipeline d'ingestion + re-depot).
-- ---------------------------------------------------------------------------
drop policy if exists "admin_insert_chunks" on public.document_chunks;
drop policy if exists "authenticated_insert_chunks" on public.document_chunks;
create policy "authenticated_insert_chunks" on public.document_chunks
  for insert to authenticated with check (true);

drop policy if exists "admin_update_chunks" on public.document_chunks;
drop policy if exists "authenticated_update_chunks" on public.document_chunks;
create policy "authenticated_update_chunks" on public.document_chunks
  for update to authenticated using (true) with check (true);

drop policy if exists "admin_delete_chunks" on public.document_chunks;
drop policy if exists "authenticated_delete_chunks" on public.document_chunks;
create policy "authenticated_delete_chunks" on public.document_chunks
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 5. Storage : lecture et ecriture ouvertes aux authentifies sur le bucket
--    `documents` (l'anonyme reste exclu).
-- ---------------------------------------------------------------------------
drop policy if exists "admin_insert_documents" on storage.objects;
drop policy if exists "authenticated_write_documents" on storage.objects;
create policy "authenticated_insert_documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');

drop policy if exists "admin_delete_documents" on storage.objects;
drop policy if exists "authenticated_delete_documents" on storage.objects;
create policy "authenticated_delete_documents" on storage.objects
  for delete to authenticated using (bucket_id = 'documents');

drop policy if exists "admin_update_documents" on storage.objects;
drop policy if exists "authenticated_update_documents" on storage.objects;
create policy "authenticated_update_documents" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

drop policy if exists "authenticated_read_documents" on storage.objects;
create policy "authenticated_read_documents" on storage.objects
  for select to authenticated using (bucket_id = 'documents');
