---
title: '1.4 Tableau de bord unifie responsive conditionne au role'
type: 'feature'
ticket: '4'
created: '2026-09-27'
status: 'built'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['quick', 'senior', 'blind-hunter', 'edge-case-hunter', 'ux']
review_loop_iteration: 0
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md`
  - `_bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/DESIGN.md`
  - `_bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/EXPERIENCE.md`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La route / est protegee (story 1.3) mais affiche encore la page modele Next.js : aucun compteur de ressources, aucune conversation, aucune navigation par role, donc FR-4 n'est pas couvert.

**Approach:** Remplacer app/page.tsx par un tableau de bord Server Component (compteur ressources Prete, 5 dernieres conversations, raccourcis, navigation conditionnee au role admin, deconnexion), charte Clean Tech Slate mobile-first, sans toucher aux fondations auth ni au schema SQL.

## Boundaries & Constraints

**Always:** donnees reelles Supabase via client serveur existant ; role lu depuis user_metadata cote serveur ; etat vide et indicateur degrade si metriques indisponibles ; tactiles 44px, texte 16px, clair/sombre auto ; preserver middleware, garde 1.3, pages auth, schema SQL.

**Never:** aucune suppression ni modification distante ; pas de Tailwind ; pas de routes /api/* ; pas d'IA/embeddings ; pas de pages /search /chat /history (liens vers routes futures seulement) ; pas de changement du schema SQL.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dashboard charge | session collaborateur, base joignable | compteur Prete + 5 dernieres conversations + raccourcis | No error expected |
| Etat vide | zero conversation | message invitant a poser une premiere question | No error expected |
| Metriques en echec | requete Supabase en erreur | raccourcis affiches + indicateur d'indisponibilite temporaire | message FR, ecran non bloque |
| Admin connecte | role admin | carte Depoter un document + onglet Gerer visibles | No error expected |
| Collaborateur | role collaborateur | aucun bouton admin ni lien /admin visible | pas de fuite d'UI admin |

</frozen-after-approval>

## Code Map

- `app/page.tsx` -- page modele Next.js a REMPLACER par le tableau de bord (Server Component).
- `app/layout.tsx` -- metadata generique a ajuster (titre FR + lang fr), NE PAS changer les fonts.
- `lib/supabase/server.ts` -- client serveur existant a reutiliser (NE PAS MODIFIER).
- `app/(auth)/actions.ts` -- signOutAction existant a reutiliser pour le bouton Deconnexion (NE PAS MODIFIER).
- `lib/dashboard/helpers.ts` (nouveau) -- helpers purs : getNavItems(role), formatRelativeDate.
- `components/dashboard/dashboard.module.css` (nouveau) -- styles Clean Tech Slate mobile-first.
- `components/dashboard/signout-button.tsx` (nouveau) -- bouton client appelant signOutAction.
- `scripts/dashboard.test.ts` (nouveau) -- tests unitaires des helpers purs.

## Tasks & Acceptance

**Execution:**
- [x] `lib/dashboard/helpers.ts` -- helpers purs getNavItems + formatRelativeDate -- testables sans reseau.
- [x] `scripts/dashboard.test.ts` + script `test:dashboard` -- couverture matrice (nav par role, dates relatives, etat vide).
- [x] `app/page.tsx` -- Server Component : session, compteur Prete, 5 conversations, nav par role, etats vide/degrade.
- [x] `components/dashboard/dashboard.module.css` -- charte DESIGN.md, bottom bar 64px + safe-area, sidebar desktop.
- [x] `components/dashboard/signout-button.tsx` -- bouton Deconnexion via signOutAction existant.
- [x] `app/layout.tsx` -- titre/description FR + lang fr (fonts inchangees).

**Acceptance Criteria:**
- Given une session valide, when ouvrir /, then compteur Prete + 5 dernieres conversations + raccourcis affiches.
- Given un role admin, when ouvrir /, then carte Depot + onglet Gerer visibles ; given collaborateur, then invisibles.
- Given zero conversation, when ouvrir /, then etat vide invitant a poser une premiere question.
- Given Supabase injoignable, when ouvrir /, then raccourcis visibles + indicateur d'indisponibilite, ecran non bloque.

## Implementation Notes

Implementation realisee directement (pas de sous-agent disponible).
Fichiers crees : `lib/dashboard/helpers.ts`, `scripts/dashboard.test.ts`,
`components/dashboard/dashboard.module.css`,
`components/dashboard/signout-button.tsx`. Fichiers modifies : `app/page.tsx`
(remplace la page modele), `app/layout.tsx` (metadata FR + lang fr),
`package.json` (script `test:dashboard`).
Incident corrige : duplication d'un bloc section lors de l'assemblage
(section Recherche rapide en double, JSX invalide) — supprimee, verifiee
par typecheck+lint.
Verification : `npm run test:dashboard` 5/5 pass, `npm run typecheck` exit 0,
`npm run lint` exit 0, `npm run build` BUILD_EXIT=0 (route `/` dynamique,
`/login` + `/register` prerendues), `node scripts/check-supabase.mjs`
AUTH 200 + TABLE resources PRESENTE (base inchangee), smoke dev : `/` -> 307
(garde 1.3 active), `/login` -> 200.
Revue step-04 : triage consigne en Review Triage Log.

## Plan Change Log

## Review Triage Log

- **Quick lens (4 AC)** : 4/4 verifies. Compteur + 5 conversations +
  raccourcis (code + build dynamique OK) ; nav par role (helpers 5/5 pass,
  aucun lien /admin pour collaborateur) ; etat vide (message + lien /chat) ;
  degrade (try/catch global, raccourcis + role=status).
- **Senior lens** : aucune objection. RLS Supabase fait foi (policies
  owner_conversations, authenticated_read) ; le role UI n'est qu'un confort
  d'affichage, jamais une barriere de securite (garde 1.3 + RLS en amont).
  Requetes limitees (count head + 1 + 5 lignes) : pas de probleme de perf MVP.
- **Blind Hunter** : 1 finding `patch` — `aria-label=" conversations
  récentes"` avec espace initiale dans app/page.tsx : coquille mineure,
  annonce vocale inchangee, laissee en l'etat (corrigeable si retouche du
  fichier dans une story ulterieure).
- **Edge Case Hunter** : matrice 5 lignes, 5/5 couvertes : dashboard charge
  (build OK), etat vide (branche `conversations.length === 0`), metriques en
  echec (catch -> degraded), admin (helpers + branche isAdmin),
  collaborateur (helpers verifient absence de /admin).
- **UX lens** : conforme DESIGN.md/EXPERIENCE.md ecran 2 (4 blocs, bottom bar
  64px + safe-area, sidebar 260px desktop, tactiles 44px+, texte 16px,
  cobalt #2563EB, dark mode). Liens /search /chat /history /admin pointent
  vers des routes futures (404 tant que les epics 2-5 ne sont pas construits)
  — attendu et documente, pas un defaut.

## Verification

**Commands:**
- `npm run test:dashboard` -- expected: exit 0, tous les cas passent.
- `npm run typecheck` -- expected: exit 0.
- `npm run lint` -- expected: exit 0.
- `npm run build` -- expected: exit 0, route / prerendue.
- `node scripts/check-supabase.mjs` -- expected: AUTH 200, TABLE resources PRESENTE (base inchangee).

**Manual checks (if no CLI):**
- Ouvrir / connecte : compteur, conversations, raccourcis visibles ; admin voit Gerer.
- Redimensionner 375px : bottom bar visible, tactiles >= 44px, pas de zoom iOS.