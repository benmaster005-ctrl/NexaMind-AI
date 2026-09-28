---
title: 'Story 5.1 — Résumé automatique d''une ressource en points clés'
type: 'feature'
ticket: '5.1'
created: '2026-09-27'
status: 'built'
baseline_revision: 'NO_VCS (git absent de la machine — pas de staging possible)'
review: 'thorough'
review_source: 'auto'
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

**Problem:** un collaborateur doit lire un document long en entier pour en tirer l'essentiel (UJ-6). FR-14 demande un résumé en points clés d'une ressource au statut `Prête`, sans conserver de Ressource ni entrer dans l'index.

**Approach:** un service pur `lib/ai/summary.ts` (dépendances injectées, testable hors réseau) construit le prompt et découpe la réponse en puces ; une Server Action lit les morceaux de la ressource via RLS, appelle `generateText`, et renvoie puces + lien signé vers le fichier ; la fiche `/resources/[id]` affiche la métadonnée, le bouton « Résumer » et la synthèse dans un tiroir.

## Boundaries & Constraints

**Always:**
- Résumé réservé au statut `Prête` avec au moins un morceau ; 5 à 8 puces, en français, en moins de 10 s.
- Génération via `generateText` + `gemini-3.1-flash-lite` (validé en flux, ~5 s). Le SDK est épinglé à `ai@4.3.19` / `@ai-sdk/google@1.2.22` : les modèles « pensants » (`gemini-flash-latest`, `gemini-2.5-flash-lite`) renvoient **0 caractère** — ne pas y revenir sans upgrade du SDK.
- Clé lue côté serveur via `getGeminiApiKey()` ; entrée bornée (plafond de contexte) avant l'appel.
- Renvoi vers le document complet : URL signée du bucket `documents` (`createSignedUrl`), jamais de lecture du fichier par le navigateur.
- Action ouverte à tout utilisateur authentifié : FR-14 vise les collaborateurs, pas l'admin.

**Never:**
- Aucune écriture en base : le résumé n'est ni stocké, ni indexé, ni rejoué par la recherche (AC « ne pollue pas la base vectorielle »).
- Aucun cache : chaque clic régénère (~5 s), l'état `pending` du bouton suffit contre le double-clic.
- Aucun rôle admin requis, aucun nouveau middleware, aucun nouveau rate-limiter.
- Ne pas toucher à `/chat`, à l'ingestion, ni aux migrations SQL.

## Décisions (2026-09-27, approbation humaine)

- **Point d'entrée :** créer la page `/resources/[id]` (option a) plutôt qu'un bouton dans la carte de recherche. Elle est **déjà liée par les résultats de recherche** et renvoie 404 aujourd'hui : la créer corrige ce 404 et respecte la story (« fiche de consultation ») comme l'UJ-6.
- **Régénération :** aucun cache ni stockage (PRD : « le résumé n'est pas conservé comme Ressource et n'entre pas dans l'index »).
- **Périmètre :** plan complet conservé malgré un dépassement de la fenêtre de tokens conseillée, ce qui est sans risque ici : un seul livrable, des chemins de fichiers explicites et des tests hors réseau.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | `Prête`, 6 morceaux, clic « Résumer » | 5-8 puces + `documentUrl` signé, < 10 s | No error expected |
| TOO_SHORT | `Prête`, contenu cumulé < 400 caractères | Message « ce document ne nécessite pas de synthèse », 0 appel IA | Aucun appel Gemini |
| NOT_READY | statut `En cours` / `Échec` | Message FR : ressource non indexée | Aucun appel Gemini |
| UNAUTH | session absente | Message de connexion, 0 appel IA | Aucun appel Gemini |
| GEN_FAILURE | Gemini vide / erreur / trop lent | Message FR d'échec, aucune puce affichée | Aucun crash, tiroir refermable |

</frozen-after-approval>


## Code Map

- `lib/ai/summary.ts` — **NOUVEAU** : `SUMMARY_MODEL = "gemini-3.1-flash-lite"`, `SUMMARY_MESSAGES`, `MIN_SOURCE_CHARS = 400`, `MAX_SOURCE_CHARS`, `buildSummaryPrompt()`, `parseBullets()`, `summarizeResource(deps)` — dépendances injectées, aucun import réseau (modèle : `lib/ai/chat.ts`).
- `app/(dashboard)/resources/[id]/actions.ts` — **NOUVEAU** : `"use server"` + `summarizeResourceAction(resourceId)`; lecture RLS de `resources` puis `document_chunks` (ordre `chunk_index`), `summarizeResource`, URL signée. Schéma `{ success, message }` copié de `app/(dashboard)/admin/resources/actions.ts` (l. 23-27) **sans** contrôle rôle admin.
- `app/(dashboard)/resources/[id]/page.tsx` — **NOUVEAU** : page serveur, `createClient()` + `getUser()`, `select("id, title, category, status, created_at, tags")`, 404 si absente. Squelette : auth + nav de `app/chat/[id]/page.tsx`.
- `components/resources/summary-sheet.tsx` + `.module.css` — **NOUVEAU** : bouton « Résumer », `pending`, tiroir réutilisant `drawer`/`backdrop` de `components/chat/chat-client.tsx` (l. 386-420), puces, lien document, `role="dialog"`.
- `lib/ai/embeddings.ts` — réutiliser `getGeminiApiKey()` (l. 47-60) ; **ne pas modifier** `EMBEDDING_MODEL`.
- `components/search/search-client.tsx` l. 179 — lien `/resources/${resourceId}` déjà présent : la page le rend fonctionnel, **fichier non modifié**.
- `scripts/summary.test.ts` + `package.json` — **NOUVEAU** : `test:summary`, sur le modèle de `scripts/chat.test.ts` (node --test, dépendances factices, aucun réseau).

## Tasks & Acceptance

**Execution:**
- [ ] `lib/ai/summary.ts` -- Service pur : prompt structuré (5-8 puces, français, « n'invente rien »), `parseBullets` tolérant aux puces `-`/`•`/numérotées et plafonné à 8, refus si source trop courte, bornage de l'entrée, `gemini-3.1-flash-lite` -- garde-fou zéro-hallucination aligné sur AD-1.
- [ ] `app/(dashboard)/resources/[id]/actions.ts` -- Server Action : auth, lecture RLS ressource + morceaux, refus si statut ≠ `Prête` ou contenu trop court, `generateText` non-streaming, URL signée du bucket `documents` -- AD-4 (clé jamais côté client) + AC « renvoi vers le document complet ».
- [ ] `app/(dashboard)/resources/[id]/page.tsx` -- Page serveur : métadonnées, 404 si introuvable, bouton visible uniquement si `status === "Prête"` -- crée la fiche manquante et implémente FR-14.
- [ ] `components/resources/summary-sheet.tsx` + `summary-sheet.module.css` -- Tiroir accessible (focus à l'ouverture, `role="dialog"`, fermeture clavier), puces, lien document, états chargement/erreur -- AC UI, mobile-first comme le tiroir de citations existant.
- [ ] `scripts/summary.test.ts` + `package.json` -- Tests hors réseau couvrant chaque ligne de la matrice I/O, dont l'absence d'écriture en base ; script `test:summary`.

**Acceptance Criteria:**
- Given une ressource `Prête` au contenu suffisant, when l'utilisateur clique « Résumer », then 5 à 8 puces s'affichent en moins de 10 secondes.
- Given un résumé affiché, when l'utilisateur suit « Ouvrir le document », then le fichier s'ouvre via une URL signée du bucket `documents`.
- Given une ressource `En cours`/`Échec` ou un contenu trop court, when l'utilisateur demande le résumé, then un message français explicite s'affiche sans appel à Gemini.
- Given n'importe quel usage, when la génération s'exécute, then aucune ligne n'est écrite dans `resources`, `document_chunks` ou l'index vectoriel.
- Given l'absence de session, when l'action est appelée, then aucun appel IA n'est effectué et un message de connexion est renvoyé.

## Implementation Notes

- 2026-09-27 — `ai@4.3.19` n'expose pas `maxOutputTokens` : l'option est `maxTokens: 600` (garde-fou sur la duree de generation, 8 puces courtes).
- 2026-09-27 — `documentUrl` est nullable : si `createSignedUrl` echoue, la synthese reste affichee sans le lien. L'AC « renvoi vers le document complet » ne doit pas faire perdre le resume.
- 2026-09-27 — Couverture de la matrice : les lignes HAPPY_PATH / TOO_SHORT / NOT_READY / GEN_FAILURE sont couvertes par des tests du service pur ; la ligne UNAUTH et l'AC « aucune ecriture » par deux tests d'audit statique de l'action (`getUser()` avant l'appel IA, absence de `.insert(/.update(/.delete(/.upsert(`), convention deja utilisee pour le SQL et le composant de chat.
- 2026-09-27 — Mesure live reelle (meme chemin de code que l'action, vrai document) : « Procedure de suivi des projets clients » (1 chunk) -> **3,7 s, 8 puces**, `partial=false`, URL signee generee, page `/resources/[id]` en HTTP 200. Les puces reprennent uniquement des faits presents dans le document (offres Solo/Team/Projet, 5 jours ouvres, 65 EUR/h, archivage 5 ans).
- 2026-09-27 — Page serveur : `notFound()` si la ressource est invisible par RLS, `redirect("/login")` sans session ; le bouton « Resumer » n'est rendu que si le statut est `Prête` (import de `READY_STATUS`, source unique de verite).

## Plan Change Log

## Review Triage Log

- 2026-09-27 — Passe `thorough` (auto). **Lentilles sous-agent non disponibles dans cet environnement** (aucun outil de delegation) : `blind-hunter`, `edge-case-hunter` et les lentilles persona n'ont pas ete lancees ; la passe a ete executee en auto-revue sur les 6 fichiers crees, croisee avec la matrice I/O et les AC du plan. `NO_VCS` : pas de diff staged possible (`git` absent), revue faite sur l'etat disque.
- Verdicts : high 0, medium 2, low 3, false 0, maybe-false 0.

| # | Finding | Verdict | Route | Evidence | Action |
|---|---------|---------|-------|----------|--------|
| 1 | `redirect("/login")` place dans un `try/catch` : le `catch` avale l'erreur interne de Next et renvoie 404 au lieu de rediriger | medium | patch | `app/(dashboard)/resources/[id]/page.tsx` avant patch : `redirect` ligne 45, `try` ligne 40, `catch { resource = null }` ligne 54 | Auth et `redirect` sortis du `try` ; test d'audit statique ajoute (le `redirect` doit preceder le premier `try`) |
| 2 | Lignes UNAUTH et « aucune ecriture » de la matrice sans test couvrant | medium | patch | Matrice I/O + AC « aucune ligne n'est ecrite » sans assertion | 2 tests d'audit statique de l'action : garde `getUser()` avant l'appel IA, absence de `.insert(/.update(/.delete(/.upsert(` |
| 3 | TTL de l'URL signee a 5 min : le lien expire avant lecture puis clic | low | patch | `SIGNED_URL_TTL_SECONDS = 300` | Portee a 900 s (le lien doit survivre a la lecture du resume) |
| 4 | Tiroir `role="dialog"` sans fermeture clavier | low | patch | `components/resources/summary-sheet.tsx` : backdrop + bouton de fermeture uniquement | Ajout d'un `keydown` sur `Escape` avec nettoyage de l'ecouteur |
| 5 | Les puces s'affichaient avec le markdown brut (`**gras**`, `` `code` ``) | low | patch | L'UI rend du texte simple ; un test ecrit sur l'hypothese « emphase en tete seulement » a echoue en realite | `cleanBullet` traite l'emphase inline puis les marqueurs de bord ; test aligned sur le comportement reel |

- Aucun `defer` : les pistes ecartees (rate-limiter d'API, plafond de lecture des morceaux) sont deja couvertes par le bloc fige (« aucun nouveau rate-limiter ») ou bornees en amont (televersement limite a 10 Mo par la story 2.1).

## Design Notes

- **Contrainte SDK (à ne pas réintroduire) :** `gemini-flash-latest` et `gemini-2.5-flash-lite` produisent 0 caractère avec `@ai-sdk/google@1.2.22` (mesuré en flux sur le vrai prompt RAG), avec des latences de 13 à 51 s ; `gemini-3.1-flash-lite` répond en ~5 s avec `finishReason: stop`. L'epic cite « Gemini 1.5 Flash », retiré de l'API : on suit le modèle validé, pas l'epic.
- **Entrée bornée :** les morceaux sont concaténés dans l'ordre de `chunk_index` puis tronqués à `MAX_SOURCE_CHARS` ; au-delà, message de « résumé partiel » (cas limite UJ-6 du PRD).
- **Pourquoi une page plutôt qu'un bouton dans la carte de recherche :** la carte pointe déjà vers `/resources/[id]` (404 aujourd'hui) ; créer la fiche corrige le 404, respecte la story et l'UJ-6, et sert de socle aux stories suivantes.

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur TS
- `npm run lint` -- expected: 0 erreur
- `npm run test:summary` -- expected: tous verts
- `npm run test:rag && npm run test:chat && npm run test:conversation` -- expected: non-régression (le flux de chat n'est pas modifié)

**Manual checks (if no CLI):**
- `/search` → cliquer un résultat : la fiche s'ouvre (plus de 404) ; « Résumer » rend 5-8 puces en moins de 10 s ; « Ouvrir le document » charge le fichier.
- Console navigateur : aucun avertissement React ; une seule requête vers l'action serveur par clic.

