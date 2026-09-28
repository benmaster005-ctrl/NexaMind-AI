"use client";

/**
 * Defilement vers le passage cite (story 6.1, FR-11).
 *
 * Seul JavaScript de la fiche : le contenu du document reste rendu par le
 * serveur en texte React, et la surbrillance est posee par le serveur
 * (`data-active`). Sans ce composant, la page reste lisible mais le passage
 * cible n'est pas amene a l'ecran.
 */
import { useEffect } from "react";

interface ChunkAnchorProps {
  /** false si aucune ancre n'a ete trouvee : on ne defile alors pas. */
  active: boolean;
}

export default function ChunkAnchor({ active }: ChunkAnchorProps) {
  useEffect(() => {
    if (!active) return;
    const target = document.querySelector<HTMLElement>('[data-active="true"]');
    target?.scrollIntoView({ block: "center" });
  }, [active]);

  return null;
}
