---
title: '2.4 Gestion et Suppression des Ressources avec Déréférencement Vectoriel'
type: 'feature'
ticket: '4'
created: '2026-09-27'
status: 'complete'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'pinned'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md`
  - `_bmad-output/initiative-nexamind-ai/epic-ingestion-ressources/tickets.toml`
  - `_bmad-output/implementation-artifacts/plan-2-3-embeddings-vector-storage.md`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Actuellement, les administrateurs peuvent téléverser et vectoriser des ressources, mais ne peuvent ni modifier les métadonnées (catégorie, tags) d'une ressource existante, ni supprimer une ressource obsolète ou erronée. Sans suppression avec déréférencement en cascade (Storage + chunks vectoriels pgvector), des morceaux continueraient d'être cités par le RAG.

**Approach:** 
1. Ajouter la migration SQL `supabase/migrations/0005_resource_management_deletion.sql` pour autoriser la suppression via RLS (`authenticated_delete_resources`).
2. Créer les Server Actions sécurisées admin-only : `updateResourceMetadataAction` et `deleteResourceAction` (supprime le fichier Storage et la ressource en DB avec cascade pgvector).
3. Enrichir l'interface `/admin/resources` avec un composant client permettant l'édition directe des métadonnées et un dialogue accessible de confirmation de suppression.
4. Corriger l'encodage UTF-8 dans `app/page.tsx` (`Prête`).

## Boundaries & Constraints

**Always:**
- Rôle `admin` vérifié strictement côté serveur (rejet 403 / non-autorisé si collaborateur ou anonyme).
- Suppression en cascade : suppression du fichier dans Supabase Storage `documents`, suppression dans `resources` entraînant la suppression des chunks dans `document_chunks`.
- Boîte de dialogue de confirmation avant toute suppression (mobile & desktop).
- Validation stricte des catégories (liste fermée FR-5) et normalisation des tags.

**Never:**
- Pas de suppression sans confirmation préalable.
- Pas de fichiers orphelins dans le bucket Storage.
- Pas de fuite d'autorisation aux non-admins.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Modification métadonnées | `resourceId`, nouvelle catégorie valide, tags | Ressource mise à jour en base, liste rafraîchie | Message d'erreur si catégorie invalide |
| Suppression ressource confirmée | Clic suppression + validation dialogue | Fichier Storage supprimé, ligne resources supprimée, chunks pgvector supprimés par cascade | Notification erreur si échec réseau/DB |
| Tentative non-admin | Collaborateur ou anonyme | Opération rejetée avec code / message d'erreur | `{ success: false, message: "Accès réservé aux administrateurs." }` |
| Annulation suppression | Clic "Annuler" dans le dialogue | Aucune action effectuée | Boîte fermée sans appel réseau |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0005_resource_management_deletion.sql` (nouveau) -- Migration idempotente ajoutant la policy RLS `authenticated_delete_resources` sur `public.resources`.
- `app/(dashboard)/admin/resources/actions.ts` (modifié) -- Ajout des Server Actions `updateResourceMetadataAction` et `deleteResourceAction` avec contrôle admin strict.
- `app/(dashboard)/admin/resources/page.tsx` (modifié) -- Intégration de la liste interactive avec tags, catégorie et actions.
- `components/resources/resource-item.tsx` (nouveau) -- Composant client de gestion d'une ressource (édition catégorie/tags en ligne, suppression avec dialogue de confirmation accessible).
- `components/resources/resource-item.module.css` (nouveau) -- Styles conformes à `DESIGN.md` pour l'édition et le dialogue de confirmation.
- `app/page.tsx` (modifié) -- Nettoyage de l'encodage UTF-8 pour le statut `Prête`.
- `scripts/resources-management.test.ts` (nouveau) -- Tests unitaires isolés pour les actions de mise à jour et suppression (validation, droits admin, logique cascade).
- `package.json` (modifié) -- Ajout du script `test:resources-management`.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/0005_resource_management_deletion.sql` -- Rédiger la migration SQL idempotente pour la policy DELETE sur `resources`.
- [x] `app/(dashboard)/admin/resources/actions.ts` -- Implémenter `updateResourceMetadataAction` et `deleteResourceAction` avec vérification admin.
- [x] `components/resources/resource-item.tsx` & `.module.css` -- Créer le composant client avec dialogue de confirmation et formulaires d'édition rapide.
- [x] `app/(dashboard)/admin/resources/page.tsx` -- Brancher `ResourceItem` pour chaque ressource affichée.
- [x] `app/page.tsx` -- Corriger l'encodage `PrÃªte` vers `Prête`.
- [x] `scripts/resources-management.test.ts` -- Couvrir la matrice I/O (modification, suppression, cascade, sécurité non-admin).
- [x] `package.json` -- Ajouter `test:resources-management` dans les scripts de test.

**Acceptance Criteria:**
- Given un administrateur connecté, when il modifie la catégorie ou les étiquettes d'une ressource, then les métadonnées sont persistées et la vue est réactualisée.
- Given un administrateur connecté, when il clique sur supprimer et valide la boîte de dialogue de confirmation, then le fichier dans Storage `documents` et la ressource en base sont supprimés, ainsi que tous ses `document_chunks` en cascade.
- Given un utilisateur avec le rôle `collaborateur` ou anonyme, when il tente de modifier ou supprimer une ressource, then l'opération est refusée avec le message "Accès réservé aux administrateurs.".
- Given un administrateur qui clique sur supprimer mais choisit "Annuler", then aucune requête de suppression n'est envoyée et la ressource reste intacte.

## Implementation Notes

Implementation sans sous-agent. Utilisation directe des Server Actions Next.js et de Supabase SSR.

## Verification

**Commands:**
- `npm run test:resources-management` -- exit 0.
- `npm run test:resources` -- exit 0.
- `npm run test:ingestion` -- exit 0.
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0.
- `npm run build` -- exit 0.
