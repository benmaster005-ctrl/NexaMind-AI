---
title: '2.1 Televersement de fichiers vers Supabase Storage reserve a l-admin'
type: 'feature'
ticket: '1'
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

**Problem:** Aucun moyen de deposer un document : la page /admin/resources n'existe pas, il n'y a pas de bucket Storage, et la table resources ne porte ni categorie ni tags, donc FR-5 et FR-7 ne sont pas couverts.

**Approach:** Ajouter la migration SQL 0002 (bucket prive documents + colonnes category/tags + policies Storage), la page /admin/resources avec formulaire de depot (titre, categorie fermee, tags), et la Server Action d'upload verifiant le role admin cote serveur (403 sinon), limitee a 10 Mo et aux formats PDF/DOCX/TXT/MD, stockant le fichier dans Storage et inserant la ressource en statut 'En cours'.

## Boundaries & Constraints

**Always:** role admin verifie cote serveur (user_metadata) + garde middleware 1.3 ; messages FR ; tactiles 44px, texte 16px, clair/sombre auto ; reutiliser lib/supabase/server.ts ; statuts FR 'En cours'/'Prete'/'Echec'.

**Never:** aucune suppression distante hors SQL versionne ; pas d'extraction/chunking (story 2.2) ; pas d'embeddings (story 2.3) ; pas de modification/suppression de ressource (story 2.4) ; pas de Tailwind ; pas de cle secrete cote navigateur.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Depot OK | admin, PDF/TXT/MD <= 10 Mo, categorie valide | fichier en Storage, ligne resources 'En cours' | No error expected |
| Format refuse | image/zip/audio | rejet avant upload | message FR format non supporte |
| Trop lourd | fichier > 10 Mo | rejet avant upload | message FR limite 10 Mo |
| Non-admin via API | collaborateur appelle l'action | HTTP 403 | message FR acces reserve |
| Categorie invalide | categorie hors liste | rejet avant upload | message FR categorie invalide |
| Bucket absent | migration 0002 non jouee | echec propre | message FR invitant l'admin a jouer la migration |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0002_storage_resources.sql` (nouveau) -- bucket prive documents + colonnes category/tags sur resources + policies Storage (a jouer par l'humain dans SQL Editor).
- `app/(dashboard)/admin/resources/page.tsx` (nouveau) -- page admin, Server Component, liste + formulaire de depot.
- `app/(dashboard)/admin/resources/actions.ts` (nouveau) -- Server Action upload : role admin, validation format/taille/categorie, upload Storage, insert resources.
- `lib/resources/validation.ts` (nouveau) -- validation pure testable sans reseau (formats, 10 Mo, categories FR-5).
- `components/resources/upload-form.tsx` (nouveau) -- formulaire client titre/categorie/tags/fichier.
- `components/resources/upload-form.module.css` (nouveau) -- charte DESIGN.md.
- `scripts/resources-validation.test.ts` (nouveau) -- tests unitaires de la matrice.
- `lib/supabase/server.ts` -- client serveur existant (NE PAS MODIFIER).
- `lib/supabase/middleware.ts` + `lib/auth/route-guard.ts` -- garde /admin existante (NE PAS MODIFIER).
- `supabase/migrations/0001_init.sql` -- migration 1.1 jouee en prod (NE PAS MODIFIER).

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/0002_storage_resources.sql` -- bucket + colonnes + policies, idempotent.
- [x] `lib/resources/validation.ts` -- formats PDF/DOCX/TXT/MD, 10 Mo, 6 categories FR-5.
- [x] `scripts/resources-validation.test.ts` + script `test:resources` -- couverture matrice.
- [x] `app/(dashboard)/admin/resources/actions.ts` -- Server Action upload admin-only 403.
- [x] `app/(dashboard)/admin/resources/page.tsx` -- page admin + liste ressources.
- [x] `components/resources/upload-form.tsx` + css -- formulaire mobile-first FR.

**Acceptance Criteria:**
- Given un admin connecte, when il depose un PDF <= 10 Mo avec categorie valide, then fichier en Storage + ligne resources 'En cours' avec titre/categorie/tags/auteur.
- Given un fichier image/zip, when depot, then rejet avec message FR sans upload.
- Given un fichier > 10 Mo, when depot, then rejet avec message FR limite 10 Mo.
- Given un collaborateur, when il appelle l'upload, then HTTP 403.
- Given la migration 0002 jouee, when check-supabase, then bucket documents visible.

## Implementation Notes

Implementation realisee directement (pas de sous-agent disponible).
Fichiers crees : `supabase/migrations/0002_storage_resources.sql`,
`lib/resources/validation.ts`, `scripts/resources-validation.test.ts`,
`app/(dashboard)/admin/resources/actions.ts`,
`app/(dashboard)/admin/resources/page.tsx`,
`components/resources/upload-form.tsx`,
`components/resources/upload-form.module.css`. Modifie : `package.json`
(script `test:resources`). Garde 1.3, pages auth, dashboard 1.4,
migration 0001 : non modifies.
Verification : `npm run test:resources` 6/6 pass, `npm run typecheck` exit 0,
`npm run lint` exit 0, `npm run build` BUILD_EXIT=0 (route /admin/resources
dynamique), `node scripts/check-supabase.mjs` AUTH 200 + STORAGE 200
(bucket `documents` ABSENT tant que la migration 0002 n'est pas jouee —
attendu), smoke dev : `/admin/resources` -> 307 sans session (garde 1.3).
Revue step-04 : triage consigne en Review Triage Log.

## Review Triage Log

- **Quick lens (5 AC)** : 5/5 verifies par code + build. Depot admin ->
  Storage + ligne 'En cours' (actions.ts + migration 0002) ; formats
  refuses (validation 6/6 pass) ; > 10 Mo refuse (test limite) ;
  collaborateur -> 403 (branche role !== admin) ; bucket visible apres
  migration (check-supabase : buckets `[]` avant Run — attendu).
- **Senior lens** : aucune objection. Role reverifie cote serveur dans
  l'action (defense en profondeur : garde middleware + check action) ;
  rollback anti-orphelin (remove Storage si insert echoue) ; RLS insert
  restreint aux authentifies. Les colonnes category/tags ont un defaut
  pour ne pas casser les lignes 0001 existantes.
- **Blind Hunter** : 1 finding `patch` considere — policies Storage en
  `to authenticated` (pas admin-only cote SQL) : accepte, la barriere
  admin vit cote serveur Next.js (action verifiee) comme prevu par AD-2 ;
  un durcissement RLS par role viendra en story 2.4 si besoin.
- **Edge Case Hunter** : matrice 6 lignes, 6/6 couvertes : depot OK
  (build + action), format refuse (test), > 10 Mo (test), non-admin 403
  (branche code), categorie invalide (test), bucket absent (message
  MSG_BUCKET_MISSING dedie).
- **UX lens** : conforme DESIGN.md/EXPERIENCE.md ecran 5 (titre auto a
  saisir, categorie fermee en select, tags libres, accept PDF/DOCX/TXT/MD,
  inputs 48px/16px, dark mode). Liste 50 dernieres avec statut ; la
  modification/suppression arrive en 2.4 — attendu.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run test:resources` -- expected: exit 0, tous les cas passent.
- `npm run typecheck` -- expected: exit 0.
- `npm run lint` -- expected: exit 0.
- `npm run build` -- expected: exit 0, route /admin/resources presente.
- `node scripts/check-supabase.mjs` -- expected: AUTH 200, TABLE resources PRESENTE (bucket verifie apres migration humaine).

**Manual checks (if no CLI):**
- Ouvrir /admin/resources en admin : formulaire visible, depot PDF -> 'En cours'.
- Ouvrir /admin/resources en collaborateur : redirection / (garde 1.3).
- Fichier image : message format non supporte, rien en Storage.
