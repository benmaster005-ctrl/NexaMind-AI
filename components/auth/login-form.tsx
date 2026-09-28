"use client";

import { useState, type FormEvent } from "react";

import { signInAction } from "@/app/(auth)/actions";
import styles from "./auth.module.css";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signInAction(new FormData(event.currentTarget));
      // Succès = redirection serveur (aucun retour) ; sinon message neutre.
      if (result && !result.success && result.message) {
        setError(result.message);
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
        <label className={styles.label} htmlFor="login-email">
          Adresse e-mail
        </label>
        <input
          className={styles.input}
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@entreprise.fr"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-password">
          Mot de passe
        </label>
        <input
          className={styles.input}
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Votre mot de passe"
        />
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Connexion en cours…" : "Se connecter"}
      </button>

      <p className={styles.switch}>
        Pas encore de compte ? <a href="/register">Créer un compte</a>
      </p>
    </form>
  );
}
