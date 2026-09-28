---
type: epic
title: "Fondations, Base Supabase, Authentification & Rôles"
parent: initiative-nexamind-ai
covers: ["FR-1", "FR-2", "FR-3", "FR-4"]
after: []
risk: low
---

# Epic 1 : Fondations, Base Supabase, Authentification & Rôles

## Description
Met en place le socle fullstack de NexaMind AI : initialisation des clients Supabase (navigateur et serveur), activation de l'extension vectorielle pgvector, gestion sécurisée des sessions utilisateur (Collaborateur vs Administrateur) et tableau de bord unifié responsive.

## Outcome
Les collaborateurs et administrateurs de NexaWorks peuvent créer un compte, se connecter de manière sécurisée et accéder à un tableau de bord épuré adapté au mobile et au desktop.

## Done when
1. Un collaborateur peut s'inscrire et se connecter avec session sécurisée HttpOnly.
2. Tout accès non authentifié aux données est bloqué (redirection ou 401).
3. Le tableau de bord affiche le nombre de ressources prêtes et les 5 dernières conversations.
4. L'accès aux outils d'administration est strictement réservé aux comptes possédant le rôle admin.

## References
- parent — _bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md, Section 4.1 & 4.2
- ux — _bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/EXPERIENCE.md, Section 2 (Écrans 1 & 2)
- architecture — _bmad-output/planning-artifacts/architecture/architecture-NexaMind AI-2026-09-26/ARCHITECTURE-SPINE.md, AD-2 & AD-4
