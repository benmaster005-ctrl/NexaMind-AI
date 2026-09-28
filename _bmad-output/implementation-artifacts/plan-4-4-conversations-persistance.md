---
title: '4.4 Persistance Multi-Échanges et Titrage Automatique'
type: 'feature'
ticket: '4'
created: '2026-09-27'
status: 'done'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/initiative-nexamind-ai/epic-assistant-rag/tickets.toml`
  - `_bmad-output/implementation-artifacts/plan-4-3-interface-chat.md`
  - `supabase/migrations/0001_init.sql`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le chat fonctionne mais rien ne dure : aucune conversation n'est nommee ni reprise, et les citations ne sont pas conservees (FR-13 : ordre, contexte de suivi, titre auto, auteur seul).

**Approach:**
1. Migration `0006_message_meta.sql` : `alter table public.messages add column if not exists meta jsonb not null default '{}'` — stocke le `ChatMeta` complet (citations + suggestions + abstained).
2. `lib/chat/conversations.ts` (pur) : `deriveConversationTitle`, `rowsToHistory` (lignes DB -> tours bornes 8), `rowsToInitialMessages` (lignes DB -> etat UI), `assertConversationOwner` (403 message FR).
3. `app/api/chat/route.ts` (modifie) : accepte `conversationId?` — verifie l'auteur (403), charge l'historique DB, cree la conversation si absente (titre auto), insere le message utilisateur, streame, puis insere la reponse assistant + meta apres le flux ; `meta.conversationId` remonte au client.
4. `app/chat/[id]/page.tsx` : recharge le fil cote serveur (RLS -> introuvable = redirection `/chat`), props `initialMessages` a `ChatClient` ; le client fait `history.replaceState` vers `/chat/[id]` apres le 1er meta (pas de remount React).
5. Tests `scripts/conversation.test.ts` + `package.json` (`test:conversation`).

## Boundaries & Constraints

**Always:**
- Un conversationId etranger -> 403 message FR (jamais de fuite). RLS reste le filet de securite.
- Titre genere uniquement a la creation, tronque proprement, jamais vide.
- Historique de suivi charge depuis la DB (auteur verifie), borne a 8 tours par `clampHistory`.
- L'insertion assistant inclut le meta complet : relecture de `/chat/[id]` re affiche puces et abstention.
- Echec persistance assistant -> flux livre quand meme (best effort), l'insert utilisateur reste dure.

**Never:**
- Pas de migration destructive (ADD COLUMN IF NOT EXISTS uniquement).
- Pas d'ecran Historique (epic Resume & Historique).
- Ne pas casser `/chat` sans conversationId (chemin actuel preserve).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 1re question | pas de conversationId | conversation creee, titre = question tronquee, meta.conversationId remonte | Insert echec -> flux sans persistance |
| Question suivante | conversationId valide | historique DB recharge (8 tours), reponses inserees | 403 si foreign |
| conversationId foreign/inconnu | autre owner ou uuid mort | 403 `{ error }`, 0 appel IA (RLS) | Message FR |
| Relecture /chat/[id] | lignes DB | fil reconstitue (puces, abstention) | Introuvable -> redirect /chat |
| Titre long | question 300 chars | titre ~60 chars coupe sur mot + « … » | No crash |
| Flux coupe | client abort | message user deja insere, assistant non insere | Pas d'exception |
| meta manquant | `{}` en DB | message affiche sans puces | Degrade silencieux |

## Code Map

- `supabase/migrations/0006_message_meta.sql` (nouveau) -- colonne `meta jsonb`.
- `lib/chat/conversations.ts` (nouveau) -- helpers purs.
- `app/api/chat/route.ts` (modifie) -- persistance + ownership + meta.conversationId.
- `lib/ai/chat.ts` (modifie) -- meta du ChatEvent porte `conversationId?`.
- `app/chat/[id]/page.tsx` (nouveau) -- relecture serveur.
- `components/chat/chat-client.tsx` (modifie) -- props initiales + replaceState.
- `scripts/conversation.test.ts` (nouveau) -- tests purs.
- `package.json` (modifie) -- script `test:conversation`.

## Tasks & Acceptance

**Execution:**
- [ ] `0006_message_meta.sql` -- Ajouter la colonne meta.
- [ ] `lib/chat/conversations.ts` -- Helpers purs testables.
- [ ] `lib/ai/chat.ts` + route `/api/chat` -- Persistance et ownership.
- [ ] `app/chat/[id]/page.tsx` + `chat-client` -- Relecture et replaceState.
- [ ] `scripts/conversation.test.ts` + `package.json` -- Tests + script.

**Acceptance Criteria:**
- Given une premiere question, when le flux se termine, then la conversation porte la question tronquee comme titre et son URL est `/chat/[id]`.
- Given 2 echanges, when la question de suivi arrive, then l'historique DB est injecte (borne 8) avant generation.
- Given un conversationId etranger, when POST, then 403, aucune generation.
- Given une relecture de `/chat/[id]`, when les lignes sont mappees, then puces et abstention reapparaissent.

## Implementation Notes

`meta` a `default '{}'` : messages anciens sans meta s'affichent sans puce (degrade silencieux). L'insertion de la reponse se fait dans un generateur enveloppant le `textStream`, apres la derniere donnee. Client abort -> `cancel()` empeche l'insertion assistant (jamais de message partiel persiste).

## Verification

**Commands:**
- `npm run test:conversation` -- exit 0.
- `npm run test:chat` / `test:chat-ui` / `test:rag` -- exit 0.
- `npm run typecheck` / `npm run lint` / `npm run build` -- exit 0.
- **Manuel :** executer `0006_message_meta.sql` dans le SQL Editor Supabase avant test live.
