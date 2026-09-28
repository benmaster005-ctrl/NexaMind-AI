-- Migration 0002 NexaMind AI (story 2.1 — FR-5, FR-7).
-- Idempotente : rejouable sans doublon.
-- À exécuter dans le SQL Editor du projet Supabase (la clé publique
-- ne permet pas le DDL : copiez ce fichier dans Dashboard > SQL Editor > Run).
-- Prérequis : migration 0001_init.sql déjà jouée.

-- 1. Bucket privé pour les documents bruts (architecture AD-2).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- 2. Colonnes catégorie + étiquettes sur resources (PRD FR-5).
alter table public.resources
  add column if not exists category text not null default 'Ressource métier';
alter table public.resources
  add column if not exists tags text[] not null default '{}';

-- 3. Sécurité Storage : lecture/écriture réservées aux authentifiés.
-- La vérification fine du rôle admin est faite côté serveur Next.js
-- (Server Action) ; ici on verrouille déjà l'anonyme.
drop policy if exists "authenticated_read_documents" on storage.objects;
create policy "authenticated_read_documents" on storage.objects
  for select to authenticated using (bucket_id = 'documents');

drop policy if exists "authenticated_write_documents" on storage.objects;
create policy "authenticated_write_documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');

drop policy if exists "authenticated_delete_documents" on storage.objects;
create policy "authenticated_delete_documents" on storage.objects
  for delete to authenticated using (bucket_id = 'documents');

-- 4. Sécurité table resources : écriture réservée aux authentifiés
-- (la story 2.1 écrit via la clé anon + RLS ; le rôle admin est vérifié
-- côté serveur avant chaque insert).
drop policy if exists "authenticated_insert_resources" on public.resources;
create policy "authenticated_insert_resources" on public.resources
  for insert to authenticated with check (true);