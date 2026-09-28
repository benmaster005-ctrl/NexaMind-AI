---
title: 'Story 7.1 — Socle visuel : tokens, thème sombre, primitives et shell'
type: 'feature'
ticket: '7.1'
created: '2026-09-27'
status: 'draft'
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

**Problem:** le design system est spécifié (`DESIGN.md` §1-6) mais le rendu s'en écarte sur sept points mesurés : `app/globals.css` est resté le **boilerplate Next.js** (Arial, `#ffffff`), **aucun token CSS n'existe** (les 25 hex de la charte sont recopiés dans ~10 modules), **4 écrans ignorent le thème sombre** (fiche document, tiroir de résumé, historique, liste des recherches), la navigation affiche des **emoji**, les pastilles de statut spécifiées sont absentes, 8 recettes de boutons coexistent pour 3 rôles, et le markup de navigation est **dupliqué dans 7 pages**.

**Approach:** des tokens en variables CSS (clair + sombre) deviennent la source unique ; des primitives partagées (bouton, carte, état vide, icône SVG) et `<AppNav>` remplacent les duplications ; chaque module migre ses couleurs vers les tokens, rendant le thème sombre automatique partout.

## Boundaries & Constraints

**Always:**
- Les tokens de `DESIGN.md` sont la seule source des couleurs, rayons et espacements ; aucune valeur hex de charte recopiée dans un module.
- Thème suivant l'OS (`prefers-color-scheme`), sans bascule manuelle ni JavaScript.
- Aucune dépendance nouvelle : CSS Modules seuls (ni Tailwind, ni librairie de composants), icônes SVG dessinées à la main.
- Primitives **sans état** (aucun `"use client"`) pour rester utilisables en composants serveur.
- Cibles tactiles ≥ 44px, contraste lisible en clair comme en sombre, `aria-current` sur l'onglet actif.
- **Accent sobre (arbitrage humain du 2026-09-27)** : la couleur primaire est réservée aux actions primaires et à l'onglet actif ; badges, tags, métadonnées et boutons secondaires sont neutres.
- Non-régression : libellés de navigation et rôles inchangés (`test:dashboard` passe sans modification d'assertion).

**Never:**
- Aucun changement de layout des écrans de contenu, de gestion ou d'authentification (lots 2 à 4 différés).
- Aucune modification de logique métier, de route ou de texte visible (hors libellés inchangés).
- Pas de pastille de statut : elle appartient au lot 3, avec son premier consommateur (liste de gestion).
- Aucun emoji dans l'interface.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| THEME_LIGHT | OS en clair | Tous les écrans rendent la palette claire de la charte | Aucun |

## Code Map

- `app/globals.css` — **RÉÉCRIRE** : tokens `DESIGN.md` en variables CSS (`:root` clair + override `prefers-color-scheme: dark`), pile `system-ui`, `body` 16px, anneau de focus unique, `::selection`, `prefers-reduced-motion`. Source unique : aucun autre module ne déclare de couleur.
- `components/ui/ui.module.css` + `button.tsx` + `card.tsx` + `empty-state.tsx` + `icon.tsx` — **NOUVEAUX** : primitives sans état en `var(--…)`. `icon.tsx` = SVG au trait 1,5px `currentColor` (accueil, recherche, assistant, historique, réglages, envoi, fermeture, document, chevron), `aria-hidden`.
- `components/ui/app-nav.tsx` — **NOUVEAU** : navigation dupliquée dans 7 pages ; props `items` (de `getNavItems`), `active` (href) ; barre basse mobile 64px + zone sûre, sidebar desktop, `aria-current`, cibles 44px.
- `lib/dashboard/helpers.ts` — **MODIFIER** : `NavItem.icon` passe de l'emoji à une clé typée `IconName` ; libellés inchangés.
- `components/dashboard/dashboard.module.css` — **MODIFIER** : garde `page`/`inner`/`card`/`cardTitle` en tokens ; classes de navigation déplacées vers `app-nav`.
- 7 pages (`<nav>` → `<AppNav>`) : `app/page.tsx`, `app/chat/page.tsx`, `app/chat/[id]/page.tsx`, `app/search/page.tsx`, `app/(dashboard)/history/page.tsx`, `app/(dashboard)/admin/resources/page.tsx`, `app/(dashboard)/resources/[id]/page.tsx`.
- À migrer vers les tokens (**couleurs seules**) : `components/chat/chat.module.css` (+ 3 styles inline de `chat-client.tsx` → classes), `components/search/{search,search-history-list}.module.css`, `components/resources/{resource-item,upload-form,summary-sheet}.module.css`, `components/auth/auth.module.css`, `app/page.module.css`, `app/(dashboard)/history/history.module.css`, `app/(dashboard)/resources/[id]/resource-fiche.module.css`. Blocs `prefers-color-scheme` manuels supprimés.
- `scripts/ui-system.test.ts` + `package.json` — **NOUVEAUX** : `test:ui-system` (tokens déclarés une fois, aucune couleur en dur dans les modules, aucun emoji, `<AppNav>` dans les 7 pages, aucun style inline).

## Tasks & Acceptance

**Execution:**
- [ ] `app/globals.css` -- Tokens clair/sombre, typographie de la charte, focus et reduced-motion -- source unique ; corrige le boilerplate Next.
- [ ] `components/ui/*` -- Primitives partagées sans état, en tokens -- supprime 8 recettes de boutons.
- [ ] `components/ui/app-nav.tsx` + `lib/dashboard/helpers.ts` -- Navigation unique à icônes sobres -- supprime la duplication sur 7 pages et les emoji.
- [ ] 7 pages + `components/dashboard/dashboard.module.css` -- Brancher `<AppNav>` et les primitives, contenu intact -- shell cohérent.
- [ ] 10 modules listés -- Couleurs vers les tokens, blocs sombres manuels retirés -- thème sombre automatique partout.
- [ ] `scripts/ui-system.test.ts` + `package.json` -- Audit statique du socle + `test:ui-system`.

**Acceptance Criteria:**
- Given un OS en mode sombre, when n'importe quel écran s'ouvre (dont fiche document, tiroir de résumé, `/history`, liste des recherches), then la palette sombre s'applique partout, sans zone restée claire.
- Given n'importe quel écran, when on inspecte les styles, then chaque couleur, rayon et espacement vient d'une variable CSS déclarée une seule fois d'après `DESIGN.md`.
- Given la navigation mobile et desktop, when l'utilisateur la parcourt, then icônes SVG sobres, onglet actif marqué (`aria-current`), cibles ≥ 44px, 4e onglet dépendant du rôle.
- Given un bouton primaire, secondaire et danger, when ils apparaissent sur deux écrans, then leur rendu est identique.
- Given JavaScript désactivé, when la page se charge, then thème, tokens et icônes restent corrects.
- Given la suite complète, when elle est rejouée, then les 19 suites, `validate:mvp-live` (56/56) et `validate:chat-live` (14/14) restent vertes.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

- Tokens dans `globals.css` (déjà importé par `app/layout.tsx`) plutôt qu'un `tokens.css` séparé : aucun import à ajouter, donc aucun oubli possible.
- Le thème sombre **découle** des tokens : les modules consomment `var(--surface)` au lieu de `#f8fafc`. C'est ce qui supprime la cause racine de l'écart n°1 au lieu de recoller chaque écran.
- Icônes SVG au trait plutôt qu'une dépendance : sobres, sans réseau, l'état actif se colore via `currentColor`.
- `<AppNav>` plutôt qu'une classe partagée : la duplication est du markup (7 copies), pas seulement du style.

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur TS
- `npm run lint` -- expected: 0 erreur
- `npm run test:ui-system` -- expected: tous verts
- `npm run test:dashboard`, `npm run test:chat-ui`, `npm run test:search-ui` -- expected: assertions existantes inchangées et vertes
- `npm run validate:mvp-live` -- expected: 56/56

**Manual checks (if no CLI):**
- OS en sombre : parcourir `/`, `/search`, `/chat`, `/history`, une fiche document, `/admin/resources` — aucune zone claire résiduelle.
- Deux boutons de même rôle sur deux écrans : rendu identique.

| THEME_DARK | OS en sombre | **Tous** les écrans rendent la palette sombre, dont les 4 qui l'ignoraient | Aucun |
| NAV_ACTIVE | page courante | Onglet actif marqué (couleur primaire + `aria-current="page"`), cible 44px | Aucun |
| NAV_ROLE | collaborateur / admin | 4e onglet Historique / Gérer (comportement inchangé) | Aucun |
| PRIMITIVES | bouton primaire, secondaire, danger ; carte ; état vide | Rendu identique d'un écran à l'autre (une recette par rôle) | Aucun |
| NO_JS | JavaScript désactivé | Tokens, thème et icônes fonctionnent (CSS seul) | Aucun |

</frozen-after-approval>
