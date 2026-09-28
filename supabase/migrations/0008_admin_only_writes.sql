-- Migration 0008 NexaMind AI — durcissement R-5 / AD-2 (audit de securite 2026-09-27).
-- Idempotente : rejouable sans doublon.
-- A executer dans le SQL Editor du projet Supabase (la cle publique ne permet
-- pas le DDL). Prerequis : 0001 a 0007 jouees.
--
-- DEUX FAIBLESSES CORRIGEES ICI
--
-- 1) Escalade de privileges (critique)
--    Le role etait lu dans `user_metadata`, que l'UTILISATEUR PEUT MODIFIER
--    LUI-MEME (supabase.auth.updateUser({ data: { role: 'admin' } })). Tout
--    controle de role de l'application etait donc forgeable : n'importe quel
--    collaborateur pouvait devenir admin, puis deposer, modifier ou supprimer
--    des ressources (R-5 viole).
--    Le role est desormais porte par `app_metadata`, que seul le serveur
--    (ou un administrateur Supabase) peut ecrire ; un trigger l'initialise a
--    'collaborateur' a l'inscription et neutralise tout role fourni par le client.
--
-- 2) RLS en ecriture completement ouverte (critique)
--    Les policies d'ecriture etaient `using (true)` / `with check (true)` pour
--    TOUT utilisateur authentifie : la defense en profondeur (AD-2) n'existait
--    pas. Avec la cle publique, un collaborateur pouvait, via l'API REST :
--      - inserer ou supprimer des ressources et des morceaux ;
--      - passer une ressource en statut 'Prête' ou injecter des morceaux
--        arbitraires = empoisonnement du corpus RAG (prompt injection) ;
--      - supprimer n'importe quel objet du bucket `documents`.
--    Les policies d'ecriture sont desormais reservees au role admin.
--    La lecture reste ouverte aux authentifies (R-5 : base ouverte en lecture).

-- ---------------------------------------------------------------------------
-- 1. Fonction d'autorisation : le role vient de app_metadata (JWT).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trigger d'inscription : role serveur, jamais celui du client.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', 'collaborateur'),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'role'
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Migration des roles existants (une fois, sans perte) : le role actuel est
--    recopie vers app_metadata, puis purge de user_metadata (desormais lu
--    par personne).
-- ---------------------------------------------------------------------------
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('role', coalesce(raw_user_meta_data ->> 'role', 'collaborateur'))
 where coalesce(raw_app_meta_data ->> 'role', '') is distinct from coalesce(raw_user_meta_data ->> 'role', 'collaborateur');

update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'role'
 where raw_user_meta_data ? 'role';

-- Promouvoir un administrateur (une fois, dans le SQL Editor) :
--   update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                           || jsonb_build_object('role', 'admin')
--    where email = 'prenom.nom@nexaworks.example';
-- L'utilisateur doit ensuite se reconnecter (le JWT porte les claims).


-- ---------------------------------------------------------------------------
-- 4. Ecritures sur `resources` et `document_chunks` : admin uniquement.
--    (Depot, ingestion, modification et suppression passent par la session admin.)
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated_insert_resources" on public.resources;
create policy "admin_insert_resources" on public.resources
  for insert to authenticated with check (public.is_admin());

drop policy if exists "authenticated_update_resources" on public.resources;
create policy "admin_update_resources" on public.resources
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated_delete_resources" on public.resources;
create policy "admin_delete_resources" on public.resources
  for delete to authenticated using (public.is_admin());

drop policy if exists "authenticated_insert_chunks" on public.document_chunks;
create policy "admin_insert_chunks" on public.document_chunks
  for insert to authenticated with check (public.is_admin());

drop policy if exists "authenticated_update_chunks" on public.document_chunks;
create policy "admin_update_chunks" on public.document_chunks
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated_delete_chunks" on public.document_chunks;
create policy "admin_delete_chunks" on public.document_chunks
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Storage : lecture ouverte aux authentifies (R-5), ecriture admin.
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated_read_documents" on storage.objects;
create policy "authenticated_read_documents" on storage.objects
  for select to authenticated using (bucket_id = 'documents');

drop policy if exists "authenticated_write_documents" on storage.objects;
drop policy if exists "admin_insert_documents" on storage.objects;
create policy "admin_insert_documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.is_admin());

drop policy if exists "authenticated_delete_documents" on storage.objects;
drop policy if exists "admin_delete_documents" on storage.objects;
create policy "admin_delete_documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());

drop policy if exists "authenticated_update_documents" on storage.objects;
