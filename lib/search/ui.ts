/**
 * Helpers purs de l'interface de recherche (story 3.3, FR-8).
 *
 * Module sans dependance (ni Next, ni Supabase) pour rester testable
 * sans reseau via `npm run test:search-ui`.
 */

export interface HighlightPart {
  text: string;
  hit: boolean;
}

/** Categories FR-5 : ["Tous", ...RESOURCE_CATEGORIES] construite cote client. */
export const ALL_CATEGORY_LABEL = "Tous";

export const SEARCH_UI_MESSAGES = {
  emptyQuery: "Décrivez votre besoin pour lancer une recherche.",
  noResults:
    "Aucun document ne correspond. Essayez de reformuler avec d'autres mots.",
  networkError:
    "Recherche indisponible. Vérifiez votre connexion puis réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous pour rechercher.",
  tooLong: "Requête trop longue : 500 caractères maximum.",
} as const;

/**
 * Decoupe un extrait en segments {text, hit} autour des occurrences
 * de la requete (insensible a la casse, sans regex). L'affichage React
 * des segments en texte (jamais de HTML brut) neutralise le XSS.
 */
export function highlightParts(excerpt: string, query: string): HighlightPart[] {
  const source = excerpt ?? "";
  const needle = (query ?? "").trim().toLowerCase();
  if (!needle) return [{ text: source, hit: false }];
  const lowered = source.toLowerCase();
  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (;;) {
    const found = lowered.indexOf(needle, cursor);
    if (found < 0) break;
    if (found > cursor) {
      parts.push({ text: source.slice(cursor, found), hit: false });
    }
    parts.push({ text: source.slice(found, found + needle.length), hit: true });
    cursor = found + needle.length;
  }
  if (cursor < source.length) {
    parts.push({ text: source.slice(cursor), hit: false });
  }
  if (parts.length === 0) return [{ text: source, hit: false }];
  return parts;
}

/** Construit l'URL d'appel a la route (pure, testee). */
export function buildSearchUrl(
  query: string,
  category?: string,
  limit = 10,
): string {
  const params = new URLSearchParams();
  params.set("q", query.trim());
  if (category && category !== ALL_CATEGORY_LABEL) {
    params.set("category", category);
  }
  params.set("limit", String(limit));
  return `/api/search?${params.toString()}`;
}

/** Tronque un extrait a N caracteres sans couper un mot. */
export function truncateExcerpt(excerpt: string, maxLength = 220): string {
  const source = (excerpt ?? "").trim();
  if (source.length <= maxLength) return source;
  const cut = source.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.5) return `${cut.slice(0, lastSpace)}…`;
  return `${cut}…`;
}
