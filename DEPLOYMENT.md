# Déploiement — NexaMind AI

Guide de mise sur Vercel (Projet : `Bmo26/nexamind-ai`). Écrit le 2026-09-28 après
vérification de la documentation Vercel/Next 16 et du code du dépôt.

## 1. Prérequis

| Élément | Valeur | Source |
| --- | --- | --- |
| Node.js | **24.x** (`.nvmrc` = `24`, `engines.node` = `24.x`) | `.nvmrc`, `package.json` |
| Paquets | `npm ci` (lockfile v3) | `package-lock.json` |
| Framework | Next.js **16.3.6** (App Router, `proxy.ts`) | `package.json` |
| Base | Supabase (Postgres + Auth + Storage + pgvector) | `supabase/migrations/` |
| Modèle | Google Gemini (embeddings + génération) | `GEMINI_API_KEY` |

Sur Vercel : **Project Settings → General → Node.js Version = 24** (ou laissez
`.nvmrc` le détecter). Install `npm ci`, Build `npm run build` (le démarrage est
géré par le runtime Next de Vercel, ne pas forcer `next start`).

## 2. Base de données (à faire une fois, dans l'ordre)

1. Exécuter les migrations de `supabase/migrations/` **dans l'ordre numérique**, via
   le SQL Editor ou `supabase db push` : `0001_init` → `0002_storage_resources`
   (bucket privé `documents`) → `0003_ingestion_chunks` →
   `0004_embeddings_vector_storage` → `0005_match_chunks` →
   `0005_resource_management_deletion` → `0006_message_meta` → `0007_search_history`
   → `0008_admin_only_writes`.
2. Vérifier que l'extension `vector` (pgvector) est installée (schéma `extensions`,
   cf. migration 0004).
3. **Promouvoir le premier administrateur** — l'inscription attribue toujours
   `collaborateur` (trigger `on_auth_user_created`, migration 0008) et le dépôt de
   documents exige `app_metadata.role = 'admin'` :

   ```sql
   update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                           || jsonb_build_object('role', 'admin')
    where email = 'prenom.nom@nexaworks.example';
   ```

   L'utilisateur doit **se reconnecter** (le rôle voyage dans le JWT).
4. Côté Auth Supabase : activer ou non « Confirm email » selon la politique choisie,
   et configurer un domaine d'envoi SMTP pour les e-mails de confirmation.

Les migrations ne sont **pas réversibles** telles quelles : sauvegarder la base avant
application, ne pas rejouer une migration déjà appliquée.

## 3. Variables d'environnement (Vercel → Environment Variables)

| Variable | Exposition | Usage |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Publique | URL du projet Supabase (client + serveur) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publique | Clé anon/publishable ; la sécurité vient des politiques RLS, jamais de la clé |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publique | Repli équivalent (lecture dans `lib/supabase/env.ts`) |
| `GEMINI_API_KEY` | **Secrète** (Production/Preview) | Embeddings + génération, lus **côté serveur uniquement** (AD-4) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Secrète | Repli accepté par le SDK Google |

Aucune clé secrète ne doit porter le préfixe `NEXT_PUBLIC_` : elle serait embarquée
dans le bundle navigateur. `models.json` doit rester à `{}` (aucun modèle Edge/
Serverless utilisé ici). Copier `.env.example` pour le poste local.

## 4. Durée maximale des fonctions (`maxDuration`)

Avec **Fluid Compute**, la durée par défaut est déjà **300 s** sur Hobby comme sur
Pro ; un `maxDuration` plus bas est un *plafond* (il borne l'occupation), pas un
remède à un timeout de 10 s. Valeurs posées, alignées sur la charge réelle :

| Route | `maxDuration` | Justification |
| --- | --- | --- |
| `/api/chat` | 120 s | RAG en flux : embedding de la question + RPC + génération |
| `/api/search` | 30 s | Embedding + RPC `match_chunks` : route la plus fréquentée, bornée volontairement |
| `/admin/resources` (Server Action de dépôt) | 300 s | Laisse l'ingestion synchrone (extraction → découpage → embeddings) aller à son terme |
| `/resources/[id]` | 120 s | Résumé à la demande (FR-11) |

Toute autre page reste au défaut plateforme : lui ajouter `export const runtime` ou
`maxDuration` est **inutile**, et ferait reposer la page sur un comportement non testé.

## 5. Dépôt de documents : plafond de 4 Mo (contrainte plateforme)

Le corps d'une requête envoyée à une fonction Vercel est limité à **4,5 Mo** (erreur
`413 function_payload_too_large`). Ce plafond est **infrastructure** : le réglage
`serverActions.bodySizeLimit` de `next.config.ts` ne peut pas le couvrir.

Ce qui est appliqué : `MAX_UPLOAD_BYTES` (`lib/resources/validation.ts`) vaut
**4 Mio** (4 194 304 o) et `bodySizeLimit` = `MAX_UPLOAD_BYTES + 64 Ko` de marge
`multipart/form-data`, soit ~235 Ko sous le plafond. Un test garde-fou
(`scripts/resources-validation.test.ts`) échoue si la constante remonte au-dessus, et
le libellé du formulaire annonce « 4 Mo max ».

**FR-5 prévoyait 10 Mo.** Y revenir suppose de sortir le fichier du corps de la
requête, ce qui est un ticket à part entière et non un réglage :

1. le navigateur téléverse le fichier **directement** dans Supabase Storage — la
   politique `admin_insert_documents` (migration 0008) l'autorise déjà pour un JWT
   admin, et la CSP `connect-src` couvre le domaine Supabase ;
2. une Server Action légère ne reçoit que le **chemin** de l'objet et les
   métadonnées, relit le fichier depuis Storage et lance l'ingestion ;
3. la limite de taille du bucket `documents` est relevée côté Supabase.

La surface exposée change (la validation du type MIME et de la taille doit alors être
refaite côté serveur sur l'objet réellement stocké, pas sur le champ du formulaire) :
à chiffrer et sécuriser séparément avant de toucher à la limite.

## 6. Limites connues avant mise en production réelle

- **Anti-force-brute en mémoire** (`lib/auth/rate-limit.ts`) : compteur par instance.
  Sur serverless, chaque instance a son compteur → le verrou de 5 minutes n'est pas
  garanti. Prévoir un stockeur partagé (Upstash/Redis), déjà inscrit en « Deferred »
  dans l'architecture.
- **Ingestion synchrone** : extraction, découpage et embeddings s'exécutent dans la
  Server Action de dépôt (aucune file d'attente avant la story 8.1). Un document de
  300 pages (garde-fou `MAX_PDF_PAGES`) consomme donc la durée allouée et les appels
  Gemini associés.
- **CSP et `'unsafe-eval'`** : `next.config.ts` envoie `script-src 'self'
  'unsafe-inline' 'unsafe-eval'`. L'éval est requis par le rechargement à chaud de
  `next dev` ; il est normalement superflu en build de production, donc à retirer
  (via un en-tête conditionné par `NODE_ENV`) après vérification en preview.
  `connect-src` ne liste que `'self'` et l'origine Supabase : suffisant aujourd'hui
  (le navigateur n'appelle jamais Gemini, AD-4) et déjà compatible avec un futur
  téléversement direct vers le Storage.
- **Aucune observabilité** configurée (ni Sentry, ni OTel) : les erreurs de fonction ne
  sont visibles que dans Vercel → Runtime Logs.

## 7. Vérification après déploiement

```bash
npm run typecheck   # next typegen + tsc --noEmit
npm run lint
npm run build       # 12 routes, aucune alerte (Turbopack, Next 16.3.6)
npm run test        # 245 tests node --test
```

Parcours de bout en bout sur l'URL déployée : inscription → promotion admin (§ 2.3) →
dépôt d'un PDF d'environ 3 Mo → statut passé à *Traité* avec le nombre de morceaux →
recherche sémantique → réponse citée dans le chat → fiche ressource et résumé →
déconnexion. `npm run validate:mvp-live` rejoue ce parcours en direct contre Supabase
et Gemini.

## 8. Retour arrière

Re-déployer la dernière publication saine depuis Vercel → Deployments → ⋯ →
*Promote to Production*. Les migrations SQL ne se révoquent pas seules : un retour
arrière applicatif peut nécessiter une migration corrective (ne jamais supprimer une
migration déjà appliquée du dossier).

