/**
 * Vue de consultation d'un document (story 6.1, FR-8/FR-9/FR-11).
 *
 * Module PUR : transforme les lignes `document_chunks` en sections
 * affichables, marque le passage cible, et borne la taille rendue. Testable
 * hors reseau via `npm run test:resource-view`.
 *
 * Le contenu est rendu en texte React par l'appelant : aucun HTML brut.
 */

/** Plafond de rendu : au-dela, troncature AVEC mention visible. */
export const MAX_VIEW_CHARS = 120_000;

export interface DocumentChunkView {
  id: string;
  /** Rang du morceau dans le document (0-based). */
  index: number;
  text: string;
  /** true pour le passage demande via `?chunk=` (si l'ancre est valide). */
  isActive: boolean;
}

export interface DocumentView {
  chunks: DocumentChunkView[];
  /** Nombre de morceaux en base, meme si certains sont tronques/ignores. */
  totalChunks: number;
  /** true si le rendu a ete borne par le plafond de caracteres. */
  truncated: boolean;
  /** Nombre de caracteres effectivement rendus. */
  chars: number;
  /** true si une ancre a ete demandee ET trouvee. */
  hasAnchor: boolean;
}

const EMPTY_VIEW: DocumentView = {
  chunks: [],
  totalChunks: 0,
  truncated: false,
  chars: 0,
  hasAnchor: false,
};

/** Ligne `document_chunks` minimale pour la consultation. */
export interface DocumentChunkRow {
  id: string;
  chunk_index?: number | null;
  content?: string | null;
}

/**
 * Lignes DB -> vue de consultation.
 *
 * - trie par `chunk_index` croissant (ordre de lecture du document) ;
 * - marque `isActive` sur le morceau dont l'id correspond a l'ancre ;
 * - borne le rendu a `maxChars` et signale `truncated` plutot que de
 *   tronquer silencieusement (meme principe que le resume, lib/ai/summary.ts).
 */
export function buildDocumentView(
  rows: unknown,
  options: { targetChunkId?: string | null; maxChars?: number } = {},
): DocumentView {
  if (!Array.isArray(rows) || rows.length === 0) return EMPTY_VIEW;

  const maxChars =
    Number.isFinite(options.maxChars) && (options.maxChars ?? 0) > 0
      ? Math.floor(options.maxChars as number)
      : MAX_VIEW_CHARS;
  const target = typeof options.targetChunkId === "string" ? options.targetChunkId : "";

  const valid: Array<{ id: string; index: number; text: string }> = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as DocumentChunkRow;
    if (typeof r.id !== "string" || !r.id) continue;
    valid.push({
      id: r.id,
      index:
        typeof r.chunk_index === "number" && Number.isFinite(r.chunk_index)
          ? r.chunk_index
          : valid.length,
      text: typeof r.content === "string" ? r.content : "",
    });
  }
  if (valid.length === 0) return EMPTY_VIEW;

  valid.sort((a, b) => a.index - b.index);
  const totalChunks = valid.length;

  const chunks: DocumentChunkView[] = [];
  let budget = maxChars;
  let truncated = false;
  let hasAnchor = false;

  for (const chunk of valid) {
    if (budget <= 0) {
      truncated = true;
      break;
    }
    // Un morceau vide reste affiche (il porte l'ordre de lecture) mais ne
    // consomme pas de budget.
    const text = chunk.text.length > budget ? chunk.text.slice(0, budget) : chunk.text;
    if (text.length < chunk.text.length) truncated = true;
    budget -= text.length;
    const isActive = Boolean(target) && chunk.id === target;
    if (isActive) hasAnchor = true;
    chunks.push({ id: chunk.id, index: chunk.index, text, isActive });
  }

  return {
    chunks,
    totalChunks,
    truncated,
    chars: chunks.reduce((sum, c) => sum + c.text.length, 0),
    hasAnchor,
  };
}

/** Libelle FR de la position d'un morceau (1-based, pour l'affichage). */
export function formatChunkPosition(index: number, total: number): string {
  const n = Number.isFinite(index) ? index + 1 : 1;
  const t = Number.isFinite(total) && total > 0 ? Math.floor(total) : n;
  return `Passage ${n} / ${t}`;
}
