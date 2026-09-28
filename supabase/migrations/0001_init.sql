-- Migration initiale NexaMind AI (story 1.1 — FR-3).
-- Idempotente : rejouable sans doublon (IF NOT EXISTS).
-- À exécuter dans le SQL Editor du projet Supabase (la clé publishable
-- ne permet pas le DDL : copiez ce fichier dans Dashboard > SQL Editor > Run).

-- 1. Extension vectorielle pour la recherche sémantique (epic 3).
create extension if not exists vector;

-- 2. Table des ressources documentaires (epic 2 : FR-5, FR-7).
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  status text not null default 'En cours'
    check (status in ('Prête', 'En cours', 'Échec')),
  storage_path text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. Morceaux vectorisés (epic 2 : FR-6, AD-3 — 768 dimensions).
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);
create index if not exists document_chunks_resource_idx
  on public.document_chunks (resource_id);

-- 4. Conversations et messages (epics 4-5 : FR-13, FR-15).
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  title text not null default 'Nouvelle conversation',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx
  on public.messages (conversation_id);

-- 5. Sécurité : RLS activé partout, accès minimal authentifié.
-- Les policies fines par rôle (admin vs collaborateur, AD-2) seront
-- renforcées dans les stories 1.2-1.3 ; ici on verrouille déjà l'anonyme.
alter table public.resources enable row level security;
alter table public.document_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "authenticated_read_resources" on public.resources;
create policy "authenticated_read_resources" on public.resources
  for select to authenticated using (true);

drop policy if exists "authenticated_read_chunks" on public.document_chunks;
create policy "authenticated_read_chunks" on public.document_chunks
  for select to authenticated using (true);

drop policy if exists "owner_conversations" on public.conversations;
create policy "owner_conversations" on public.conversations
  for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owner_messages" on public.messages;
create policy "owner_messages" on public.messages
  for all to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.owner_id = auth.uid()
    )
  );
