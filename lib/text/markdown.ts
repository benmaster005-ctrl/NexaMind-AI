/**
 * Parseur « markdown-lite » : rendu fidele des reponses de l'assistant
 * (gras, italique, code inline, listes, titres) sans dependance externe.
 *
 * Pourquoi un parseur maison : les reponses arrivent en flux NDJSON,
 * caractere par caractere. Un repondeur markdown complet (react-markdown,
 * marked) est lourd, et surtout il ferait disparaitre les puces de citation
 * `[n]`, qui sont des elements cliquables de notre interface (FR-11). Ce
 * module est donc :
 * - PUR (aucun import) : testable sans reseau via `npm run test:markdown` ;
 * - sur en cours de frappe : une emphase jamais fermee rend du texte simple,
 *   jamais des asterisques bruts, et aucun caractere n'est jamais perdu ;
 * - integrant : le texte est toujours rendu, seule l'emphase peut manquer.
 *
 * Volonte, pas un bug : ni HTML, ni lien, ni image, ni tableau. Le modele est
 * invite a rester sur le vocabulaire reconnu ici (voir `buildSystemPrompt`).
 */

/** Segments d'une ligne : texte, emphase, ou puce de citation cliquable. */
export interface InlineToken {
  text: string;
  /** `**gras**` / `__gras__`. */
  strong: boolean;
  /** `*italique*` / `_italique_`. */
  emphasis: boolean;
  /** null = texte simple ; sinon index 0-based de la citation `[n]`. */
  citationIndex: number | null;
}

export type BlockKind = "paragraph" | "heading" | "bullets" | "numbers";

/** Bloc de reponse : un paragraphe, un titre, ou une liste. */
export interface AnswerBlock {
  kind: BlockKind;
  /** Un element par paragraphe ou par ligne de liste. */
  items: InlineToken[][];
}

/** Garde-fou : une emphase ne s'imbrique pas au-dela de 4 niveaux. */
export const MAX_INLINE_DEPTH = 4;

/** Puce de citation : un a deux chiffres, jamais hors borne. */
const CITATION_RE = /^\[(\d{1,2})\]/;
/** Italique : contenu non vide, sans blanc aux bords, meme marqueur ferme. */
const EMPHASIS_RE = /^([*_])(?=\S)([^*_\n]+?)(?<=\S)\1/;
const HEADING_RE = /^#{1,6}\s+(.+)$/;
const BULLET_RE = /^\s*[-*+\u2022\u2013\u2014]\s+(.*)$/;
const NUMBER_RE = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const FENCE_RE = /^\s*(?:```|~~~)/;
/** Marqueurs de tete de ligne, retires par `stripMarkdownInline`. */
const HEADING_MARKER_RE = /^#{1,6}\s+/;
const LIST_MARKER_RE = /^(?:[-*+\u2022\u2013\u2014]|\d{1,3}[.)])\s+/;
/** Separateur horizontal (`---`, `***`, `___`) : ignore, pas de ligne vide. */
const RULE_RE = /^\s*([-*_])\s*(?:\1\s*){2,}$/;

/**
 * Decoupe une ligne en tokens inline.
 *
 * `citationCount` borne les puces : `[7]` avec 2 citations reste du texte
 * (pas de puce fantome, pas de clic dans le vide). Un marqueur d'emphase
 * sans fermant est retire, pas affiche : c'est ce qui rend le parseur
 * utilisable pendant le streaming.
 */
export function tokenizeInline(text: string, citationCount = 0): InlineToken[] {
  const source = text ?? "";
  const max = Math.max(0, Math.floor(citationCount));
  const out: InlineToken[] = [];

  const push = (token: InlineToken): void => {
    const last = out[out.length - 1];
    if (
      last &&
      last.citationIndex === null &&
      token.citationIndex === null &&
      last.strong === token.strong &&
      last.emphasis === token.emphasis
    ) {
      last.text += token.text;
      return;
    }
    out.push({ ...token });
  };

  const walk = (src: string, strong: boolean, emphasis: boolean, depth: number): void => {
    let plain = "";
    const flush = (): void => {
      if (!plain) return;
      push({ text: plain, strong, emphasis, citationIndex: null });
      plain = "";
    };

    let i = 0;
    while (i < src.length) {
      const char = src[i];
      const rest = src.slice(i);

      // Puce de citation : la regle la plus specifique du projet passe avant
      // l'emphase, pour qu'un `[1]` a l'interieur d'un gras reste cliquable.
      if (char === "[") {
        const marker = CITATION_RE.exec(rest);
        const n = marker ? Number(marker[1]) : 0;
        if (marker && n >= 1 && n <= max) {
          flush();
          push({ text: marker[1], strong: false, emphasis: false, citationIndex: n - 1 });
          i += marker[0].length;
          continue;
        }
        plain += char;
        i += 1;
        continue;
      }

      // Gras `**…**` / `__…__`.
      if (depth < MAX_INLINE_DEPTH && (rest.startsWith("**") || rest.startsWith("__"))) {
        const marker = rest.slice(0, 2);
        const close = src.indexOf(marker, i + 2);
        flush();
        if (close < 0) {
          // Emphase encore ouverte (flux en cours) : on avale le marqueur.
          i += 2;
          continue;
        }
        walk(src.slice(i + 2, close), true, emphasis, depth + 1);
        i = close + 2;
        continue;
      }

      // Code inline : les backticks disparaissent, le contenu reste.
      if (char === "`" && depth < MAX_INLINE_DEPTH) {
        const close = src.indexOf("`", i + 1);
        flush();
        if (close < 0) {
          i += 1;
          continue;
        }
        walk(src.slice(i + 1, close), strong, emphasis, depth + 1);
        i = close + 1;
        continue;
      }

      // Italique. Le `_` ne s'ouvre qu'en debut de mot : sinon un identifiant
      // technique (`match_chunks`, un uuid) se transformerait en emphase.
      if (char === "*" || (char === "_" && (i === 0 || /[\s(\[]/.test(src[i - 1])))) {
        const marker = EMPHASIS_RE.exec(rest);
        if (marker && depth < MAX_INLINE_DEPTH) {
          flush();
          walk(marker[2], strong, true, depth + 1);
          i += marker[0].length;
          continue;
        }
      }

      plain += char;
      i += 1;
    }
    flush();
  };

  walk(source, false, false, 0);
  return out;
}

/**
 * Reponse complete -> blocs a rendre.
 *
 * Reanalyse a chaque morceau du flux : le texte reste court (quelques
 * centaines de caracteres) et l'operation est triviale comparee a un
 * re-render React.
 */
export function parseAnswerBlocks(text: string, citationCount = 0): AnswerBlock[] {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  /** Phase 1 en chaines, phase 2 en tokens : les paragraphes peuvent s'etendre. */
  const raw: Array<{ kind: BlockKind; items: string[] }> = [];
  let current: { kind: BlockKind; items: string[] } | null = null;
  let inFence = false;

  const openBlock = (kind: BlockKind): { kind: BlockKind; items: string[] } => {
    if (current && current.kind === kind) return current;
    const block: { kind: BlockKind; items: string[] } = { kind, items: [] };
    raw.push(block);
    current = block;
    return block;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      current = null;
      continue;
    }
    if (!inFence && RULE_RE.test(line)) {
      current = null;
      continue;
    }
    const body = inFence ? line : line.trim();

    // Ligne vide = fin de bloc : deux retours a la ligne = deux paragraphes.
    if (!body) {
      current = null;
      continue;
    }

    if (!inFence) {
      const heading = HEADING_RE.exec(body);
      if (heading) {
        raw.push({ kind: "heading", items: [heading[1].trim()] });
        current = null;
        continue;
      }
      const bullet = BULLET_RE.exec(line);
      if (bullet) {
        openBlock("bullets")?.items.push(bullet[1].trim());
        continue;
      }
      const numbered = NUMBER_RE.exec(line);
      if (numbered) {
        openBlock("numbers")?.items.push(numbered[2].trim());
        continue;
      }
    }

    // Ligne libre : saut de ligne « souple » du markdown, joint au paragraphe
    // courant (le modele casse souvent ses phrases en milieu de ligne).
    const block = openBlock("paragraph");
    if (block.items.length > 0) block.items[block.items.length - 1] += ` ${body}`;
    else block.items.push(body);
  }

  return raw
    .map((block) => ({
      kind: block.kind,
      items: block.items
        .map((item) => tokenizeInline(item, citationCount))
        .filter((tokens) => tokens.length > 0),
    }))
    .filter((block) => block.items.length > 0);
}

/**
 * Marqueurs markdown retires, texte conserve : pour les affichages qui
 * restent en texte brut (puces de synthese, extraits de source). Le marqueur
 * de liste et le croisillon de titre tombent aussi : une puce affichee telle
 * quelle n'a ni tiret ni titre.
 */
export function stripMarkdownInline(text: string): string {
  const single = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(HEADING_MARKER_RE, "")
    .replace(LIST_MARKER_RE, "")
    .trim();
  if (!single) return "";
  return tokenizeInline(single, 0)
    .map((token) => token.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

