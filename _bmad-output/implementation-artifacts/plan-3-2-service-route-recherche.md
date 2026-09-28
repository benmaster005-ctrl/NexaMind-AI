---
title: '3.2 Service de Recherche Hybride et Route API de Recherche'
type: 'feature'
ticket: '2'
created: '2026-09-28'
status: 'building'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md`
  - `_bmad-output/initiative-nexamind-ai/epic-recherche-semantique/tickets.toml`
  - `_bmad-output/implementation-artifacts/plan-3-1-match-chunks-rpc.md`
  - `lib/ai/embeddings.ts`
  - `supabase/migrations/0005_match_chunks.sql`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La RPC `match_chunks()` existe (story 3.1) mais aucun service ni route HTTP ne l'exploite. Les collaborateurs ne peuvent pas interroger le fonds documentaire par mots-cles ni par sens.

**Approach:**
1. Creer `lib/ai/search.ts` : service pur testable (dependances injectees) qui vectorise la requete via `generateEmbeddings([query])`, appelle la RPC `match_chunks`, complete par une recherche textuelle simple (titre/eticquettes/auteur -> colonnes `title`, `tags`, `category`) limitee aux ressources 'Prête', fusionne et dedupe (semantique d'abord, texte ensuite, max `limit`).
2. Creer `app/api/search/route.ts` (GET `?q=&limit=&threshold=&category=`) : garde auth (401 si non connecte), requete vide -> `{ results: [] }` sans appel IA, appel du service avec le client Supabase serveur, reponse `{ results: [{ resourceId, chunkId, title, category, createdAt, excerpt, similarity, matchKind }] }`.
3. Tests hors-reseau `scripts/search.test.ts` (service : vide, semantique, hybride, dedupe, erreurs) + `package.json` (`test:search`).

## Boundaries & Constraints

**Always:**
- Requete vide/espaces -> reponse vide SANS appel d'embedding (ticket edge-case).
- Seuil defaut 0.65 (AD-1), limite defaut 10 bornee [1,50].
- Uniquement ressources 'Prête' (filtre RPC + filtre texte).
- Chaque resultat : ID ressource, titre, categorie, date, extrait exact.
- Authentification requise sur la route (401 JSON sinon).
- Service `searchDocuments` ne leve jamais : `{ ok, results, message }`.

**Never:**
- Pas de cle Gemini cote navigateur (tout passe par la route serveur, AD-4).
- Pas d'appel reseau/IA dans les tests CI (doubles injectes).
- Ne pas exposer les vecteurs dans la reponse HTTP.
- Ne pas casser embeddings/ingestion existants.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Requete vide | `q=""` ou `"   "` | `{ results: [] }`, 0 appel embedding/RPC | Pas d'erreur, 200 |
| Succes semantique | `q=télétravail`, chunks 'Politique de travail à distance' trouves | Resultats tries par similarite, `matchKind: 'semantic'` | No error expected |
| Zero semantique, texte OK | RPC vide, titre matche en ILIKE | Resultats texte `matchKind: 'text'`, similarite null | No error expected |
| Doublon semantique+texte | Meme chunk dans les 2 sources | Une seule entree (semantique gagne) | Dedupe silencieuse |
| Filtre categorie | `category=FAQ` | Les 2 sources filtrees | Pas d'erreur |
| RPC en echec | Supabase throw | `{ ok:false, results:[], message FR }` -> route 502 | Message FR, pas de stack |
| Embedding en echec | Gemini throw | Repli texte seul (degrade gracieux) + message | Pas de 500 si le texte reussit |
| Non authentifie | pas de session | 401 `{ error }` | Message FR |
| q trop longue | > 500 chars | 400 `{ error }` | Message FR |

## Code Map

- `lib/ai/search.ts` (nouveau) -- Service `searchDocuments` + types + fusion hybride.
- `app/api/search/route.ts` (nouveau) -- Route GET JSON + garde auth + adaptateur Supabase reel.
- `scripts/search.test.ts` (nouveau) -- Tests service hors-reseau.
- `package.json` (modifie) -- Script `test:search`.

## Tasks & Acceptance

**Execution:**
- [ ] `lib/ai/search.ts` -- Creer le service hybride injectable.
- [ ] `app/api/search/route.ts` -- Creer la route GET avec garde auth.
- [ ] `scripts/search.test.ts` -- Tester vide/semantique/hybride/dedupe/erreurs.
- [ ] `package.json` -- Ajouter `test:search`.

**Acceptance Criteria:**
- Given la requete 'télétravail', when la route s'execute avec un chunk 'Politique de travail à distance' similaire, then la ressource est retournee meme sans mot-cle identique.
- Given un appel, when il aboutit, then chaque resultat contient ID ressource, titre, categorie, date et extrait exact.
- Given requete vide, when la route s'execute, then reponse vide sans appel IA.
- Given un appel nominal, when mesure de bout en bout, then < 1,5 s (budget : embedding ~1 s + RPC < 150 ms).

## Implementation Notes

`match_chunks` retourne deja `similarity` triee. La recherche texte utilise `ilike` sur `title` + `category` et `overlaps`/`contains` sur `tags` (text[]), limite 10, statut 'Prête'. L'auteur PRD (FR-8 : titres/etiquettes/auteurs) est mappe sur `title`/`tags`/`category` car le schema n'a pas de colonne auteur dediee.

## Verification

**Commands:**
- `npm run test:search` -- exit 0.
- `npm run test:search-rpc` -- exit 0 (non-regression).
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0.
- `npm run build` -- exit 0.
