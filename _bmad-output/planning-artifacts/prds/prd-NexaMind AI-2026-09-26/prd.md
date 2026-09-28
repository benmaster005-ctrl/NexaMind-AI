---
title: NexaMind AI
status: final
created: 2026-09-26
updated: 2026-09-26
---

# PRD: NexaMind AI
*Titre de travail — à confirmer.*

> **Statut du document : BROUILLON EN COURS DE RÉDACTION (mode guidé).**
> Ce PRD est construit pas à pas avec l'utilisateur (skill `bmad-prd`, mode coaching).
> Les sections ci-dessous sont remplies progressivement au fil de la conversation.
> Les éléments marqués `[ASSUMPTION: ...]` sont des **hypothèses de l'agent**, pas des exigences du cahier des charges.

## 0. Document Purpose

Ce PRD décrit **NexaMind AI**, le copilote métier interne que NexaWorks veut mettre entre les mains de ses équipes. Il s'adresse à trois lecteurs :

- **Le commanditaire (NexaWorks)** — qui valide le périmètre, les règles métier et les limites du MVP.
- **L'équipe produit** (product builders en Vibe Coding) — qui construit le MVP.
- **Les ateliers en aval** (`bmad-ux`, `bmad-architecture`, `bmad-preview-ticketing`) — qui s'appuieront sur ce document pour concevoir l'interface, les choix techniques et la découpe en stories.

**Comment lire ce document.** Le vocabulaire métier est défini **une seule fois** au §3 Glossaire et utilisé **à l'identique** partout ailleurs (aucun synonyme). Les fonctions attendues sont regroupées en **fonctionnalités** (§4), chacune contenant des **exigences fonctionnelles** numérotées de façon stable (`FR-1`, `FR-2`, …) afin d'être citées sans ambiguïté en aval. Deux niveaux de confiance sont utilisés explicitement :

- une phrase **sans marque** = elle provient du **cahier des charges NexaWorks** (c'est une exigence) ;
- une phrase marquée **`[HYPOTHÈSE]`** = elle a été **déduite par l'agent** et doit être **confirmée ou corrigée** ; toutes ces hypothèses sont récapitulées au §11.

Les choix **techniques** (stack, services, modèles, découpage du code) ne figurent pas ici : ils vivent dans `addendum.md` et relèvent de `bmad-architecture`.

## 1. Vision

**NexaMind AI est le copilote métier interne de NexaWorks : un espace unique où l'information de l'entreprise est centralisée, retrouvée en quelques secondes, et interrogeable en langage naturel avec des réponses rattachées aux documents réels de l'entreprise.**

Aujourd'hui, le savoir de NexaWorks est éparpillé — documents internes, notes de réunion, FAQ, procédures, fiches projets, comptes rendus clients, historiques de tâches, ressources métier — et cet éparpillement est devenu un handicap opérationnel : les collaborateurs perdent trop de temps à chercher l'information, les réponses ne sont pas homogènes d'une personne à l'autre, une partie de la connaissance disponible reste inexploitée, et un nouvel arrivant met longtemps à monter en compétence.

NexaMind AI attaque ces quatre pertes de front : **centraliser**, **retrouver vite**, **répondre de façon homogène**, **transmettre**. Là où un moteur de recherche classique rend une liste de liens, NexaMind AI comprend la question, va chercher les passages pertinents dans les Ressources de l'entreprise (RAG sur base vectorielle) et produit une réponse **utile, contextualisée et rattachée à ses sources**. Pour NexaWorks, l'enjeu n'est pas d'ajouter un outil de plus : il s'agit de transformer un stock de documents dormants en **capacité de réponse immédiate**.

*Note de rédaction : la vision ci-dessus reformule les termes du cahier des charges. Aucun engagement chiffré n'a été ajouté — les cibles mesurables vivent au §9.*

## 2. Target User

### 2.1 Qui sont les utilisateurs

NexaMind AI est un **intranet** : seuls les **collaborateurs de NexaWorks** se connectent. Les indépendants, petites entreprises et équipes projet accompagnés par NexaWorks **ne sont pas des utilisateurs** — ils sont le **sujet** de certaines Ressources (fiches projets, comptes rendus clients). Décision validée par le commanditaire lors de la rédaction.

Trois profils se dégagent :

- **Le collaborateur standard** — consulte les Ressources de l'entreprise, effectue des recherches, interroge l'Assistant conversationnel et consulte son historique personnel. Il a un accès en **lecture et interrogation uniquement** : il ne peut pas déposer ni supprimer de Ressources. `[HYPOTHÈSE: profil déduit, rôle lecture seule retenu pour protéger la qualité du fonds documentaire.]`
- **L'administrateur / gestionnaire documentaire** — possède les droits d'un collaborateur et détient le **droit exclusif de déposer, organiser, mettre à jour et supprimer des Ressources** dans NexaMind AI. `[Décision explicite du commanditaire lors de la révision.]`
- **Le nouvel arrivant** — collaborateur récemment arrivé, en montée en compétence. Ce n'est **pas un rôle technique** mais une **situation d'usage** mise en avant par le cahier des charges comme bénéfice explicite du produit. Il utilise l'application comme un collaborateur standard.

### 2.2 Jobs To Be Done

- **Fonctionnel** — « Quand j'ai une question sur une procédure, un client ou un projet, je veux la réponse sans savoir où elle est rangée. »
- **Fonctionnel** — « Quand je dépose une Ressource, je veux qu'elle devienne retrouvable par les autres sans que je doive la leur envoyer. »
- **Fonctionnel** — « Quand je réponds à un client ou à un collègue, je veux une réponse cohérente avec ce que répondraient les autres. »
- **Émotionnel** — « Je veux arrêter de perdre du temps à chercher une information que l'entreprise possède déjà. »
- **Social** — « Je veux que le savoir que je produis soit capitalisé pour l'équipe au lieu de rester enfermé dans mes échanges. »
- **Contextuel — nouvel arrivant** — « Quand j'arrive, je veux devenir autonome rapidement sans mobiliser mes collègues en permanence. »

### 2.3 Non-Users (v1)

- Les **indépendants, petites entreprises et équipes projet** accompagnés par NexaWorks : ils sont le sujet de Ressources, jamais des comptes.
- Toute **personne extérieure à NexaWorks** : pas d'accès invité, pas de lien de partage anonyme.
- Les **visiteurs non authentifiés** : aucune Ressource de NexaMind AI n'est accessible sans compte. `[HYPOTHÈSE: ni espace public, ni page de démonstration.]`

### 2.4 Key User Journeys

*Parcours nommés : chaque protagoniste porte un prénom et une situation, car ce sont eux qui forcent la précision (état d'entrée, chemin, moment où la valeur arrive, cas limite). Ils servent de matière première à `bmad-ux`.*

**UJ-1. Camille ouvre sa journée en sachant où tout se trouve.**
- **Protagoniste + contexte :** Camille, consultante chez NexaWorks, suit six clients en parallèle. Elle arrive au bureau et ouvre NexaMind AI.
- **État d'entrée :** non connectée, navigateur ouvert sur l'application.
- **Chemin :** (1) elle se connecte avec son e-mail et son mot de passe ; (2) elle arrive sur le Tableau de bord ; (3) elle y voit ses 5 dernières Conversations et le nombre de Ressources prêtes ; (4) elle clique sur l'accès à l'Assistant conversationnel.
- **Climax :** en un seul écran, elle sait ce qu'elle a fait récemment et où poser sa prochaine question.
- **Résolution :** elle est prête à interroger la base sans chercher comment.
- **Cas limite :** aucune Conversation enregistrée → le Tableau de bord l'invite à poser une première question au lieu d'afficher une zone vide.

**UJ-2. Karim verse une pièce au pot commun.**
- **Protagoniste + contexte :** Karim, responsable de contenu, revient d'une réunion client avec un compte rendu DOCX.
- **État d'entrée :** connecté, sur le Tableau de bord.
- **Chemin :** (1) il ouvre le dépôt de Ressource ; (2) il sélectionne le fichier ; (3) il saisit un titre, choisit la catégorie « Compte rendu » et ajoute les étiquettes du client et du mois ; (4) il valide ; (5) le statut passe à « En cours » puis « Prête ».
- **Climax :** le statut « Prête » lui confirme que le contenu est désormais interrogeable par toute l'entreprise, sans qu'il ait eu à l'envoyer à personne.
- **Résolution :** il pose une question de vérification pour confirmer que le contenu est bien pris en compte.
- **Cas limite :** le fichier est un PDF scanné → l'Ingestion échoue en indiquant clairement la cause, et Karim comprend qu'il doit fournir un fichier dont le texte est sélectionnable.

**UJ-3. Léa devient autonome en trente secondes.**
- **Protagoniste + contexte :** Léa, arrivée depuis trois semaines, doit poser un congé et n'ose pas déranger une quatrième fois sa collègue.
- **État d'entrée :** connectée, dans l'Assistant conversationnel.
- **Chemin :** (1) elle écrit « Comment je fais une demande de congés ? » ; (2) l'assistant affiche une réponse en étapes ; (3) sous la réponse apparaissent des Citations vers les Ressources utilisées, dont la procédure interne ; (4) elle clique sur la première Citation et ouvre la Ressource au passage concerné.
- **Climax :** elle tient la réponse officielle, avec sa source — sans avoir dérangé personne.
- **Résolution :** elle applique la procédure et referme l'application.
- **Cas limite :** deux Ressources donnent des procédures différentes → l'assistant présente les deux en signalant la contradiction plutôt que d'en choisir une en silence.

**UJ-4. Nadia constate une limite : l'assistant n'invente pas.**
- **Protagoniste + contexte :** Nadia, cheffe de projet, demande « Quel est le tarif négocié avec le client Ferrand ? ». L'information a été échangée à l'oral et n'a jamais été documentée.
- **État d'entrée :** connectée, dans une Conversation en cours.
- **Chemin :** (1) elle pose la question ; (2) l'assistant indique explicitement qu'il ne trouve pas l'information dans les Ressources disponibles ; (3) il propose les Ressources les plus proches (contrat, fiche projet) sans affirmer de tarif ; (4) Nadia décide de faire documenter l'information.
- **Climax :** elle n'a reçu aucun chiffre inventé — elle sait précisément ce que l'entreprise sait et ne sait pas.
- **Résolution :** elle transmet l'information manquante pour qu'elle soit déposée comme Ressource.

**UJ-5. Camille rouvre une piste laissée ouverte.**
- **Protagoniste + contexte :** Camille cherche ce qu'elle avait compris sur un client il y a deux semaines.
- **État d'entrée :** connectée, sur le Tableau de bord.
- **Chemin :** (1) elle ouvre son Historique ; (2) elle retrouve la Conversation par son titre et sa date ; (3) elle la rouvre ; (4) l'Échange complet et ses Citations se réaffichent.
- **Climax :** une information de deux semaines redevient accessible en dix secondes.
- **Résolution :** elle enchaîne une nouvelle question dans la même Conversation.
- **Cas limite :** la Ressource citée a été supprimée depuis → la Citation s'affiche comme « source retirée » au lieu de conduire à une erreur.

**UJ-6. Nadia arrive en réunion préparée.**
- **Protagoniste + contexte :** Nadia a une réunion dans dix minutes sur un projet qu'elle n'a pas suivi pendant trois semaines ; la fiche projet fait vingt pages.
- **État d'entrée :** connectée, sur la Ressource concernée.
- **Chemin :** (1) elle ouvre la Ressource ; (2) elle déclenche « Résumer » ; (3) le résumé s'affiche en points clés ; (4) elle ouvre la Ressource pour vérifier un détail.
- **Climax :** dix minutes ont suffi à redevenir opérationnelle sur le dossier.
- **Résolution :** elle entre en réunion avec les points clés en tête et la source à portée de clic.
- **Cas limite :** le document est trop volumineux pour une seule passe → le système le signale plutôt que de produire un résumé silencieusement tronqué.

## 3. Glossary

*Ces termes sont les seuls autorisés dans la suite du PRD (FR, UJ, SM). Le cahier des charges emploie « contenus » et « ressources » comme synonymes ; ce PRD retient **Ressource** comme terme unique.*

- **NexaWorks** — L'entreprise propriétaire du produit. Elle accompagne des indépendants, des petites entreprises et des équipes projet dans la gestion de leurs activités quotidiennes. NexaWorks est l'utilisatrice du produit.
- **NexaMind AI** — Le produit décrit par ce PRD : une application web fullstack de capitalisation des connaissances internes, dotée d'un assistant conversationnel alimenté par les données de l'entreprise.
- **Utilisateur** — Personne authentifiée dans NexaMind AI. *(Voir §2 pour la définition des profils.)*
- **Ressource** — Toute information métier disponible dans NexaMind AI : document interne, note de réunion, FAQ, procédure, fiche projet, compte rendu client, historique de tâches ou ressource métier. Une Ressource possède au minimum un titre, un contenu et une provenance. *(Terme canonique — ne pas écrire « contenu », « document » ou « fichier » pour la désigner.)*
- **Espace de travail** — L'unité d'organisation à laquelle des Ressources appartiennent et à laquelle des Utilisateurs ont accès. `[HYPOTHÈSE: « espace » désigne un regroupement de Ressources (par exemple par client, par projet ou par équipe) ; le périmètre exact — personnel, partagé, ou les deux — reste à confirmer avec le commanditaire.]`
- **Ingestion** — Le processus qui transforme une Ressource déposée en contenu interrogeable par l'assistant (découpage en Morceaux, vectorisation, indexation).
- **Morceau (chunk)** — Fragment issu du découpage d'une Ressource lors de l'Ingestion. C'est l'unité effectivement recherchée par la recherche sémantique.
- **Base vectorielle** — Le composant de stockage des Morceaux sous forme de représentations numériques (vecteurs), permettant de retrouver les Morceaux dont le **sens** est proche de celui de la question posée.
- **Recherche sémantique** — Recherche qui compare le sens de la requête à celui des Morceaux, et non les mots exacts.
- **RAG (Retrieval-Augmented Generation)** — Mécanisme par lequel NexaMind AI sélectionne des Morceaux pertinents, les injecte comme contexte dans la question posée à l'IA, puis génère une réponse appuyée sur ce contexte.
- **Assistant conversationnel** — L'interface de dialogue de NexaMind AI, alimentée par les Ressources de l'entreprise via le mécanisme RAG.
- **Conversation** — Un fil continu d'échanges entre un Utilisateur et l'Assistant conversationnel. Une Conversation regroupe un ou plusieurs Échanges.
- **Échange** — Un couple question de l'Utilisateur / réponse de l'Assistant conversationnel à l'intérieur d'une Conversation.
- **Citation** — Référence, attachée à une réponse de l'Assistant conversationnel, vers la ou les Ressources effectivement utilisées pour produire cette réponse.
- **Rôle** — Niveau d'autorisation attribué à un Utilisateur. Le MVP distingue deux rôles stricts : **Collaborateur** (consultation, recherche, questionnement RAG, historique personnel) et **Administrateur** (droits complets + dépôt exclusif, mise à jour, catégorisation et suppression des Ressources). *(Décision validée en révision).*
- **Tableau de bord** — L'écran d'accueil affiché après authentification, donnant accès aux Ressources, à la recherche et à l'Assistant conversationnel.
- **Historique** — La liste consultable par un Utilisateur de ses Conversations passées et de ses recherches effectuées.

## 4. Features

*Chaque exigence fonctionnelle est numérotée globalement (`FR-n`) afin d'être citée de façon stable en aval. Les parcours utilisateurs (§2.4) sont référencés par leur identifiant. Les règles métier transverses sont regroupées au §5.*

Un principe traverse toutes les fonctionnalités : **une Ressource n'a de valeur que si elle devient interrogeable de la même manière pour tous**.

### 4.1 Comptes et authentification

**Description.** Un collaborateur de NexaWorks dispose d'un compte et se connecte pour accéder à NexaMind AI. Aucune Ressource n'est accessible sans authentification. Réalise UJ-1.

#### FR-1 : Créer un compte

Un visiteur peut créer un compte NexaMind AI en fournissant une adresse e-mail et un mot de passe.

**Conséquences (testables) :**
- Un mot de passe de moins de 8 caractères est refusé avec un message explicite.
- Une adresse e-mail déjà utilisée est refusée ; le compte existant n'est ni modifié ni écrasé.
- Le mot de passe n'est jamais stocké en clair : seule une empreinte non réversible est conservée.
- Après une création réussie, l'Utilisateur dispose d'une session active et arrive sur le Tableau de bord.

`[HYPOTHÈSE : l'inscription est ouverte à toute adresse e-mail dans le MVP. Pour un outil interne, une restriction au domaine e-mail de NexaWorks (ou une création de compte par un administrateur) serait plus sûre. Voir Open Question Q-1.]`

#### FR-2 : Se connecter

Un Utilisateur disposant d'un compte peut ouvrir une session avec son e-mail et son mot de passe.

**Conséquences (testables) :**
- Des identifiants valides ouvrent une session et mènent au Tableau de bord.
- Des identifiants invalides renvoient un message d'erreur générique ne révélant pas lequel des deux champs est incorrect.
- Après 5 tentatives échouées consécutives sur une même adresse, les tentatives suivantes sont refusées pendant au moins 5 minutes. `[HYPOTHÈSE : protection anti-force brute non spécifiée dans le cahier des charges.]`

#### FR-3 : Protéger les accès et se déconnecter

Toute page présentant des Ressources exige une session valide ; l'Utilisateur peut se déconnecter.

**Conséquences (testables) :**
- Une requête non authentifiée vers une page de Ressources est redirigée vers la connexion ; vers une API, elle reçoit un code 401 — jamais le contenu.
- Après déconnexion, un retour arrière du navigateur ne réaffiche aucun contenu issu de la session précédente.

**NFR propres à cette fonctionnalité :**
- Sécurité : mot de passe haché avec sel (jamais MD5/SHA1 seul) ; session portée par un cookie `HttpOnly`.

### 4.2 Tableau de bord

**Description.** Après connexion, l'Utilisateur arrive sur le Tableau de bord : point d'entrée unique vers la recherche, l'Assistant conversationnel, les Ressources et l'Historique. Réalise UJ-1.

#### FR-4 : Afficher un Tableau de bord

Un Utilisateur authentifié voit un Tableau de bord qui l'invite à agir.

**Conséquences (testables) :**
- Le Tableau de bord affiche : un accès à la recherche, un accès à l'Assistant conversationnel, et les 5 Conversations les plus récentes de l'Utilisateur.
- Pour un Utilisateur possédant le rôle **Administrateur**, un accès direct et prioritaire au dépôt et à la gestion documentaire est visible. Pour un Collaborateur standard, le bouton de dépôt n'est pas affiché.
- Le nombre de Ressources actuellement au statut Prête est affiché.
- Chaque destination majeure est atteignable en un seul clic depuis le Tableau de bord.
- Si l'Utilisateur n'a aucune Conversation, le Tableau de bord affiche un état vide incitant à poser une première question (jamais une zone vide).

`[HYPOTHÈSE : le contenu exact du Tableau de bord n'est pas spécifié par le cahier des charges (« accéder à un tableau de bord »). Cette proposition minimale est à valider.]`

### 4.3 Gestion des Ressources (ajouter, organiser, consulter)

**Description.** La Ressource est l'unité de connaissance de NexaMind AI. Seul un **Administrateur** peut déposer un fichier, le décrire (titre, catégorie, étiquettes) et le retirer. Tous les Utilisateurs authentifiés peuvent consulter et filtrer les Ressources prêtes. Le dépôt par un Administrateur déclenche l'Ingestion automatique : c'est cette étape qui rend la Ressource interrogeable et retrouvable. Réalise UJ-2.

#### FR-5 : Déposer une Ressource (Administrateur uniquement)

Seul un Utilisateur possédant le rôle Administrateur peut déposer un fichier pour l'ajouter à la base de connaissances, en précisant un titre, une catégorie et zéro ou plusieurs étiquettes.

**Conséquences (testables) :**
- Toute tentative d'accès à la fonction de dépôt ou à l'API de dépôt par un Collaborateur standard renvoie une interdiction claire (code HTTP 403 à l'API, action masquée à l'interface).
- Formats acceptés : PDF dont le texte est sélectionnable, DOCX, TXT, Markdown. Tout autre format est refusé avec un message listant les formats supportés.
- Les images, PDF scannés, fichiers audio et vidéo sont refusés explicitement au MVP.
- Si aucun titre n'est saisi, le nom du fichier est utilisé comme titre (modifiable ensuite).
- La catégorie appartient à une liste fermée : Compte rendu · Procédure · FAQ · Fiche projet · Note de réunion · Ressource métier.
- La Ressource déposée enregistre l'identité de l'Administrateur qui l'a déposée.

#### FR-6 : Ingester et indexer une Ressource

Toute Ressource déposée par un Administrateur est automatiquement transformée en contenu interrogeable.

**Conséquences (testables) :**
- Immédiatement après le dépôt, la Ressource porte un statut d'Ingestion visible : En cours, Prête ou Échec.
- Une Ressource en Échec affiche la raison de l'échec et peut être relancée par un Administrateur.
- Une Ressource Prête est retrouvable par la recherche (FR-8) et citable par l'Assistant conversationnel (FR-10).
- Une Ressource En cours ou en Échec n'est jamais citée dans une réponse de l'Assistant conversationnel.

#### FR-7 : Consulter, organiser et retirer une Ressource

Tout Utilisateur peut consulter et filtrer l'ensemble des Ressources prêtes de l'entreprise. Seul un Administrateur peut modifier les métadonnées ou supprimer une Ressource.

**Conséquences (testables) :**
- La liste des Ressources affiche pour chacune : titre, catégorie, étiquettes, auteur du dépôt, date de dépôt et statut d'Ingestion.
- Les filtres par catégorie, étiquette, auteur et statut sont utilisables par tous les collaborateurs.
- Seul un Administrateur a accès au bouton de suppression et à la modification des étiquettes/titre.
- Une tentative de suppression via API par un non-administrateur est rejetée avec un code 403.
- Une Ressource supprimée disparaît de la liste, de la recherche **et de l'index** : une question portant sur son seul contenu ne peut plus la citer.

### 4.4 Recherche dans les Ressources

**Description.** Deux chemins coexistent volontairement : la **recherche** (« je cherche un document ») et l'**Assistant conversationnel** (« je cherche une réponse »). La recherche sert aussi de repli quand l'assistant n'a pas de réponse. Réalise l'étape de consultation de UJ-2 et le repli de UJ-4.

#### FR-8 : Rechercher une Ressource

Un Utilisateur peut rechercher des Ressources et obtenir des résultats classés par pertinence.

**Conséquences (testables) :**
- La recherche porte sur le titre, les étiquettes, la catégorie, l'auteur et le **contenu** des Ressources.
- Chaque résultat affiche : titre, catégorie, auteur, date de dépôt, statut, et l'**extrait de contenu** ayant déclenché la correspondance.
- Un résultat mène à la Ressource, au passage concerné.
- Une recherche sans résultat affiche un message explicite et propose une action alternative (reformuler, ou interroger l'Assistant conversationnel) — jamais une page vide.
- Aucune Ressource aux statuts En cours ou Échec n'apparaît dans les résultats.

#### FR-9 : Retrouver par le sens (recherche sémantique)

Un Utilisateur qui ne connaît pas les mots exacts employés dans les Ressources obtient malgré tout des résultats pertinents.

**Conséquences (testables) :**
- Une Ressource qui ne contient aucun des mots de la requête mais traite du même sujet figure dans les résultats. *Contrôle : avec une Ressource intitulée « Politique de télétravail », la requête « puis-je travailler de chez moi ? » doit la faire remonter.*
- Une Ressource dont le statut d'Ingestion n'est pas Prête n'apparaît jamais dans les résultats sémantiques.
- Le même mécanisme de recherche alimente la recherche (FR-8) **et** l'Assistant conversationnel (FR-10). `[HYPOTHÈSE : architecture de recherche unifiée ; voir addendum A2.]`

### 4.5 Assistant conversationnel

**Description.** L'Assistant conversationnel répond en langage naturel en s'appuyant sur les Morceaux retrouvés dans la base (RAG). Son comportement le plus important n'est pas de répondre : c'est de **ne pas répondre** quand les Ressources ne contiennent pas l'information. C'est ce comportement qui rend l'outil crédible en interne. Réalise UJ-3 et UJ-4.

#### FR-10 : Poser une question et obtenir une réponse fondée sur les Ressources

Un Utilisateur peut poser une question en langage naturel et recevoir une réponse construite à partir des Ressources.

**Conséquences (testables) :**
- Toute réponse appuyée sur des Ressources porte au moins une Citation.
- Une réponse de plus de trois phrases est structurée (étapes numérotées ou liste à puces), jamais un bloc de texte compact.
- Le délai entre l'envoi de la question et l'affichage du premier élément de réponse est inférieur à 10 secondes en usage interne normal. `[HYPOTHÈSE : cible fixée par l'agent, voir §9.]`
- La question posée et la réponse produite sont conservées dans la Conversation (FR-13).

**NFR propres à cette fonctionnalité :**
- Coût : chaque question consomme du quota payant chez le fournisseur du modèle → un plafond de questions par Utilisateur et par jour est appliqué (valeur à définir, voir Q-5).

#### FR-11 : Montrer ses sources

Un Utilisateur voit, sous chaque réponse, les Ressources effectivement utilisées, et peut les ouvrir.

**Conséquences (testables) :**
- Chaque Citation affiche au minimum le titre de la Ressource et sa catégorie.
- Cliquer sur une Citation ouvre la Ressource au passage utilisé pour construire la réponse.
- Le nombre de Ressources distinctes citées dans une réponse ne dépasse pas 5. `[HYPOTHÈSE : plafond fixé par l'agent.]`
- Les Citations affichées correspondent aux Ressources réellement utilisées pour générer la réponse (aucune Citation décorative).

#### FR-12 : S'abstenir plutôt qu'inventer

Quand les Ressources retrouvées ne contiennent pas l'information demandée, l'Assistant conversationnel le déclare explicitement.

**Conséquences (testables) :**
- Sur une question dont la réponse n'est pas dans la base, la réponse contient une formulation d'absence d'information, et **aucune Citation n'est présentée comme y répondant**.
- La réponse propose les Ressources les plus proches, explicitement présentées comme des pistes et non comme une réponse. *(Réalise UJ-4.)*
- Tout chiffre, date ou nom propre figurant dans une réponse apparaît dans au moins une Ressource citée. *Contrôle : sur un jeu de 10 questions dont 3 sans réponse en base, l'audit manuel ne relève aucun fait non sourcé.* `[HYPOTHÈSE : jeu de contrôle et seuil proposés par l'agent.]`

**Notes :** ce comportement est le principal différenciateur du produit en usage interne. Il se vérifie à chaque itération, pas seulement au premier essai.

#### FR-13 : Garder le fil d'une Conversation

Un Utilisateur peut enchaîner plusieurs questions dans une même Conversation.

**Conséquences (testables) :**
- Une Conversation regroupe ses Échanges et porte un titre dérivé de sa première question (titre modifiable par son auteur).
- Une question de suivi (« et pour un temps partiel ? ») est interprétée en tenant compte des Échanges précédents de la Conversation.
- Une Conversation n'est visible que par son auteur (voir R-7).
- Si une Ressource citée a été supprimée entre-temps, la Citation s'affiche comme « source retirée » et la réponse reste lisible. *(Réalise le cas limite de UJ-5.)*

### 4.6 Résumé automatique d'une Ressource

**Description.** L'Utilisateur demande le résumé d'une Ressource existante et obtient l'essentiel en points clés, sans lire un document long. Réalise UJ-6.

#### FR-14 : Résumer une Ressource

Un Utilisateur peut demander le résumé d'une Ressource au statut Prête.

**Conséquences (testables) :**
- Le résumé tient en 5 à 8 puces maximum et est produit à partir du **contenu** de la Ressource (ni le titre ni les étiquettes ne suffisent).
- Le résumé renvoie vers la Ressource d'origine.
- Le résumé d'une Ressource de 20 pages est produit en moins de 15 secondes. `[HYPOTHÈSE : cible fixée par l'agent.]`
- Une Ressource trop volumineuse pour une seule passe produit un message explicite (« résumé partiel ») plutôt qu'un résumé silencieusement tronqué. *(Réalise le cas limite de UJ-6.)*

**Out of Scope :** le résumé n'est pas conservé comme Ressource et n'entre pas dans l'index.

### 4.7 Historique

**Description.** L'Utilisateur retrouve ce qu'il a cherché et demandé, pour ne pas repartir de zéro. Réalise UJ-5.

#### FR-15 : Retrouver et rouvrir ses Conversations

Un Utilisateur peut consulter la liste de ses Conversations passées et en rouvrir une.

**Conséquences (testables) :**
- La liste affiche pour chaque Conversation : titre, date du dernier Échange, nombre d'Échanges.
- La liste est triée du plus récent au plus ancien et filtrable par mot-clé de titre.
- Rouvrir une Conversation restitue l'intégralité de ses Échanges et de leurs Citations.
- Un Utilisateur ne voit que ses propres Conversations (voir R-7).

#### FR-16 : Retrouver ses recherches passées

Un Utilisateur peut consulter la liste de ses recherches passées.

**Conséquences (testables) :**
- Chaque recherche enregistrée conserve le texte de la requête, sa date et son nombre de résultats.
- Rejouer une recherche passée relance la même requête sur l'état actuel de la base.
- Un Utilisateur ne voit que ses propres recherches (voir R-7).

**Notes :** `[NOTE FOR PM]` La conservation de l'historique soulève une question de durée de rétention (Q-6). Le MVP peut démarrer sans purge automatique, mais la question doit être tranchée avant toute mise en production réelle.

## 5. Règles métier transverses

*Ces règles s'appliquent au produit entier, pas à un écran.*

- **R-1 — Rien sans authentification.** Aucune Ressource, aucun extrait et aucune réponse d'assistant n'est accessible sans session valide. *(Traduit l'exigence « de manière sécurisée » du cahier des charges.)*
- **R-2 — Une Ressource non prête n'existe pas.** Une Ressource aux statuts En cours ou Échec est invisible pour la recherche et pour l'assistant ; elle reste visible dans la liste de gestion, avec son statut.
- **R-3 — Supprimer, c'est retirer de l'index.** La suppression d'une Ressource retire aussi ses Morceaux de la base vectorielle. Une Citation pointant vers elle s'affiche alors comme « source retirée », sans casser l'Échange.
- **R-4 — L'assistant cite ou se tait.** Une réponse fondée sur des Ressources porte au moins une Citation ; quand aucune Ressource ne permet de répondre, l'assistant le déclare et n'affirme aucun fait absent des Ressources. *(Décision produit structurante — voir FR-12.)*
- **R-5 — Base ouverte en lecture, alimentation réservée à l'administrateur.** Tout Utilisateur authentifié peut consulter et interroger toutes les Ressources prêtes de l'entreprise. En revanche, **seul un Administrateur** peut déposer, modifier ou supprimer des Ressources. *(Décision structurante validée lors de la révision).*
- **R-6 — Un seul chemin d'entrée au MVP : le fichier.** Une Ressource ne peut naître que du dépôt d'un fichier aux formats supportés (FR-5). Aucune Ressource n'est rédigée directement dans l'application au MVP. *(Conséquence assumée : une note de réunion doit d'abord exister sous forme de fichier.)*
- **R-7 — L'Historique est personnel.** Les Conversations et les recherches passées ne sont visibles que par leur auteur. `[HYPOTHÈSE : le cahier des charges demande de « retrouver l'historique des échanges ou recherches » sans préciser s'il est partagé. Voir Q-3.]`

## 6. Exigences non fonctionnelles transverses

*Elles s'appliquent au système, pas à une fonctionnalité. Chaque exigence porte une borne mesurable, jamais un adjectif.*

- **Sécurité.** Mots de passe hachés avec sel (jamais MD5/SHA1 seul) ; sessions portées par cookie `HttpOnly` ; toute route ou API de Ressource renvoie 401 ou redirige sans session valide ; **aucune clé d'API du fournisseur d'IA n'est exposée au navigateur** (les appels sortants partent du serveur).
- **Performance.** Recherche restituée en moins de 3 secondes ; premier élément de réponse de l'assistant en moins de 10 secondes ; dépôt d'un fichier de 5 Mo accepté sans attente perceptible à l'interface. `[HYPOTHÈSE : cibles fixées par l'agent, à valider.]`
- **Coût.** La consommation IA est plafonnée par Utilisateur et par jour ; un dépassement produit un message explicite, pas une erreur technique. `[HYPOTHÈSE : contrainte absente du cahier des charges mais structurelle pour un outil interne budgété.]`
- **Traçabilité.** Toute réponse doit permettre de retrouver les Ressources sur lesquelles elle s'appuie (FR-11), afin qu'une réponse contestée puisse être auditée.
- **Accessibilité.** Navigation complète au clavier et contrastes conformes WCAG 2.1 niveau AA sur les parcours principaux. `[HYPOTHÈSE : non exigé explicitement ; recommandé pour un outil utilisé quotidiennement.]`
- **Langue.** Interface, messages d'erreur et réponses de l'assistant en français. `[HYPOTHÈSE : déduit du contexte du cahier des charges ; à confirmer.]`

## 7. Non-Goals (Explicit)

*Ce que NexaMind AI n'est pas et ne cherchera pas à être au MVP. Cette section protège le projet contre les ajouts insidieux en cours de route.*

- **Ce n'est pas un portail client.** Les indépendants et PME accompagnés par NexaWorks n'ont aucun accès. NexaMind AI ne devient pas un extranet ni un outil de partage client au MVP.
- **Ce n'est pas une GED (Gestion Électronique de Documents).** Pas de versionnage complexe, pas de circuit de validation de document, pas de métadonnées personnalisées par type, pas d'édition collaborative en temps réel.
- **Ce n'est pas un moteur de connecteurs universels.** Pas de synchronisation automatique avec Google Drive, Notion, Slack ou Microsoft Teams au MVP. Chaque connecteur représente une charge de maintenance et de sécurité disproportionnée.
- **Ce n'est pas un agent autonome avec outils externes.** L'assistant répond aux questions posées sur les Ressources internes. Il n'envoie pas d'e-mails, ne crée pas de tâches dans un outil tiers, ne planifie pas d'actions et n'interroge pas le web public au MVP.
- **Ce n'est pas un outil de génération marketing.** Pas de rédaction de posts LinkedIn, pas de reformulation de style pour les réseaux, pas de copywriting. L'accent reste strictement sur la restitution fidèle du savoir interne.
- **Ce n'est pas un outil d'archivage légal ou réglementaire.** Pas de signature électronique, pas de coffre-fort numérique à valeur probante.
- **Ce n'est pas une application mobile native.** Pas d'application iOS ou Android au MVP ; application web responsive uniquement.

## 8. MVP Scope

### 8.1 In Scope

*Ce qui doit fonctionner pour que le MVP soit considéré comme livré.*

- **Comptes et accès** : création de compte, connexion, déconnexion, protection de toutes les Ressources (FR-1 à FR-3).
- **Tableau de bord** : point d'entrée donnant accès aux fonctions et aux Conversations récentes (FR-4).
- **Ressources** : dépôt de fichiers (PDF texte, DOCX, TXT, Markdown), titre, catégorie, étiquettes, statut d'Ingestion, consultation, filtres, suppression par l'auteur (FR-5 à FR-7).
- **Ingestion et indexation** : découpage, vectorisation, indexation, avec statut visible et relance en cas d'échec (FR-6).
- **Recherche** : recherche textuelle et sémantique sur les Ressources prêtes (FR-8, FR-9).
- **Assistant conversationnel RAG** : questions en langage naturel, réponses fondées sur les Ressources, Citations cliquables, abstention explicite, Conversations à plusieurs Échanges (FR-10 à FR-13).
- **Résumé automatique** d'une Ressource (FR-14).
- **Historique** personnel des Conversations et des recherches (FR-15, FR-16).
- **Qualité transverse** : sécurité, performance, coût plafonné, traçabilité, accessibilité de base, interface en français (§6).

### 8.2 Out of Scope for MVP

*Chaque élément ci-dessous est explicitement hors périmètre. Les omettre en silence serait la première source de dérive.*

- **Accès des clients** (indépendants, PME) à la plateforme : le produit est un intranet strict (§2.3). *Déféré v2.*
- **Multi-organisations et cloisonnement par client** : décidé hors périmètre pendant la rédaction. *Déféré v2.*
- **Espaces de travail cloisonnés comme objet de première classe** : « Espace de travail » est interprété comme la base partagée de l'entreprise (voir FR-7). *Déféré v2.*
- **Marqueur de confidentialité par Ressource** : écarté sur décision du commanditaire. `[NOTE FOR PM]` Point sensible : sans lui, les documents RH, financiers ou clients pourraient ne jamais être déposés, ce qui affaiblirait l'assistant lui-même. Critère de réexamen défini en Q-7.`
- **Connecteurs** vers les outils existants (stockage, messagerie, wiki, gestion de projet) : chaque connecteur est un projet à part entière (authentification externe, synchronisation, gestion des suppressions). *Déféré v2.*
- **Saisie d'une Ressource directement dans l'application** (éditeur de texte) : le MVP n'accepte que des fichiers (R-6).
- **OCR et traitement des documents scannés** : PDF non sélectionnables, images, sons et vidéos sont refusés (FR-5).
- **Aide à la rédaction, reformulation intelligente, extraction d'informations structurées** : variations cosmétiques du même appel d'IA, sans effet sur la valeur démontrée. *Déférés v2.*
- **Rôles et permissions au MVP :** limitation stricte à deux rôles (**Collaborateur** en lecture/recherche/chat et **Administrateur** avec pouvoir exclusif d'ingestion et de gestion documentaire). Les permissions plus fines par groupe ou dossier sont déférées en v2.
- **Notifications** (e-mail, alertes de mise à jour d'une Ressource).
- **Application mobile native** : le produit est une application web, form-factor fixé par le cahier des charges.
- **Interface multilingue** : français uniquement (§6).
- **Recherche fédérée vers des sources externes** et **modes de réponse avancés** (agents multi-étapes, outils appelés par l'IA).
- **Purge automatique de l'Historique** : voir FR-16 et Q-6.
- **Analytique d'usage détaillée** (statistiques de consultation par Ressource, tableaux de bord administrateur).

## 9. Success Metrics

*Chaque métrique croise les FR qu'elle valide. Une métrique sans méthode de mesure n'est pas une métrique.*

**Primaires** *(elles valident la thèse du produit)*

- **SM-1 — L'information se trouve sans aide humaine.** Sur un jeu de 15 questions représentatives (procédures, projets, comptes rendus), un collaborateur qui ne connaît pas le dossier obtient une réponse exploitable, avec une Citation correcte, pour **au moins 12 questions sur 15 (80 %)**. *Mesure : session de test avec 3 collaborateurs, jeu de questions figé, revue manuelle de chaque réponse.* Valide FR-8, FR-9, FR-10, FR-11.
- **SM-2 — L'assistant ne fabrique pas.** Sur un jeu de 6 questions **dont la réponse n'existe pas dans la base**, l'assistant déclare l'absence d'information **6 fois sur 6**, sans présenter de Citation comme si elle répondait. *Mesure : même session de test, réponse binaire par question.* Valide FR-12 et R-4. **C'est la métrique la plus importante du MVP** : un assistant qui invente rend l'outil inutilisable en interne, quel que soit le reste.
- **SM-3 — Le délai jusqu'à la première réponse utile est de l'ordre de la minute.** Sur les 15 questions de SM-1, un collaborateur trouve l'information **en moins de 60 secondes** pour au moins 10 questions, chronomètre en main, comparé à une recherche manuelle dans les fichiers partagés (temps de référence à mesurer une fois au démarrage). *Mesure : chronométrage pendant la session de test.* Valide FR-4, FR-8, FR-10.

**Secondaires**

- **SM-4 — La base est alimentée de manière contrôlée.** Après 3 semaines d'usage, la base contient **au moins 50 Ressources** déposées par les administrateurs pour couvrir les principaux besoins documentaires des équipes. *Mesure : comptage direct.* Valide FR-5, FR-6.
- **SM-5 — Une Ressource déposée devient réellement interrogeable.** Sur 10 Ressources déposées, **au moins 9** atteignent le statut Prête sans intervention technique. *Mesure : suivi des statuts d'Ingestion.* Valide FR-6.
- **SM-6 — Le résumé fait gagner la relecture.** Sur 5 Ressources de plus de 10 pages, un collaborateur juge le résumé **suffisant pour se remettre à niveau** sans lire le document, **au moins 4 fois sur 5**. *Mesure : avis binaire recueilli après usage réel.* Valide FR-14.

**Contre-métriques (à ne PAS optimiser)**

- **SM-C1 — Le nombre de questions posées.** À ne pas optimiser : viser « beaucoup de questions » pousserait à rendre l'assistant bavard et à délayer les réponses. Contrebalance SM-1 et SM-3 : c'est la **vitesse de résolution** qui compte, pas le volume d'Échanges.
- **SM-C2 — Le nombre de Ressources indexées.** À ne pas optimiser : viser « toujours plus de documents » pousserait à ingérer des doublons, des brouillons et des versions obsolètes, ce qui dégrade SM-1 et SM-2. Contrebalance SM-4.
- **SM-C3 — La longueur des réponses de l'assistant.** À ne pas optimiser : des réponses longues *paraissent* riches, baissent la précision des Citations et masquent les cas d'abstention. Contrebalance SM-2.

*Note de mesure : le jeu de questions de SM-1 et SM-2 doit être figé avant le développement puis rejoué à chaque itération. C'est ce qui transforme « ça a l'air de marcher » en résultat vérifiable.*

## 10. Open Questions

*Ces questions n'ont pas de réponse explicite dans le cahier des charges. Elles doivent être tranchées avant le déploiement réel. Celles marquées [BLOQUANTE] doivent l'être avant la fin des ateliers `bmad-ux` et `bmad-architecture`.*

- **Q-1 [BLOQUANTE] — Qui peut créer un compte ?** Le cahier des charges demande « créer un compte et se connecter de manière sécurisée ». S'agit-il d'une inscription libre (n'importe quelle adresse e-mail), restreinte au domaine e-mail `@nexaworks.*`, ou de comptes créés manuellement par un administrateur ? *Impact : modèle d'authentification et sécurité de l'intranet.*
- **Q-2 [TRANCHÉE] — Existe-t-il un rôle administrateur formel au MVP ?** Décision validée : **oui**. Deux rôles stricts : Collaborateur (consultation/recherche/chat RAG/historique) et Administrateur (seul habilité à déposer, catégoriser, modifier et supprimer des Ressources).
- **Q-3 — Quel volume documentaire de départ pour le lancement ?** Combien de documents réels NexaWorks compte-t-elle injecter au premier jour (dizaines, centaines, milliers) ? *Impact : dimensionnement de la base vectorielle, durée de l'ingestion initiale et coût d'embedding.*
- **Q-4 — Faut-il une rétention ou une purge automatique de l'Historique ?** Les Conversations et recherches passées sont-elles conservées indéfiniment ou purgées après un délai (ex. 90 jours) ? *Impact : conformité RGPD interne et volumétrie base de données.*
- **Q-5 — Quel budget / quota mensuel acceptable pour les appels IA ?** Un collaborateur moyen pose-t-il 5, 20 ou 50 questions par jour ? *Impact : choix des modèles (taille, coût par million de tokens) et politique de plafonnement.*
- **Q-6 — Quelles directives pour la propriété intellectuelle des documents déposés ?** Des clauses de confidentialité client interdisent-elles l'envoi de certains textes vers des API d'IA hébergées hors UE ? *Impact : choix d'un fournisseur cloud compatible ou nécessité d'un modèle auto-hébergé.*
- **Q-7 — Critère de réouverture du marqueur de confidentialité :** après 3 semaines d'utilisation, si aucun document stratégique ou RH n'a été déposé par crainte d'exposition interne, la fonctionnalité de confidentialité (écartée du MVP) doit-elle être réintroduite en priorité ?

## 11. Assumptions Index

*Chaque élément ci-dessous a été déduit par l'agent ou retenu comme hypothèse de travail lors de la rédaction guidée. Aucun ne provient textuellement du cahier des charges.*

1. **§2.1 — Trois profils d'usage identifiés :** collaborateur standard (majoritaire), responsable de contenu/administrateur, et nouvel arrivant (situation d'usage critique).
2. **§2.3 — Non-Users stricts :** aucun accès public, aucun mode invité, aucun accès pour les clients de NexaWorks au MVP.
3. **§4.1 (FR-1) — Inscription ouverte par défaut :** tout visiteur peut s'inscrire, en attendant une politique de domaine restreint (voir Q-1).
4. **§4.1 (FR-2) — Protection anti-force brute :** verrouillage temporaire de 5 minutes après 5 échecs consécutifs.
5. **§4.2 (FR-4) — Contenu minimal du Tableau de bord :** raccourcis vers recherche, assistant, dépôt, 5 dernières conversations et compteur de ressources prêtes.
6. **§4.3 (FR-5) — Liste fermée de catégories :** Compte rendu, Procédure, FAQ, Fiche projet, Note de réunion, Ressource métier.
7. **§4.3 (FR-7) — Notion d'Espace interprétée comme base partagée :** pas d'espaces privés étanches au MVP ; chacun accède à tout le fonds documentaire prêt.
8. **§4.4 (FR-9) — Moteur de recherche hybride unifié :** la recherche textuelle simple et l'assistant s'appuient sur le même mécanisme de découpage et d'indexation vectorielle.
9. **§4.5 (FR-10) — Seuil de performance de l'assistant :** premier jet de réponse en moins de 10 secondes en condition normale.
10. **§4.5 (FR-11) — Plafond de citations :** 5 sources distinctes maximum affichées par réponse pour préserver la lisibilité.
11. **§4.5 (FR-12) — Protocole de test de non-invention :** jeu de contrôle de 10 questions dont 3 sans réponse pour auditer le zéro hallucination.
12. **§4.6 (FR-14) — Délai de résumé :** moins de 15 secondes pour un document de 20 pages.
13. **§5 (R-5) — Gouvernance d'accès centralisée :** tout collaborateur authentifié peut lire toute Ressource prête ; **seul un Administrateur** peut déposer, modifier ou supprimer des Ressources. *(Décision utilisateur issue de la révision).*
14. **§5 (R-7) — Confidentialité de l'Historique :** chaque utilisateur ne voit que ses propres Conversations et recherches.
15. **§6 — Exigences transverses chiffrées :** cibles de latence (< 3s recherche, < 10s IA), interface 100 % en français, conformité WCAG 2.1 AA.
16. **§8.2 — Écartement délibéré de la saisie directe :** le dépôt par fichier est l'unique mode d'entrée documentaire au MVP (les notes doivent être rédigées hors outil).
