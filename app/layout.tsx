import type { Metadata } from "next";

import "./globals.css";

/**
 * Aucune police n'est chargee : la charte impose la pile systeme
 * (`--font-sans` dans `globals.css`, DESIGN.md 3) pour un affichage immediat,
 * sans requete reseau ni flash de police. Le template Next chargeait Geist
 * (`next/font/google`) et posait `--font-geist-*` : ces variables n'etaient
 * consommees nulle part, la police etait donc telechargee pour rien
 * (story 7.2).
 */
export const metadata: Metadata = {
  title: "NexaMind AI — Copilote métier interne",
  description:
    "Retrouvez l'information NexaWorks en quelques secondes, avec des réponses rattachées aux documents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
