"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { documentTypeLabel, formatShortDate } from "@/lib/dashboard/helpers";
import { formatChunkPosition, type DocumentView } from "@/lib/resources/view";
import { READY_STATUS } from "@/lib/ai/summary";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SummarySheet from "@/components/resources/summary-sheet";
import type { ResourceData } from "@/app/actions/workspace";
import { parseStructuredDocument } from "@/lib/document-parser/parser";
import type { StructuredBlock, StructuredSection } from "@/lib/document-parser/types";
import styles from "./workspace.module.css";

interface DocumentReaderProps {
  document: ResourceData | null;
  documentView: DocumentView | null;
  isLoading: boolean;
  currentUserId: string;
  targetChunkId?: string | null;
  onOpenUpload: () => void;
}

/**
 * Rendu de texte avec détection automatique des URLs cliquables.
 */
function renderRichTextWithLinks(text: string, linkClass: string): ReactNode {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s\)\],;]+)/g;
  const parts = text.split(urlRegex);
  if (parts.length <= 1) return text;

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {part}
        </a>
      );
    }
    return part;
  });
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
  const containerRef = useRef<HTMLElement | null>(null);

  const chunks = documentView?.chunks ?? [];

  // Transformation structurée du contenu extrait
  const structuredDoc = useMemo(() => {
    if (!document || chunks.length === 0) return null;
    return parseStructuredDocument({
      documentTitle: document.title,
      category: document.category,
      chunks,
      targetChunkId,
    });
  }, [document, chunks, targetChunkId]);

  useEffect(() => {
    if (targetChunkId && activePassageRef.current) {
      activePassageRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [targetChunkId, documentView]);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToSection = (sectionId: string) => {
    const el = window.document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // État : Chargement
  if (isLoading) {
    return (
      <div className={styles.readerScrollContainer}>
        <div className={styles.readerContent}>
          <div className={styles.emptyNotice}>Analyse du document en cours…</div>
          <div className={styles.skeletonLine} style={{ width: "40%", marginTop: "16px" }} />
          <div className={styles.skeletonLine} style={{ width: "85%" }} />
          <div className={styles.skeletonLine} style={{ width: "70%" }} />
          <div className={styles.skeletonLine} style={{ width: "90%", marginTop: "24px" }} />
          <div className={styles.skeletonLine} style={{ width: "80%" }} />
        </div>
      </div>
    );
  }

  // État : Aucun document sélectionné
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

  return (
    <article
      ref={containerRef}
      className={styles.readerScrollContainer}
      aria-label={`Lecture de ${document.title}`}
    >
      <div className={styles.readerContent}>
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <span>{document.category}</span>
          <span className={styles.breadcrumbSep}>/</span>
          <span>{document.title}</span>
        </div>

        {/* Titre hiérarchisé : Surtitre, Titre principal & Sous-titre éventuel */}
        {structuredDoc?.surtitle ? (
          <div className={styles.docSurtitle}>{structuredDoc.surtitle}</div>
        ) : null}

        <h1 className={styles.docH1}>
          {structuredDoc?.subtitle || document.title}
        </h1>

        {/* Barre de métadonnées globale */}
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
            <Badge variant={isReady ? "success" : "neutral"}>
              {document.status}
              {document.chunk_count ? ` · ${document.chunk_count} segments` : ""}
            </Badge>
          </div>

          <div className={styles.metaGroup}>
            <SummarySheet
              resourceId={document.id}
              title={document.title}
              canSummarize={isReady}
            />
          </div>
        </div>

        {/* Grille de métadonnées extraites (RÉFÉRENCE, VERSION, MISE À JOUR, etc.) */}
        {structuredDoc && structuredDoc.metadata.length > 0 ? (
          <section className={styles.docMetaGrid} aria-label="Métadonnées du document">
            {structuredDoc.metadata.map((item) => (
              <div key={item.key} className={styles.docMetaCard}>
                <span className={styles.docMetaLabel}>{item.label}</span>
                <span className={styles.docMetaValue}>{item.value}</span>
              </div>
            ))}
          </section>
        ) : null}

        {tags.length > 0 ? (
          <div className={styles.accordionWrap}>
            {tags.map((t) => (
              <span key={t} className={styles.formatTag}>
                #{t}
              </span>
            ))}
          </div>
        ) : null}

        {/* Table des matières automatique si 2+ sections */}
        {structuredDoc && structuredDoc.tableOfContents.length >= 2 ? (
          <section className={styles.tocContainer} aria-label="Table des matières">
            <h2 className={styles.tocTitle}>Sur cette page</h2>
            <ul className={styles.tocList}>
              {structuredDoc.tableOfContents.map((toc) => (
                <li key={toc.id}>
                  <button
                    type="button"
                    className={styles.tocLink}
                    onClick={() => scrollToSection(toc.id)}
                  >
                    <span className={styles.tocBullet}>•</span>
                    <span>{toc.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Contenu principal du document */}
        {!isReady ? (
          <div className={styles.passageCard}>
            <p className={styles.emptyNotice}>
              {document.status === "En cours"
                ? "Ce document est actuellement en cours d'indexation par le pipeline Gemini. Son contenu complet sera lisible dès la fin du traitement."
                : `L'indexation a échoué : ${document.error_message || "Erreur technique"}.`}
            </p>
          </div>
        ) : structuredDoc && structuredDoc.sections.length > 0 ? (
          <div className={styles.passagesContainer}>
            {documentView?.truncated ? (
              <div className={styles.emptyNotice}>
                Document volumineux : seuls les premiers passages sont affichés ici.
              </div>
            ) : null}

            {structuredDoc.sections.map((section: StructuredSection) => {
              const isSectionTarget = section.chunkId === targetChunkId || section.isActive;

              return (
                <section
                  key={section.id}
                  id={section.id}
                  className={styles.docSection}
                  aria-label={section.title}
                >
                  {section.title && section.title !== "Introduction" ? (
                    <header className={styles.docSectionHeader}>
                      {section.number ? (
                        <span className={styles.docSectionNumber}>{section.number}</span>
                      ) : null}
                      <h2 className={styles.docH2}>{section.title}</h2>
                    </header>
                  ) : null}

                  {section.blocks.map((block: StructuredBlock) => {
                    const isTarget = Boolean(
                      block.chunkId === targetChunkId ||
                      block.isActive ||
                      (isSectionTarget && !targetChunkId),
                    );

                    return renderStructuredBlock(
                      block,
                      isTarget,
                      activePassageRef,
                      chunks.length,
                    );
                  })}
                </section>
              );
            })}

            {/* Pied de page du document */}
            <footer className={styles.docFooter}>
              <button
                type="button"
                className={styles.backToTopAction}
                onClick={scrollToTop}
              >
                <Icon name="arrow" className={styles.iconRotate270} />
                <span>Haut de page</span>
              </button>
            </footer>
          </div>
        ) : (
          <div className={styles.passageCard}>
            <p className={styles.emptyNotice}>
              Ce document ne contient aucun contenu exploitable.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Rendu d'un bloc individuel (QA, Paragraphe, Table, Liste).
 */
function renderStructuredBlock(
  block: StructuredBlock,
  isTarget: boolean,
  activeRef: React.MutableRefObject<HTMLElement | null>,
  totalChunks: number,
) {
  const anchorId = block.chunkId ? `chunk-${block.chunkId}` : undefined;
  const chunkIndex = block.chunkId ? 0 : 0;

  switch (block.type) {
    case "qa":
      return (
        <article
          key={block.id}
          id={anchorId}
          ref={isTarget ? (el) => { activeRef.current = el; } : undefined}
          className={isTarget ? styles.qaItemActive : styles.qaItem}
          aria-label={formatChunkPosition(chunkIndex, totalChunks)}
        >
          <div className={styles.qaQuestionWrap}>
            <h3 className={styles.qaQuestion}>
              {renderRichTextWithLinks(block.question, styles.docLink)}
            </h3>
            {isTarget ? (
              <span className={styles.passageTargetBadge}>Passage cité</span>
            ) : null}
          </div>
          <div className={styles.qaAnswer}>
            {renderRichTextWithLinks(block.answer, styles.docLink)}
          </div>
        </article>
      );

    case "table":
      return (
        <div
          key={block.id}
          id={anchorId}
          ref={isTarget ? (el) => { activeRef.current = el; } : undefined}
          className={styles.docTableWrap}
        >
          <table className={styles.docTable}>
            {block.headers.length > 0 ? (
              <thead>
                <tr>
                  {block.headers.map((h, i) => (
                    <th key={i} className={styles.docTh}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className={styles.docTd}>
                      {renderRichTextWithLinks(cell, styles.docLink)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "list":
      return block.ordered ? (
        <ol key={block.id} id={anchorId} className={styles.docList}>
          {block.items.map((item, idx) => (
            <li key={idx} className={styles.docListItem}>
              {renderRichTextWithLinks(item, styles.docLink)}
            </li>
          ))}
        </ol>
      ) : (
        <ul key={block.id} id={anchorId} className={styles.docList}>
          {block.items.map((item, idx) => (
            <li key={idx} className={styles.docListItem}>
              {renderRichTextWithLinks(item, styles.docLink)}
            </li>
          ))}
        </ul>
      );

    case "paragraph":
      return (
        <p
          key={block.id}
          id={anchorId}
          ref={isTarget ? (el) => { activeRef.current = el; } : undefined}
          className={isTarget ? styles.passageCardActive : styles.docParagraph}
        >
          {isTarget ? (
            <span style={{ display: "block", marginBottom: "8px" }}>
              <span className={styles.passageTargetBadge}>Passage cité</span>
            </span>
          ) : null}
          {renderRichTextWithLinks(block.text, styles.docLink)}
        </p>
      );

    case "divider":
      return <hr key={block.id} className={styles.docDivider} />;

    default:
      return null;
  }
}

function metaGroupClass(stylesObj: Record<string, string>): string {
  return stylesObj.metaGroup || "";
}
