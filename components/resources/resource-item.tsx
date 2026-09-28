"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  deleteResourceAction,
  updateResourceMetadataAction,
} from "@/app/(dashboard)/admin/resources/actions";
import { RESOURCE_CATEGORIES } from "@/lib/resources/validation";
import styles from "./resource-item.module.css";

interface ResourceItemProps {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: string;
  chunkCount: number | null;
  tags: string[];
  errorMessage: string | null;
}

/** Carte de gestion d'une ressource (story 2.4, FR-5/FR-7). */
export default function ResourceItem({
  id,
  title,
  category,
  status,
  createdAt,
  chunkCount,
  tags,
  errorMessage,
}: ResourceItemProps) {
  const [editing, setEditing] = useState(false);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftTags, setDraftTags] = useState(tags.join(", "));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmOpen) confirmButtonRef.current?.focus();
  }, [confirmOpen]);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFeedback(null);
    setPending(true);
    try {
      const result = await updateResourceMetadataAction(id, draftCategory, draftTags);
      if (result.success) {
        setFeedback(result.message);
        setEditing(false);
      } else {
        setError(result.message);
      }
    } catch {
      setError("Problème de connexion. Vérifiez votre réseau et réessayez.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setFeedback(null);
    setPending(true);
    try {
      const result = await deleteResourceAction(id);
      if (result.success) {
        setFeedback(result.message);
        setConfirmOpen(false);
      } else {
        setError(result.message);
        setConfirmOpen(false);
      }
    } catch {
      setError("Problème de connexion. Vérifiez votre réseau et réessayez.");
      setConfirmOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <li className={styles.item}>
      <div className={styles.head}>
        <p className={styles.title}>{title}</p>
        <p className={styles.meta}>
          {category} · {status}
          {typeof chunkCount === "number" && chunkCount > 0
            ? ` · ${chunkCount} morceau${chunkCount > 1 ? "x" : ""}`
            : ""}
          {" · "}
          {new Date(createdAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          })}
        </p>
        {tags.length > 0 ? (
          <p className={styles.tags}>{tags.join(" · ")}</p>
        ) : null}
        {status === "Échec" && errorMessage ? (
          <p className={styles.degraded} role="status">
            {errorMessage}
          </p>
        ) : null}
      </div>

      {!editing ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setDraftCategory(category);
              setDraftTags(tags.join(", "));
              setEditing(true);
            }}
          >
            Modifier
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={() => setConfirmOpen(true)}
          >
            Supprimer
          </button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleUpdate}>
          <label className={styles.label} htmlFor={`cat-${id}`}>
            Catégorie
          </label>
          <select
            id={`cat-${id}`}
            className={styles.input}
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
          >
            {RESOURCE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <label className={styles.label} htmlFor={`tags-${id}`}>
            Étiquettes (séparées par des virgules)
          </label>
          <input
            id={`tags-${id}`}
            className={styles.input}
            type="text"
            value={draftTags}
            maxLength={300}
            onChange={(e) => setDraftTags(e.target.value)}
          />
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setEditing(false)}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {feedback ? (
        <p className={styles.info} role="status">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {confirmOpen ? (
        <div className={styles.overlay}>
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`del-title-${id}`}
            aria-describedby={`del-desc-${id}`}
          >
            <h3 id={`del-title-${id}`} className={styles.dialogTitle}>
              Supprimer « {title} » ?
            </h3>
            <p id={`del-desc-${id}`} className={styles.dialogText}>
              Le fichier, ses morceaux vectoriels et sa fiche seront
              définitivement supprimés.
            </p>
            <div className={styles.actions}>
              <button
                ref={confirmButtonRef}
                type="button"
                className={styles.danger}
                disabled={pending}
                onClick={handleDelete}
              >
                {pending ? "Suppression…" : "Supprimer définitivement"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setConfirmOpen(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
