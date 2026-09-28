---
title: NexaMind AI Design System
status: final
created: 2026-09-26
updated: 2026-09-26
sources:
  - _bmad-output/planning-artifacts/prds/prd-NexaMind AI-2026-09-26/prd.md
tokens:
  colors:
    brand:
      primary: "#2563EB"       # Cobalt Blue (actions principales, état actif)
      primary_hover: "#1D4ED8" # Hover / press
      primary_subtle: "#EFF6FF"# Fond sélection / badge clair
      primary_dark: "#3B82F6"  # Version lumineuse pour dark mode
    neutral:
      slate_50: "#F8FAFC"      # Fond de page clair
      slate_100: "#F1F5F9"     # Fond de cartes / surfaces secondaires
      slate_200: "#E2E8F0"     # Bordures légères
      slate_300: "#CBD5E1"     # Bordures actives / inputs
      slate_500: "#64748B"     # Textes secondaires / métadonnées
      slate_700: "#334155"     # Textes principaux secondaires
      slate_900: "#0F172A"     # Titres et texte primaire clair
      dark_bg: "#0B1120"       # Fond de page sombre
      dark_surface: "#111827"  # Fond cartes sombre
      dark_border: "#1F2937"   # Bordures sombre
      dark_text: "#F9FAFB"     # Texte sombre principal
    semantic:
      success: "#10B981"       # Ressource prête
      warning: "#F59E0B"       # En cours d'ingestion
      error: "#EF4444"         # Échec / abstention explicite
      info: "#3B82F6"          # Citations / aides
  typography:
    font_family_sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font_family_mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    sizes:
      xs: "0.75rem"    # 12px - Badges, métadonnées
      sm: "0.875rem"   # 14px - Textes secondaires, inputs, citations
      base: "1rem"     # 16px - Corps de texte par défaut, bulles de chat
      lg: "1.125rem"   # 18px - Sous-titres
      xl: "1.25rem"    # 20px - Titres de cartes
      2xl: "1.5rem"    # 24px - Titres d'écrans mobile
      3xl: "1.875rem"  # 30px - Titre du Tableau de bord desktop
    weights:
      normal: 400
      medium: 500
      semibold: 600
      bold: 700
  spacing:
    unit: "0.25rem"    # 4px base
    xs: "0.5rem"       # 8px
    sm: "0.75rem"      # 12px
    md: "1rem"         # 16px (marge standard mobile)
    lg: "1.5rem"       # 24px
    xl: "2rem"         # 32px
  rounded:
    sm: "0.375rem"     # 6px (tags, petits badges)
    md: "0.5rem"       # 8px (inputs, cartes de documents)
    lg: "0.75rem"      # 12px (modales, bulles de chat, bottom sheets)
    full: "9999px"     # Badges d'état, boutons ronds
---

# NexaMind AI — Spécification Design (DESIGN.md)

## 1. Brand & Style
- **Identité :** NexaMind AI incarne un copilote documentaire d'entreprise sobre, rapide et rigoureux.
- **Style :** « Clean Tech Slate » — inspiré des standards modernes B2B (Linear, Stripe, Notion).
- **Philosophie :** Zéro encombrement visuel. La priorité absolue est donnée à la lisibilité du texte, à la distinction nette entre question et réponse, et à la mise en évidence des sources.

## 2. Colors & Theming
- **Thème automatique (System-adaptive) :** L'application commute automatiquement entre les palettes claire et sombre selon les préférences de l'OS.
- **Palette Claire (Light) :**
  - Fond d'écran : `{tokens.colors.neutral.slate_50}`
  - Cartes & Bulles assistant : `{tokens.colors.neutral.slate_100}`
  - Texte principal : `{tokens.colors.neutral.slate_900}`
  - Couleur d'accent & CTA : `{tokens.colors.brand.primary}`
- **Palette Sombre (Dark) :**
  - Fond d'écran : `{tokens.colors.neutral.dark_bg}`
  - Cartes & Bulles assistant : `{tokens.colors.neutral.dark_surface}`
  - Bordures : `{tokens.colors.neutral.dark_border}`
  - Texte principal : `{tokens.colors.neutral.dark_text}`
  - Couleur d'accent : `{tokens.colors.brand.primary_dark}`

## 3. Typography & Hierarchy
- **Police système sans serif ultra-optimisée** pour un chargement instantané sans flash de police sur smartphone.
- Corps de texte standard fixé à 16px minimum sur mobile pour éviter tout zoom automatique intempestif sur iOS/Android.

## 4. Layout & Spacing (Mobile-First)
- **Conteneur mobile :** Largeur 100%, marge intérieure latérale de `{tokens.spacing.md}` (16px).
- **Zone sécurisée (Safe Area) :** Prise en compte de la barre d'accueil tactile basse (`env(safe-area-inset-bottom)`) pour que la barre de navigation ne soit jamais masquée.
- **Grille Desktop :** Barre latérale fixe de 260px + zone de contenu centrée max 960px pour une lecture documentaire optimale.

## 5. Components & Micro-interactions
- **Bulles de Chat :**
  - Message Utilisateur : Alignement à droite, fond `{tokens.colors.brand.primary}`, texte blanc, coins arrondis `{tokens.rounded.lg}`.
  - Message Assistant : Alignement à gauche, fond neutre (`slate_100` ou `dark_surface`), texte principal, coins arrondis `{tokens.rounded.lg}`, bordure fine.
- **Puces de Citations (`[1]`, `[2]`) :**
  - Affichage en exposant ou badge compact cliquable `{tokens.colors.brand.primary_subtle}` avec texte bleu cobalt.
  - Au clic : déclenche une animation douce d'ouverture d'un tiroir bas (Bottom Sheet sur mobile) ou survol d'un popover d'extrait sur desktop.
- **Pastilles de Statut d'Ingestion :**
  - `Prête` : Pastille verte (`success`), texte vert foncé.
  - `En cours` : Pastille ambre avec icône de chargement discret (`warning`).
  - `Échec` : Pastille rouge avec texte expliquant le refus (`error`).
- **Barre de Navigation Basse (Bottom Bar Mobile) :**
  - Hauteur fixe 64px, fixée en bas, icônes avec libellés 11px sous l'icône, état actif marqué par la couleur primaire.

## 6. Do's and Don'ts
- **DO :** Laisser au moins 44x44px pour chaque zone de clic tactile sur mobile.
- **DO :** Permettre le repliement des longues citations pour préserver l'espace vertical.
- **DON'T :** Ne jamais cacher les messages d'abstention (quand l'IA ne sait pas, l'encadré neutre doit être immédiatement identifiable).
- **DON'T :** Ne jamais afficher d'options d'administration ou de boutons de suppression à un profil Collaborateur standard.

