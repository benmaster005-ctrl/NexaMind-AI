"use client";

import { useState } from "react";

import { signOutAction } from "@/app/(auth)/actions";
import { buttonClass } from "@/components/ui/button";

/** Bouton Deconnexion : appelle signOutAction (invalide la session, -> /login). */
export default function SignOutButton() {
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
      className={buttonClass("secondary")}
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}