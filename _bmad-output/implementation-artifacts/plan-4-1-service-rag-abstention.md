---
title: '4.1 Service RAG avec Injection de Contexte et Abstention (AD-1)'
type: 'feature'
ticket: '1'
created: '2026-09-27'
status: 'done'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md`
  - `_bmad-output/initiative-nexamind-ai/epic-assistant-rag/tickets.toml`
  - `_bmad-output/implementation-artifacts/plan-3-2-service-route-recherche.md`
  - `lib/ai/search.ts`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le moteur de recherche hybride existe (Epic 3) mais rien ne transforme ses résultats en réponse conversationnelle fondée. Sans service RAG, l'assistant ne peut ni répondre, ni s'abstenir (AD-1, FR-10/FR-12).

**Approach:**
1. Creer `lib/ai/rag.ts` : module testable sans reseau (dependances injectees) qui :
   - prepare le contexte RAG a partir de resultats de `searchDocuments` (chunks grounds : similarite >= 0.65, max 5 ressources distinctes FR-11, plafond de caracteres) ;
   - construit le prompt systeme imposant la reponse unique issue des sources injectees + citation `[n]` inline (AD-1) ;
   - decide de l'abstention : aucun chunk ground -> formule d'abstention standard EXPERIENCE.md + 2-3 documents les plus proches presentes comme **pistes** (jamais comme reponse) ;
   - expose `answerQuestion` (retrieval + generation via deps injectees) pour la route `/api/chat` (story 4.2) et pour les tests.
2. Tests hors-reseau `scripts/rag.test.ts` (vide, abstention, contexte, citations, plafonds, erreurs) + `package.json` (`test:rag`).

## Boundaries & Constraints

**Always:**
- Seuil de grounding 0.65 (AD-1) re-verifie cote service meme si la RPC filtre.
- Max 5 ressources citees par reponse (FR-11) ; pistes d'abstention : 2-3 documents.
- Formule d'abstention exacte EXPERIENCE.md : « Cette information n'a pas été trouvée dans les documents internes de NexaWorks. »
- Question vide/espaces -> erreur legere, 0 appel IA. Question > 2000 chars -> rejetee.
- L'historique recent (questions/reponses precedentes) est injecte pour le suivi de contexte (FR-13) et borne (8 tours, 2000 chars/tour).
- `answerQuestion` ne leve jamais : retour `{ ok, ... }` + message FR (pattern searchDocuments).

**Never:**
- Pas de cle cote navigateur, pas d'appel reseau dans les tests CI (deps injectees).
- Aucune citation presentee comme reponse en cas d'abstention (FR-12) : les pistes sont marquees `asLead`.
- Ne pas casser le service de recherche existant (read-only sur searchDocuments).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Question vide | `"   "` | `ok:false`, 0 appel retrieval/IA | Message FR |
| Question trop longue | > 2000 chars | `ok:false`, 0 appel IA | Message FR |
| Aucun chunk ground | retrieval -> [] | `abstained:true`, formule standard, 0-3 pistes `asLead:true` | Pas d'appel generation |
| Semantique degradee | tous les hits similarity null | abstention (grounding indemontrable) | Pas de generation |
| Similarite < 0.65 | hits tous sous seuil | abstention + pistes | Pas de generation |
| Reponse nominale | 2 chunks grounds 0.82/0.71 | `abstained:false`, system contient chunks + regles, citations [1..2] | No error expected |
| > 5 ressources candidates | 7 ressources | contexte et citations plafonnes a 5 | Troncature silencieuse |
| Generation en echec | deps.generate throw | `ok:false`, message FR | Pas de reponse partial |
| Retrieval en echec | searchDocuments ok:false | `ok:false`, message FR | Pas d'exception |
| Historique long | 20 tours | 8 derniers tours conserves, chacun borne | Troncature silencieuse |

## Code Map

- `lib/ai/rag.ts` (nouveau) -- constantes, types, `buildSystemPrompt`, `prepareRagContext`, `answerQuestion`.
- `scripts/rag.test.ts` (nouveau) -- tests hors-reseau.
- `package.json` (modifie) -- script `test:rag`.

## Tasks & Acceptance

**Execution:**
- [ ] `lib/ai/rag.ts` -- Creer le service RAG injectable.
- [ ] `scripts/rag.test.ts` -- Tester vide/abstention/contexte/citations/plafonds/erreurs.
- [ ] `package.json` -- Ajouter `test:rag`.

**Acceptance Criteria:**
- Given une question hors documents, when prepareRagContext s'execute, then abstained=true, la formule standard est presentee et les pistes sont marquees asLead (jamais comme reponse).
- Given 2 chunks grounds, when le prompt est construit, then il contient les sources numerotees et l'interdiction d'inventer ; citations <= 5.
- Given la question 'conges payes' avec un hit a 0.82, when answerQuestion s'execute avec des deps factices, then la generation est appelee avec historique + question et la reponse est rattachee aux citations.
- Given un echec de generation, when answerQuestion s'execute, then ok=false, message FR, aucune exception.

## Implementation Notes

Le seuil est re-verifie dans `prepareRagContext` car `searchDocuments` peut renvoyer des hits texte (similarity null) en repli : tout hit sans similarite >= 0.65 n'est pas groundable -> abstention (priorite zéro-hallucination). L'historique est borne cote service pour que la route reste mince.

## Verification

**Commands:**
- `npm run test:rag` -- exit 0.
- `npm run test:search` -- exit 0 (non-regression).
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0.
- `npm run build` -- exit 0.