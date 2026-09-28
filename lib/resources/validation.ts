/**
 * Validation pure du dépôt documentaire (story 2.1, FR-5).
 *
 * Module sans dépendance (ni Next, ni Supabase) pour rester testable
 * sans réseau via `npm run test:resources`. Règles :
 * - Formats : PDF, DOCX, TXT, MD uniquement (PRD FR-5).
 * - Taille : 4 Mo maximum — voir `MAX_UPLOAD_BYTES` (FR-5 ramené de 10 Mo à
 *   4 Mo pour tenir sous le plafond d'une fonction serverless, `DEPLOYMENT.md`).
 * - Catégories : liste fermée de 6 valeurs (hypothèse PRD §11 n.6).
 */

/**
 * Taille maximale d'un dépôt, en octets (4 Mio).
 *
 * FR-5 prévoyait 10 Mo. La valeur est descendue à 4 Mio parce que le corps d'une
 * requête envoyée à une fonction Vercel est plafonné à 4,5 Mo (erreur 413
 * `function_payload_too_large`) : un réglage `bodySizeLimit` plus élevé dans
 * `next.config.ts` ne peut pas couvrir ce plafond plateforme. 4 Mio = 4 194 304
 * octets, soit ~300 Ko de jeu sous le plafond même lu en mégaoctets décimaux
 * (4 500 000 octets) — marge conservée pour l'encodage `multipart/form-data`.
 *
 * Remonter à 10 Mo demande de sortir le fichier du corps de la requête
 * (téléversement direct du navigateur vers Supabase Storage) : `DEPLOYMENT.md`.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Catégories fermées FR-5 (hypothèse PRD §11 n.6). */
export const RESOURCE_CATEGORIES = [
  "Compte rendu",
  "Procédure",
  "FAQ",
  "Fiche projet",
  "Note de réunion",
  "Ressource métier",
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

/** Extensions acceptées, en minuscules avec le point. */
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;

/** Types MIME acceptés (indicatifs : l'extension fait foi). */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

export interface FileValidation {
  valid: boolean;
  /** Message FR à afficher quand valid est false. */
  message?: string;
}

const MSG_FORMAT =
  "Format non supporté. Déposez un fichier PDF, DOCX, TXT ou MD.";
const MSG_SIZE = "Fichier trop lourd : la limite est de 4 Mo.";
const MSG_CATEGORY =
  "Catégorie invalide. Choisissez une catégorie dans la liste.";
const MSG_TITLE = "Saisissez un titre pour le document.";
const MSG_MISSING = "Sélectionnez un fichier à déposer.";

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  return fileName.slice(dot).toLowerCase();
}

/** Vérifie qu'un fichier est présent et non vide. */
export function validatePresence(file: unknown): FileValidation {
  if (!file || typeof file !== "object") {
    return { valid: false, message: MSG_MISSING };
  }
  const size = (file as { size?: unknown }).size;
  if (typeof size !== "number" || size <= 0) {
    return { valid: false, message: MSG_MISSING };
  }
  return { valid: true };
}

/** Vérifie le format (extension + MIME quand il est connu). */
export function validateFormat(
  fileName: string,
  mimeType: string,
): FileValidation {
  const ext = getExtension(fileName);
  const extOk = (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  if (!extOk) {
    return { valid: false, message: MSG_FORMAT };
  }
  // Certains navigateurs envoient application/octet-stream pour .md/.txt :
  // on ne rejette sur le MIME que s'il est renseigné ET inconnu.
  if (mimeType && mimeType !== "application/octet-stream") {
    // .txt/.md peuvent arriver en text/plain quel que soit l'OS : OK.
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return { valid: false, message: MSG_FORMAT };
    }
  }
  return { valid: true };
}

/** Vérifie la taille (`MAX_UPLOAD_BYTES`, soit 4 Mo). */
export function validateSize(sizeBytes: number): FileValidation {
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return { valid: false, message: MSG_SIZE };
  }
  return { valid: true };
}

/** Vérifie la catégorie (liste fermée FR-5). */
export function validateCategory(category: unknown): FileValidation {
  if (
    typeof category !== "string" ||
    !(RESOURCE_CATEGORIES as readonly string[]).includes(category)
  ) {
    return { valid: false, message: MSG_CATEGORY };
  }
  return { valid: true };
}

/** Vérifie le titre (non vide après trim). */
export function validateTitle(title: unknown): FileValidation {
  if (typeof title !== "string" || title.trim().length === 0) {
    return { valid: false, message: MSG_TITLE };
  }
  return { valid: true };
}

/**
 * Normalise les tags libres : trim, minuscules, dédupliqués,
 * vides écartés, 20 tags max.
 */
export function normalizeTags(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const tag = part.trim().toLowerCase();
    if (tag && !seen.has(tag)) seen.add(tag);
    if (seen.size >= 20) break;
  }
  return [...seen];
}