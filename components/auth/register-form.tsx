"use client";

import { useState, type FormEvent } from "react";

import { signUpAction } from "@/app/(auth)/actions";
import styles from "./auth.module.css";

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");

    // Contrôle local avant tout appel réseau (matrice : mot de passe court).
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setPending(true);
    try {
      const result = await signUpAction(formData);
      // Succès = redirection serveur (aucun retour).
      if (result && !result.success && result.message) {
        setError(result.message);
      } else if (result?.success && result.message) {
        // Confirmation e-mail active : pas de redirection, message d'info.
        setInfo(result.message);
      }
    } catch (unknownError) {
      // redirect("/") côté serveur lève NEXT_REDIRECT : ce n'est pas une
      // erreur, la navigation est en cours — ne rien afficher.
      const digest =
        typeof unknownError === "object" && unknownError !== null
          ? (unknownError as { digest?: unknown }).digest
          : undefined;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        return;
      }
      setError("Problème de connexion. Vérifiez votre réseau et réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="register-email">
          Adresse e-mail
        </label>
        <input
          className={styles.input}
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@entreprise.fr"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="register-password">
          Mot de passe (8 caractères minimum)
        </label>
        <input
          className={styles.input}
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          placeholder="Choisissez un mot de passe"
        />
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className={styles.info} role="status">
          {info}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Création en cours…" : "Créer mon compte"}
      </button>

      <p className={styles.switch}>
        Déjà un compte ? <a href="/login">Se connecter</a>
      </p>
    </form>
  );
}
