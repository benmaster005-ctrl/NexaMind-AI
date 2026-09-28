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

- status: open
  source_plan: plan-5-2-historique-conversations.md
  summary: Ajouter `updated_at` (et eventuellement un compteur denormalise) sur `conversations` pour classer l'historique par derniere activite et afficher la bonne date.
  evidence: Constate en live le 2026-09-27 pendant la story 5.2 : la table `conversations` (0001_init.sql l. 34-39) n'a que `created_at`, donc une conversation relancee aujourd'hui s'affiche sous sa date de creation. Le tri et l'affichage respectent le PRD (UJ-5) sans migration ; l'amelioration demande une migration SQL jouable au SQL Editor (0008).

- status: open
  source_plan: plan-5-3-historique-recherches.md

- status: open
  source_plan: none
  summary: Lot 2 de la refonte UX/UI — appliquer le socle visuel aux écrans de contenu (/search, /chat, /history).
  evidence: Scindé depuis la refonte globale demandée le 2026-09-27 (rendu sobre, professionnel, épuré) : la refonte couvre 7 écrans, découpés en 4 lots. Le lot 2 dépend du lot 1 (tokens + primitives) ; il reste à faire une fois le socle livré.

- status: open
  source_plan: none
  summary: Lot 3 de la refonte UX/UI — écrans de gestion (/admin/resources, fiche /resources/[id], tiroir de résumé) dont la pastille de statut d'ingestion décrite par DESIGN.md §5.
  evidence: Scindé depuis la refonte globale du 2026-09-27. La pastille de statut (verte/ambre/rouge) est spécifiée dans DESIGN.md mais absente du rendu : elle doit être traitée avec la liste de gestion, son premier consommateur.

- status: open
  source_plan: none
  summary: Lot 4 de la refonte UX/UI — écrans d'authentification (/login, /register).
  evidence: Scindé depuis la refonte globale du 2026-09-27. Les deux écrans partagent components/auth/auth.module.css et devront consommer les tokens du lot 1.

  summary: Trancher la politique de retention de l'historique des recherches (Q-6 du PRD : purge automatique ou conservation illimitee) avant toute mise en production reelle.
  evidence: Le PRD (section 4.6, note NOTE FOR PM) autorise explicitement un MVP sans purge, applique le 2026-09-27 : la table `search_history` croit sans expiration et seul l'affichage est plafonne a 10 entrees. Le PRD exige que la question soit tranchee avant une mise en production reelle ; elle demande une decision produit (duree de conservation, plafond de lignes, purge a l'insertion ou tache planifiee) puis son implementation.
- status: open
  source_plan: mvp-validation-report.md
  summary: Afficher une citation comme � source retiree � quand la ressource citee a ete supprimee depuis la reponse.
  evidence: Ecart PRD constate par la validation MVP du 2026-09-27 (cas limite UJ-5) : l'extrait reste lisible (conserve dans `messages.meta`), mais le lien � Ouvrir dans le document � du tiroir de citation mene a une 404 au lieu d'afficher � source retiree �. Le marquage necessite de savoir que la ressource n'existe plus au moment de l'affichage (comparaison de l'UUID de citation avec les ressources visibles, cote client).
