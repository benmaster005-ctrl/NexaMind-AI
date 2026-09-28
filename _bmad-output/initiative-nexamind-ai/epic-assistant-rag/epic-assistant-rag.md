---
type: epic
title: "Assistant Conversationnel RAG & Citations Zéro-Hallucination"
parent: initiative-nexamind-ai
covers: ["FR-10", "FR-11", "FR-12", "FR-13"]
after: [epic-recherche-semantique]
risk: high
---

# Epic 4 : Assistant Conversationnel RAG & Citations Zéro-Hallucination

## Description
Fournit l'assistant conversationnel RAG cœur de NexaMind AI : service RAG (Gemini 1.5 Flash, injections de chunks, seuil 0.65, formule d'abstention AD-1), route `/api/chat` en streaming avec citations structurées `[1]`, `[2]`, interface `/chat` et `/chat/[id]` avec tiroir de sources tactile (Bottom Sheet mobile), et persistance multi-échanges avec titrage automatique.

## Outcome
Les collaborateurs interrogent le fonds documentaire en langage naturel et reçoivent des réponses utiles, contextualisées et rattachées aux documents réels — ou une abstention explicite, jamais une hallucination.

## Requirements

- FR-10: Assistant conversationnel interrogeant la base vectorielle et répondant en langage naturel (multi-échanges, contexte retenu). (PRD §4.5)
- FR-11: Citations cliquables sur chaque réponse. (PRD §4.5 : FR-11.1 sources affichées sous la réponse ; FR-11.2 clic → document + passages ; FR-11.3 renvois inline [1], [2])
- FR-12: Abstention explicite si information introuvable, sans invention. (PRD §4.5 + R-4 zéro-hallucination)
- FR-13: Conversations persistantes nommées, supprimables, avec historique et reprise contextuelle. (PRD §4.5 : FR-13.1/13.2/13.3)

## Done when
1. Une question couverte par les documents reçoit une réponse avec citations `[1]`, `[2]` cliquables.
2. Une question hors documents déclenche l'abstention explicite avec 2-3 documents proches suggérés.
3. Aucun fait non présent dans les chunks injectés n'apparaît dans une réponse.
4. Une conversation multi-échanges conserve l'ordre, le contexte de suivi et son titre automatique.

## Boundaries

L'assistant conversationnel. Pas le moteur de recherche seul (epic Recherche sémantique), pas le résumé automatique ni l'écran d'historique global (epic Résumé & Historique).

## References

- parent — _bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md, Section 4.5 & R-4
- ux — _bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/EXPERIENCE.md, Écran 3 (`/chat`, tiroir Bottom Sheet) & état Abstention
- architecture — _bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md, AD-1 (carte FR-10–FR-13 → `app/api/chat/route.ts`)

## Notes

- Waits on epic-recherche-semantique because: la fonction `match_chunks()` validée et le service de recherche vectorielle sont le socle du service RAG.
