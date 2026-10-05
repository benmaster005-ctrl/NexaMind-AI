"use client";

/**
 * Bouton « Resumer » + tiroir de synthese (story 5.1, FR-14).
 *
 * Pattern de tiroir repris du tiroir de citations du chat
 * (`components/chat/chat-client.tsx`) : fond, panneau bas mobile, panneau
 * lateral desktop. Aucun cache : chaque clic regenere (PRD — le resume n'est
 * pas conserve), l'etat `pending` empechant la double requete.
 */

import { useEffect, useRef, useState } from "react";

import { summarizeResourceAction } from "@/app/actions/summary";
import styles from "./summary-sheet.module.css";

interface SummarySheetProps {
  resourceId: string;
  title: string;
  /** false si la ressource n'est pas au statut Pret : le bouton est masque. */
  canSummarize: boolean;
}

const MESSAGES = {
  trigger: "Résumer",
  loading: "Synthèse en cours...",
  partialBadge: "Résumé partiel",
  openDocument: "Ouvrir le document complet",
  close: "Fermer",
  dialogLabel: "Synthèse du document",
} as const;

export default function SummarySheet({
  resourceId,
  title,
  canSummarize,
}: SummarySheetProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [bullets, setBullets] = useState<string[]>([]);
  const [partial, setPartial] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus a l'ouverture : clavier et lecteurs d'ecran orientes (tiroir modal).
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Echap ferme le tiroir (attendu d'un dialogue modal).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!canSummarize) return null;

  async function handleSummarize() {
    setOpen(true);
    setPending(true);
    setBullets([]);
    setPartial(false);
    setDocumentUrl(null);
    setMessage(null);
    try {
      const result = await summarizeResourceAction(resourceId);
      if (result.success) {
        setBullets(result.bullets);
        setPartial(result.partial);
        setDocumentUrl(result.documentUrl);
        setMessage(result.message || null);
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("Problème de connexion. Vérifiez votre réseau et réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => void handleSummarize()}
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {pending ? MESSAGES.loading : MESSAGES.trigger}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label={MESSAGES.close}
            onClick={() => setOpen(false)}
          />
          <aside
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label={`${MESSAGES.dialogLabel} : ${title}`}
          >
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>{title}</h2>
              <button
                ref={closeRef}
                type="button"
                className={styles.closeButton}
                aria-label={MESSAGES.close}
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            {pending ? <p className={styles.status}>{MESSAGES.loading}</p> : null}

            {message ? (
              <p className={partial ? styles.partial : styles.error} role="status">
                {message}
              </p>
            ) : null}

            {bullets.length > 0 ? (
              <ul className={styles.bullets}>
                {bullets.map((bullet, i) => (
                  <li key={i} className={styles.bullet}>
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}

            {documentUrl ? (
              <a
                className={styles.documentLink}
                href={documentUrl}
                target="_blank"
                rel="noreferrer"
              >
                {MESSAGES.openDocument}
              </a>
            ) : null}
          </aside>
        </>
      ) : null}
    </>
  );
}
