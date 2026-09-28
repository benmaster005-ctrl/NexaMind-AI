-- Migration 0005 NexaMind AI (story 2.4 — FR-5, FR-7).
-- Idempotente : rejouable sans doublon.
-- À exécuter dans le SQL Editor du projet Supabase (la clé publique
-- ne permet pas le DDL : copiez ce fichier dans Dashboard > SQL Editor > Run).
-- Prérequis : migrations 0001_init.sql à 0004_embeddings_vector_storage.sql jouées.

-- 1. Sécurité : permettre la suppression des ressources par les
-- utilisateurs authentifiés (le rôle admin est vérifié côté serveur
-- Next.js avant chaque suppression, AD-2 : défense en profondeur,
-- l'anonyme reste verrouillé). La suppression d'une ressource entraîne
-- la suppression en cascade de ses morceaux vectoriels (document_chunks
-- via la contrainte on delete cascade de 0001_init.sql), ce qui évite
-- que le RAG continue de citer des morceaux orphelins.
drop policy if exists "authenticated_delete_resources" on public.resources;
create policy "authenticated_delete_resources" on public.resources
  for delete to authenticated using (true);

-- 2. Sécurité : permettre la mise à jour des métadonnées (catégorie,
-- étiquettes) par les utilisateurs authentifiés via la clé publique + RLS.
-- Idempotent avec la policy créée en 0003 (recréée à l'identique si absente).
drop policy if exists "authenticated_update_resources" on public.resources;
create policy "authenticated_update_resources" on public.resources
  for update to authenticated using (true) with check (true);
