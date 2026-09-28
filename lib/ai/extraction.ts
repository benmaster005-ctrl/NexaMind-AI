/**
 * Extraction de texte des documents déposés (story 2.2, FR-6).
 *
 * Le dispatch se fait sur l'extension du fichier déposé (.pdf, .docx, .txt,
 * .md) — la validation 2.1 a déjà rejeté tout autre format. Les lecteurs PDF
 * (`unpdf`) et DOCX (`mammoth`) sont chargés à l'appel via import dynamique et
 * peuvent être remplacés par des lecteurs injectés (tests hors réseau).
 *
 * Toute anomalie est signalée par une `ExtractionError` typée dont le message
 * français est destiné à être persisté dans `resources.error_message`.
 */
import { normalizeText } from "./chunking.ts";

export type ExtractionErrorCode =
  | "unsupported-format"
  | "scanned-pdf"
  | "corrupted"
  | "empty"
  | "too-many-pages";

/** En dessous de ce nombre de caractères, un PDF est considéré comme scanné. */
export const MIN_EXTRACTED_CHARS = 50;
/** Garde-fou : au-delà, l'ingestion est refusée (AD-3, dépôt limité à 4 Mo). */
export const MAX_PDF_PAGES = 300;
/** Formats pris en charge par l'extraction (aligné sur la validation 2.1). */
export const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;

export class ExtractionError extends Error {
  readonly code: ExtractionErrorCode;

  constructor(code: ExtractionErrorCode, message: string) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
  }
}

export interface PdfReadResult {
  text: string;
  pages: number;
}

/** Lecteurs remplaçables (tests) des formats binaires. */
export interface ExtractionReaders {
  pdf?: (data: Uint8Array) => Promise<PdfReadResult>;
  docx?: (data: Uint8Array) => Promise<string>;
}

export interface ExtractTextInput {
  data: Uint8Array;
  fileName: string;
  readers?: ExtractionReaders;
}

export interface ExtractionResult {
  text: string;
  format: "pdf" | "docx" | "text";
}

export const EXTRACTION_MESSAGES = {
  unsupported:
    "Format non supporté pour l'ingestion. Formats acceptés : PDF (texte), DOCX, TXT, MD.",
  scanned:
    "PDF scanné ou sans texte extractible : l'OCR n'est pas supporté. Déposez une version texte du document.",
  corrupted: "Fichier illisible ou corrompu : impossible d'extraire le texte.",
  empty: "Aucun contenu textuel détecté dans le document.",
  tooManyPages:
    "Document trop volumineux pour l'ingestion : la limite est de 300 pages.",
} as const;

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot).toLowerCase();
}

async function readPdfWithUnpdf(data: Uint8Array): Promise<PdfReadResult> {
  const { extractText: extractPdfText, getDocumentProxy } = await import(
    "unpdf"
  );
  const document = await getDocumentProxy(data);
  const totalPages =
    typeof document.numPages === "number" ? document.numPages : 0;
  // Refus AVANT d'extraire : un PDF gigantesque ne doit pas être traité.
  if (totalPages > MAX_PDF_PAGES) {
    throw new ExtractionError("too-many-pages", EXTRACTION_MESSAGES.tooManyPages);
  }
  const { text } = await extractPdfText(document, { mergePages: true });
  return {
    text: Array.isArray(text) ? text.join("\n") : text,
    pages: totalPages,
  };
}

async function readDocxWithMammoth(data: Uint8Array): Promise<string> {
  const { extractRawText } = await import("mammoth");
  const result = await extractRawText({ buffer: Buffer.from(data) });
  return result.value;
}

/**
 * Extrait le texte d'un document déposé.
 * @throws {ExtractionError} format refusé, PDF scanné, fichier vide, corrompu ou trop long.
 */
export async function extractText({
  data,
  fileName,
  readers,
}: ExtractTextInput): Promise<ExtractionResult> {
  const extension = getExtension(fileName);
  if (!(ALLOWED_DOCUMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new ExtractionError("unsupported-format", EXTRACTION_MESSAGES.unsupported);
  }

  if (extension === ".txt" || extension === ".md") {
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(data);
    const text = normalizeText(decoded);
    if (text.length === 0) {
      throw new ExtractionError("empty", EXTRACTION_MESSAGES.empty);
    }
    return { text, format: "text" };
  }

  if (extension === ".pdf") {
    const readPdf = readers?.pdf ?? readPdfWithUnpdf;
    let result: PdfReadResult;
    try {
      result = await readPdf(data);
    } catch (error) {
      // Une erreur d'ingestion déjà typée (ex. trop de pages) est conservée.
      if (error instanceof ExtractionError) throw error;
      throw new ExtractionError("corrupted", EXTRACTION_MESSAGES.corrupted);
    }
    if (result.pages > MAX_PDF_PAGES) {
      throw new ExtractionError(
        "too-many-pages",
        EXTRACTION_MESSAGES.tooManyPages,
      );
    }
    const text = normalizeText(result.text ?? "");
    if (text.length < MIN_EXTRACTED_CHARS) {
      throw new ExtractionError("scanned-pdf", EXTRACTION_MESSAGES.scanned);
    }
    return { text, format: "pdf" };
  }

  const readDocx = readers?.docx ?? readDocxWithMammoth;
  let raw: string;
  try {
    raw = await readDocx(data);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError("corrupted", EXTRACTION_MESSAGES.corrupted);
  }
  const text = normalizeText(raw ?? "");
  if (text.length === 0) {
    throw new ExtractionError("empty", EXTRACTION_MESSAGES.empty);
  }
  return { text, format: "docx" };
}
