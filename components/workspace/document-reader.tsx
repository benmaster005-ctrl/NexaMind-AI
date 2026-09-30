"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { documentTypeLabel, formatShortDate } from "@/lib/dashboard/helpers";
import { formatChunkPosition, type DocumentView } from "@/lib/resources/view";
import { READY_STATUS } from "@/lib/ai/summary";
import { buttonClass } from "@/components/ui/button";
import SummarySheet from "@/components/resources/summary-sheet";
import type { ResourceData } from "@/app/actions/workspace";
import styles from "./workspace.module.css";

interface DocumentReaderProps {
  document: ResourceData | null;
  documentView: DocumentView | null;
  isLoading: boolean;
  currentUserId: string;
  targetChunkId?: string | null;
  onOpenUpload: () => void;
}

export default function DocumentReader({
  document,
  documentView,
  isLoading,
  currentUserId,
  targetChunkId,
  onOpenUpload,
}: DocumentReaderProps) {
  const activePassageRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (targetChunkId && activePassageRef.current) {
      activePassageRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [targetChunkId, documentView]);

  if (isLoading) {
    return (
      <div className={styles.readerScrollContainer}>
        <div className={styles.readerContent}>
          <div className={styles.emptyNotice}>Chargement du document…</div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className={styles.readerScrollContainer}>
        <div className={styles.emptyStateContainer}>
          <Icon name="documents" className={styles.emptyStateIcon} />
          <h2 className={styles.emptyStateTitle}>Sélectionnez un document</h2>
          <p className={styles.emptyStateText}>
            Choisissez un document dans la bibliothèque pour commencer la lecture, ou déposez une nouvelle ressource pour enrichir la base de connaissances.
          </p>
          <div className={styles.accordionWrap}>
            <button
              type="button"
              className={styles.addResourceAction}
              onClick={onOpenUpload}
            >
              <Icon name="plus" />
              <span>Ajouter une ressource</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const format = documentTypeLabel(document.storage_path) || "DOC";
  const dateFormatted = formatShortDate(document.created_at);
  const isOwner = document.created_by && document.created_by === currentUserId;
  const ownerLabel = isOwner ? "Personnel" : "Entreprise";
  const isReady = document.status === READY_STATUS;
  const tags = Array.isArray(document.tags) ? document.tags : [];
  const chunks = documentView?.chunks ?? [];

  return (
    <article className={styles.readerScrollContainer} aria-label={`Lecture de ${document.title}`}>
      <div className={styles.readerContent}>
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <span>{document.category}</span>
          <span className={styles.breadcrumbSep}>/</span>
          <span>{document.title}</span>
        </div>

        {/* Title */}
        <h1 className={styles.docH1}>{document.title}</h1>

        {/* Metadata bar */}
        <div className={styles.docMetaBar}>
          <div className={metaGroupClass(styles)}>
            <span className={styles.formatTag}>{format}</span>
            <span className={styles.metaDot}>·</span>
            <span className={styles.metaItem}>{ownerLabel}</span>
            {dateFormatted ? (
              <>
                <span className={styles.metaDot}>·</span>
                <span className={styles.metaItem}>Ajouté le {dateFormatted}</span>
              </>
            ) : null}
            <span className={styles.metaDot}>·</span>
            <span className={styles.metaItem}>
              {document.status}
              {document.chunk_count ? ` (${document.chunk_count} morceaux)` : ""}
            </span>
          </div>

          <div className={styles.metaGroup}>
            <SummarySheet
              resourceId={document.id}
              title={document.title}
              canSummarize={isReady}
            />
          </div>
        </div>

        {tags.length > 0 ? (
          <div className={styles.accordionWrap}>
            {tags.map((t) => (
              <span key={t} className={styles.formatTag}>
                #{t}
              </span>
            ))}
          </div>
        ) : null}

        {/* Document Content */}
        {!isReady ? (
          <div className={styles.passageCard}>
            <p className={styles.emptyNotice}>
              {document.status === "En cours"
                ? "Ce document est actuellement en cours d'indexation par le pipeline Gemini. Son contenu complet sera lisible dès la fin du traitement."
                : `L'indexation a échoué : ${document.error_message || "Erreur technique"}.`}
            </p>
          </div>
        ) : chunks.length > 0 ? (
          <div className={styles.passagesContainer}>
            {documentView?.truncated ? (
              <div className={styles.emptyNotice}>
                Document volumineux : seuls les premiers passages sont affichés ici.
              </div>
            ) : null}

            {chunks.map((chunk) => {
              const isTarget = chunk.id === targetChunkId || chunk.isActive;
              return (
                <section
                  key={chunk.id}
                  id={`chunk-${chunk.id}`}
                  ref={isTarget ? (el) => { activePassageRef.current = el; } : undefined}
                  className={isTarget ? styles.passageCardActive : styles.passageCard}
                  aria-label={formatChunkPosition(chunk.index, chunks.length)}
                >
                  <header className={styles.passageHeader}>
                    <span>{formatChunkPosition(chunk.index, chunks.length)}</span>
                    {isTarget ? (
                      <span className={styles.passageTargetBadge}>Passage cité</span>
                    ) : null}
                  </header>
                  <p className={styles.passageBody}>{chunk.text}</p>
                </section>
              );
            })}
          </div>
        ) : (
          <div className={styles.passageCard}>
            <p className={styles.emptyNotice}>
              Contenu non disponible : aucun texte extrait n&apos;a été trouvé pour ce document.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function metaGroupClass(stylesObj: Record<string, string>): string {
  return stylesObj.metaGroup || "";
}
