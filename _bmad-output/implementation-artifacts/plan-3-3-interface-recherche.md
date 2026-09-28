---
title: '3.3 Interface Utilisateur de Recherche Documentaire Mobile et Desktop'
type: 'feature'
ticket: '3'
created: '2026-09-28'
status: 'done'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/EXPERIENCE.md`
  - `_bmad-output/initiative-nexamind-ai/epic-recherche-semantique/tickets.toml`
  - `_bmad-output/implementation-artifacts/plan-3-2-service-route-recherche.md`
  - `app/api/search/route.ts`
  - `lib/resources/validation.ts`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La route `/api/search` existe (story 3.2) mais aucun ecran ne l'exploite. Les collaborateurs ne peuvent pas interroger le fonds depuis mobile/desktop avec filtres et retours explicites.

**Approach:**
1. Creer la page `/search` (Server Component mince : lecture categorie initiale) + `components/search/search-client.tsx` (Client : saisie, debounce 300ms, fetch `/api/search`, filtres horizontaux Tous + 6 categories FR-5, cartes tactiles, etats chargement/vide/erreur+Reessayer).
2. Surlignage de l'extrait via `<mark>` (split insensible a la casse, echappement XSS par React).
3. Clic sur un resultat -> `/resources/[id]` si existant sinon lien neutre ; jamais d'ecran vide (aide + lien /chat).

## Boundaries & Constraints

**Always:**
- Tous roles authentifies (garde 1.3 : session requise ; pas de role admin).
- Filtres combinables au clic tactile, 44px mini, nav EXPERIENCE.md §1.
- Erreur reseau -> encadre + bouton Reessayer sans perdre la saisie.
- Requete vide -> pas de fetch, liste vide avec aide.
- FR-8 : titre, categorie, date, extrait exact sur chaque carte.

**Never:**
- Pas de cle cote navigateur (fetch vers /api/search uniquement).
- Pas de vecteur expose (reponse route deja filtree).
- Ne pas casser /api/search, embeddings, ingestion.
- Pas de SSR streaming bloquant (page charge vite, recherche cote client).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Saisie nominale | `q=teletravail` | fetch debounce, cartes triees | No error expected |
| Filtre categorie | clic `FAQ` | refetch avec category, filtre combine | Pas d'erreur |
| Zero resultat | RPC+texte vides | aide reformuler + lien assistant | Jamais d'ecran vide |
| Hors-ligne | fetch throw | encadre erreur + Reessayer (saisie gardee) | Bouton sans reload |
| 401 | session expiree | message reconnectez-vous + lien /login | Pas de stack |
| q > 500 | saisie longue | 400 route -> message FR | Pas de fetch inutile cote client si > 500 (validation) |
| XSS | extrait `<script>` | affiche en texte (React), mark sans HTML brut | Pas de dangerouslySetInnerHTML |

## Code Map

- `app/search/page.tsx` (nouveau) -- Server mince + metadata FR.
- `components/search/search-client.tsx` (nouveau) -- Client : saisie/debounce/fetch/filtres/cartes.
- `components/search/search.module.css` (nouveau) -- Charte Clean Tech Slate, mobile-first.
- `app/search/loading.tsx` (nouveau) -- Skeleton chargement route.
- `scripts/search-ui.test.ts` (nouveau) -- Pur : highlight + parse + URL builder.
- `package.json` (modifie) -- Script `test:search-ui`.

## Tasks & Acceptance

**Execution:**
- [x] `app/search/page.tsx` -- Server + Suspense vers client.
- [x] `components/search/search-client.tsx` -- Logique UI complete.
- [x] `components/search/search.module.css` -- Styles.
- [x] `app/search/loading.tsx` -- Skeleton.
- [x] `scripts/search-ui.test.ts` -- Tests purs hors-reseau.
- [x] `package.json` -- Script `test:search-ui`.

**Acceptance Criteria:**
- Given une saisie, when debounce 300ms, then fetch `/api/search?q=...&category=...`.
- Given des filtres, when clic tactile, then resultats filtres combines.
- Given zero resultat, when reponse vide, then aide + lien assistant (jamais vide).
- Given un clic resultat, when carte cilee, then ouvre `/resources/[id]`.
- Given une coupure reseau, when fetch echoue, then encadre + Reessayer.

## Implementation Notes

Categories : `["Tous", ...RESOURCE_CATEGORIES]`. Debounce via setTimeout + cleanup. AbortController pour annuler la requete precedente. Surlignage : fonction pure `highlightParts(excerpt, query)` retournant segments {text, hit}. URL : `buildSearchUrl(q, category, limit)` pure et testee.

## Verification

**Commands:**
- `npm run test:search-ui` -- exit 0.
- `npm run test:search` -- exit 0 (non-regression).
- `npm run test:search-rpc` -- exit 0 (non-regression).
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0.
- `npm run build` -- exit 0.
