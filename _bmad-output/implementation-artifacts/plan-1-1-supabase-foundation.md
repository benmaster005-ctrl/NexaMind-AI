---
title: '1.1 Fondations Supabase — clients + schéma SQL + garde-fous'
type: 'feature'
ticket: '1'
created: '2026-09-26'
status: 'built'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md`
  - `_bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/DESIGN.md`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'application Next.js 16 démarre mais n'a ni connexion base de données, ni schéma, ni garde-fous d'environnement : la story 1.1 est la seule démarrable du graphe (`tickets.py next` → ref `1.1`, FR-3).

**Approach:** Câbler les clients Supabase navigateur + serveur (SDK `@supabase/ssr`), livrer le schéma SQL initial versionné (pgvector + tables + RLS), ajouter un contrôle d'environnement au démarrage et des tests fictifs locaux, sans toucher au distant ni aux pages existantes.

## Boundaries & Constraints

**Always:** données fictives uniquement, aucune clé réelle ; variables lues côté serveur, jamais de secret en `NEXT_PUBLIC_` sauf URL + clé anon publique (AD-4) ; préserver `app/page.tsx`, `app/layout.tsx`, `app/globals.css` ; RLS activé sur chaque table ; messages d'erreur explicites si env manquant.

**Never:** aucune suppression ou modification distante (ni projet Supabase, ni bucket, ni SQL exécuté à distance sans accord explicite) ; pas de pages login/register/dashboard (stories 1.2–1.4) ; pas de Tailwind, pas d'IA/embeddings, pas de routes `/api/*` (epics suivants) ; pas d'exécution du SQL contre une vraie base dans ce sprint.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Config OK fictive | `.env.local` avec URL + anon fictives | `getSupabaseEnv()` retourne les deux valeurs, clients créés | No error expected |
| Env manquante | `NEXT_PUBLIC_SUPABASE_URL` absente | échec rapide au démarrage avec message nommant la variable | lever `Error` explicite listant les variables attendues |
| Import serveur côté client | `lib/supabase/server.ts` importé dans un Client Component | build/lint refuse ou erreur claire | interdiction documentée dans l'en-tête du fichier |
| Schéma rejoué | script SQL exécuté deux fois | idempotent (`IF NOT EXISTS`), aucun doublon | No error expected |

</frozen-after-approval>

## Code Map

- `package.json` -- ajouter `@supabase/ssr` + `@supabase/supabase-js`, ne rien retirer du existant.
- `lib/supabase/client.ts` (nouveau) -- client navigateur via `createBrowserClient`, seule source navigateur.
- `lib/supabase/server.ts` (nouveau) -- client serveur via `createServerClient` + cookies Next.js, jamais importé côté client.
- `lib/supabase/env.ts` (nouveau) -- lecture validée de `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, erreur explicite si absente.
- `supabase/migrations/0001_init.sql` (nouveau) -- `pgvector`, tables `resources`, `document_chunks` (vecteur 768), `conversations`, `messages`, RLS + policies de base.
- `lib/supabase/__tests__/env.test.ts` (nouveau) -- tests fictifs du garde-fou env, sans réseau.
- `app/page.tsx`, `app/layout.tsx`, `app/globals.css` -- NE PAS MODIFIER (fonctionnel existant préservé).
- `.env*` -- NE PAS COMMETTRE de vraies clés ; fournir `.env.example` avec valeurs `placeholder`.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- installer `@supabase/ssr` + `@supabase/supabase-js` via npm -- socle requis par l'architecture.
- [x] `lib/supabase/env.ts` -- lecture + validation des 2 variables, erreur explicite -- échec rapide et lisible.
- [x] `lib/supabase/client.ts` -- client navigateur singleton -- réutilisé par les futures pages.
- [x] `lib/supabase/server.ts` -- client serveur avec gestion cookies -- accès RLS côté serveur (AD-2/AD-4).
- [x] `supabase/migrations/0001_init.sql` -- schéma idempotent + RLS -- base prête sans distant.
- [x] `.env.example` -- modèle avec placeholders -- onboarding dev sans secret.
- [x] `scripts/check-supabase.mjs` -- contrôle lecture seule (auth 200, storage 200, table resources 200).
- [x] `tsconfig.json` -- vérifier l'inclusion de `lib/` (aucun changement attendu) -- éviter les surprises de typage.

**Acceptance Criteria:**
- Given un `.env.local` fictif complet, when `npm run typecheck`, then zéro erreur et clients importables.
- Given une variable manquante, when le serveur démarre, then message d'erreur nommant la variable.
- Given le script SQL, when relu, then `CREATE EXTENSION IF NOT EXISTS vector`, tables avec `REVOKE/GRANT` minimaux et RLS activé.
- Given `npm run lint`, when exécuté, then zéro erreur sur les nouveaux fichiers.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0.
- `npm run lint` -- expected: exit 0, aucune erreur sur `lib/supabase/**`.
- `npm run build` -- expected: exit 0 (préserve les pages existantes).
- tests du garde-fou env avec données fictives -- expected: pass sans accès réseau.

## Auto Run Result

**Date :** 2026-09-26 — sprint 1.1 terminé et vérifié.
- `node scripts/check-supabase.mjs` → AUTH 200, STORAGE 200, TABLE resources 200 (PRESENTE).
- `npm run typecheck` → exit 0 (route types OK, tsc sans erreur).
- `npm run lint` → exit 0 (aucune erreur).
- `npm run build` → exit 0 (routes `/` + `/_not-found` prérendues ; avertissement bénin : convention `middleware` dépréciée au profit de `proxy` en Next 16).
- `npm run dev` → HTTP 200 sur `http://localhost:3000` (page rendue, 14854 octets).
- Aucune suppression ni modification distante effectuée : seul le script SQL versionné a été exécuté par l'utilisateur dans le SQL Editor Supabase.
