# Audit de sécurité — 2026-09-27

Méthode : workflow `bmad-code-review`, deux passes de revue (**Blind Hunter** et
**Intent Alignment**) conduites en inline sur la totalité du code (74 fichiers,
9 297 lignes), croisées avec les invariants de sécurité du projet (R-1 à R-7,
AD-2/AD-4) consignés dans le fichier de `claims`.

Deux lentilles du workflow (**Edge Case Hunter**, **Verification Gap**) exigent
des sous-agents, indisponibles dans cet environnement : leurs invites sont
préparées dans `_bmad-output/implementation-artifacts/review-prompt-*.md` pour
une session distincte. Elles passent notamment en revue les fichiers de test.

## Vulnérabilités corrigées

| # | Sévérité | Constat | Preuve | Correction |
|---|----------|---------|---------|-----------|
| 1 | **Critique** | **Escalade de privilèges** : le rôle était lu dans `user_metadata`, que l'utilisateur modifie lui-même (`auth.updateUser({ data: { role: "admin" } })`). Tout contrôle de rôle de l'application était donc forgeable — n'importe quel collaborateur pouvait devenir admin, puis déposer, modifier ou supprimer des ressources (R-5 violé). | 11 sites de lecture du rôle : `lib/supabase/middleware.ts`, `app/(dashboard)/admin/resources/actions.ts` (×3), 6 pages, `lib/dashboard/helpers.ts` ; inscription qui envoyait `role: "collaborateur"` dans les options | Rôle déplacé vers **`app_metadata`** (non modifiable par l'utilisateur) ; l'inscription n'envoie plus de rôle ; trigger d'inscription en base ; test d'audit `scripts/security.test.ts` |
| 2 | **Critique** | **RLS en écriture ouverte à tous les authentifiés** : les policies étaient `using (true)` / `with check (true)`. La défense en profondeur d'AD-2 n'existait pas : avec la clé publique, un collaborateur pouvait, via l'API REST, supprimer des ressources et des morceaux, passer une ressource en `Prête`, ou **injecter des morceaux arbitraires = empoisonnement du corpus RAG** (prompt injection), et supprimer n'importe quel objet du bucket `documents`. | `0002` l. 36-38, `0003` l. 21-31, `0004` l. 9-11, `0005_resource_management_deletion` l. 14-16 et 20-23 | `supabase/migrations/0008_admin_only_writes.sql` : fonction `is_admin()` (JWT `app_metadata`), policies d'écriture `resources` / `document_chunks` / `storage.objects` réservées à l'admin, **lecture maintenue ouverte** aux authentifiés (R-5) |
| 3 | Élevée | **Absence d'en-têtes de sécurité HTTP** : pas de CSP, ni anti-framing, ni anti-sniffing, alors que l'app affiche du contenu extrait de fichiers déposés. | `next.config.ts` vide | CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src` limité à l'origine Supabase), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader: false` |
| 4 | Faible | **Rôle dupliqué** : extraction du rôle répétée en 3 endroits dans un seul fichier (risque de divergence), sans réutilisation du helper existant. | `app/(dashboard)/admin/resources/actions.ts` | Réutilisation de `isAdminRole()` de `lib/resources/management.ts` |
| 5 | Faible | **`.env.example` obsolète** : documentait `text-embedding-004` et `gemini-1.5-flash`, deux modèles retirés de l'API. | `.env.example` l. 8 | Modèles réels documentés + rappel explicite des modèles retirés |

## Risques assumés (non corrigés, avec motif)

- **Aucun plafonnement des appels IA** (`/api/chat`, `/api/search`, résumé) :
  un compte authentifié peut consommer le quota Gemini sans limite. Le PRD renvoie
  ce choix à **Q-5 (budget IA), non tranchée**, et la story 5.1 avait explicitement
  exclu tout nouveau limiteur. À traiter comme une décision produit, pas comme un bug.
- **Corpus lisible en masse** : la policy de lecture de `document_chunks` est
  ouverte à tout authentifié (choix R-5 assumé : base ouverte en lecture). Un
  compte compromis peut exporter l'ensemble du fonds.
- **Prompt injection par document** : un document déposé peut contenir des
  instructions ; elles sont cantiquées par le prompt système AD-1 mais pas
  neutralisées. Le correctif n° 2 réduit fortement la surface (plus d'injection
  par un collaborateur non autorisé).
- **Limite du vérificateur** : le test négatif « un collaborateur ne peut pas
  écrire » n'a pas pu être exécuté en live, faute d'un second compte (l'inscription
  exige une confirmation e-mail). Il est couvert par l'audit statique de la
  migration 0008 ; un test live est possible dès qu'un compte collaborateur existe.

## Points vérifiés et conformes (aucune action)

- `/api/chat` : 401 sans session, 403 sur conversation étrangère (propriété vérifiée
  par la RLS `owner_conversations`), limite de taille d'historique.
- Clé Gemini jamais référencée dans un composant client ; `.env.local` ignoré par git.
- Contenu documentaire et réponses rendus en texte React : aucun
  `dangerouslySetInnerHTML` dans l'application.
- `match_chunks` : `security definer`, exécution révoquée à l'anonyme, filtre
  `status = 'Prête'`, paramètres SQL liés.
- Verrou anti-force brute présent sur la connexion, avec messages d'erreur neutres
  (énumération de comptes impossible).
- Anti-XSS des paramètres de recherche : motifs `ilike` échappés, pas de
  concaténation de filtre `or()`.

## Vérification après application de la migration 0008 (2026-09-27)

Contrôles effectués une fois 0008 jouée en base :

| Contrôle | Résultat |
|----------|----------|
| `app_metadata.role` du compte admin | `admin` (recopie depuis l'ancien `user_metadata`, **rôle préservé**) |
| `user_metadata.role` | **absent** (purgé : plus rien de forgeable par l'utilisateur) |
| `is_admin()` via RPC | `true` |
| Lecture des ressources (R-5) | autorisée |
| Écritures admin (upload Storage, suppression, insert/delete de ressource) | **toujours autorisées** → aucune régression fonctionnelle |
| `npm run validate:mvp-live` | **56/56**, `EXIT=0` (dépôt, ingestion, suppression, recherche, chat, résumé, historiques) |
| `npm run validate:chat-live` | **14/14** |
| 19 suites unitaires | **227 tests**, 0 échec · `typecheck` et `lint` verts |

### Durcissement supplémentaire découvert pendant la revérification

Le rejeu de la validation a révélé une **réponse vide transitoire de Gemini** sur le
résumé (« Note projet » : 0 puce après 15,9 s, sans lien avec la sécurité — le
résumé refait sur les deux documents rend 8 puces en 7-18 s). Pour ne plus exposer
un « aucune puce » alors que le document est résumable, `summarizeResource()`
relance **une seule fois** sur réponse vide ou erreur (2 tests ajoutés,
`summarizeResource` passe de 18 à 20 assertions). Le chat, lui, bénéficie déjà
d'un garde-fou d'affichage (`emptyFallback`) mais ne relance pas : une relance en
milieu de flux doublerait la latence perçue — risque résiduel assumé.

Limite du vérificateur, rappelée : le cas négatif « un collaborateur ne peut pas
écrire » n'est pas testable en direct faute d'un second compte (l'inscription
exige une confirmation e-mail). Il reste couvert par l'audit statique de la
migration 0008 (`npm run test:security`). Il suffira de créer un compte
collaborateur pour lever ce doute définitivement.

## Vérification

- `npm run test:security` — 11/11 (audit statique : source du rôle, policies 0008,
  en-têtes HTTP, secrets, absence de HTML brut).
- 19 suites, 227 tests, `typecheck` et `lint` : verts.
- `npm run validate:mvp-live` (56/56) et `validate:chat-live` (14/14) après
  application de la migration 0008.
