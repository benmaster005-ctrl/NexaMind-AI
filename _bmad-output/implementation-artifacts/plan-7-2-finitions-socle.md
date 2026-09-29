---
title: 'Story 7.2 — Finitions du socle visuel : police, icône de fermeture, pastille sémantique, échelle d''espacement'
type: 'feature'
ticket: '7.2'
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

**Problem:** quatre écarts mesurés subsistaient après le lot 1. (1) `app/layout.tsx` chargeait Geist via `next/font/google` et posait `--font-geist-sans/-mono` : aucune de ces variables n'était consommée, la police était donc téléchargée pour rien et la charte impose la pile système (DESIGN.md §3). (2) Le jeu d'icônes du socle n'exposait pas d'icône de fermeture, alors que trois contrôles affichent un glyphe texte (`↑`, `✕`). (3) DESIGN.md §5 spécifie des pastilles de statut colorées, mais `Badge` n'avait qu'une variante neutre et les tokens `--success-*` n'existaient pas. (4) Neuf modules CSS gardaient des valeurs littérales de rayon, de taille de police et d'espacement qui dupliquaient exactement un token.

**Approach:** retirer la police externe, compléter le jeu d'icônes, doter la pastille de trois variantes sémantiques adossées à des tokens (succès ajouté en clair et en sombre), et ramener les valeurs littérales sur l'échelle de la charte — sans créer aucun token hors échelle.

## Boundaries & Constraints

**Always:**
- Les tokens de `globals.css` restent la source unique ; aucun token inventé hors de l'échelle de DESIGN.md.
- Aucune dépendance nouvelle ; aucune couleur nouvelle dans un module.
- Non-régression : les 293 assertions antérieures restent vertes sans modification.

**Never:**
- Aucun changement de logique, de route, de texte visible ou de contrat API.
- Aucune extraction de composant réservée aux stories 7.5 à 7.9 (recettes de boutons locales conservées).
- Aucun remplacement des glyphes `↑`/`✕` par l'icône : l'usage appartient à 7.6 (assistant) et 7.7 (recherche) — cette story ne fournit que l'icône.

## Code Map

- `app/layout.tsx` — **MODIFIÉ** : import `next/font/google` retiré (aucune police chargée).
- `app/globals.css` — **MODIFIÉ** : `--success-subtle`, `--success-border`, `--success-text` en clair et en sombre (DESIGN.md §2 `semantic.success`).
- `components/ui/icon.tsx` + `lib/dashboard/helpers.ts` — **MODIFIÉS** : icône `close` ajoutée au jeu et à `IconName`.
- `components/ui/badge.tsx` + `ui.module.css` — **MODIFIÉS** : `variant` optionnel (`success`, `warning`, `danger`), neutre par défaut, jamais l'accent.
- 9 modules CSS (**MODIFIÉS**) : `history`, `resource-fiche`, `auth`, `chat`, `resource-item`, `summary-sheet`, `upload-form`, `search-history-list`, `search` — rayon, taille de police et espacement passés aux tokens quand la valeur correspond exactement à l'échelle.
- `scripts/ui-system.test.ts` — **MODIFIÉ** : 5 assertions nouvelles (police, icône, pastille, tokens de succès, non-duplication des valeurs littérales).

## Tasks & Acceptance

**Execution:**
- [x] `app/layout.tsx` — plus aucune police externe.
- [x] `app/globals.css` — tokens de succès (clair + sombre).
- [x] `components/ui/icon.tsx`, `lib/dashboard/helpers.ts` — icône `close`.
- [x] `components/ui/badge.tsx`, `ui.module.css` — variantes sémantiques.
- [x] 9 modules CSS — conversion rayon / police / espacement.
- [x] `scripts/ui-system.test.ts` — audit étendu.

**Acceptance Criteria:**
- Aucun `next/font` ni `--font-geist-*` : la pile `system-ui` est la seule source de police.
- `.badgeSuccess|Warning|Danger` existent, consomment les tokens sémantiques et n'utilisent jamais l'accent.
- `--success-*` : une valeur claire, une valeur sombre, exactement.
- Aucune valeur littérale de `border-radius`, `font-size`, `padding`, `margin`, `gap` ne duplique un token dans les modules CSS de `app/` et `components/`.
- Les 293 assertions antérieures restent vertes.

## Implementation Notes

- Les valeurs **hors échelle** restent littérales et assumées : `0.0625rem`, `0.125rem`, `0.25rem`, `0.375rem`, `0.625rem`, `0.875rem`, rayon `1rem`, dimensions en `px`. Aucun token n'est créé pour elles : la charte n'en définit pas et l'audit ne les refuse pas.
- Deux tailles de police hors échelle ont été ramenées à l'échelle : `0.8125rem` → `--fs-sm` (14px) et `0.9375rem` → `--fs-base` (16px). Effet réel : ces textes gagnent 1 px, ce qui va dans le sens de la charte (« corps de texte 16px minimum »). C'est le seul effet visuel de cette story.
- La conversion a été appliquée par un script déterministe (propriété → famille de token), puis vérifiée par diff et par l'assertion de non-duplication : aucune substitution approximative.
- `--radius-full` (déjà déclaré) a servi pour les pastilles `9999px` : aucun token en double n'a été ajouté.

## Verification

**Réellement exécuté (2026-09-29) :**
- `npm test` — **298/298 verts, 70 suites** (5 assertions ajoutées, 0 assertion antérieure modifiée).
- `npm run lint` — **0 erreur, 0 avertissement**.
- `npm run typecheck` — `next typegen` + `tsc --noEmit` : **aucune erreur**.
- `npm run build` — **succès** : 12 routes compilées (`/`, `/api/chat`, `/api/search`, `/chat`, `/chat/[id]`, `/documents`, `/history`, `/login`, `/register`, `/resources/[id]`, `/search`, `/_not-found`) + `Proxy (Middleware)`.

**Non exécuté :** contrôles visuels (aucun navigateur disponible) et validations live (`validate:mvp-live`, `validate:chat-live` : serveur et compte réels requis — story 7.10).

**Risque résiduel assumé :** l'effet des deux tailles de police ramenées à l'échelle (`0.8125rem` → 14px, `0.9375rem` → 16px) est à confirmer à l'œil.
