---
title: '3.1 Fonction RPC match_chunks pour la Recherche par Similarite Cosinus'
type: 'feature'
ticket: '1'
created: '2026-09-28'
status: 'built'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md`
  - `_bmad-output/initiative-nexamind-ai/epic-recherche-semantique/tickets.toml`
  - `_bmad-output/implementation-artifacts/plan-2-3-embeddings-vector-storage.md`
  - `supabase/migrations/0001_init.sql`
  - `supabase/migrations/0004_embeddings_vector_storage.sql`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les morceaux vectorises (768d, story 2.3) sont stockes dans pgvector mais aucune fonction SQL ne permet de retrouver les plus proches voisins d'une requete. Sans RPC `match_chunks()`, la recherche semantique (FR-9) et la route `/api/search` (story 3.2) ne peuvent pas fonctionner.

**Approach:**
1. Creer la migration idempotente `supabase/migrations/0005_match_chunks.sql` avec la fonction `public.match_chunks(query_embedding float[], match_threshold float, match_count int)`.
2. Similarite cosinus via l'operateur pgvector `<=>` (distance) convertie en score `1 - distance`, tri decroissant, filtre strict `resources.status = 'Prête'`.
3. Validation defensive : dimension exacte 768, seuil borne [0,1], limite bornee [1,50] ; erreur SQL controlee sinon.
4. Securite : `SECURITY DEFINER` + `search_path = public` fige + `REVOKE ALL` puis `GRANT EXECUTE TO authenticated` uniquement (AD-2/AD-4 : jamais d'acces anonyme).
5. Test hors-reseau `scripts/search-rpc.test.ts` qui audite le fichier SQL (presence fonction, filtre statut, garde dimension, grant) sans connexion Supabase.

## Boundaries & Constraints

**Always:**
- Vecteur 768 dimensions (AD-3, `vector(768)`), modele `text-embedding-004` cote appelant.
- Seuil par defaut 0.65 (AD-1 : seuil d'abstention), parametrable par l'appelant.
- Ne retourner que des morceaux de ressources 'Prête' (jamais 'En cours' ni 'Échec').
- Fonction `STABLE`, idempotente (`CREATE OR REPLACE`), rejouable sans doublon.
- Retourner l'extrait exact `content` + metadonnees (titre, categorie, date) pour l'epic Done-when n.2.

**Never:**
- Pas d'acces `anon` (REVOKE ALL, GRANT authenticated uniquement).
- Pas de `search_path` mutable (fige a `public` contre le hijacking).
- Ne pas casser les migrations 0001-0004 ni les index hnsw existants.
- Pas d'appel reseau dans les tests CI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Requete nominale | vecteur 768d, seuil 0.65, limite 10 | N lignes triees par similarite decroissante, toutes 'Prête' | No error expected |
| Seuil haut | seuil 0.99 | Sous-ensemble (eventuellement vide, pas d'erreur) | Retour vide, pas d'exception |
| Vecteur mauvaise dimension | 512 floats | Exception SQL controlee | `raise exception 'match_chunks: ... 768 ...'` |
| Vecteur NULL | NULL | Exception SQL controlee | `raise exception 'match_chunks: query_embedding ... NULL'` |
| Seuil hors borne | -1 ou 2 | Borne automatique dans [0,1] via LEAST/GREATEST | Pas d'exception, clamping |
| Limite hors borne | 0 ou 500 | Bornee dans [1,50] | Pas d'exception, clamping |
| Ressource 'En cours'/'Échec' | chunks existants non prets | Exclus du resultat (JOIN + WHERE status) | Filtrage silencieux |
| Chunk sans embedding | embedding NULL | Exclu (`dc.embedding IS NOT NULL`) | Filtrage silencieux |

## Code Map

- `supabase/migrations/0005_match_chunks.sql` (nouveau) -- Fonction RPC + droits, idempotente.
- `scripts/search-rpc.test.ts` (nouveau) -- Audit statique du SQL hors-reseau.
- `package.json` (modifie) -- Script `test:search-rpc`.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/0005_match_chunks.sql` -- Ecrire la fonction + grants.
- [ ] `scripts/search-rpc.test.ts` -- Auditer le SQL (fonction, filtre, dimension, grants, index).
- [ ] `package.json` -- Ajouter `test:search-rpc`.

**Acceptance Criteria:**
- Given un vecteur 768d et un seuil 0.65, when `match_chunks()` s'execute, then elle renvoie les morceaux les plus proches tries par similarite decroissante.
- Given des ressources 'En cours' ou 'Échec', when la fonction s'execute, then aucune de leurs morceaux n'est retournee.
- Given un vecteur de mauvaise dimension, when la fonction s'execute, then une erreur SQL controlee est levee.
- Given 10 000 chunks indexes hnsw, when la fonction s'execute, then le plan utilise l'index (execution < 150ms visee, mesure cote Supabase).

## Implementation Notes

Implementation sans sous-agent. SQL pur, sans dependance npm. L'appelant (story 3.2) passera un `float[]` de 768 valeurs issu de `generateEmbeddings([requete])`.

## Verification

**Commands:**
- `npm run test:search-rpc` -- exit 0.
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0.
