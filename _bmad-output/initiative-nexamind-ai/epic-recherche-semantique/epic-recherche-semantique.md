---
type: epic
title: "Moteur de Recherche Textuelle & Sémantique"
parent: initiative-nexamind-ai
covers: ["FR-8", "FR-9"]
after: [epic-ingestion-ressources]
risk: medium
---

# Epic 3 : Moteur de Recherche Textuelle & Sémantique

## Description
Fournit aux collaborateurs un moteur de recherche unifié textuel et sémantique : fonction RPC Supabase `match_chunks()` sur pgvector (similarité cosinus, seuil 0.65), route API `/api/search` hybride (vecteurs + texte simple), et page `/search` mobile-first avec filtres horizontaux par catégorie et cartes tactiles.

## Outcome
Les collaborateurs de NexaWorks retrouvent une ressource en quelques secondes par mots-clés ou sens, avec pour chaque résultat le titre, la catégorie, la date et l'extrait exact ayant déclenché la correspondance.

## Requirements

- FR-8: Moteur de recherche par mots-clés rattaché aux Ressources (textuel sur titres/étiquettes/auteurs). (PRD §4.4)
- FR-9: Recherche sémantique. (PRD §4.4 : FR-9.1 vectorisation requête via text-embedding-004 ; FR-9.2 appui sur même découpage/indexation que FR-6 ; FR-9.3 routeurs API côté Next.js)

## Done when
1. Une requête « télétravail » retrouve « Politique de travail à distance » sans mot-clé identique.
2. Chaque résultat affiche titre, catégorie, date et extrait exact de correspondance.
3. Le temps total de réponse reste inférieur à 1,5 seconde.
4. Aucune ressource au statut 'En cours' ou 'Échec' n'apparaît dans les résultats.

## Boundaries

La recherche documentaire. Pas l'assistant conversationnel RAG (epic Assistant RAG), pas l'ingestion (epic Ingestion ressources).

## References

- parent — _bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md, Section 4.4
- ux — _bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/EXPERIENCE.md, Écran 4 (`/search`)
- architecture — _bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md, AD-3 (carte FR-8/FR-9 → `match_chunks`)
