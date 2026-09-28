---
type: epic
title: "Gestion Documentaire & Pipeline d'Ingestion Vectorielle"
parent: initiative-nexamind-ai
covers: ["FR-5", "FR-6", "FR-7"]
after: [epic-fondations-auth]
risk: medium
---

# Epic 2 : Gestion Documentaire & Pipeline d'Ingestion Vectorielle

## Description
Fournit à l'administrateur l'interface de dépôt documentaire (PDF, DOCX, TXT, MD), exécute l'extraction de texte, le découpage en morceaux (400-500 tokens), le calcul des embeddings Gemini et la persistance dans pgvector avec déréférencement en cascade à la suppression.

## Outcome
L'administrateur peut enrichir le fonds documentaire de NexaWorks de manière fiable avec statut d'ingestion visible et garantie de déréférencement vectoriel complet en cas de suppression.

## Done when
1. Seul un administrateur peut déposer ou supprimer des fichiers.
2. Les formats supportés (PDF texte, DOCX, TXT, MD) sont découpés et vectorisés en moins de 30s par document standard.
3. Les documents scannés ou non supportés sont explicitement rejetés en statut 'Échec'.
4. La suppression d'une ressource retire immédiatement l'intégralité de ses morceaux vectoriels de pgvector.

## References
- parent — _bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md, Section 4.3 & R-5, R-6
- architecture — _bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md, AD-2 & AD-3
