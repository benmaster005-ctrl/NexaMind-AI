---
title: '2.3 Generation d-Embeddings Gemini et Stockage pgvector'
type: 'feature'
ticket: '3'
created: '2026-09-27'
status: 'built'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md`
  - `_bmad-output/implementation-artifacts/plan-2-2-extraction-texte-chunking.md`
  - `_bmad-output/initiative-nexamind-ai/epic-ingestion-ressources/tickets.toml`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les documents deposes sont decoupes en morceaux de 400-500 tokens mais inseres avec `embedding = NULL`, laissant la ressource au statut 'En cours'. La recherche semantique (epic 3) et l'assistant RAG (epic 4) ne peuvent pas fonctionner sans representations vectorielles denses (768d) ni sans ressources certifiees 'Prête'.

**Approach:** 
1. Creer `lib/ai/embeddings.ts` avec Google Gemini (`text-embedding-004`, 768d) via `@ai-sdk/google` et `ai` (`embedMany`).
2. Gerer le decoupage par lots de 100 max et les erreurs transitoires (429/quota) par backoff exponentiel.
3. Permettre l'injection de client d'embedding pour garantir des tests 100% hors reseau.
4. Ajouter la migration `supabase/migrations/0004_embeddings_update_policy.sql` pour les permissions UPDATE et index vectoriel pgvector.
5. Integrer la vectorisation dans `lib/ingestion/ingest-resource.ts` pour persister `embedding` et passer a 'Prête' (ou 'Échec' + message FR clair si quota depasse).
6. Mettre a jour `actions.ts`, `.env.example`, `package.json` et les suites de tests unitaires/integration.

## Boundaries & Constraints

**Always:** 
- Traitement vectoriel serveur exclusivement (AD-4) ; pas de cle publique cote navigateur.
- Modele fixe `text-embedding-004` (768 dimensions float[], AD-3, FR-6).
- Gestion 429/quota via backoff exponentiel borne.
- Statuts FR stricts : 'En cours', 'Prête', 'Échec'.
- Re-ingestion idempotente (remplacement propre des morceaux et vecteurs).
- `ingestResource` ne leve jamais et retourne un `IngestResult`.

**Never:**
- Pas de `NEXT_PUBLIC_` pour `GEMINI_API_KEY`.
- Pas d'appels reseau externes durant les scripts de tests CI.
- Ne pas alterer les regles auth 1.3 ni casser le chunking 2.2.


## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ingestion & vectorisation reussie | Morceaux de texte (N <= 100) | `document_chunks.embedding` rempli avec float[768], `resources.status = 'Prête'`, `resources.error_message = null` | No error expected |
| Grand document (> 100 morceaux) | N = 250 morceaux | Decoupage en 3 batches (100, 100, 50), tous les vecteurs persistes | Si un batch echoue apres retries, ressource en 'Échec' |
| Quota / Rate limit Gemini (429) | L'API renvoie 429 ou Quota exceeded | Retries automatiques avec backoff exponentiel | Si retries epuisees : statut 'Échec', message FR clair |
| Cle API absente ou invalide | Pas de `GEMINI_API_KEY` | Echec explicite sans crash : ressource marquee 'Échec' | `error_message` invitant a configurer `GEMINI_API_KEY` |
| Re-ingestion ressource existante | Morceaux deja presents en base | Nettoyage des anciens morceaux, re-calcul et ecriture complete, statut passe a 'Prête' | No error expected |

## Code Map

- `lib/ai/embeddings.ts` (nouveau) -- Module d'embeddings Gemini : validation de la cle, decoupage par lots de 100, retry/backoff, embedChunks.
- `supabase/migrations/0004_embeddings_update_policy.sql` (nouveau) -- RLS update policy pour `document_chunks` et index vectoriel ivfflat/hnsw.
- `lib/ingestion/ingest-resource.ts` (modifie) -- Brancher la vectorisation des chunks, insertion avec vecteurs, passage a 'Prête'.
- `app/(dashboard)/admin/resources/actions.ts` (modifie) -- Message de reussite actualise, propagation des etats d'erreur.
- `.env.example` (modifie) -- Ajout explicite de `GEMINI_API_KEY`.
- `scripts/embeddings.test.ts` (nouveau) -- Tests unitaires batching, backoff exponentiel et erreurs hors reseau.
- `scripts/ingestion.test.ts` (modifie) -- Couvrir le flux complet d'ingestion avec vectorisation et statut 'Prête'.
- `package.json` (modifie) -- Ajout du script `test:embeddings`.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/0004_embeddings_update_policy.sql` -- Ecrire la migration SQL idempotente.
- [x] `.env.example` -- Documenter `GEMINI_API_KEY`.
- [x] `lib/ai/embeddings.ts` -- Creer le service d'embeddings avec batching <= 100 et backoff exponentiel.
- [x] `scripts/embeddings.test.ts` -- Tester les lots, le retry et la gestion d'erreurs sans reseau.
- [x] `lib/ingestion/ingest-resource.ts` -- Integrer la vectorisation et la transition du statut vers 'Prête'.
- [x] `app/(dashboard)/admin/resources/actions.ts` -- Actualiser le retour utilisateur.
- [x] `scripts/ingestion.test.ts` -- Valider la suite de tests d'ingestion mise a jour.
- [x] `package.json` -- Ajouter `test:embeddings` et mettre a jour les scripts.

**Acceptance Criteria:**
- Given un document textuel depose et decoupe en morceaux, when le pipeline traite la ressource, then chaque morceau recoit un vecteur float[768] de `text-embedding-004`.
- Given les morceaux vectorises et persistes, when le traitement termine, then la ressource est au statut 'Prête' avec `error_message = null`.
- Given une erreur de quota ou 429 de Gemini, when le backoff depasse les tentatives allouees, then la ressource passe en statut 'Échec' avec une explication lisible en francais.
- Given plus de 100 morceaux dans un meme document, when la vectorisation s'execute, then elle est fractionnee en batches de 100 maximum.

## Implementation Notes

Implementation sans sous-agent. Utilisation de `@ai-sdk/google` et `ai` deja installes.

## Verification

**Commands:**
- `npm run test:embeddings` -- exit 0.
- `npm run test:ingestion` -- exit 0.
- `npm run test:resources` -- exit 0.
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0.
- `npm run build` -- exit 0.
