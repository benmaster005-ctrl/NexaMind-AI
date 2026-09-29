---
title: 'Story 7.4 — Tableau de bord : finalisation (états, accessibilité, densité)'
type: 'feature'
ticket: '7.4'
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

**Problem:** le tableau de bord livré le 2026-09-29 (`c1f4172`) restait à finaliser sur trois plans. (1) Son bandeau (`<section>` avec `<h1>` et sous-titre locaux) était hors du composant d'en-tête unifié — la story 7.3 l'avait explicitement reporté ici. (2) Une lecture en échec dégradait mal : les colonnes Documents et Conversations affichaient leur état vide (« Aucun document pour le moment… ») alors que la donnée n'était pas absente mais indisponible, la signalisation reposant sur une bannière globale en bas de page — hors de la colonne concernée, contrairement à l'AC. (3) Trois cibles tactiles restaient sous le plancher de 44 px : les onglets de l'en-tête horizontal (`.topItem` 36 px, 40 sur desktop), la déconnexion (`.accountSignOut` 28 px) et l'envoi du composeur (`.askSubmit` 40 px) ; les cartes raccourcis n'exprimaient aucun plancher.

**Approach:** le bandeau est rendu par `PageHeader` (le composant du socle — un seul mécanisme de `h1` sur l'application) et ses styles locaux sont effacés ; chaque colonne lit la base via des flags `documentsFailed` / `conversationsFailed` et affiche, en cas d'échec, un message `role="status"` **dans la colonne**, l'état vide restant réservé aux vraies listes vides — la bannière globale disparaît ; le compteur de documents prêts, en échec, continue de disparaître silencieusement (AC) ; les cibles nommées par le ticket passent à 44 px et un plancher exprimé (`min-height: 44px`) est posé sur les cartes d'action. Six tests d'audit verrouillent les AC, l'écran rejoint l'audit `h1`/`PageHeader` de la 7.3.

## Boundaries & Constraints

**Always:**
- Données et permissions inchangées : mêmes lectures Supabase (mêmes tables, colonnes, limites), même RLS, aucune API ni requête ajoutée.
- Aucun JavaScript client : la recherche reste un `GET /search` natif (bouton + Entrée) et le composeur un `GET /chat?q=` — zéro `fetch`, zéro gestionnaire d'événement.
- Chaque colonne affiche des données réelles, un état vide explicite ou un message d'indisponibilité — jamais de donnée factice, jamais de page blanche.
- CSS ajouté ou modifié uniquement en tokens (`--space-*`, `--radius-*`, les couleurs de la charte) : le thème clair/sombre reste automatique.
- Un seul `h1` par écran, rendu par `PageHeader` : le tableau de bord rejoint la règle de la 7.3.

**Never:**
- Pas de `loading.tsx` : placé à la racine `app/`, il créerait une frontière de chargement **globale** sur tous les écrans — décision documentée en Implementation Notes.
- Pas de réécriture de `listSearchHistory` (story 5.3) : son contrat « ne lève jamais, table absente → liste vide » prime ; la colonne Recherches garde sa dégradation silencieuse.
- Pas de changement de densité des entêtes de panneau : `.seeAll` (« Voir tout ») reste un lien texte — son plancher 44 px est reporté (voir deferred-work).
- Pas de migration, pas de changement `lib/**`, RLS ou limites d'upload.
- Aucune dépendance nouvelle.


## Code Map

- `app/page.tsx` — **MODIFIÉ** : import `PageHeader` ; bandeau `<section .intro>` remplacé par `<PageHeader title description>` ; `degraded` global remplacé par `documentsFailed` / `conversationsFailed` (assignés dans les `try/catch` respectifs) ; message `styles.degraded` `role="status"` rendu **dans** les colonnes Documents et Conversations (avant l'état vide) ; catch du compteur redevenu silencieux ; bannière globale en bas de page supprimée.
- `components/dashboard/dashboard-home.module.css` — **MODIFIÉ** : règles orphelines `.intro`, `.title`, `.subtitle` effacées ; `.accountSignOut` 28 → 44 px ; `.askSubmit` 40 → 44 px ; `.actionCard` : `min-height: 44px` (plancher exprimé, commentaire AC).
- `components/ui/ui.module.css` — **MODIFIÉ** : `.topItem` `min-height` 36 → 44 px (commenté) ; override `@media (min-width: 1024px) { .topItem { min-height: 40px } }` supprimé (redondant).
- `scripts/ui-system.test.ts` — **MODIFIÉ** : `app/page.tsx` ajouté à `HEADER_SCREENS` (audit h1 unifié de la 7.3) ; test « structure attendue » cible `<PageHeader>` au lieu de `styles.title` ; nouveau bloc **« story 7.4 »** (6 tests : bandeau, dégradation par colonne, compteur, formulaires natifs, cibles 44 px, ordre de tabulation).
- `_bmad-output/implementation-artifacts/deferred-work.md` — **MODIFIÉ** : résidu `.seeAll` ouvert pour la 7.10.

## Tasks & Acceptance

**Execution:**
- [x] `app/page.tsx` — bandeau via `PageHeader` ; flags de dégradation par colonne ; messages `role="status"` dans les colonnes ; bannière globale supprimée ; compteur silencieux en échec.
- [x] `dashboard-home.module.css` — `.intro`/`.title`/`.subtitle` effacés ; `.accountSignOut` et `.askSubmit` à 44 px ; plancher `min-height: 44px` sur `.actionCard`.
- [x] `ui.module.css` — onglets `.topItem` à 44 px (base) ; override desktop 40 px supprimé.
- [x] `ui-system.test.ts` — 6 tests d'audit ajoutés ; écran ajouté à l'audit h1 ; test de structure mis à jour.
- [x] `deferred-work.md` — résidu `.seeAll` documenté (ouvert, gate 7.10).

**Acceptance Criteria:**
- Trois colonnes : données réelles, état vide explicite, ou message d'indisponibilité **dans la colonne** — une lecture en échec ne dégrade jamais la page.
- Recherche soumise par bouton et par clavier sans JavaScript (`GET /search`, formulaire natif).
- Composeur transmet la question à `/chat?q=` sans nouvel appel réseau.
- Aucun compteur inventé : total `count: "exact", head: true` issu de la base ; échec → le chiffre disparaît (aucune valeur zéro affichée).
- Cibles tactiles ≥ 44 px sur les onglets, les raccourcis et la zone de compte (testées).
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` verts.

## Implementation Notes

- **État de chargement (vérifié, sans action) :** la page est un Server Component sans `fetch` client ; la navigation affiche l'état natif de Next jusqu'au rendu. Pas de `loading.tsx` : enraciné dans `app/`, il s'appliquerait à **tous** les écrans — effet global non demandé par le ticket. Les quatre lectures restent séquentielles (4 allers-retours Supabase, ordre de grandeur des dizaines de ms) : un `Promise.all` a été écarté pour cette story de vérification (hors AC, gain marginal, réécriture des `try/catch` isolés).
- **Contrat des Recherches :** `listSearchHistory` ne lève jamais et renvoie `[]` en cas d'erreur comme de table absente (migration 0007) — la colonne ne peut pas distinguer les deux, par conception (même contrat que `/search`). Sa dégradation reste silencieuse et documentée.
- **Compteur en échec :** disparaît silencieusement, sans message (AC explicite : « le chiffre disparaît au lieu d'afficher zéro ») — le `catch` est vide, commenté.
- **`.seeAll` < 44 px (résidu ouvert) :** le ticket nomme trois cibles (onglets, raccourcis, zone de compte), toutes portées à 44 px ; les liens « Voir tout » sont des textes liés d'une vingtaine de pixels. Les porter à 44 px agrandirait les entêtes des trois panneaux — un changement de densité non demandé → `deferred-work.md` pour la 7.10.
- **Plancher sur `.actionCard` :** la carte mesure ~200 px de haut ; le `min-height: 44px` ne change rien au rendu mais rend l'AC auditable (la même méthode que les autres modules du socle).
- **Décision G-3 :** l'arbitrage « quatre cartes d'action » est celui livré et il reste verrouillé par le test « structure attendue » (4 blocs, libellés imposés).
- **Bandeau :** le rendu passe de `--fw-medium` (local) à `--fw-semibold` (`PageHeader`) et l'écart titre/sous-titre de 8 → 4 px ; la taille reste `--fs-xl` (« titre discret » de la maquette de référence, cf. en-tête du module CSS) — l'échelle du socle est donc cohérente avec la 7.3.

## Verification

**Réellement exécuté (2026-09-29) :**
- `npm test` — **310/310 verts, 72 suites** (6 tests ajoutés pour la 7.4, 2 tests existants mis à jour, 0 assertion antérieure supprimée).
- `npm run lint` — **0 erreur**.
- `npm run typecheck` — `next typegen` + `tsc --noEmit` : **aucune erreur**.
- `npm run build` — **succès** (12 routes générées, `/` server-rendered).

**Non exécuté :** contrôles visuels (aucun navigateur disponible : rendu du bandeau via `PageHeader`, hauteur des entêtes de panneau) et validations live (`validate:mvp-live`, `validate:chat-live` : serveur et compte réels requis — story 7.10).

**Risque résiduel assumé :** le bandeau gagne en graisse (`--fw-semibold`) et se rapproche de son sous-titre (4 px) ; les onglets et la déconnexion sont plus grands au toucher — effet visuel à confirmer à l'œil.
