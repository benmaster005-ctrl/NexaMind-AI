---
title: '2.2 Pipeline d-extraction de texte et decoupage en morceaux (chunking)'
type: 'feature'
ticket: '2'
created: '2026-09-27'
status: 'built'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
review: 'step-04-review'
review_source: 'auto'
lenses_ran: ['edge-case-hunter', 'verification-gap']
review_loop_iteration: 0
context:
  - `_bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md`
  - `_bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md`
  - `_bmad-output/implementation-artifacts/plan-2-1-televersement-admin-storage.md`
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les documents deposes restent des fichiers bruts : rien n'extrait leur texte, rien ne les decoupe en morceaux, et une ressource illisible (PDF scanne, fichier corrompu) reste bloquee en 'En cours' sans explication. FR-6 et AD-3 ne sont pas couverts.

**Approach:** Extraire le texte des PDF/DOCX/TXT/MD cote serveur, decouper en morceaux de 400-500 tokens (chevauchement ~50 tokens, titre du document conserve dans chaque morceau), persister ces morceaux dans `document_chunks` sans embedding (les vecteurs arrivent en story 2.3), et marquer la ressource 'Echec' + raison FR affichee quand l'extraction echoue.

**Decisions validees (2026-09-27) :** mesure des tokens par estimateur local deterministe `ceil(caracteres / 4)` (Gemini reste le fournisseur d'embeddings de la story 2.3, AD-3 ; aucune cle Gemini n'existe encore dans `.env.local`) ; la story 2.2 persiste les morceaux dans `document_chunks` (embedding NULL) et la story 2.3 n'ajoutera que les vecteurs avant le statut 'Prete' ; le plan complet est conserve (objectif unique, non scindable).

## Boundaries & Constraints

**Always:** extraction + decoupage cote serveur uniquement (AD-4) ; mesure des tokens par estimateur deterministe exporte et teste ; titre du document prefixe a chaque morceau ; chevauchement d'environ 50 tokens ; messages FR ; reutiliser `lib/supabase/server.ts`, la garde 1.3 et `lib/resources/validation.ts` ; statuts FR 'En cours'/'Prete'/'Echec' ; `resources.error_message` rempli seulement en cas d'echec ; re-ingestion idempotente (remplacement des morceaux).

**Never:** pas d'embeddings Gemini ni de statut 'Prete' (story 2.3) ; pas de bouton de relance ni de suppression/modification de ressource (2.3/2.4) ; pas de recherche ni de chat (epic 3) ; aucune cle secrete cote navigateur ; aucune DDL hors migration SQL versionnee ; ne pas modifier la garde 1.3, les pages auth, le tableau de bord 1.4, les migrations 0001/0002 existantes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Depot texte exploitable | admin, PDF texte/DOCX/TXT/MD <= 10 Mo, texte non vide | N morceaux persistes dans `document_chunks` (index 0..N-1, titre dans chacun), `chunk_count = N`, statut reste 'En cours' | No error expected |
| PDF scanne | PDF sans texte extractible (< 50 caracteres) | ressource 'Echec' | raison FR « PDF scanne ou sans texte extractible — l'OCR n'est pas supporte » affichee dans la liste |
| Fichier corrompu/illisible | le parser leve | ressource 'Echec', serveur debout | raison FR « Fichier illisible ou corrompu » |
| Fichier vide | TXT/MD vide apres normalisation | ressource 'Echec' | raison FR « Aucun contenu textuel detecte » |
| PDF trop long | plus de 300 pages | ressource 'Echec' | raison FR « Document trop volumineux pour l'ingestion » |
| Re-ingestion | morceaux deja presents | remplacement total des morceaux | No error expected |
| Migration 0003 non jouee | ecriture des morceaux refusee | ressource 'Echec' | raison FR invitant a jouer `0003_ingestion_chunks.sql` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0003_ingestion_chunks.sql` (nouveau) -- `resources.error_message` + `chunk_count`, policies update `resources` et insert/delete `document_chunks` (`to authenticated`), index unique `(resource_id, chunk_index)` ; a jouer par l'humain (SQL Editor).
- `lib/ai/chunking.ts` (nouveau) -- module pur : `estimateTokens`, `normalizeText`, `chunkDocument({ resourceId, title, text })` ; bornes 400 / 500 / 50.
- `lib/ai/extraction.ts` (nouveau) -- `extractText({ data, fileName, readers? })` ; dispatch par extension ; readers par defaut = `unpdf` (PDF) et `mammoth` (DOCX) charges en import dynamique ; `ExtractionError` avec `code` + message FR.
- `lib/ingestion/ingest-resource.ts` (nouveau) -- service serveur : Storage -> extraction -> chunking -> remplacement des morceaux + `status`/`error_message`/`chunk_count` ; ne leve jamais.
- `app/(dashboard)/admin/resources/actions.ts` (modifie) -- recuperer l'id insere puis appeler `ingestResource` ; message FR de succes / ingestion en echec ; conserver role admin, validation 2.1 et rollback anti-orphelin.
- `app/(dashboard)/admin/resources/page.tsx` (modifie) -- afficher `chunk_count` et la raison d'echec (styles `dashboard.module.css`).
- `scripts/chunking.test.ts` + `scripts/ingestion.test.ts` (nouveaux) -- decoupage, extraction, orchestration avec faux client Supabase et faux readers.
- `package.json` (modifie) -- dependances `unpdf` + `mammoth` et script `test:ingestion` calque sur `test:resources`.
- Reutiliser tel quel : `lib/supabase/server.ts`, `lib/resources/validation.ts`, garde 1.3, `components/resources/upload-form.tsx`, `scripts/check-supabase.mjs`, migrations 0001 (`document_chunks.embedding` nullable) et 0002. `next.config.ts` : a n'ouvrir que si le build echoue sur le bundling de `unpdf`.


## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/0003_ingestion_chunks.sql` -- ecrire la migration idempotente -- debloque l'ecriture des morceaux, la raison d'echec et le compteur.
- [ ] `package.json` -- ajouter `unpdf` + `mammoth` (dependencies) et le script `test:ingestion` -- parsers serveur et tests hors reseau.
- [ ] `lib/ai/chunking.ts` -- implementer normalisation, estimateur et decoupage 400-500 / chevauchement 50 -- AD-3 et FR-6.
- [ ] `lib/ai/extraction.ts` -- implementer le dispatch PDF/DOCX/TXT/MD et les erreurs typees -- detecte PDF scanne, fichier corrompu, vide.
- [ ] `lib/ingestion/ingest-resource.ts` -- implementer l'orchestration et les transitions de statut -- pipeline reellement declenche au depot.
- [ ] `app/(dashboard)/admin/resources/actions.ts` -- brancher l'ingestion apres insert (recuperer l'id insere) -- « immediatement apres le depot » (FR-6).
- [ ] `app/(dashboard)/admin/resources/page.tsx` -- afficher `chunk_count` et `error_message` -- FR-6 « affiche la raison de l'echec ».
- [ ] `scripts/chunking.test.ts` et `scripts/ingestion.test.ts` -- couvrir la matrice I/O -- preuve reproductible sans reseau.

**Acceptance Criteria:**
- Given un admin connecte deposant un TXT/DOCX/PDF texte de plus de 1 500 caracteres, when le depot aboutit, then `document_chunks` contient N lignes d'index 0..N-1 dont chaque contenu commence par le titre et mesure entre 400 et 500 tokens estimes (seul le dernier morceau peut etre plus court).
- Given deux morceaux consecutifs, when on compare la fin du premier au debut du second, then le chevauchement est d'environ 50 tokens.
- Given un PDF scanne ou un fichier corrompu, when le depot aboutit, then la ressource est en 'Echec' avec une raison FR dans `error_message`, sans exception serveur ni fichier orphelin.
- Given une ressource deja ingeree, when le pipeline rejoue, then le nombre de morceaux est remplace sans doublon d'index.
- Given un collaborateur standard, when il tente un depot, then le comportement 2.1 est inchange (acces refuse / 403).

## Implementation Notes

Realisation directe (pas de sous-agent). A completer pendant le travail :
fichiers touches, choix de lecture Storage, surprises (migration 0003 non
jouee, besoin eventuel de `serverExternalPackages` pour `unpdf`).

## Plan Change Log

## Review Triage Log

## Design Notes

- **Estimateur.** Aucun tokenizer Gemini hors ligne : `estimateTokens = ceil(longueur normalisee / 4)`, source de verite unique, testee (decision du 2026-09-27 ; un comptage Gemini `countTokens` pourra servir de controle croise en story 2.3).
- **Decoupage.** Normalisation (BOM, CRLF -> LF, 3+ sauts -> 2, trim), puis paragraphe -> phrase -> repli sur les mots ; l'unite est coupee durement si elle depasse la fenetre. Le morceau est ferme avant de depasser 500 et le suivant reprend les ~50 derniers tokens, alignes sur une frontiere de mot ; tout morceau > 500 tokens est un bug (test dedie).
- **Titre et fenetre.** Contenu stocke = `# {titre}\n\n{corps}` ; le titre est compte dans la mesure, donc les bornes restent tenues.
- **Readers injectables.** `readers` (optionnel) laisse les tests tourner sans binaire PDF/DOCX ; l'application utilise `unpdf.extractText(getDocumentProxy(data), { mergePages: true })` et `mammoth.extractRawText({ buffer })`, charges par import dynamique a l'appel.
- **Statuts.** Succes = 'En cours' avec `chunk_count > 0` et `error_message` vide : 'Prete' reste reserve a 2.3, car FR-6 fait de 'Prete' la condition pour etre citable. Echec = 'Echec' + raison.
- **Idempotence.** Re-ingestion = suppression des morceaux de la ressource puis insertion ; l'index unique `(resource_id, chunk_index)` bloque tout residu.

## Verification

**Commands:**
- `npm run test:ingestion` -- exit 0, tous les cas de la matrice I/O passent.
- `npm run test:resources` -- exit 0 (non-regression 2.1).
- `npm run typecheck`, `npm run lint`, `npm run build` -- exit 0, `/admin/resources` toujours present.
- `node scripts/check-supabase.mjs` -- AUTH 200, TABLE resources 200.

**Manual checks (if no CLI):**
- Jouer `0003_ingestion_chunks.sql` (action humaine, SQL Editor) puis : `select title, status, chunk_count, error_message from public.resources order by created_at desc limit 5;` et `select resource_id, chunk_index, length(content) from public.document_chunks order by resource_id, chunk_index limit 10;`.
- Deposer un PDF texte et un TXT : statut « En cours », `chunk_count > 0`, titre en tete de chaque morceau ; deposer un PDF scanne : 'Echec' + raison FR visible dans la liste.
