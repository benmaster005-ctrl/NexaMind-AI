---
type: initiative
title: "NexaMind AI — Copilote métier interne RAG de NexaWorks"
parent: none
covers: ["FR-1", "FR-2", "FR-3", "FR-4", "FR-5", "FR-6", "FR-7", "FR-8", "FR-9", "FR-10", "FR-11", "FR-12", "FR-13", "FR-14", "FR-15", "FR-16"]
after: []
assignee: ""
risk: high
---

# NexaMind AI — Copilote métier interne RAG de NexaWorks

## Description

NexaMind AI est le copilote métier interne de NexaWorks : un espace unique où l'information de l'entreprise est centralisée, retrouvée en quelques secondes, et interrogeable en langage naturel avec des réponses rattachées aux documents réels. Le PRD validé (§1 Vision) et l'architecture spine (`ARCHITECTURE-SPINE.md`) portent le périmètre ; cette initiative les découpe en 5 epics ordonnés (voir `tickets.toml`).

## Outcome

Les collaborateurs de NexaWorks retrouvent une information en quelques secondes et obtiennent des réponses homogènes rattachées aux sources, sans hallucination — signal : les 6 métriques de succès du PRD §9 (adoption, zéro-hallucination, usage, délai de réponse, satisfaction, transmission).

## Requirements

- FR-1: Création de compte sécurisée. (PRD §4.1)
- FR-2: Connexion sécurisée. (PRD §4.1)
- FR-3: Sécurité des espaces (sessions, rôles, chiffrement). (PRD §4.2 + R-5, R-7)
- FR-4: Tableau de bord (raccourcis, 5 dernières conversations, compteur ressources prêtes). (PRD §4.2)
- FR-5: Dépôt de documents par l'Administrateur (PDF, DOCX, TXT, MD ; catégories fermées ; tags). (PRD §4.3 + R-5)
- FR-6: Découpage & indexation vectorielle (400-500 tokens, overlap 50, text-embedding-004 768d). (PRD §4.3)
- FR-7: Gestion de l'espace documentaire (catégories, statuts Prête/En cours/Échec, suppression + déréférencement). (PRD §4.3 + R-5)
- FR-8: Moteur de recherche par mots-clés rattaché aux Ressources. (PRD §4.4)
- FR-9: Recherche sémantique (vectorisation requête, même indexation, routeurs API). (PRD §4.4)
- FR-10: Assistant conversationnel RAG multi-échanges. (PRD §4.5)
- FR-11: Citations cliquables (sources + passages + renvois inline [1], [2]). (PRD §4.5)
- FR-12: Abstention explicite si information introuvable. (PRD §4.5 + R-4)
- FR-13: Conversations persistantes nommées, supprimables, reprises contextuelles. (PRD §4.5)
- FR-14: Fonctionnalité « Résumer » en points clés. (PRD §4.6)
- FR-15: Historique des conversations consultable et reprenable. (PRD §4.6)
- FR-16: Historique personnel des recherches, réexécutable en un clic. (PRD §4.6)

## Done when

1. Un collaborateur s'inscrit, se connecte et voit son tableau de bord (compteur + 5 dernières conversations) en < 2 s.
2. Un administrateur dépose un document qui devient interrogeable (statut Prête) en < 30 s, et sa suppression le déréférence totalement.
3. Une question couverte reçoit une réponse avec citations cliquables ; une question hors documents déclenche l'abstention explicite, sans hallucination.
4. Les 6 métriques de succès du PRD §9 sont mesurables sur le MVP (adoption, zéro-hallucination, usage, délai, satisfaction, transmission).

## Boundaries

Le copilote web responsive (mobile-first) : auth, tableau de bord, dépôt/ingestion, recherche, assistant RAG, résumé, historiques. Pas les espaces privés étanches, pas le marqueur de confidentialité, pas les connecteurs externes (Drive/Notion) — voir les Non-Goals du PRD §7. Tracer path : un admin dépose une procédure, un collaborateur la retrouve en recherche puis l'interroge dans le chat avec citations.

- Touch point: Supabase (PostgreSQL + pgvector + Auth + Storage) — schéma, RLS, RPC `match_chunks` ; owner: epic-fondations-auth
- Touch point: Google Gemini (text-embedding-004 + gemini-1.5-flash via Vercel AI SDK) — embeddings et génération streaming ; owner: epic-assistant-rag

## References

- prd — _bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md, Sections 4 (FR-1 à FR-16), 5 (R-1 à R-7), 7 (Non-Goals), 9 (métriques)
- architecture — _bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md (AD-1 à AD-4, Capability Map)
- ux-design — _bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/DESIGN.md (tokens, composants)
- ux-experience — _bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/EXPERIENCE.md (5 écrans, états, flux Léa/Karim)

## Notes

- Decision: dépôt et administration documentaire strictement réservés aux Administrateurs (PRD §10 Q-2 tranchée, 2026-09-26).
- **Decision 2026-09-27 : les métriques de succès du PRD §9 (SM-1 à SM-6) sont abandonnées.** Le critère de clôture n° 4 (« les 6 métriques sont mesurables sur le MVP ») n'est donc **pas** delivered, volontairement. La conformité fonctionnelle du MVP est couverte par la validation live de bout en bout (56/56) consignée dans `_bmad-output/implementation-artifacts/mvp-validation-report.md`. Aucun epic ni ticket n'est créé pour ces métriques.
- Open question: qui peut créer un compte — inscription libre, domaine @nexaworks restreint, ou comptes créés par admin (PRD §10 Q-1 bloquante) ; la story 1.2 part sur inscription ouverte par défaut.
- Open question: volume documentaire de départ, rétention/purge historique, budget IA, propriété intellectuelle (PRD §10 Q-3 à Q-6) — à trancher avant déploiement réel.
