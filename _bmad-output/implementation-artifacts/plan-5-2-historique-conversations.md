---
title: 'Story 5.2 — Écran d''historique des conversations et reprise d''échange'
type: 'feature'
ticket: '5.2'
created: '2026-09-27'
status: 'built'
baseline_revision: 'NO_VCS (git absent de la machine — pas de staging possible)'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** après avoir échangé avec l'assistant, l'utilisateur ne peut pas retrouver ses conversations : l'onglet « Historique » existe déjà dans la navigation du collaborateur (`lib/dashboard/helpers.ts` l. 44-47) mais **la route `/history` renvoie 404**. Chaque retour au fil passe par une URL devinée ou par l'accueil.

**Approach:** un helper pur transforme les lignes DB en éléments d'historique (tri, nombre d'échanges, garde-fous), et une page serveur `/history` liste les conversations de l'utilisateur — titre, date relative, nombre d'échanges — chacune Computation lien vers `/chat/[id]`, qui recharge déjà le fil **avec ses citations** (story 4.4, `app/chat/[id]/page.tsx`). Aucun nouveau schéma : la table `conversations` et la RLS `owner_conversations` suffisent.

## Boundaries & Constraints

**Always:**
- Liste strictement personnelle : ne jamais filtrer autrement que par la RLS existante (`auth.uid() = owner_id`), ne jamais accepter d'`owner_id` venant du client.
- Tri par `created_at` décroissant, limité aux `HISTORY_LIMIT` (50) conversations les plus récentes.
- Date relative via `formatRelativeDate()` déjà testé (`lib/dashboard/helpers.ts` l. 57-79) — ne pas réécrire de formateur de date.
- Reprise = lien vers `/chat/[id]` : la relecture avec citations existe déjà, ne pas la dupliquer.
- État vide soigné invitant à démarrer une discussion, jamais une page vide (PRD).

**Never:**
- Pas de suppression, rename ou édition d'une conversation : hors périmètre de FR-15 (consulter + reprendre).
- Pas de pagination ni de recherche dans l'historique à ce stade.
- Aucune migration SQL, aucun changement de schéma, aucune écriture.
- Ne pas modifier `/chat`, `/api/chat` ni `lib/ai/*`.

## Décisions (2026-09-27, approbation humaine)

- **« Nombre d'échanges » = nombre de questions de l'utilisateur** (une question = 1 échange), pas le nombre de messages : « 3 échanges » pour 6 messages, et un échange reste compté si la réponse n'est pas encore arrivée. Le libellé affiché est « N échange(s) ».
- **Périmètre** : plan complet conservé au-delà de la fenêtre de tokens conseillée (≈2 180) — un seul écran, un seul livrable, chemins explicites, tests hors réseau.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | 3 conversations, 2/4/1 messages | Liste triée du plus récent au plus ancien, titre + date relative + nombre d'échanges, chaque lien ouvre `/chat/<id>` | No error expected |
| EMPTY | 0 conversation | État vide + lien « Poser une première question » vers `/chat` | Aucune requête `messages` |
| SINGLE | 1 conversation | Une ligne, même rendu qu'en liste | No error expected |
| ROWS_INVALID | titre vide / `created_at` invalide | Titre de repli « Nouvelle conversation », date « Date inconnue » (helper existant) | Aucun crash |
| ISOLATION | session d'un autre utilisateur | La liste ne contient que ses conversations (RLS), aucun `owner_id` client | Aucun filtre manuel |

</frozen-after-approval>


## Code Map

- `lib/chat/conversations.ts` — **MODIFIER** : ajouter `HISTORY_LIMIT`, `HistoryItem`, `buildHistoryItems(conversationRows, messageRows)` (pur) : normalise titre/date, **trie `created_at` décroissant**, plafonne, joint les comptes. Réutiliser `CONVERSATION_MESSAGES.defaultTitle`.
- `app/(dashboard)/history/page.tsx` — **NOUVEAU** : page serveur, `getUser()`, lectures `conversations` (tri décroissant + `.limit(HISTORY_LIMIT)`) puis `messages` (`select("conversation_id, role")` + `.in(...)`) seulement si la 1re lecture ramène des lignes, `buildHistoryItems`, nav `/history` active. Squelette : `app/chat/[id]/page.tsx` l. 20-58, visuel : `app/page.tsx` l. 152-176.
- `app/(dashboard)/history/history.module.css` — **NOUVEAU** : liste, lien, titre, date, compteur, état vide ; tokens de `app/page.module.css` (`.conversations`, `.conversationLink`, `.conversationTitle`, `.conversationDate`, `.empty`).
- `lib/dashboard/helpers.ts` — **RÉUTILISER SANS MODIFICATION** : `formatRelativeDate()` l. 57-79, `getNavItems()` l. 43-48.
- `app/chat/[id]/page.tsx` — **NE PAS MODIFIER** : reprise avec citations déjà en place (4.4).
- `supabase/migrations/0001_init.sql` l. 33-49 — `conversations(id, owner_id, title, created_at)` : **ni `updated_at` ni compteur** ; RLS `owner_conversations` / `owner_messages` = isolation `auth.uid()`.
- `lib/supabase/middleware.ts` — **NE PAS MODIFIER** : `decideRouteGuard` protège déjà `/history`.
- `scripts/history.test.ts` + `package.json` — **NOUVEAU** : `test:history`, une assertion par ligne de matrice + audit statique `owner_id`.

## Tasks & Acceptance

**Execution:**
- [ ] `lib/chat/conversations.ts` -- `buildHistoryItems()` : validation des lignes, repli titre/date, tri décroissant, plafond `HISTORY_LIMIT`, jointure des comptes -- cœur pur et testable, une ligne de la matrice par cas.
- [ ] `app/(dashboard)/history/page.tsx` -- Page serveur : deux lectures RLS, `buildHistoryItems`, rendu liste/état vide, nav `/history` active -- rend la route existante dans la navigation.
- [ ] `app/(dashboard)/history/history.module.css` -- Styles de la liste et de l'état vide, mobile-first, mêmes tokens que le tableau de bord -- cohérence DESIGN.md.
- [ ] `scripts/history.test.ts` + `package.json` -- Tests hors réseau (tri, comptes, lignes invalides, limite, isolation par audit statique) ; script `test:history`.

**Acceptance Criteria:**
- Given plusieurs conversations, when l'utilisateur ouvre `/history`, then elles sont listées de la plus récente à la plus ancienne, avec titre, date relative et nombre d'échanges.
- Given une conversation listée, when l'utilisateur la rouvre, then `/chat/<id>` recharge l'échange complet avec ses citations.
- Given aucune conversation, when l'utilisateur ouvre `/history`, then un état vide invite à démarrer une discussion via un lien vers `/chat`.
- Given la session d'un autre utilisateur, when il ouvre `/history`, then il ne voit que ses propres conversations (RLS, aucun `owner_id` transmis par le client).
- Given une liste affichée, when l'utilisateur navigue, then l'onglet « Historique » est marqué actif et aucune écriture n'a eu lieu.

## Implementation Notes

- 2026-09-27 — Mesure live (session reelle, serveur dev) : `GET /history` -> **HTTP 200** (404 avant), **38 conversations** listees = exactement les 38 renvoyees par la RLS sans aucun filtre `owner_id` ; compteurs « 4, 1, 1, 1… » (la conversation de 4 questions affiche « 4 échanges ») ; dates relatives correctes (« Il y a 46 min », « Il y a 1h »).
- 2026-09-27 — L'audit statique de la ligne ISOLATION ne doit porter que sur le **code** : le commentaire de la page cite volontairement `owner_id` pour expliquer pourquoi on ne l'utilise pas. Le test retire commentaires de ligne et de bloc avant d'affirmer.
- 2026-09-27 — Aucun changement de RLS ni de migration : `owner_conversations` filtre deja par `auth.uid()`, l'isolation R-7 est donc structurelle et non recitee cote page.

## Plan Change Log

## Review Triage Log

- 2026-09-27 — Passe `thorough` (auto). **Lentilles sous-agent indisponibles** (aucun outil de delegation) : revue executee sur les 4 fichiers du diff, croisee avec la matrice I/O et les AC. `NO_VCS` : pas de diff staged possible.
- Verdicts : high 0, medium 0, low 2, false 0, maybe-false 0.

| # | Finding | Verdict | Route | Evidence | Action |
|---|---------|---------|-------|----------|--------|
| 1 | Deux instructions `import` distinctes pour le meme module dans la page | low | patch | `page.tsx` l. 6-7 avant patch | Fusion en un seul import |
| 2 | Bloc `buildHistoryItems` insere dans le corps de `rowsToInitialMessages` (accolade fermante manquante) | low | patch | `tsc` : « Modifiers cannot appear here » l. 135/166/211, des la premiere ecriture | Accolade de fin de fonction repliquee avant le bloc ; typecheck vert, 8/8 tests |

- 1 `defer` : la date affichee est `created_at` (la table n'a pas d'`updated_at`), donc une conversation relancée aujourd'hui peut apparaitre sous une date ancienne. Cf. `deferred-work.md`.


## Design Notes

- **Pas de « dernière activité »** : `conversations` n'a pas de colonne `updated_at` (0001_init.sql l. 34-39) et le PRD ne le demande pas ; la date affichée est donc `created_at`. Ajouter la colonne serait une migration hors périmètre.
- **Comptage en deux requêtes** plutôt qu'un `messages(count)` PostgREST imbriqué : la logique de jointure reste dans un helper pur testable, sans dépendre de la version de PostgREST de l'hébergeur.
- **La reprise ne demande aucun travail de plus** : le lien vers `/chat/[id]` suffit, la relecture avec citations est déjà en place depuis la story 4.4.

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur TS
- `npm run lint` -- expected: 0 erreur
- `npm run test:history` -- expected: tous verts
- `npm run test:conversation && npm run test:dashboard` -- expected: non-régression (modules voisins)

**Manual checks (if no CLI):**
- `/history` : ordre décroissant, dates relatives correctes, compteurs cohérents ; clic → fil rechargé avec citations.
- `/history` avec 0 conversation : état vide + lien ; onglet « Historique » actif.

## Open Questions

1. **« Nombre d'échanges » : tours ou messages ?** (a) Compter les **tours** (une question + sa réponse = 1 échange) : « 3 échanges » pour 6 messages, conforme au vocabulaire du PRD/UX. (b) Compter les **messages** : « 6 messages », plus brut mais sans interprétation. Recommandation : (a).
