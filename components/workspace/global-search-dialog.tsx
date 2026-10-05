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
  /** Appelé après chaque recherche réussie pour mettre à jour l'historique en temps réel. */
  onSearchPerformed?: (query: string, resultCount: number) => void;
}

/**
 * Détermine si la saisie constitue un mot complet ou une requête finalisée :
 * - Si elle se termine par un espace et compte au moins 2 caractères (ex: "rh ", "ia ", "contrat ")
 * - Si elle contient plusieurs mots (ex: "plan d'action")
 * - Si c'est un mot d'au moins 3 caractères (ex: "faq", "projet", "finance")
 *
 * Évite de déclencher des recherches prématurées et coûteuses sur des lettres isolées ("a", "pr").
 */
function isCompleteQuery(rawText: string): boolean {
  const trimmed = rawText.trim();
  if (!trimmed) return false;

  // Un espace final indique que l'utilisateur a fini d'écrire son mot
  if (rawText.endsWith(" ") && trimmed.length >= 2) {
    return true;
  }

  // Expression multi-mots
  if (trimmed.includes(" ") && trimmed.length >= 3) {
    return true;
  }

  // Mot isolé : au minimum 3 caractères pour être considéré comme un mot complet
  return trimmed.length >= 3;
}

export default function GlobalSearchDialog({
  isOpen,
  onClose,
  onSelectResult,
  recentSearches,
  onDeleteSearch,
  onSearchPerformed,
}: GlobalSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchedQueryRef = useRef<string>("");

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setErrorMessage(null);
      lastSearchedQueryRef.current = "";
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const performSearch = async (textToSearch: string) => {
    const trimmed = textToSearch.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setErrorMessage(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    lastSearchedQueryRef.current = trimmed;
    setLoading(true);
    setErrorMessage(null);

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
        const hits = data.results ?? [];
        setResults(hits);
        setSelectedIndex(0);
        // Mise à jour optimiste de l'historique : visible immédiatement dans
        // le volet droit sans attendre un rechargement de page.
        onSearchPerformed?.(trimmed, hits.length);
      }
    } catch {
      setErrorMessage("Erreur réseau lors de la recherche.");
    } finally {
      setLoading(false);
    }
  };

  // Handle live search with debouncing (uniquement lorsqu'un mot complet est saisi)
  useEffect(() => {
    if (!isOpen) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setErrorMessage(null);
      lastSearchedQueryRef.current = "";
      return;
    }

    // Si la saisie n'est pas encore un mot complet (ex: 1 lettre "p" ou 2 lettres sans espace) :
    // On ne lance aucune recherche automatique et on vide les anciens résultats.
    if (!isCompleteQuery(query)) {
      setResults([]);
      setLoading(false);
      setErrorMessage(null);
      return;
    }

    // Temporisation de 400ms pour laisser à l'utilisateur le temps de terminer son mot
    debounceRef.current = setTimeout(() => {
      void performSearch(trimmed);
    }, 400);

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

    const trimmed = query.trim();

    if (results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        return;
      } else if (e.key === "Enter") {
        // Si les résultats correspondent à la requête actuelle, on ouvre la sélection
        if (lastSearchedQueryRef.current.toLowerCase() === trimmed.toLowerCase()) {
          e.preventDefault();
          const selected = results[selectedIndex];
          if (selected) {
            onSelectResult(selected.resourceId, selected.chunkId, selected.category);
            onClose();
            return;
          }
        }
      }
    }

    // Si l'utilisateur appuie sur Entrée (validation immédiate sans attendre le debounce)
    if (e.key === "Enter" && trimmed.length >= 2) {
      e.preventDefault();
      void performSearch(trimmed);
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
            !isCompleteQuery(query) ? (
              <div className={styles.emptyNotice}>
                Tapez un mot complet (au moins 3 lettres) ou appuyez sur Entrée pour rechercher.
              </div>
            ) : (
              <div className={styles.emptyNotice}>Aucun document ne correspond à cette recherche.</div>
            )
          ) : recentSearches.length > 0 ? (
            <div>
              <div className={styles.sectionHeader}>Recherches récentes</div>
              {recentSearches.slice(0, 5).map((s) => (
                <div key={s.id} className={styles.historyItemRow}>
                  <button
                    type="button"
                    className={styles.commandRow}
                    onClick={() => {
                      setQuery(s.query);
                      void performSearch(s.query);
                    }}
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
