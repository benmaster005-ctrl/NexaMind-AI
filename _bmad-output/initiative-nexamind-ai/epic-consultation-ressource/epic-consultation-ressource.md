---
type: epic
title: "Consultation de Ressource & Accès au Passage Cité"
parent: initiative-nexamind-ai
covers: ["FR-8", "FR-9", "FR-11"]
after: [epic-resume-historique]
risk: low
---

# Epic 6 : Consultation de Ressource & Accès au Passage Cité

## Description
Comble un écart entre le PRD et le MVP livré : la fiche `/resources/[id]` (créée en 5.1) n'affiche que des métadonnées et le bouton « Résumer », alors que le PRD impose qu'un résultat de recherche « mène à la Ressource, **au passage concerné** » (FR-8/FR-9) et que « cliquer sur une Citation ouvre la Ressource au passage utilisé pour construire la réponse » (FR-11). Ce rendu lit les morceaux vectorisés déjà stockés en base : aucun nouveau stockage, aucun Gemini.

## Outcome
Depuis un résultat de recherche ou une citation de l'assistant, l'utilisateur lit le document dans le navigateur et atterrit directement sur le passage qui a motivé sa venue, surligné.

## Requirements

- FR-8: Un résultat de recherche mène à la Ressource, au passage concerné. (PRD §4.4)
- FR-9: L'accès à la Ressource passe par le contenu indexé. (PRD §4.4)
- FR-11: Cliquer sur une Citation ouvre la Ressource au passage utilisé. (PRD §4.5)

## Done when
1. `/resources/[id]` affiche le contenu intégral du document (morceaux dans l'ordre), lisible sur mobile comme sur desktop, sans téléchargement.
2. Arrivé depuis une recherche (`?chunk=`) ou une citation, le passage correspondant est surligné et visible sans défilement manuel.
3. Cliquer une puce de citation `[n]` du chat mène à la fiche, sur le bon passage.
4. Aucun texte n'est rendu comme HTML brut (XSS neutralisé) et la fiche reste lisible sans JavaScript côté contenu.

## Boundaries
La consultation et l'ancrage au passage cité. Pas la synthèse (epic 5), pas l'ingestion, pas la recherche elle-même, pas d'édition du contenu.

## References

- parent — _bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md, Sections 4.4 & 4.5 (FR-8, FR-9, FR-11)
- ux — _bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/EXPERIENCE.md, Écrans 1 (Accueil) et 3 (Assistant)
- implementation — _bmad-output/implementation-artifacts/plan-5-1-resume-automatique-ressource.md (fiche créée), plan-4-2-route-chat-streaming.md (citations)

## Notes
- Écart constaté le 2026-09-27 au terme de l'Epic 5, à la demande de l'utilisateur : le lien `/resources/[id]` des résultats de recherche menait à 404 jusqu'à la story 5.1, puis à une fiche sans contenu.
