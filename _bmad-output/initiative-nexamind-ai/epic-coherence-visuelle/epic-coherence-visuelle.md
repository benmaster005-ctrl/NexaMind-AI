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
- **2026-09-29 — réconciliation.** Story 7.1 livrée (`plan-7-1-socle-visuel.md` passée en `built`) : tokens, thème sombre complet, primitives partagées, `<AppNav>` sur les 7 pages, icônes SVG. La **refonte du tableau de bord** (en-tête horizontal, marque géométrique, recherche unique, trois colonnes de données réelles) est committée (`c1f4172`) et reste dans le périmètre de cet epic.
- **2026-09-29 — story 7.3 livrée** (`plan-7-3-en-tete-unifie.md` en `built`, commit de cette story) : composant `PageHeader` (un seul `h1` par écran sur les 6 écrans de travail), lien « ← Accueil » et recette `buttonClass` supprimés de `/documents`, `CardTitle` retiré des titres de `/search`, `/history` et de la fiche document, en-tête du client de chat et styles orphelins (`.brand`, `.header`) effacés, séparateur de métadonnées unique `·`. `npm test` 304/304, `lint`, `typecheck` et `build` verts.
- **Découpage.** `tickets.toml` enregistre les stories 7.2 à 7.10 : 7.2 finitions du socle, 7.3 en-têtes/navigation, 7.4 tableau de bord, 7.5 gestion documentaire, 7.6 assistant, 7.7 recherche, 7.8 historique, 7.9 authentification, 7.10 non-régression et livraison.
- **Correction de périmètre.** La route de gestion est `/documents` (et non `/admin/resources`) : la gestion des rôles a été supprimée le 2026-09-29 (commit `376d3b2`). Les lots 3 et 4 de `deferred-work.md` sont corrigés en conséquence.
- **Hors périmètre confirmé** : `lib/ai/**`, `app/api/**`, migrations, RLS, limites d'upload (4 Mo) et prompts système — aucune de ces zones n'est touchée par les stories 7.2 à 7.10.
