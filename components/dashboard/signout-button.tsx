"use client";

import { useState } from "react";

import { signOutAction } from "@/app/(auth)/actions";
import { buttonClass } from "@/components/ui/button";

interface SignOutButtonProps {
  /** Classe supplementaire posee sur le bouton (en-tete du tableau de bord). */
  className?: string;
  /** Contenu du bouton (icone + libelle sur l'accueil, texte seul ailleurs). */
  children?: React.ReactNode;
  /**
   * Sans la recette du socle : l'en-tete du tableau de bord pose une icone
   * ronde de 28px, dont la taille ne doit pas etre imposee par `.button`.
   */
  plain?: boolean;
}

/** Bouton Deconnexion : appelle signOutAction (invalide la session, -> /login). */
export default function SignOutButton({
  className,
  children,
  plain = false,
}: SignOutButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await signOutAction();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={plain ? className : buttonClass("ghost", className)}
      onClick={handleClick}
      disabled={pending}
    >
      {children ?? (pending ? "Déconnexion…" : "Se déconnecter")}
    </button>
  );
}