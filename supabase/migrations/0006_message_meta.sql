-- Story 4.4 (FR-13) : conservation des citations/abstention par message.
-- Idempotent : rejouable sans erreur.
-- À exécuter dans le SQL Editor Supabase (la clé publishable ne fait pas de DDL).

alter table public.messages
  add column if not exists meta jsonb not null default '{}';

-- Relecture fil : messages d'une conversation dans l'ordre chronologique.
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
