/** Search client part 1/3 : imports, types et constantes. */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { deleteSearchHistoryAction } from "@/app/actions/search";
import {
  SEARCH_HISTORY_MESSAGES,
  formatResultCount,
  prependSearchItem,
  removeSearchItem,
  type SearchHistoryItem,
} from "@/lib/search/history";
import { RESOURCE_CATEGORIES } from "@/lib/resources/validation";
import {
  ALL_CATEGORY_LABEL,
  SEARCH_UI_MESSAGES,
  buildSearchUrl,
  highlightParts,
  truncateExcerpt,
} from "@/lib/search/ui";
import { Card } from "@/components/ui/card";
import styles from "./search.module.css";

export interface ApiSearchResult {
  resourceId: string;
  chunkId: string | null;
  title: string;
  category: string;
  createdAt: string;
  excerpt: string;
  similarity: number | null;
  matchKind: "semantic" | "text";
}

interface SearchClientProps {
  initialCategory?: string;
  /** Requete de rejeu (?q= depuis /history, story 5.3). */
  initialQuery?: string;
  /** Historique personnel lu en base (RLS), story 5.3. */
  initialHistory?: SearchHistoryItem[];
}

const FILTERS: string[] = [ALL_CATEGORY_LABEL, ...RESOURCE_CATEGORIES];
const DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 10;

type Status = "idle" | "loading" | "ready" | "error";
/** Search client part 2/4 : etat, debounce et fetch. */
export default function SearchClient({
  initialCategory = "Tous",
  initialQuery = "",
  initialHistory = [],
}: SearchClientProps) {
  const normalizedInitial = FILTERS.includes(initialCategory) ? initialCategory : ALL_CATEGORY_LABEL;
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string>(normalizedInitial);
  const [results, setResults] = useState<ApiSearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [history, setHistory] = useState<SearchHistoryItem[]>(initialHistory);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = query.trim();
  const isEmptyQuery = trimmedQuery === "";

  function resetForQueryValue(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      abortRef.current?.abort();
      setResults([]);
      setStatus("idle");
      setErrorMessage(null);
      return;
    }
    if (trimmed.length > 500) {
      abortRef.current?.abort();
      setResults([]);
      setStatus("error");
      setErrorMessage(SEARCH_UI_MESSAGES.tooLong);
      return;
    }
    setStatus("loading");
    setErrorMessage(null);
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length > 500) return;
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const url = buildSearchUrl(trimmed, category, SEARCH_LIMIT);
      fetch(url, { signal: controller.signal })
        .then(async (res) => {
          if (res.status === 401) throw new Error(SEARCH_UI_MESSAGES.unauthorized);
          if (!res.ok) throw new Error(SEARCH_UI_MESSAGES.networkError);
          const data = (await res.json()) as { results?: ApiSearchResult[] };
          const rows = Array.isArray(data.results) ? data.results : [];
          setResults(rows);
          setStatus("ready");
          // 5.3 : ajout optimiste cote client — le serveur a deja enregistre
          // la recherche (route /api/search). L'entree locale est remplacee
          // au prochain rendu serveur de la page.
          setHistory((current) =>
            prependSearchItem(current, {
              query: trimmed,
              resultCount: rows.length,
            }),
          );
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setResults([]);
          setStatus("error");
          setErrorMessage(err instanceof Error ? err.message : SEARCH_UI_MESSAGES.networkError);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query, category, retryKey]);

  const showHelp = isEmptyQuery && status === "idle";

  return (
    <Card aria-label="Recherche documentaire">
      <form
        role="search"
        className={styles.form}
        onSubmit={(e) => e.preventDefault()}
      >
        <label className={styles.visuallyHidden} htmlFor="search-input">
          Rechercher un document
        </label>
        <input
          ref={inputRef}
          id="search-input"
          name="q"
          type="search"
          autoComplete="off"
          className={styles.input}
          placeholder="Ex. procedure conges payes"
          value={query}
          maxLength={600}
          onChange={(e) => {
            setQuery(e.target.value);
            resetForQueryValue(e.target.value);
          }}
        />
      </form>

      {history.length > 0 ? (
        <div className={styles.recent} aria-label="Recherches recentes">
          <p className={styles.recentTitle}>Recherches recentes</p>
          <ul className={styles.recentList}>
            {history.map((item) => (
              <li key={item.id} className={styles.recentItem}>
                <button
                  type="button"
                  className={styles.recentReplay}
                  title={SEARCH_HISTORY_MESSAGES.replay}
                  onClick={() => {
                    // Rejeu : la requete repart dans la barre, l'effet existant
                    // (debounce + fetch) la relance sur l'etat actuel de la base.
                    setQuery(item.query);
                    resetForQueryValue(item.query);
                    inputRef.current?.focus();
                  }}
                >
                  <span className={styles.recentQuery}>{item.query}</span>
                  <span className={styles.recentMeta}>
                    {formatResultCount(item.resultCount)}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.recentDelete}
                  aria-label={`${SEARCH_HISTORY_MESSAGES.delete} : ${item.query}`}
                  onClick={async () => {
                    const result = await deleteSearchHistoryAction(item.id);
                    // L'entree disparait dans tous les cas cote affichage : si
                    // la RLS a refuse, rien n'a ete supprime chez nous et la
                    // page se rechargera a la navigation.
                    if (result.success || item.id.startsWith("pending-")) {
                      setHistory((current) => removeSearchItem(current, item.id));
                    }
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.filters} role="group" aria-label="Filtrer par categorie">
        {FILTERS.map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={category === label}
            className={category === label ? styles.filterActive : styles.filter}
            onClick={() => setCategory(label)}
          >
            {label}
          </button>
        ))}
      </div>

      {showHelp ? <p className={styles.help}>{SEARCH_UI_MESSAGES.emptyQuery}</p> : null}
      {status === "loading" ? (
        <p className={styles.help} role="status">
          Recherche en cours...
        </p>
      ) : null}
      {status === "error" && errorMessage ? (
        <div className={styles.errorBox} role="alert">
          <p className={styles.errorText}>{errorMessage}</p>
          <button
            type="button"
            className={styles.retry}
            onClick={() => {
              inputRef.current?.focus();
              setRetryKey((k) => k + 1);
            }}
          >
            Reessayer
          </button>
        </div>
      ) : null}
      {status === "ready" ? (
        results.length === 0 ? (
          <div className={styles.emptyBox}>
            <p className={styles.help}>{SEARCH_UI_MESSAGES.noResults}</p>
            <Link className={styles.assistantLink} href="/chat">
              Poser la question a l assistant
            </Link>
          </div>
        ) : (
          <ul className={styles.results} aria-label="Resultats">
            {results.map((r) => (
              <li key={`${r.resourceId}-${r.chunkId ?? "doc"}`}>
                <Link
                  className={styles.card}
                  // 6.1 : le resultat mene a la ressource AU PASSAGE ayant
                  // declenche la correspondance (FR-8/FR-9). Un match texte
                  // n'a pas de morceau : on retombe sur la fiche simple.
                  href={`/resources/${r.resourceId}${r.chunkId ? `?chunk=${r.chunkId}` : ""}`}
                >
                  <span className={styles.title}>{r.title}</span>
                  <span className={styles.meta}>
                    {r.category}
                    {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    {r.matchKind === "text" ? " · texte" : ""}
                  </span>
                  <span className={styles.excerpt}>
                    {highlightParts(truncateExcerpt(r.excerpt), query.trim()).map((part, i) =>
                      part.hit ? (
                        <mark key={i} className={styles.mark}>
                          {part.text}
                        </mark>
                      ) : (
                        <span key={i}>{part.text}</span>
                      ),
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Card>
  );
}
