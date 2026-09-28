---
title: '4.3 Interface de Chat avec Tiroir de Sources Tactile'
type: 'feature'
ticket: '3'
created: '2026-09-27'
status: 'done'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/EXPERIENCE.md`
  - `_bmad-output/initiative-nexamind-ai/epic-assistant-rag/tickets.toml`
  - `_bmad-output/implementation-artifacts/plan-4-2-route-chat-streaming.md`
  - `components/search/search-client.tsx`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La route `/api/chat` streame mais aucune interface n'existe : `/chat` est le 3e onglet de la nav (helpers 1.4) et pointe vers une 404. Les puces `[1]`, le tiroir de sources et l'encadré d'abstention d'EXPERIENCE.md ne sont pas incarnés.

**Approach:**
1. `lib/chat/ui.ts` (pur) : decoupe du texte assistant en segments `{text, citation?}` autour de `[n]` (sans regex sur entree brute non controlee), messages d'UI FR, aide a l'interpretation du flux NDJSON (reducer d'evenements), helpers d'affichage.
2. `app/chat/page.tsx` (server mince, meme pattern que `/search`) + `components/chat/chat-client.tsx` (+ `.module.css`) : bulles (user droite brand / assistant gauche), saisie basse auto-extensible 1-4 lignes + bouton envoi 44x44, streaming via reader NDJSON (`fetch` + `getReader`), indicateur « en train d'ecrire », puces `[1]` cliquables (aria-label « Source 1 : Titre »), tiroir bas (Bottom Sheet mobile / panneau bas desktop via media query) montrant titre + extrait exact, encadré abstention ambre + pistes `asLead`, erreur avec « Reessayer » sans perdre la saisie.
3. Tests hors-reseau `scripts/chat-ui.test.ts` (segments, reducer NDJSON, limites) + `package.json` (`test:chat-ui`).

## Boundaries & Constraints

**Always:**
- Mobile-first : pas de defilement horizontal, cibles >= 44x44, aria-labels sur puces/boutons (EXPERIENCE §4).
- Abstention : bordure ambre + formule standard + pistes presentees comme telles (jamais [n] cliquable vers une « reponse »).
- Interruption/reseau KO : garder la saisie + bouton Reessayer, jamais d'ecran bloque.
- Le flux NDJSON : meta d'abord (citations), textes accumules, done final, error -> message FR.
- Seuil : question > 2000 chars refuse cote client avec le meme message FR que la route.

**Never:**
- Pas de `dangerouslySetInnerHTML` (segments React en texte, meme principe que `highlightParts`).
- Pas d'appel IA direct du navigateur (tout passe par `/api/chat`).
- Pas de dependance UI externe (CSS modules, charte Clean Tech Slate deja en place).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Envoi nominal | `question valide` | bulle user + bulle assistant qui stream (meta -> text...) | Done -> saisie reset |
| Abstention | meta.abstained=true | encadré ambre + formule + pistes (titres) | Aucune puce [n] |
| Puce [1] cliquee | citations fournies | tiroir bas ouvert : titre + extrait exact | Focus/aria en ordre |
| Citation absente | `[9]` hors meta | puce non cliquable, style « inconnu » | Pas de crash |
| Reseau coupe | fetch rejette | encart erreur + Reessayer, saisie preservee | Pas de boucle auto |
| Saisie vide/espaces | bouton envoi | inactif, 0 requete | No request |
| Saisie > 2000 | keyup | message FR, envoi bloque | Pas d'appel |
| Trop de citations | meta > 5 | n'affiche que [1..5] (garde-fou route deja) | Silencieux |

## Code Map

- `lib/chat/ui.ts` (nouveau) -- `segmentAssistantText`, `reduceChatEvents`, messages UI.
- `app/chat/page.tsx` (nouveau) -- server page + nav rolee (pattern search).
- `components/chat/chat-client.tsx` + `chat.module.css` (nouveaux) -- ecran complet.
- `scripts/chat-ui.test.ts` (nouveau) -- tests purs.
- `package.json` (modifie) -- script `test:chat-ui`.

## Tasks & Acceptance

**Execution:**
- [ ] `lib/chat/ui.ts` -- Segments + reducer NDJSON + messages.
- [ ] `app/chat/page.tsx` -- Page server mince.
- [ ] `components/chat/chat-client.tsx` + CSS -- Ecran complet.
- [ ] `scripts/chat-ui.test.ts` -- Tests segments/reducer/limites.
- [ ] `package.json` -- Ajouter `test:chat-ui`.

**Acceptance Criteria:**
- Given une reponse contenant « ...conges [1]. », when le client l'affiche, then `[1]` est un bouton avec aria-label « Source 1 : … » et ouvre le tiroir avec l'extrait de la meta.
- Given meta.abstained, when la reponse arrive, then encadré ambre + formule standard + pistes en texte, zero puce cliquable.
- Given un evenement error en cours de flux, when il est consomme, then message FR affiche + saisie intacte.
- Given le flux complet, when on trace l'ordre, then meta avant tout text, done en dernier.

## Implementation Notes

Le composant est splite en parties `chat-client.partN.tsx` concatenees (limite 6000 caracteres de l'editeur), meme convention que `search-client.tsx`. `segmentAssistantText` ne cree une puce que si `1 <= n <= citations.length` ; les autres marqueurs restent en texte brut.

## Verification

**Commands:**
- `npm run test:chat-ui` -- exit 0.
- `npm run test:chat` -- exit 0 (non-regression).
- `npm run typecheck` -- exit 0.
- `npm run lint` -- exit 0.
- `npm run build` -- exit 0.
