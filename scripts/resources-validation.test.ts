// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Audit de la validation du dépôt (plan 2.1, FR-5).
 * Exécuté avec `npm run test:resources` (node --test, sans dépendance).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  validatePresence,
  validateFormat,
  validateSize,
  validateCategory,
  validateTitle,
  normalizeTags,
  MAX_UPLOAD_BYTES,
} from "../lib/resources/validation.ts";

describe("validation dépôt (plan 2.1)", () => {
  it("accepte les 4 formats autorisés", () => {
    const cases = [
      ["procedure.pdf", "application/pdf"],
      ["compte-rendu.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["notes.txt", "text/plain"],
      ["guide.md", "text/markdown"],
      ["GUIDE.MD", "application/octet-stream"],
    ];
    for (const [name, mime] of cases) {
      assert.equal(validateFormat(name, mime).valid, true, name);
    }
  });

  it("rejette les formats non supportés (images, zip, audio)", () => {
    for (const [name, mime] of [
      ["photo.png", "image/png"],
      ["archive.zip", "application/zip"],
      ["audio.mp3", "audio/mpeg"],
      ["sans-extension", "text/plain"],
    ]) {
      const result = validateFormat(name, mime);
      assert.equal(result.valid, false);
      assert.ok(result.message);
    }
  });

  it("rejette les fichiers de plus de 4 Mo", () => {
    assert.equal(validateSize(MAX_UPLOAD_BYTES).valid, true);
    assert.equal(validateSize(MAX_UPLOAD_BYTES + 1).valid, false);
    assert.equal(validateSize(10 * 1024 * 1024).valid, false);
    assert.equal(
      validateSize(MAX_UPLOAD_BYTES + 1).message,
      "Fichier trop lourd : la limite est de 4 Mo.",
    );
  });

  // Garde-fou plateforme : le plafond FR-5 doit rester sous la limite de
  // corps de requête d'une fonction Vercel (4,5 Mo, erreur 413
  // `function_payload_too_large`) plus sa marge d'encodage multipart. Remonter
  // `MAX_UPLOAD_BYTES` fait tomber ce test : c'est voulu, la limite 10 Mo
  // exige alors un televersement direct vers Supabase Storage (`DEPLOYMENT.md`).
  it("maintient la limite de dépôt sous le plafond serverless de 4,5 Mo", () => {
    const VERCEL_BODY_LIMIT_BYTES = 4_500_000;
    const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
    assert.ok(
      MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES < VERCEL_BODY_LIMIT_BYTES,
      `MAX_UPLOAD_BYTES (${MAX_UPLOAD_BYTES}) dépasse le plafond serveur`,
    );
  });

  it("valide la catégorie dans la liste fermée FR-5", () => {
    assert.equal(validateCategory("Procédure").valid, true);
    assert.equal(validateCategory("Hors liste").valid, false);
    assert.equal(validateCategory("").valid, false);
    assert.equal(validateCategory(null).valid, false);
  });

  it("exige un titre non vide et un fichier présent", () => {
    assert.equal(validateTitle("  ").valid, false);
    assert.equal(validateTitle("Procédure congés").valid, true);
    assert.equal(validatePresence(null).valid, false);
    assert.equal(validatePresence({ size: 0 }).valid, false);
    assert.equal(validatePresence({ size: 120 }).valid, true);
  });

  it("normalise les tags libres (trim, dedup, 20 max)", () => {
    assert.deepEqual(normalizeTags("RH, congés, rh , "), ["rh", "congés"]);
    assert.deepEqual(normalizeTags(""), []);
    assert.deepEqual(normalizeTags(null), []);
  });
});