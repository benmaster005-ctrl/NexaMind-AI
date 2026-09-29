---
title: 'Story 7.3 — En-tête et navigation harmonisés : un seul h1 par écran'
type: 'feature'
ticket: '7.3'
created: '2026-09-29'
status: 'built'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: []
---

## Intent

**Problem:** chaque écran rendait son titre de page à sa manière. `/documents` avait un `<header>` maison avec `<h1 className={...brand}>` **et** un lien « ← Accueil » qui contournait `AppNav` ; `/search` et `/history` n'avaient aucun `h1` (leur « titre » était un `CardTitle`, donc un `h2`) ; l'`<h1>` d'Assistant vivait dans le corps du composant client du chat avec son sous-titre local. Le style du titre dépendait de `.brand` de `dashboard.module.css`, et les métadonnées de résultats de recherche séparaient catégorie, date et nature du match par un tiret simple (` - `) alors que le reste de l'application utilise le point médian (`·`).

**Approach:** un composant sans état `PageHeader` (titre = `h1` unique de l'écran, description optionnelle, actions à droite) posé au sommet de chaque écran, `CardTitle` réservé au `h2` des sections, suppression des en-têtes dupliqués et des raccourcis de navigation locaux, et alignement du séparateur de métadonnées sur `·`.

## Boundaries & Constraints

**Always:**
- Un seul `h1` par écran, rendu exclusivement par `PageHeader` ; `CardTitle` reste le `h2` des sections.
- Composant sans état : utilisable depuis un Server Component, aucun JS client ajouté.
- Le titre de page ne dépend plus de `dashboard.module.css` : il vit dans `ui.module.css` sur l'échelle du socle (`--fs-xl`, `--fw-semibold`, `--text-muted`, `--space-*`).
- Non-régression : routes, données, contrats API et textes de navigation inchangés, hors suppression du lien « ← Accueil ».

**Never:**
- Pas de remaniement du bandeau du tableau de bord (`app/page.tsx`) : hors périmètre, revient en story 7.4.
- Pas de remplacement des glyphes `↑`/`✕` ni de conversion des recettes de boutons (7.6, 7.7, 7.8).
- Aucune dépendance nouvelle.

## Code Map

- `components/ui/page-header.tsx` — **NOUVEAU** : `PageHeader` (`title`, `description?`, `actions?`, `className?`), stateless, `<h1 className={styles.pageHeaderTitle}>`.
- `components/ui/ui.module.css` — **MODIFIÉ** : bloc `.pageHeader` / `.pageHeaderText` / `.pageHeaderTitle` / `.pageHeaderDescription` / `.pageHeaderActions` (flex-wrap : sur écran étroit les actions passent sous le titre).
- 6 écrans (**MODIFIÉS**) : `app/search/page.tsx`, `app/chat/page.tsx`, `app/chat/[id]/page.tsx`, `app/(dashboard)/history/page.tsx`, `app/(dashboard)/documents/page.tsx`, `app/(dashboard)/resources/[id]/page.tsx` — `<PageHeader>` en tête de `dashboardStyles.inner`.
- `app/(dashboard)/documents/page.tsx` — `<header>` maison remplacé, lien « ← Accueil » supprimé, imports `Link` et `buttonClass` retirés ; `Badge` « Partagé » passé en `actions`.
- `app/(dashboard)/history/page.tsx` — `CardTitle` « Historique » cède la place à `PageHeader` ; « Recherches récentes » reste un `h2` de section.
- `components/search/search-client.tsx` — `CardTitle` « Recherche » supprimé (la page rend le `h1`), import retiré, séparateur ` - ` → ` · `.
- `app/(dashboard)/resources/[id]/page.tsx` — titre du document (`resource.title`) déplacé de la carte vers l'en-tête ; `CardTitle` conservé pour « Contenu ».
- `components/chat/chat-client.tsx` + `components/chat/chat.module.css` — bloc `<header>` (`h1` + sous-titre) supprimé, règles `.header`, `.title`, `.subtitle` retirées.
- `components/dashboard/dashboard.module.css` — `.header` et `.brand` supprimés (plus aucun consommateur).
- `scripts/ui-system.test.ts` — **MODIFIÉ** : bloc « story 7.3 » (6 tests) ; seuil `@/components/ui/button` passé de 3 à 2 consommateurs (le lien « ← Accueil » supprimé était l'un des trois).

## Tasks & Acceptance

**Execution:**
- [x] `components/ui/page-header.tsx` + `ui.module.css` — composant d'en-tête et ses styles.
- [x] 6 écrans — `PageHeader` en tête, un `h1` chacun, aucun `h1` en dur.
- [x] `/documents` — plus de lien vers `/`, plus de recette `buttonClass`, plus de `.brand`.
- [x] `/search` et `/history` — plus de `CardTitle` comme titre de page.
- [x] `chat-client` + `chat.module.css` — en-tête client supprimé, styles associés retirés.
- [x] `dashboard.module.css` — `.header` et `.brand` supprimés.
- [x] `search-client` — séparateur de métadonnées unique `·`.
- [x] `scripts/ui-system.test.ts` — audit étendu (6 assertions).

**Acceptance Criteria:**
- Chaque écran applicatif rend exactement un `h1` via le composant d'en-tête ; `/search` et `/history` n'utilisent plus `CardTitle` comme titre de page.
- L'en-tête de `/documents` ne contient plus de lien vers `/`.
- Le style de titre de page ne dépend plus de `dashboard.module.css` `.brand`.
- Un seul caractère séparateur de métadonnées (`·`) sur tous les écrans.
- Un seul système d'en-tête : `h1` de page (`PageHeader`) + `h2` de section (`CardTitle`).
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` verts.

## Implementation Notes

- **`h1` / `h2`** : `PageHeader` rend le `h1`, `CardTitle` reste un `h2` (`components/ui/card.tsx` inchangé). Aucun écran ne rend d'`h1` en dur : l'invariant est testé.
- **Sous-titre du chat** : « Réponses fondées sur les documents internes — avec citations. » disparaît du corps du fil ; la description de l'en-tête (« Posez vos questions : les réponses s'appuient sur vos documents internes, avec citations. ») le remplace, formulée pour le lecteur qui arrive sur l'écran.
- **Titre de la fiche document** : `resource.title` est rendu par `PageHeader` ; la carte conserve la ligne `catégorie · statut · date` (aucune duplication du titre, `CardTitle` reste utilisé pour « Contenu »).
- **Tableau de bord** (`app/page.tsx`) : hors périmètre (story 7.4) — son `h1` de bandeau reste en place et l'écran n'est pas dans la liste couverte par l'audit.
- **Seuil `buttonClass`** : ajusté de 3 à 2 avec commentaire, plutôt qu'un bouton artificiel ajouté pour satisfaire un compteur.

## Verification

**Réellement exécuté (2026-09-29) :**
- `npm test` — **304/304 verts, 71 suites** (6 assertions ajoutées pour la 7.3, 1 seuil ajusté, 0 assertion antérieure supprimée).
- `npm run lint` — **0 erreur**.
- `npm run typecheck` — `next typegen` + `tsc --noEmit` : **aucune erreur**.
- `npm run build` — **succès** (`Compiled successfully`).

**Non exécuté :** contrôles visuels (aucun navigateur disponible) et validations live (`validate:mvp-live`, `validate:chat-live` : serveur et compte réels requis — story 7.10).

**Risque résiduel assumé :** le sous-titre d'Assistant disparaît du fil de conversation (remplacé par la description d'en-tête) — effet visuel à confirmer à l'œil.

