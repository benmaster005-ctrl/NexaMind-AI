---
type: epic
title: "Cohérence Visuelle & Refonte UX"
parent: initiative-nexamind-ai
covers: []
after: [epic-consultation-ressource]
risk: low
---

# Epic 7 : Cohérence Visuelle & Refonte UX

## Description
Aligne le rendu de l'application sur le design system déjà spécifié (`DESIGN.md`, « Clean Tech Slate ») et produit un rendu **sobre, professionnel et épuré**. L'audit du 2026-09-27 a relevé sept écarts entre la spécification et le code : thème sombre partiel (4 écrans récents l'ignorent), aucun token CSS (les 25 valeurs hex de la charte sont recopiées dans ~10 modules), icônes emoji dans la navigation, pastilles de statut d'ingestion absentes, recettes de boutons dupliquées, styles inline contournant les CSS modules, échelles d'espacement improvisées.

## Outcome
Une application dont la cohérence visuelle ne dépend plus de la discipline de chaque écran : les couleurs, rayons et espacements viennent d'une source unique, le thème sombre s'applique partout automatiquement, les primitives (bouton, carte, état vide, icône) sont partagées, et la navigation est sobre.

## Requirements
Aucune exigence fonctionnelle (FR) : travail de cohérence visuelle, cadré par `DESIGN.md` §1 à §6 et `EXPERIENCE.md`.

## Done when
1. Les tokens de `DESIGN.md` sont la source unique des couleurs/rayons/espacements de l'application.
2. Le thème clair **et** sombre s'appliquent sur tous les écrans, sans exception.
3. La navigation utilise des icônes sobres (pas d'emoji) et des primitives partagées.
4. Le tableau de bord respecte la hiérarchie typographique et l'échelle d'espacement de la charte.

## Boundaries
Le socle visuel et le shell. Pas les écrans de contenu (lot 2), de gestion (lot 3) ni d'authentification (lot 4) — voir `deferred-work.md`.

## References

- design — _bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/DESIGN.md (§1 à §6, tokens)
- experience — _bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/EXPERIENCE.md (navigation, écrans)
- constat — audit du 2026-09-27 (7 écarts listés en Description)

## Notes
- Aucune dépendance nouvelle : ni Tailwind, ni librairie de composants (l'architecture impose des CSS Modules).
- Les emoji de navigation sont remplacés par un jeu d'icônes SVG dessinées à la main (aucune dépendance).
