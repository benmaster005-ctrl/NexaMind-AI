"use client";

import { useEffect, useState, useRef, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";
import type { SearchResult } from "@/lib/ai/search";
import type { SearchHistoryItem } from "@/lib/search/history";
import styles from "./workspace.module.css";

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (resourceId: string, chunkId: string | null, category: string) => void;
  recentSearches: SearchHistoryItem[];
  onDeleteSearch?: (id: string) => void;
}

export default function GlobalSearchDialog({
  isOpen,
  onClose,
  onSelectResult,
  recentSearches,
  onDeleteSearch,
}: GlobalSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setErrorMessage(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle live search with debouncing
  useEffect(() => {
    if (!isOpen) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setErrorMessage(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          setErrorMessage("La recherche n'a pas pu être effectuée.");
          setResults([]);
          return;
        }
        const data = (await res.json()) as { results?: SearchResult[]; error?: string };
        if (data.error) {
          setErrorMessage(data.error);
          setResults([]);
        } else {
          setResults(data.results ?? []);
          setSelectedIndex(0);
        }
      } catch {
        setErrorMessage("Erreur réseau lors de la recherche.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          onSelectResult(selected.resourceId, selected.chunkId, selected.category);
          onClose();
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.dialogBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className={styles.commandPalette}
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale NexaMind AI"
      >
        <div className={styles.commandHeader}>
          <button
            type="button"
            className={`${styles.mobileBackAction} ${styles.mobileOnly}`}
            onClick={onClose}
            aria-label="Fermer la recherche"
          >
            <Icon name="arrow" className={styles.iconRotate180} />
          </button>
          <Icon name="search" />
          <input
            ref={inputRef}
            type="search"
            className={styles.commandInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher dans tous les documents…"
            maxLength={500}
            autoComplete="off"
          />
          <button
            type="button"
            className={styles.iconControl}
            onClick={onClose}
            aria-label="Fermer"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className={styles.commandResults}>
          {loading ? (
            <div className={styles.emptyNotice}>Recherche sémantique en cours…</div>
          ) : errorMessage ? (
            <div className={`${styles.emptyNotice} ${styles.textDanger}`}>{errorMessage}</div>
          ) : results.length > 0 ? (
            results.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.resourceId + (item.chunkId || "") + index}
                  type="button"
                  className={`${styles.commandRow} ${isSelected ? styles.commandRowSelected : ""}`}
                  onClick={() => {
                    onSelectResult(item.resourceId, item.chunkId, item.category);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className={styles.commandRowTitle}>
                    <span>{item.title}</span>
                    <span className={styles.formatTag}>{item.category}</span>
                  </div>
                  {item.excerpt ? (
                    <div className={styles.commandRowExcerpt}>{item.excerpt}</div>
                  ) : null}
                </button>
              );
            })
          ) : query.trim() ? (
            <div className={styles.emptyNotice}>Aucun document ne correspond à cette recherche.</div>
          ) : recentSearches.length > 0 ? (
            <div>
              <div className={styles.sectionHeader}>Recherches récentes</div>
              {recentSearches.slice(0, 5).map((s) => (
                <div key={s.id} className={styles.historyItemRow}>
                  <button
                    type="button"
                    className={styles.commandRow}
                    onClick={() => setQuery(s.query)}
                  >
                    <div className={styles.commandRowTitle}>
                      <span>{s.query}</span>
                      <span className={styles.formatTag}>{s.resultCount} résultat{s.resultCount > 1 ? "s" : ""}</span>
                    </div>
                  </button>
                  {onDeleteSearch ? (
                    <button
                      type="button"
                      className={styles.historyItemDeleteAction}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSearch(s.id);
                      }}
                      aria-label={`Supprimer ${s.query} de l'historique`}
                      title="Supprimer cette recherche"
                    >
                      <Icon name="trash" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyNotice}>
              Saisissez des mots-clés ou une question pour rechercher dans le fonds documentaire.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
