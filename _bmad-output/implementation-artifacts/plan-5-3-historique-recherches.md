---
title: 'Story 5.3 — Historique personnel des recherches et rejeu direct'
type: 'feature'
ticket: '5.3'
created: '2026-09-27'
status: 'built'
review: 'thorough'
review_source: 'auto'
baseline_revision: 'NO_VCS (git absent de la machine — pas de staging possible)'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** une recherche fruitful est perdue dès qu'on quitte `/search` : rien ne permet de la retrouver, alors que le PRD (FR-16) promet de conserver pour chaque recherche « le texte de la requête, sa date et son nombre de résultats », rejouable en un clic sur l'état actuel de la base.

**Approach:** une migration `0007_search_history.sql` crée la table personnelle `search_history` (RLS `auth.uid() = owner_id`) ; un service pur `lib/search/history.ts` fixe les règles d'enregistrement, de déduplication et de formatage ; `app/api/search/route.ts` enregistre chaque recherche réussie (best effort) ; les recherches récentes s'affichent sous la barre de recherche et dans une seconde section de `/history`, chacune rejouable en un clic et supprimable.

## Boundaries & Constraints

**Always:**
- Isolation personnelle par la RLS uniquement : aucun `owner_id` venant du client, aucun filtre manuel.
- Enregistrement **best effort** : un échec d'écriture ne doit jamais faire échouer la recherche (l'utilisateur ne voit pas d'erreur).
- Dédupliquer une requête identique à la dernière enregistrée (le debounce du client relance la même recherche).
- Affichage plafonné à `SEARCH_HISTORY_LIMIT` (10) entrées, tri décroissant, requêtes > 500 caractères jamais enregistrées.
- Rejeu = relancer la même requête via le chemin de recherche existant (donc sur l'état actualisé de la base), pas de résultat figé.
- Migration 0007 **idempotente** (`create table if not exists`, `create index if not exists`, `drop policy if exists` avant `create policy`) — même convention que 0001-0006.

**Never:**
- Pas de purge automatique : le PRD la classe hors périmètre MVP (Q-6), la conservation suit la table sans expiration.
- Ne pas modifier le moteur de recherche (`lib/ai/search.ts`, `match_chunks`) ni le rendu des résultats.
- Ne pas enregistrer une requête vide, ni les recherches refusées (401/400) ou en erreur (502).
- Ne pas exposer de compteur de résultats qui ne soit pas celui de la recherche réellement exécutée.

## Décisions (2026-09-27, approbation humaine)

- **Les deux écrans** : bloc sous la barre de recherche **et** section dans `/history`, comme l'exige la story. Pas de report de la section `/history` en différé.
- **Aucune purge automatique** : le PRD la classe hors périmètre MVP (Q-6). La question de rétention est consignée en différé ; l'historique croît donc sans expiration, l'affichage est plafonné à 10.
- **Périmètre** : plan complet conservé au-delà de la fenêtre de tokens conseillée (≈2 670) — un seul livrable, chemins explicites, tests hors réseau.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|

## Code Map

- `supabase/migrations/0007_search_history.sql` — **NOUVEAU** : `search_history(id, owner_id not null, query, result_count, created_at)`, index `(owner_id, created_at desc)`, RLS activée + policy `for all to authenticated using (auth.uid() = owner_id) with check (...)`. Modèle : `supabase/migrations/0001_init.sql` l. 33-49 et 67-78 (conversations). **À jouer dans Supabase > SQL Editor** (la clé publique ne fait pas de DDL).
- `lib/search/history.ts` — **NOUVEAU (pur)** : `SEARCH_HISTORY_LIMIT = 10`, `normalizeQuery()`, `shouldRecordSearch(last, next)`, `buildSearchHistoryItems(rows)`, `formatResultCount(n)`, `SEARCH_HISTORY_MESSAGES`, type `SearchHistoryItem`. Aucun import réseau.
- `lib/search/history-store.ts` — **NOUVEAU** : `listSearchHistory({ client })`, `recordSearch({ client, userId, query, resultCount })` (lit la dernière entrée puis insère), `deleteSearchEntry({ client, id })` — client Supabase injecté, sur le modèle de `lib/ingestion/ingest-resource.ts`.
- `app/api/search/route.ts` — **MODIFIER** : après `outcome.ok` (l. 66-77), `await recordSearch(...)` dans un `try/catch` ignoré ; `user` est déjà récupéré l. 36-41. Aucun changement de statut ni de corps de réponse.
- `app/search/page.tsx` — **MODIFIER** : lire `?q=` en plus de `?category=` (l. 24-28) et charger l'historique côté serveur → props `initialQuery` et `initialHistory` à `SearchClient`.
- `components/search/search-client.tsx` — **MODIFIER** : prop `initialQuery`/`initialHistory`, état `history`, ajout optimiste après recherche réussie, rendu du bloc « Recherches récentes » sous le formulaire (rejeu + suppression), `search.module.css` étendu.
- `app/search/actions.ts` — **NOUVEAU** : `"use server"`, `deleteSearchHistoryAction(id)` : valide un uuid, appelle le store, `revalidatePath("/search")` et `revalidatePath("/history")`. Importé aussi par la page `/history`.
- `app/(dashboard)/history/page.tsx` — **MODIFIER** : seconde section « Recherches récentes » (max 10) avec lien de rejeu `/search?q=…` et bouton de suppression.
- `scripts/search-history.test.ts` + `package.json` — **NOUVEAU** : `test:search-history`, une assertion par ligne de matrice + audit statique de la migration 0007 (convention `scripts/search-rpc.test.ts`).

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/0007_search_history.sql` -- Table + index + RLS propriétaire, idempotente -- sans elle, toute la feature dégrade (ligne NO_MIGRATION).
- [ ] `lib/search/history.ts` -- Règles pures : normalisation, déduplication, tri + plafond, libellé de résultats -- chaque règle de la matrice est testable hors réseau.
- [ ] `lib/search/history-store.ts` -- Accès Supabase injecté : lecture, enregistrement best effort, suppression ; toute erreur renvoyée en booléen, jamais levée -- l'isolation reste à la RLS.
- [ ] `app/api/search/route.ts` -- Enregistrement après recherche réussie, dans un `try/catch` -- le seul point de capture, requête exacte + nombre réel de résultats.
- [ ] `app/search/page.tsx` + `components/search/search-client.tsx` + `search.module.css` -- Bloc « Recherches récentes » sous la barre : rejeu en un clic, suppression, ajout optimiste, état vide masqué -- AC d'affichage et de rejeu.
- [ ] `app/search/actions.ts` + `app/(dashboard)/history/page.tsx` + `history.module.css` -- Action de suppression partagée et seconde section dans `/history` -- AC « les deux écrans ».
- [ ] `scripts/search-history.test.ts` + `package.json` -- Tests hors réseau + audit de la migration ; script `test:search-history`.

**Acceptance Criteria:**
- Given une recherche réussie, when elle se termine, then une entrée conserve le texte exact, la date et le nombre de résultats, et apparaît sous la barre de recherche **et** dans `/history`.
- Given une recherche enregistrée, when l'utilisateur la rejoue, then la même requête est relancée sur l'état actualisé de la base.
- Given deux utilisateurs, when chacun ouvre les écrans, then chacun ne voit que ses propres recherches (RLS, aucun `owner_id` client).
- Given une entrée, when l'utilisateur la supprime, then elle disparaît des deux écrans et aucune autre entrée n'est affectée.
- Given la migration 0007 non appliquée, when l'utilisateur recherche, then la recherche fonctionne normalement et aucun message d'erreur n'apparaît.

## Implementation Notes

- 2026-09-27 — **Ligne NO_MIGRATION vérifiée en live avant migration** : `search_history` absente (PGRST205) → `GET /api/search` répond **HTTP 200 avec 2 résultats et sans erreur**, `/search` et `/history` répondent 200 sans la section historique. La dégradation est silencieuse, comme le veut la matrice.
- 2026-09-27 — Type du client du store : une interface structurelle à base de `any` échouait à la fois sur la variance de `tsc` (le `insert` generique de PostgEST n'est pas assignable) et sur la regle `no-explicit-any`. Remplacée par `Pick<SupabaseClient, "from">` (import de type seul, aucune dependance runtime).
- 2026-09-27 — `prependSearchItem` : le test a revele que l'ajout optimiste **remplace** l'entree precedente par le texte exact de la nouvelle recherche (« alpha » remplace « Alpha »). C'est le contrat du PRD (conserver la requete saisie) ; l'assertion a ete alignee sur ce comportement explicite.
- 2026-09-27 — **Parcours vérifié en live après la migration 0007** : (1) `procedure suivi projets clients` → entrée créée avec la requête exacte et `result_count = 2` ; (2) même requête relancée → **aucun doublon** (1 → 1) ; (3) `nexawork contact` → 2e entrée en tête ; (4) `/search` **et** `/history` exposent l'historique (HTTP 200) ; (5) lien de rejeu `/search?q=…` → barre **pré-remplie** et `/api/search` rejoue la requête (2 résultats) ; (6) suppression → ligne retirée, `/history` ne l'affiche plus, suppression acceptée par la RLS, 1 entrée restante.

## Plan Change Log

## Review Triage Log

- 2026-09-27 — Passe `thorough` (auto). **Lentilles sous-agent indisponibles** : revue sur les 10 fichiers du diff, croisée avec la matrice I/O, les AC et une vérification live complète. `NO_VCS`.
- Verdicts : high 0, medium 2, low 2, false 0, maybe-false 0.

| # | Finding | Verdict | Route | Evidence | Action |
|---|---------|---------|-------|----------|--------|
| 1 | Bouton de suppression rendu dans la page serveur `/history` : contrôle **mort**, aucun gestionnaire | medium | patch | `history/page.tsx` : `<button>` sans `onClick` dans un Server Component | Extrait dans `components/search/search-history-list.tsx` (client) qui appelle l'action serveur |
| 2 | Interface `SearchHistoryClient` à base de `any` : variance `tsc` + `no-explicit-any` | medium | patch | 2 erreurs TS sur `app/search/page.tsx`, 3 erreurs eslint | Type remplacé par `Pick<SupabaseClient, "from">` (import de type seul) |
| 3 | `SEARCH_HISTORY_MESSAGES.results` faisait doublon avec `formatResultCount` | low | patch | Deux formateurs du même libellé | Doublon supprimé, un seul point de format |
| 4 | Vérification live du rejeu fausse (attendait des résultats dans le HTML serveur) | low | patch | Les résultats sont rendus côté client après fetch | Vérification corrigée : requête pré-remplie + `/api/search` rejoué |

- 1 `defer` : politique de rétention de l'historique (Q-6 du PRD). Cf. `deferred-work.md`.
- Sans objet : la branche « liste vide » de `SearchHistoryList` n'est pas atteignable depuis `/history` (la section n'est rendue que s'il y a des entrées) — c'est une API de composant réutilisable, conservée volontairement.

## Design Notes

- **Enregistrement côté serveur** dans `/api/search` plutôt que côté client : un seul point de capture (toute surface qui interroge la route est historisée), et le nombre de résultats est exactement celui de la réponse envoyée à l'utilisateur.
- **Déduplication par la dernière entrée** : une lecture ciblée (`.order(created_at desc).limit(1)`) évite d'exploser le nombre d'écritures sans interdire de rejouer une recherche ancienne plus tard (qui crée alors une entrée à jour).
- **Numérotation de migration** : `0007` (le plus haut existant est `0006_message_meta.sql` ; noter que le dépôt contient deux fichiers `0005_` — collision historique à ne pas reproduire).
- **Pas de purge** : conforme au PRD (« le MVP peut démarrer sans purge automatique », Q-6), la décision de rétention est consignée en différé.

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur TS
- `npm run lint` -- expected: 0 erreur
- `npm run test:search-history` -- expected: tous verts
- `npm run test:search-ui && npm run test:search && npm run test:history` -- expected: non-régression

**Manual checks (if no CLI):**
- Après avoir joué 0007 : `/search` → une recherche laisse une trace ; rejouer une entrée relance la recherche ; la poubelle la retire ; `/history` affiche la même section.
- Sans 0007 : `/search` fonctionne, aucun historique affiché, aucune erreur console.

| RECORD_OK | recherche « vacances » ayant renvoyé 4 résultats | Entrée créée : texte exact, `created_at`, `result_count = 4` | Aucun impact sur la réponse |
| RECORD_SKIP | même requête relancée | Aucun doublon (comparaison à la dernière entrée) | Aucun |
| RECORD_SKIP_INVALID | `q` vide ou > 500 caractères | Rien n'est enregistré | Aucun |
| LIST | 12 entrées existantes | 10 entrées, tri décroissant, libellé « N résultats » | Aucun |
| REPLAY | clic sur une recherche passée | La requête repart dans la barre et relance un fetch sur l'état actuel | Aucun |
| DELETE | clic sur la poubelle | L'entrée disparaît des deux écrans | RLS : seul le propriétaire supprime |
| UNAUTH | session absente | Aucune lecture ni écriture, section masquée | Aucun |
| NO_MIGRATION | table `search_history` absente (0007 non jouée) | La recherche fonctionne normalement, historique masqué, **aucun 500** | Dégradation silencieuse |

</frozen-after-approval>
