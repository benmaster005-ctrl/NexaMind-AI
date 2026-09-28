---
title: 'Story 6.1 — Consultation du document et ancrage au passage cité'
type: 'feature'
ticket: '6.1'
created: '2026-09-27'
status: 'built'
review: 'thorough'
review_source: 'auto'
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

**Problem:** le PRD veut qu'un résultat de recherche « mène à la Ressource, au passage concerné » (FR-8/FR-9) et que « cliquer sur une Citation ouvre la Ressource au passage utilisé » (FR-11). En réalité : la fiche `/resources/[id]` (story 5.1) n'affiche que des métadonnées, et ledit contenu s'obtient en téléchargeant le fichier. Le lien des résultats de recherche et les puces `[n]` du chat mènent donc à une page sans le texte.

**Approach:** la fiche lit les morceaux **déjà stockés** en base (`document_chunks.content`, RLS lecture ouverte aux authentifiés) et rend le document en sections, une par morceau, sans JavaScript de contenu. Une ancre `?chunk=<uuid>` marque le passage ciblé : surlignage par le serveur, défilement par un composant client minimal. Aucune migration, aucun appel IA, aucun nouveau stockage.

## Boundaries & Constraints

**Always:**
- Contenu rendu en **texte React**, jamais de HTML brut : `dangerouslySetInnerHTML` interdit (XSS).
- Le serveur marque le passage actif (`data-active`) à partir de `?chunk=` : l'URL reste partageable et lisible sans JavaScript.
- Ordre de lecture = `chunk_index` croissant, identique à celui utilisé par l'ingestion et la recherche.
- Ressource sans morceau indexé → fiche consultable, message explicite, **pas** de zone vide.
- Passage inexistant (ressource supprimée, id forgé) → document complet affiché, sans surlignage, sans erreur.

**Never:**
- Pas de migration SQL, pas de nouvelle table, pas de colonnes ajoutées.
- Pas d'appel Gemini sur cette page (le résumé existe déjà, story 5.1).
- Ne pas casser la fiche 5.1 : métadonnées, statut, notice « pas encore indexé », bouton « Résumer » et URL signée inchangés.
- Ne pas modifier `lib/ai/*` ni le moteur de recherche.

## Décisions (2026-09-27, approbation humaine)

- **Puce `[n]` → tiroir inchangé**, avec un lien « Ouvrir dans le document » **dans** le tiroir (`:/resources/<id>?chunk=<uuid>`). On respecte ainsi l'artefact UX (« chips [1] […] mapped to an anchored source drawer ») tout en atteignant l'intention de FR-11 (« la Citation ouvre la Ressource au passage utilisé ») : l'utilisateur voit l'extrait *puis* décide d'ouvrir le passage.
- **Plafond de troncature `MAX_VIEW_CHARS = 120_000`** intégré au plan, avec mention visible + lien vers le fichier complet.
- **Périmètre** : plan complet conservé au-delà de la fenêtre de tokens conseillée (≈2 245) — un seul livrable (lire le document et atterrir sur le passage), chemins explicites, tests hors réseau.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | 6 morceaux, `?chunk=<id du 3e>` | Document complet en 6 sections, 3ᵉ marquée active et visible au chargement | Aucun |
| SEARCH_JUMP | arrive de `/search`, `?chunk` = morceau ayant matché | Le passage ayant déclenché la correspondance est mis en avant | Aucun |

## Code Map

- `lib/resources/view.ts` — **NOUVEAU (pur)** : `MAX_VIEW_CHARS = 120_000`, `buildDocumentView(rows, { targetChunkId, maxChars })` → `{ chunks: [{ id, index, text, isActive }], totalChunks, truncated, chars }`. Trie par `chunk_index`, marque l'ancre valide, tronque en fin de document. Aligné sur `lib/ai/summary.ts` (bornage explicite + mention).
- `app/(dashboard)/resources/[id]/page.tsx` — **MODIFIER** : accepter `searchParams.chunk`, lire `document_chunks` (`select("id, chunk_index, content")`, `.order("chunk_index", { ascending: true })`), appeler `buildDocumentView`, rendre les sections + `<ChunkAnchor>`. Ne pas toucher l'existant (auth hors `try`, métadonnées, `SummarySheet`).
- `components/resources/chunk-anchor.tsx` — **NOUVEAU** : client, ~15 lignes, `useEffect` qui fait `scrollIntoView({ block: "center" })` sur `[data-active="true"]` au montage. Seul JavaScript de la page.
- `components/search/search-client.tsx` l. 179 — **MODIFIER** : `href={`/resources/${r.resourceId}${r.chunkId ? `?chunk=${r.chunkId}` : ""}`}`. Le `ApiSearchResult` contient déjà `chunkId`.
- `components/chat/chat-client.tsx` l. 424 (tiroir de citations) — **MODIFIER** : ajouter un lien « Ouvrir dans le document » → `/resources/${citation.sourceId}?chunk=${citation.chunkId}`, rendu seulement si `chunkId` existe. `RagCitation` (`lib/ai/rag.ts`) porte déjà `sourceId` et `chunkId`.
- `app/(dashboard)/resources/[id]/resource-fiche.module.css` — **MODIFIER** : styles de section, de surlignage actif, de mention de troncature.
- `scripts/resource-view.test.ts` + `package.json` — **NOUVEAU** : `test:resource-view`, une assertion par ligne de matrice + audit statique (absence de `dangerouslySetInnerHTML`).

## Tasks & Acceptance

**Execution:**
- [ ] `lib/resources/view.ts` -- Vue de document pure : tri, ancre active, troncature bornée -- toute la logique de la matrice est testable hors réseau.
- [ ] `app/(dashboard)/resources/[id]/page.tsx` -- Lecture des morceaux (RLS), `?chunk`, rendu des sections, états « sans contenu » et « tronqué » -- rend le document lisible, c'est le cœur de la story.
- [ ] `components/resources/chunk-anchor.tsx` -- Défilement vers l'ancre au montage, sans casser le rendu serveur -- rend l'ancre réellement visible.
- [ ] `components/search/search-client.tsx` -- Le lien du résultat porte l'ancre du morceau ayant matché -- FR-8/FR-9.
- [ ] `components/chat/chat-client.tsx` -- Lien « Ouvrir dans le document » dans le tiroir de citation -- FR-11.
- [ ] `scripts/resource-view.test.ts` + `package.json` -- Tests hors réseau + audit XSS/ancrage ; script `test:resource-view`.

**Acceptance Criteria:**
- Given une ressource indexée, when l'utilisateur ouvre sa fiche, then le contenu intégral du document s'affiche en sections dans l'ordre, lisible sur mobile et desktop.
- Given l'arrivée depuis une recherche ou une citation, when la fiche s'ouvre, then le passage visé est surligné et visible sans défilement manuel.
- Given une puce de citation `[n]`, when l'utilisateur l'ouvre puis suit « Ouvrir dans le document », then il atterrit sur la fiche, sur le passage utilisé.
- Given un contenu contenant du HTML, when la fiche s'affiche, then il est rendu comme texte, jamais interprété.
- Given une ressource sans morceau indexé, when l'utilisateur ouvre la fiche, then un message explicite remplace la zone de contenu.

## Implementation Notes

- 2026-09-27 — **Vérifié en live** (« Note projet », 6 morceaux) : fiche sans ancre → 6 sections, aucun actif ; `?chunk=<2e morceau>` → 6 sections, **exactement 1 active** ; ancre inexistante → document complet, aucun surlignage, aucune erreur ; ancre injectée `"><img src=x onerror=alert(1)>` → **aucune balise non échappée** (le payload n'apparaît qu'échappé dans la charge RSC), 6 sections intactes. Résultat de recherche sémantique porteur d'un `chunkId` → l'ancre est bien transmise.

## Plan Change Log

## Review Triage Log

- 2026-09-27 — Passe `thorough` (auto). **Lentilles sous-agent indisponibles** : revue sur les 7 fichiers du diff + vérification live des 6 lignes de matrice. `NO_VCS`.
- Verdicts : high 0, medium 1, low 2, false 0, maybe-false 0.

| # | Finding | Verdict | Route | Evidence | Action |
|---|---------|---------|-------|----------|--------|
| 1 | Le passage actif n'était signalé que par la couleur | medium | patch | Fiche : fond bleu + bordure, rien d'autre | Badge visible « Passage cité » + `aria-current="true"` sur la section ; assertion de non-régression ajoutée |
| 2 | La mention de troncature promettait « Ouvrez le fichier pour la version complète » alors que la fiche n'expose aucun lien vers le fichier | low | patch | L'URL signée n'est disponible que dans le tiroir de résumé (story 5.1) | Mention reformulée sans promesse inexistante + assertion qui empêche sa réapparition |
| 3 | Un test d'audit comptait l'import et l'appel de `useEffect` | low | patch | `resource-view.test.ts` : 2 occurrences au lieu de 1 | Comptage restreint à `useEffect(` (l'appel seul) |

- Note de méthode : deux « échecs » de vérification live venaient de **mes** méthodes de mesure (libellé compté dans le balisage *et* dans la charge RSC ; recherche d'une sous-chaîne d'injection au lieu d'une balise). Le code n'a pas été modifié pour ces deux cas ; ce sont les vérifications qui ont été corrigées, puis rejouées.

## Design Notes

- **Ancre `?chunk=` plutôt que `#chunk-`** : le paramètre est lisible par le serveur, qui peut marquer l'ancre active **au rendu** (surbrillance sans JavaScript, URL partageable, tests possibles). Le hash aurait imposé `:target` en CSS et un défilement natif dont le comportement varie lors d'une navigation client Next.
- **Plafond `MAX_VIEW_CHARS`** : l'ingestion accepte des fichiers de 10 Mo ; rendre 10 Mo de texte en un seul rendu serveur serait lent. Le document est donc tronqué **avec mention visible** et un lien vers le fichier complet — jamais une troncature silencieuse.
- **Pas de client pour le texte** : le contenu reste du JSX ; seul le défilement est côté client. La fiche reste lisible si le JavaScript échoue.

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur TS
- `npm run lint` -- expected: 0 erreur
- `npm run test:resource-view` -- expected: tous verts
- `npm run test:search-ui && npm run test:chat-ui && npm run test:summary` -- expected: non-régression

**Manual checks (if no CLI):**
- `/search` → un résultat : la fiche s'ouvre sur le morceau ayant matché, surligné.
- Chat → puce `[1]` → tiroir → « Ouvrir dans le document » : la fiche s'ouvre sur le passage cité.
- Fiche d'une ressource sans morceaux → message explicite, aucune zone vide.

| CITATION_JUMP | arrive d'une puce `[n]` | Même ancre : le passage utilisé pour la réponse est mis en avant | Aucun |
| NO_CHUNKS | ressource `Prête` sans morceau | Fiche + message « contenu non disponible », pas de zone vide | Aucun |
| BAD_ANCHOR | `?chunk` absent, vide ou inconnu | Document complet, aucun surlignage, aucune erreur | Aucun |
| HUGE_DOC | contenu > `MAX_VIEW_CHARS` | Affichage tronqué **avec mention explicite** + lien vers le fichier complet | Aucun |

</frozen-after-approval>
