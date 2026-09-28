-- Migration 0007 NexaMind AI (story 5.3 — FR-16, R-7).
-- Idempotente : rejouable sans doublon.
-- À exécuter dans le SQL Editor du projet Supabase (la clé publique
-- ne permet pas le DDL : copiez ce fichier dans Dashboard > SQL Editor > Run).
-- Prérequis : migration 0001_init.sql jouée (RLS activée par table).
--
-- Objectif : conserver, pour chaque Utilisateur, ses recherches passées avec
-- le texte exact de la requête, sa date et son nombre de résultats (PRD FR-16),
-- rejouables en un clic sur l'état actuel de la base.

-- 1. Table de l'historique personnel des recherches.
--    `owner_id` est NOT NULL : une entrée sans auteur n'a aucun sens et
--    affaiblirait l'isolation R-7.
create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  query text not null check (char_length(query) between 1 and 500),
  result_count integer not null default 0 check (result_count >= 0),
  created_at timestamptz not null default now()
);

-- 2. Index de lecture : liste par auteur, du plus récent au plus ancien.
create index if not exists search_history_owner_created_idx
  on public.search_history (owner_id, created_at desc);

-- 3. R-7 : l'historique est strictement personnel. Une seule policy `for all`
--    couvre lecture, insertion et suppression : le client ne reçoit ni ne
--    transmet d'owner_id (AD-2 : l'anonyme reste verrouillé).
alter table public.search_history enable row level security;

drop policy if exists "owner_search_history" on public.search_history;
create policy "owner_search_history" on public.search_history
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
