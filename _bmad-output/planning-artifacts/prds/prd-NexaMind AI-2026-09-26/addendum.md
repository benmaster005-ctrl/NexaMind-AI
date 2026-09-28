# Addendum — NexaMind AI

*Contenu utile qui n'a pas sa place dans le PRD lui-même : matière technique, mise en perspective marché, options considérées. Destiné aux ateliers en aval (`bmad-architecture`, `bmad-ux`).*

Statut : brouillon — alimenté pendant la conversation.

## A1. Mise en perspective marché (recherché le 2026-09-26)

*But : situer le produit et éviter de réinventer. Ce n'est pas une exigence.*

- **Catégorie** : « workplace AI search / assistant de connaissance interne ».
- **Acteurs représentatifs et leur positionnement** :
  - Glean — recherche d'entreprise, connecteurs massifs, leader haut de gamme.
  - Dust — plateforme d'agents + recherche, orientée startups SaaS.
  - Google NotebookLM Enterprise — notebooks IA, écosystème Workspace.
  - Inkeep — recherche IA pour documentation technique.
  - Onyx (ex-Danswer) — **open source, auto-hébergeable**, le plus proche d'un « à nous de le construire ».
  - Microsoft 365 Copilot / ChatGPT Enterprise / Claude Enterprise — IA générique adossée à un écosystème.
  - Notion AI / Slack AI / Atlassian Rovo — IA native d'un outil unique.
- **Attentes récurrentes du marché** (utiles comme source d'inspiration pour les FR) : connecteurs vers les sources, recherche sémantique + synthèse, **réponses citant les documents réels**, **respect des droits d'accès**, fraîcheur/synchronisation de l'index, outils d'inspection et d'administration.
- **Échecs classiques observés** : documents obsolètes indexés, mauvais découpage, réponses inventées en l'absence de preuve, et évaluation de la qualité à la seule « fluidité » du texte.
- **Lecture pour NexaMind AI** : la valeur différenciante du MVP ne sera pas la génération de texte (commodité), mais **la qualité du rattachement aux sources** et **la capacité à dire « je ne trouve pas »**.

## A2. Repères techniques RAG (issus de la recherche du 2026-09-26)

*Repères pour `bmad-architecture` — à valider, pas des exigences PRD.*

- **Découpage (chunking)** : viser des Morceaux de **300 à 500 tokens** environ, en préservant l'idée complète et le **titre** de la section.
- **Métadonnées utiles par Morceau/Ressource** : titre, propriétaire, date de mise à jour, statut, type, droits d'accès, URL canonique.
- **Nettoyage avant découpage** : retirer navigation, pieds de page, doublons obsolètes ; conserver titres, tableaux et frontières de documents.
- **Améliorations de la qualité de recherche** : recherche **hybride** (mots-clés + vecteurs) et **reclassement** (reranking) des candidats.
- **Instruction au modèle** : répondre à partir des sources fournies, **citer**, et **déclarer l'absence d'information** quand le contexte ne permet pas de répondre.
- **Protocole d'évaluation suggéré** : questions pièges, formulations ambiguës, versions obsolètes, frontières de permissions, questions sans réponse valide. Juger la **récupération** séparément de la **rédaction** de la réponse (ex. recall@k, taux de citations correctes, taux d'abstention correcte).
- **Séparation des problèmes** : qualité de la source ≠ qualité de la récupération ≠ qualité de la réponse.

## A3. Options techniques ouverts (à trancher en architecture)

- Base de données et authentification : à choisir (gestion propre vs service managé).
- Base vectorielle : native dans la base relationnelle vs service dédié.
- Fournisseur du modèle de génération et d'embeddings : à choisir, avec une contrainte de **coût maîtrisé** pour un usage interne.
- Ingestion : uniquement par dépôt manuel au MVP, ou connecteurs vers les outils existants.
