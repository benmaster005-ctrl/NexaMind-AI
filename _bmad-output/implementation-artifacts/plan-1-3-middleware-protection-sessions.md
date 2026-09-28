---
title: '1.3 Middleware de protection des routes et gestion des sessions'
type: 'feature'
ticket: '3'
created: '2026-09-27'
status: 'built'
baseline_revision: 'NO_VCS'
route: 'oneshot'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['quick', 'senior', 'blind-hunter', 'edge-case-hunter', 'ux']
review_loop_iteration: 0
route: 'oneshot'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les pages /login et /register existent (story 1.2) mais rien ne bloque l'acces aux zones privees : un visiteur sans session peut ouvrir / et un collaborateur peut visiter /admin/*, donc FR-3 n'est pas couvert.

**Approach:** Etendre le middleware existant pour verifier la session Supabase sur les routes protegees, rediriger vers /login sans session, bloquer /admin/* sans role 'admin', et exposer la deconnexion via le signOutAction existant.

</frozen-after-approval>

## Implementation Notes

Implementation realisee directement (pas de sous-agent disponible).
Raison oneshot : ~100 lignes sur 3 fichiers existants, sans nouvelle page.
Fichiers touches : `lib/supabase/middleware.ts` (garde FR-3 via
`decideRouteGuard`, redirection sans query params), `lib/auth/route-guard.ts`
(nouveau, decision pure testable sans reseau), `scripts/route-guard.test.ts`
(nouveau, 7 cas), `package.json` (script `test:guard`).
`middleware.ts` (matcher), `app/(auth)/actions.ts` (`signOutAction` reutilise
tel quel), fondations 1.1/1.2 et base Supabase : non modifies.
Verification : `npm run test:guard` 7/7 pass, `npm run lint` exit 0,
`npm run typecheck` exit 0, `npm run build` exit 0 (BUILD_EXIT=0),
`node scripts/check-supabase.mjs` AUTH 200 + TABLE resources PRESENTE
(base inchangee, lecture seule), smoke dev : `/` -> 307, `/admin/resources`
-> 307, `/login` -> 200.
Revue step-04 : triage consigne en Review Triage Log.

## Review Triage Log

- **Quick lens (step-04, 3 AC)** : 3/3 verifies. `/` sans session -> `/login`
  (smoke 307 constate) ; `/admin/*` non-admin -> `/`, sans session ->
  `/login` (7/7 tests unitaires + smoke 307) ; deconnexion via
  `signOutAction` existant (invalide session, redirect `/login`, reutilise
  sans modification).
- **Senior lens** : aucune objection. Role lu depuis `user_metadata` cote
  serveur uniquement (jamais expose au navigateur, AD-2/AD-4) ; pas de page
  403 dediee par choix valide (redirection `/`, reversible en 1.4).
- **Blind Hunter** : 1 finding `patch` corrige pendant l'implementation — le
  test importait `lib/supabase/middleware.ts` (dependances `next/server`,
  non resolvable par node --test) ; corrige en extrayant la decision pure
  dans `lib/auth/route-guard.ts` sans dependance. Aucun residu.
- **Edge Case Hunter** : matrice 4 lignes auditee, 4/4 couvertes par test
  unitaire passe : visiteur `/` -> `/login`, collaborateur `/admin` -> `/`,
  session expiree (= pas de session cote `getUser`) -> `/login`, `/login`
  et `/register` jamais bloques. Chemins reseau Supabase non exercables
  sans ecriture distante (interdite) — limite documentee.
- **UX lens** : aucune nouvelle UI dans cette story (middleware invisible).
  Redirections sans parametre visible, `/login` existant inchange et
  accessible (smoke 200). Aucun changement.
