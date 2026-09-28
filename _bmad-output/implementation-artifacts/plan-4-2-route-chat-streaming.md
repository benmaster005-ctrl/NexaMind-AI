---
title: '4.2 Route de Streaming RAG et Citations Structurées'
type: 'feature'
ticket: '2'
created: '2026-09-27'
status: 'done'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md`
  - `_bmad-output/initiative-nexamind-ai/epic-assistant-rag/tickets.toml`
  - `_bmad-output/implementation-artifacts/plan-4-1-service-rag-abstention.md`
  - `lib/ai/rag.ts`
  - `app/api/search/route.ts`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le service RAG (story 4.1) est pur mais inaccessible : aucune route HTTP ni aucun transport streamant n'existe. Les questions ne peuvent pas atteindre Gemini.

**Approach:**
1. `lib/ai/chat.ts` (nouveau, pur) : `prepareChatTurn` (validation + retrieval + grounding/abstention, commun avec `answerQuestion`), parsing de requete (`parseChatRequest`), cadrage NDJSON (`encodeChatEvent`, `createChatEventStream`) : 1re ligne `{"type":"meta"...}` (citations + suggestions + abstained), puis `{"type":"text"...}` au fil de l'eau, fin `{"type":"done"}`.
2. `app/api/chat/route.ts` (POST `{ question, history? }`) : garde auth (401), parsing (400), retrieval via l'adaptateur Supabase de `/api/search` (502 si echec), abstention -> formule standard streamée sans appel Gemini, sinon `streamText` (gemini-1.5-flash, `@ai-sdk/google`) dont le `textStream` alimente les evenements NDJSON.
3. Tests hors-reseau `scripts/chat.test.ts` + `package.json` (`test:chat`).

## Boundaries & Constraints

**Always:**
- 1re donnee streamee = metadonnees (citations connues AVANT generation, FR-11 : titre, category, chunkId, excerpt, asLead ; max 5).
- Abstention : aucun appel Gemini, formule standard directement dans le flux.
- Auth requise (401 JSON), question vide/trop longue -> 400, retrieval KO -> 502 (pattern `/api/search`).
- Cles jamais cote navigateur (AD-4). Interrupt client -> `cancel()` du stream sans crash.
- Historique borne via `clampHistory` (8 tours).

**Never:**
- Pas de metadonnees ni citation dans le corps texte brut (seulement l'inline `[n]`).
- Pas d'appel reseau/IA dans les tests CI (stream fabrique avec generateur factice).
- Ne pas casser `/api/search` (import de `supabaseSearchDeps` sans modification).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Non authentifie | pas de session | 401 `{ error }` | Message FR |
| Corps invalide / question vide | `{}` | 400 `{ error }` | Message FR |
| Question > 2000 | 2001 chars | 400 `{ error }` | Message FR |
| Retrieval KO | searchDocuments ok:false | 502 `{ error }` | Message FR, pas de stream |
| Abstention | aucun chunk ground | meta(abstained:true, suggestions) + text(formule) + done, 0 appel Gemini | No error expected |
| Nominal | 2 chunks grounds | meta(citations<=5) + N evenements text + done | No error expected |
| Interruption client | abort reseau | cancel() appele, pas d'exception serveur | Fermeture propre |
| Historique malforme | entrees non-{role,content} | filtrees/bornees par clampHistory | Ignorées silencieusement |

## Code Map

- `lib/ai/chat.ts` (nouveau) -- `prepareChatTurn`, `parseChatRequest`, `encodeChatEvent`, `createChatEventStream`.
- `app/api/chat/route.ts` (nouveau) -- POST auth + retrieval + streamText/abstention.
- `lib/ai/rag.ts` (modifie) -- `answerQuestion` reutilise `prepareChatTurn` (zero duplication de logique).
- `scripts/chat.test.ts` (nouveau) -- tests hors-reseau.
- `package.json` (modifie) -- script `test:chat`.

## Tasks & Acceptance

**Execution:**
- [ ] `lib/ai/chat.ts` -- Helpers purs + stream NDJSON.
- [ ] `app/api/chat/route.ts` -- Route POST streamante.
- [ ] `scripts/chat.test.ts` -- Tests parse/prepare/stream/ordre des evenements.
- [ ] `package.json` -- Ajouter `test:chat`.

**Acceptance Criteria:**
- Given une question valide avec chunks grounds, when la route stream, then la 1re ligne est `meta` avec <= 5 citations, puis le texte, puis `done`.
- Given aucun chunk ground, when la route repond, then `meta.abstained=true` + formule standard, aucun appel Gemini.
- Given une session absente, when POST, then 401.
- Given un client qui coupe, when le flux s'interrompt, then `cancel()` sans exception.

## Implementation Notes

NDJSON (une ligne JSON par evenement) plutot que headers : les citations (~3,5 ko d'extraits) depassent la taille sûre d'en-tête HTTP. Le client separateur par `\n`. `gemini-1.5-flash` via `createGoogleGenerativeAI().languageModel()` (ARCHITECTURE-SPINE).

## Verification

**Commands:**
- `npm run test:chat` -- exit 0.
- `npm run test:rag` -- exit 0 (non-regression).
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0.
- `npm run build` -- exit 0.
