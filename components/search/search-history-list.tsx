"use client";

/**
 * Liste des recherches recentes (story 5.3, FR-16) pour les ecrans serveur.
 *
 * Le rejeu passe par `/search?q=...` : la recherche est donc reexecutee sur
 * l'etat ACTUEL de la base (le resultat n'est jamais fige). La suppression
 * appelle l'action serveur, filtree par la RLS.
 *
 * Utilisee par `/history` ; `/search` garde sa propre version (qui ajoute
 * l'entree de facon optimiste).
 */
import { useState } from "react";
import Link from "next/link";

import { deleteSearchHistoryAction } from "@/app/actions/search";
import {
  SEARCH_HISTORY_MESSAGES,
  formatResultCount,
  removeSearchItem,
  type SearchHistoryItem,
} from "@/lib/search/history";
import { formatRelativeDate } from "@/lib/dashboard/helpers";
import styles from "./search-history-list.module.css";

interface SearchHistoryListProps {
  items: SearchHistoryItem[];
  /** Message affiche quand la liste est vide. */
  emptyLabel?: string;
}

export default function SearchHistoryList({
  items,
  emptyLabel = SEARCH_HISTORY_MESSAGES.empty,
}: SearchHistoryListProps) {
  const [entries, setEntries] = useState<SearchHistoryItem[]>(items);
  const [error, setError] = useState<string | null>(null);

  if (entries.length === 0) {
    return <p className={styles.empty}>{emptyLabel}</p>;
  }

  return (
    <>
      <ul className={styles.list}>
        {entries.map((item) => (
          <li key={item.id} className={styles.item}>
            <Link className={styles.link} href={`/search?q=${encodeURIComponent(item.query)}`}>
              <span className={styles.query}>{item.query}</span>
              <span className={styles.meta}>
                <span>{formatRelativeDate(item.createdAt)}</span>
                <span className={styles.count}>{formatResultCount(item.resultCount)}</span>
              </span>
            </Link>
            <button
              type="button"
              className={styles.deleteButton}
              aria-label={`${SEARCH_HISTORY_MESSAGES.delete} : ${item.query}`}
              onClick={async () => {
                const result = await deleteSearchHistoryAction(item.id);
                if (result.success) {
                  setEntries((current) => removeSearchItem(current, item.id));
                  setError(null);
                } else {
                  // La RLS a refuse (donc rien n'a ete supprime) : on le dit
                  // plutot que de faire disparaitre une entree encore la.
                  setError(result.message);
                }
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
