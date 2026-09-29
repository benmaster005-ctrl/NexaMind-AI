# deferred-work

Registre des ecarts et questions reportes. Une entree `open` attend une
decision ou une implementation ; une entree `resolu` documente ce qui a ete
realise depuis (elle n'est pas supprimee : elle explique pourquoi le plan a change).

- status: resolu
  source_plan: none
  summary: Ecran /history listant les conversations de l'utilisateur avec reprise d'echange (FR-15, story 5.2).
  evidence: Scinde depuis l'Epic 5 (trois livrables independants). **Livre le 2026-09-27** via `plan-5-2-historique-conversations.md` (status: built) — 38 conversations listees en live, reprise avec citations deja en place depuis la story 4.4.

- status: resolu
  source_plan: none
  summary: Historique personnel des recherches avec rejeu en un clic (FR-16, story 5.3).
  evidence: Scinde depuis l'Epic 5 pour la meme raison que 5.2. **Livre le 2026-09-27** via `plan-5-3-historique-recherches.md` (status: built) — parcours verifie en live apres la migration 0007.

- status: resolu
  source_plan: plan-7-1-socle-visuel.md
  summary: Socle visuel (tokens, theme sombre, primitives partagees, navigation) et refonte du tableau de bord.
  evidence: **Livre le 2026-09-29.** Story 7.1 (tokens de `app/globals.css`, primitives `components/ui/`, `<AppNav>` sur les 7 pages, icones SVG) puis refonte du tableau de bord (en-tete horizontal, marque, trois colonnes de donnees reelles) — commit `c1f4172`. `npm test` 293/293, `npm run lint` 0 erreur. Sert de base aux stories 7.2 a 7.10.

- status: open
  source_plan: plan-5-2-historique-conversations.md
  summary: Ajouter `updated_at` (et eventuellement un compteur denormalise) sur `conversations` pour classer l'historique par derniere activite et afficher la bonne date.
  evidence: Constate en live le 2026-09-27 pendant la story 5.2 : la table `conversations` (0001_init.sql l. 34-39) n'a que `created_at`, donc une conversation relancee aujourd'hui s'affiche sous sa date de creation. Le tri et l'affichage respectent le PRD (UJ-5) sans migration ; l'amelioration demande une migration SQL jouable au SQL Editor. **Numero a utiliser : 0010** — `0005` existe en double (`0005_match_chunks.sql` et `0005_resource_management_deletion.sql`), `0008` et `0009` sont pris. Reste a trancher avec l'humain (story 7.8, decision G-5).

- status: open
  source_plan: plan-5-3-historique-recherches.md
  summary: Trancher la politique de retention de l'historique des recherches (Q-6 du PRD : purge automatique ou conservation illimitee) avant toute mise en production reelle.
  evidence: Le PRD (section 4.6, note NOTE FOR PM) autorise explicitement un MVP sans purge, applique le 2026-09-27 : la table `search_history` croit sans expiration et seul l'affichage est plafonne a 10 entrees. Le PRD exige que la question soit tranchee avant une mise en production reelle ; elle demande une decision produit (duree de conservation, plafond de lignes, purge a l'insertion ou tache planifiee) puis son implementation.

- status: open
  source_plan: none
  summary: Lot 2 de la refonte UX/UI — composants des ecrans de contenu (/search, /chat, /history) : primitives partagees, icones du socle a la place des glyphes de texte, aucun style inline.
  evidence: Scindé depuis la refonte globale du 2026-09-27. Les **couleurs** sont deja passees aux tokens par la story 7.1 (livree), mais les recettes locales demeurent : `.sendButton` dans `chat.module.css`, pastilles, rejeu et `.recentDelete` dans `search.module.css`, glyphes `↑` et `✕` a la place des icones du socle, 3 styles inline dans `chat-client.tsx`, et deux ecrans sans `h1` (`/search`, `/history`). **Partiellement livre le 2026-09-29 par la story 7.3** (`plan-7-3-en-tete-unifie.md`, status built) : les deux ecrans ont leur `h1` via `PageHeader` et l'en-tete du chat a ete retire avec ses styles. Reste ouvert : `.sendButton`, pastilles, rejeu, `.recentDelete`, glyphes `↑`/`✕` et styles inline — traite par 7.6 (assistant), 7.7 (recherche) et 7.8 (historique).

- status: open
  source_plan: none
  summary: Lot 3 de la refonte UX/UI — ecrans de gestion (/documents, fiche /resources/[id], tiroir de resume) dont la pastille de statut d'ingestion decrite par DESIGN.md 5.
  evidence: Scindé depuis la refonte globale du 2026-09-27. La pastille de statut (verte/ambre/rouge) est spécifiée dans DESIGN.md mais absente du rendu : elle doit être traitée avec la liste de gestion, son premier consommateur. **Correction du 2026-09-29** : la route est `/documents` (et non `/admin/resources`) depuis la suppression de la gestion des roles (commit `376d3b2`). Traite par les stories 7.5 (gestion documentaire) et 7.6 (tiroirs de l'assistant).

- status: open
  source_plan: none
  summary: Lot 4 de la refonte UX/UI — écrans d'authentification (/login, /register).
  evidence: Scindé depuis la refonte globale du 2026-09-27. Les deux ecrans partagent `components/auth/auth.module.css` : les couleurs viennent des tokens du lot 1 (livre), l'echelle d'espacement et la recette de bouton restent locales. Traite par la story 7.9.

- status: open
  source_plan: mvp-validation-report.md
  summary: Afficher une citation comme « source retiree » quand la ressource citee a ete supprimee depuis la reponse.
  evidence: Ecart PRD constate par la validation MVP du 2026-09-27 (cas limite UJ-5) : l'extrait reste lisible (conserve dans `messages.meta`), mais le lien « Ouvrir dans le document » du tiroir de citation mene a une 404 au lieu d'afficher « source retiree ». Le marquage necessite de savoir que la ressource n'existe plus au moment de l'affichage (comparaison de l'UUID de citation avec les ressources visibles, cote client). **Hors perimetre de la refonte visuelle** (decision G-8) : a traiter comme un correctif fonctionnel separe.

- status: open
  source_plan: mvp-validation-report.md
  summary: Rejouer la validation live (56/56 et 14/14) apres la suppression des roles et la refonte de l'interface.
  evidence: `mvp-validation-report.md` date du 2026-09-27, soit **avant** la suppression de la gestion des roles (commit `376d3b2`) et avant la refonte du tableau de bord (commit `c1f4172`). Ses constats fonctionnels restent valables, mais sa description de l'ecran d'accueil et sa reference a `/admin/resources` ne correspondent plus au code. `npm run validate:mvp-live` et `npm run validate:chat-live` exigent un serveur de developpement et un compte reel : revalidation planifiee dans la story 7.10. L'addendum du 2026-09-29 dans le rapport consigne l'ecart.
