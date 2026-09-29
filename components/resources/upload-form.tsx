"use client";

import { useState, type FormEvent } from "react";

import { uploadResourceAction } from "@/app/(dashboard)/documents/actions";
import { RESOURCE_CATEGORIES } from "@/lib/resources/validation";
import styles from "./upload-form.module.css";

/**
 * Formulaire de dépôt documentaire partagé (story 2.1, FR-5).
 * Titre + catégorie fermée + tags libres + fichier (PDF/DOCX/TXT/MD, 4 Mo).
 */
export default function UploadForm() {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Capturé avant le await : event.currentTarget redevient null
    // dès que la dispatch est terminée (standard DOM).
    const form = event.currentTarget;
    setError(null);
    setInfo(null);
    setPending(true);
    try {
      const result = await uploadResourceAction(new FormData(form));
      if (result.success) {
        setInfo(result.message);
        form.reset();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Problème de connexion. Vérifiez votre réseau et réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="upload-title">
          Titre du document
        </label>
        <input
          className={styles.input}
          id="upload-title"
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder="Ex. Procédure congés payés"
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="upload-category">
            Catégorie
          </label>
          <select
            className={styles.input}
            id="upload-category"
            name="category"
            required
            defaultValue="Ressource métier"
          >
            {RESOURCE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="upload-tags">
            Étiquettes (séparées par des virgules)
          </label>
          <input
            className={styles.input}
            id="upload-tags"
            name="tags"
            type="text"
            maxLength={300}
            placeholder="rh, congés"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="upload-file">
          Fichier (PDF, DOCX, TXT, MD — 4 Mo max)
        </label>
        <input
          className={styles.input}
          id="upload-file"
          name="file"
          type="file"
          required
          accept=".pdf,.docx,.txt,.md"
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
        {pending ? "Dépôt en cours…" : "Déposer le document"}
      </button>
    </form>
  );
}