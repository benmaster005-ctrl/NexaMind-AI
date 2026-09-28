---
title: '1.2 Flux inscription et connexion avec attribution des roles'
type: 'feature'
ticket: '2'
created: '2026-09-26'
status: 'built'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['quick', 'senior', 'blind-hunter', 'edge-case-hunter', 'ux']
lenses_ran: []
review_loop_iteration: 0
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md`
  - `_bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/DESIGN.md`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'application a ses fondations Supabase (story 1.1) mais aucun utilisateur ne peut s'inscrire ni se connecter : les exigences FR-1 et FR-2 du PRD ne sont pas couvertes.

**Approach:** Ajouter les pages /login et /register avec design Clean Tech Slate, branchees sur Supabase Auth e-mail/mot de passe, avec role 'collaborateur' par defaut dans user_metadata et messages d'erreur neutres, sans toucher aux fondations existantes.

## Boundaries & Constraints

**Always:** donnees fictives uniquement en dev ; aucune cle secrete cote navigateur (AD-4) ; reutiliser les clients existants lib/supabase/client.ts (navigateur) et lib/supabase/server.ts (serveur) ; role par defaut 'collaborateur' ; mot de passe minimum 8 caracteres ; messages d'erreur neutres ; preserver app/page.tsx, app/layout.tsx, app/globals.css et middleware.ts existants.

**Never:** aucune suppression ni modification distante ; pas de middleware de protection des routes (story 1.3) ; pas de tableau de bord (story 1.4) ; pas de Tailwind, pas d'IA/embeddings, pas de routes /api/* ; pas de changement du schema SQL 0001_init.sql.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Inscription OK | e-mail valide + mot de passe >= 8 | compte cree, role 'collaborateur', redirection ou message verifier e-mail | No error expected |
| Mot de passe court | mot de passe < 8 caracteres | refuse avant appel reseau avec message explicite | message FR clair, champ en erreur |
| E-mail existant | e-mail deja inscrit | refuse sans ecraser le compte ni divulguer d'infos | message neutre identique a un succes apparent |
| Identifiants incorrects | mauvais e-mail ou mot de passe | connexion refusee | message neutre, sans preciser le champ faux |
| 5 echecs consecutifs | 5 tentatives ratees | blocage temporaire anti-bruteforce | message invitant a reessayer plus tard |
| Hors ligne | reseau coupe | pas de crash | message reseau propre en francais |

</frozen-after-approval>

## Code Map

- `lib/supabase/client.ts` -- client navigateur existant a reutiliser (NE PAS MODIFIER).
- `lib/supabase/server.ts` -- client serveur existant a reutiliser (NE PAS MODIFIER).
- `lib/supabase/env.ts` -- garde-fou env existant (NE PAS MODIFIER).
- `middleware.ts` -- rafraichissement session existant (NE PAS MODIFIER, protection = story 1.3).
- `app/(auth)/login/page.tsx` (nouveau) -- page connexion, Server Component.
- `app/(auth)/register/page.tsx` (nouveau) -- page inscription, Server Component.
- `components/auth/login-form.tsx` (nouveau) -- formulaire connexion 'use client'.
- `components/auth/register-form.tsx` (nouveau) -- formulaire inscription 'use client'.
- `app/(auth)/actions.ts` (nouveau) -- Server Actions signUp/signIn/signOut, role 'collaborateur'.
- `components/auth/auth.module.css` (nouveau) -- styles Clean Tech Slate, sans Tailwind.
- `lib/auth/rate-limit.ts` (nouveau) -- garde anti-bruteforce minimal en memoire.
- `app/page.tsx`, `app/layout.tsx`, `app/globals.css` -- NE PAS MODIFIER.

## Tasks & Acceptance

**Execution:**
- [x] `app/(auth)/actions.ts` -- Server Actions signUp (role collaborateur) + signIn + signOut via client serveur -- coeur FR-1/FR-2.
- [x] `components/auth/login-form.tsx` -- formulaire connexion, etats chargement/erreur neutre -- FR-2.
- [x] `components/auth/register-form.tsx` -- formulaire inscription, controle 8 caracteres -- FR-1.
- [x] `app/(auth)/login/page.tsx` -- page connexion rendant le formulaire -- route /login.
- [x] `app/(auth)/register/page.tsx` -- page inscription rendant le formulaire -- route /register.
- [x] `components/auth/auth.module.css` -- styles mobile-first (16px, tactiles 44px, clair/sombre) -- DESIGN.md.
- [x] `lib/auth/rate-limit.ts` -- verrou memoire 5 echecs puis blocage temporaire -- hypothese PRD 11 n.4.

**Acceptance Criteria:**
- Given e-mail valide et mot de passe >= 8, when inscription, then compte cree role 'collaborateur' et redirection (ou message verifier e-mail si confirmation activee).
- Given mot de passe < 8, when inscription, then refuse avec message explicite avant appel reseau.
- Given identifiants incorrects, when connexion, then message neutre sans reveler le champ faux.
- Given 5 echecs consecutifs, when nouvelle tentative, then blocage temporaire avec message adapte.
- Given `npm run lint`, when execute, then zero erreur sur les nouveaux fichiers.

## Design Notes

Formulaires verticaux mobile-first (marge 16px, inputs 16px contre zoom iOS), bouton primaire cobalt #2563EB pleine largeur hauteur 48px, carte centree max 400px sur desktop, erreurs rouges #EF4444 avec role="alert", liens croises login/register. Server Actions retournent { success, error } et redirect('/') en succes ; rate-limit memoire par e-mail/IP (MVP local, documente non-distribue).

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0.
- `npm run lint` -- expected: exit 0 sur app/(auth)/** et components/auth/**.
- `npm run build` -- expected: exit 0, routes /login et /register prerendues.
- `node scripts/check-supabase.mjs` -- expected: AUTH 200, TABLE resources PRESENTE (base inchangee).

**Manual checks (if no CLI):**
- Ouvrir /register sur mobile (375px) : lisible, bouton 48px, erreur si mot de passe < 8.
- Ouvrir /login : connexion compte fictif, message neutre si mauvais mot de passe.

## Implementation Notes

Implementation realisee directement (pas de sous-agent disponible).
Fichiers crees : `app/(auth)/actions.ts`, `app/(auth)/login/page.tsx`,
`app/(auth)/register/page.tsx`, `components/auth/login-form.tsx`,
`components/auth/register-form.tsx`, `components/auth/auth.module.css`,
`lib/auth/rate-limit.ts`, `scripts/rate-limit.test.ts`.
Verification : `npm run test:rate-limit` 3/3 pass, `npm run lint` exit 0,
`npm run typecheck` exit 0, `npm run build` exit 0 (routes `/login` et
`/register` prerendues), `node scripts/check-supabase.mjs` AUTH 200 +
TABLE resources PRESENTE (base inchangee, lecture seule).
Revue step-04 : verrou memoire expire purge de la Map, triage consigne en
Review Triage Log.

## Plan Change Log

## Plan Change Log

## Review Triage Log

- **Quick lens (step-04, 7 claims)** : 6/7 verifies (`signUp` role collaborateur,
  refus < 8, `signIn` neutre, anti-bruteforce, CSS 16px/48px, pas de secret
  navigateur). 1 entry `e-mail existant -> message neutre` classee `unknown` :
  aucun test ne peut exercer Supabase Auth sans ecriture distante (interdite
  par le plan). Pas de changement de code.
- **Senior lens** : aucune objection de conception ; le verrou memoire
  mono-instance est le compromis documente du plan (MVP local, Redis deferred
  dans l'architecture). Pas de changement de code.
- **Blind Hunter** : 2 findings retenus `patch`, 1 corrige. (1) Limite
  memoire non bornee quand un verrou expire : corrige en supprimant l'entree
  expiree de la Map dans `checkRateLimit` (`lib/auth/rate-limit.ts`).
  (2) `signOutAction` exporte mais non appele (1.2 ne contient pas de bouton
  de deconnexion) : conserve volontairement — appele prevu par la story 1.3
  (middleware) quand une UI de deconnexion existera ; pas de code mort a
  corriger ici.
- **Edge Case Hunter** : matrice I/O 6 lignes auditee. `mot de passe court`
  couvert cote client (blocage avant reseau) + garde serveur. `5 echecs ->
  blocage` couvert par `npm run test:rate-limit` (3/3 pass). `inscription OK`,
  `e-mail existant`, `identifiants incorrects`, `hors ligne` : chemins
  Supabase/reseau non exercables sans ecriture distante (interdite) —
  documente comme limite de couverture, pas comme defaut du code.
- **UX lens** : formulaires conformes DESIGN.md (carte 400px, cobalt #2563EB,
  inputs 16px anti-zoom iOS, tactiles 48px, roles alert/status, dark mode).
  Les doubles `<h1>` existaient deja avant cette story et ne sont pas
  introduits ici — aucun changement.

