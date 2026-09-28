---
title: NexaMind AI Experience Specification
status: final
created: 2026-09-26
updated: 2026-09-26
sources:
  - _bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md
  - _bmad-output/planning-artifacts/ux-designs/ux-NexaMind AI-2026-09-26/DESIGN.md
---

# NexaMind AI — Spécification Expérience & Ergonomie (EXPERIENCE.md)

## 1. Foundation & Form-Factor
- **Plateforme :** Web responsive fluide (optimisé de l'écran smartphone 375px jusqu'au grand écran 1440px+).
- **Architecture de navigation par rôle :**
  - **Collaborateur standard :**
    - Mobile (Bottom Bar) : `[ 🏠 Accueil | 🔍 Recherche | 💬 Assistant | 🕒 Historique ]`
    - Desktop (Sidebar) : Mêmes sections + consultation de la liste des ressources prêtes.
  - **Administrateur :**
    - Mobile (Bottom Bar) : `[ 🏠 Accueil | 🔍 Recherche | 💬 Assistant | ⚙️ Gérer ]`
    - Desktop (Sidebar) : Espace administration distinct avec bouton « + Déposer une ressource » mis en avant.

## 2. Information Architecture (Écrans clés)

### Écran 1 : Authentification (`/login` & `/register`)
- Formulaire centré, sobre, compatible FaceID / TouchID / auto-fill.
- Bouton unique d'action principale (`{tokens.colors.brand.primary}`).
- Messages d'erreur discrets sans révéler la présence d'un e-mail.

### Écran 2 : Tableau de bord (`/`)
- En-tête mobile compact : Logo NexaMind AI, badge de statut, profil.
- **Bloc 1 — Recherche unifiée :** Champ rapide « Poser une question ou rechercher un document... ».
- **Bloc 2 — Métrique de confiance :** Compteur en direct « 214 ressources prêtes » et date de mise à jour.
- **Bloc 3 — Reprise d'activité :** Liste déroulante des 5 dernières conversations avec date relative (« Il y a 2h »).
- **Bloc 4 (Admin uniquement) :** Carte d'action rapide « Déposer un document » (PDF, DOCX, TXT, MD).

### Écran 3 : Assistant Conversationnel (`/chat` & `/chat/[id]`)
- **Zone de discussion :**
  - Bulle utilisateur à droite (`{tokens.colors.brand.primary}`), bulle assistant à gauche.
  - Formatage en étapes ou puces lisibles en déplacement.
  - **Citations dans le texte :** Puces tactiles `[1]`, `[2]` ouvrant au clic un tiroir bas (Bottom Sheet) avec extrait et titre du document.
- **Zone de saisie basse fixée :** Champ extensible (1 à 4 lignes) + bouton d'envoi tactile 44x44px.

### Écran 4 : Recherche Documentaire (`/search`)
- Filtres horizontaux déroulants : `[ Tous | Procédures | Comptes rendus | FAQ | Fiches projets ]`.
- Résultats en cartes tactiles avec extrait surligné, pastille de statut et lien vers la ressource.

### Écran 5 : Espace Gestion & Dépôt (`/admin/resources` — Admin uniquement)
- Téléversement avec bouton ouvrant le sélecteur de fichiers smartphone / ordinateur.
- Formulaire : titre automatique, catégorie fermée, étiquettes libres.
- Barre d'avancement d'ingestion (`En cours` -> `Prête`).
- Liste avec modification des étiquettes et suppression sécurisée.


## 3. State Patterns & Feedback Utilisateur
- **État "L'IA réfléchit" :**
  - Animation discrète de frappe en moins de 500ms pour rassurer l'utilisateur mobile.
  - Streaming progressif de la réponse au fur et à mesure de sa génération.
- **État "Abstention / Zéro-hallucination" :**
  - Si l'information est introuvable, la bulle affiche une bordure ambrée et le texte explicite : *« Cette information n'a pas été trouvée dans les documents internes de NexaWorks. »*
  - Suggestions des 2 ou 3 documents connexes les plus proches présentés comme pistes.
- **État d'erreur réseau / timeout :**
  - Bouton « Réessayer » sans recharger la page ni perdre la saisie.

## 4. Accessibility Floor (Norme d'Accessibilité Mobile)
- **Contrastes de couleurs :** Conformes WCAG AA (ratio minimal 4.5:1 sur tous les textes).
- **Cibles tactiles :** Minimum 44x44px pour chaque icône, bouton d'envoi et puce de citation.
- **Lecteurs d'écran (VoiceOver / TalkBack) :**
  - Attributs `aria-label` descriptifs sur tous les boutons d'icônes.
  - Les puces `[1]` sont annoncées sous la forme *« Source 1 : [Titre du document] »*.

## 5. Key Flows & Scénarios incarnés
- **Flux 1 (Léa sur smartphone) :** Léa ouvre l'application sur son mobile -> S'identifie -> Tape « congés payés » -> L'assistant répond en 4 étapes claires -> Elle touche la puce `[1]` -> Un tiroir bas coulisse avec l'extrait exact de la procédure RH -> Elle le referme d'un glissement vers le bas.
- **Flux 2 (Karim sur tablette / PC) :** Karim (Admin) se connecte -> Ouvre l'onglet `Gérer` -> Sélectionne son compte rendu DOCX -> Choisit la catégorie `Compte rendu` -> Valide -> La pastille passe au vert `Prête` en quelques secondes -> Le document est immédiatement interrogeable par toute l'entreprise.

