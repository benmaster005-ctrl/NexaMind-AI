---
type: epic
title: "Synthèse Documentaire Automatique & Historique Personnel"
parent: initiative-nexamind-ai
covers: ["FR-14", "FR-15", "FR-16"]
after: [epic-assistant-rag]
risk: low
---

# Epic 5 : Synthèse Documentaire Automatique & Historique Personnel

## Description
Fournit la synthèse automatique d'une ressource (Gemini 1.5 Flash, 5 à 8 puces, < 10 s, bouton « Résumer » sur la fiche) et les historiques strictement personnels : écran `/history` des conversations (tri décroissant, reprise avec citations) et historique des recherches avec rejeu direct en un clic.

## Outcome
Les collaborateurs gagnent du temps avec des synthèses fiables rattachées au document complet, et retrouvent instantanément leurs conversations et recherches passées, visibles uniquement par leur auteur.

## Requirements

- FR-14: Fonctionnalité « Résumer » synthétisant une Ressource en points clés. (PRD §4.6)
- FR-15: Historique des conversations consultable et reprenable. (PRD §4.6 : FR-15 historique + FR-15.2/15.3 fonctionnalités)
- FR-16: Historique personnel des recherches accessible et réexécutable en un clic. (PRD §4.6)

## Done when
1. Le bouton « Résumer » produit 5 à 8 puces en moins de 10 s avec renvoi vers le document complet.
2. L'écran `/history` liste les conversations par date décroissante, ne montre que celles de l'auteur, et recharge une conversation avec ses citations.
3. Une recherche passée se réexécute en un clic sur l'état actualisé de la base.

## Boundaries

La synthèse et les historiques personnels. Pas la persistance des conversations elle-même (epic Assistant RAG), pas la sécurité globale des accès (epic Fondations auth, R-7).

## References

- parent — _bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md, Section 4.6 & R-7
- ux — _bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/EXPERIENCE.md, navigation Historique (Bottom Bar)
- architecture — _bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md, carte FR-14 → Server Action Gemini, FR-15/FR-16 → tables `conversations` et `messages`

## Notes

- Waits on epic-assistant-rag because: le connecteur Gemini et la persistance des conversations établies sont les prérequis du résumé et des historiques.
