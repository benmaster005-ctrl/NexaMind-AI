// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Audit des helpers du tableau de bord (plan 1.4, FR-4).
 * Execute avec `npm run test:dashboard` (node --test, sans dependance).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getNavItems,
  getTopNavItems,
  formatRelativeDate,
  formatHistoryStamp,
  documentTypeLabel,
  formatShortDate,
  displayNameFromEmail,
  initialsFromName,
} from "../lib/dashboard/helpers.ts";

describe("dashboard helpers (plan 1.4)", () => {
  it("donne la meme navigation a tout utilisateur authentifie", () => {
    assert.deepEqual(getNavItems().map((i) => i.label), [
      "Accueil",
      "Recherche",
      "Assistant",
      "Historique",
      "Documents",
    ]);
  });

  it("expose le depot documentaire a tous (plus de role)", () => {
    // Gestion des roles supprimee : chaque onglet est accessible a tous.
    const items = getNavItems();
    assert.equal(items.length, 5);
    assert.ok(items.some((i) => i.href === "/documents"));
    assert.ok(items.some((i) => i.href === "/history"));
  });

  it("formate les dates relatives en francais", () => {
    const now = new Date("2026-09-27T12:00:00Z").getTime();
    assert.equal(
      formatRelativeDate("2026-09-27T11:59:30Z", now),
      "À l'instant",
    );
    assert.equal(formatRelativeDate("2026-09-27T11:30:00Z", now), "Il y a 30 min");
    assert.equal(formatRelativeDate("2026-09-27T10:00:00Z", now), "Il y a 2h");
    assert.equal(formatRelativeDate("2026-09-24T12:00:00Z", now), "Il y a 3 j");
  });

  it("gere les dates invalides ou futures", () => {
    assert.equal(formatRelativeDate("pas-une-date"), "Date inconnue");
    assert.equal(
      formatRelativeDate("2026-09-28T12:00:00Z", new Date("2026-09-27T12:00:00Z").getTime()),
      "À venir",
    );
  });

  // Refonte du tableau de bord : le type de document vient du chemin de
  // stockage (seule source reelle), jamais d'une donnee inventee.
  it("deduit le type de document du chemin de stockage", () => {
    assert.equal(documentTypeLabel("u1/8f3a.pdf"), "PDF");
    assert.equal(documentTypeLabel("u1/8F3A.PDF"), "PDF");
    assert.equal(documentTypeLabel("u1/8f3a.docx"), "DOCX");
    assert.equal(documentTypeLabel("u1/notes.txt"), "TXT");
    assert.equal(documentTypeLabel("u1/notes.md"), "MD");
  });

  it("n'invente ni type ni date quand la donnee manque", () => {
    assert.equal(documentTypeLabel(null), "");
    assert.equal(documentTypeLabel(undefined), "");
    assert.equal(documentTypeLabel("u1/sans-extension"), "");
    assert.equal(documentTypeLabel("u1/archive.zip"), "");
    assert.equal(formatShortDate(null), "");
    assert.equal(formatShortDate("pas-une-date"), "");
  });

  it("formate une date courte francaise", () => {
    const formatted = formatShortDate("2026-09-28T10:00:00Z");
    assert.ok(/\d{1,2}\s+\w+\.?\s+2026/.test(formatted), `date illisible : ${formatted}`);
  });

  // En-tete du tableau de bord : la marque ramene a `/`, donc l'onglet
  // « Accueil » n'y figure pas — seules les 4 sections de travail.
  it("expose les 4 onglets de l'en-tete, sans Accueil", () => {
    assert.deepEqual(
      getTopNavItems().map((i) => i.href),
      ["/search", "/chat", "/history", "/documents"],
    );
    // Meme source de verite que la sidebar : un filtre, pas une copie.
    assert.deepEqual(getTopNavItems(), getNavItems().slice(1));
  });

  // Horodatage de l'historique (« Aujourd'hui · 09:42 ») : l'ecart est
  // calendaire, jamais horaire.
  it("horodate l'historique : aujourd'hui, hier, puis date", () => {
    const now = new Date("2026-09-29T18:00:00").getTime();
    assert.equal(
      formatHistoryStamp("2026-09-29T09:42:00", now),
      "Aujourd'hui · 09:42",
    );
    assert.equal(formatHistoryStamp("2026-09-28T16:48:00", now), "Hier · 16:48");
    // 00h10 le meme jour reste « aujourd'hui », malgre 17h50 d'ecart.
    assert.equal(
      formatHistoryStamp("2026-09-29T00:10:00", now),
      "Aujourd'hui · 00:10",
    );

    const older = formatHistoryStamp("2026-09-26T16:20:00", now);
    assert.ok(
      /^[A-Z]\w*\.?\s+26\s+sept\.\s+·\s+16:20$/.test(older),
      `horodatage illisible : ${older}`,
    );
  });

  it("n'horodate rien quand la date manque", () => {
    assert.equal(formatHistoryStamp(null), "");
    assert.equal(formatHistoryStamp(undefined), "");
    assert.equal(formatHistoryStamp("pas-une-date"), "");
  });

  // Compte de l'en-tete : derive de l'adresse reelle, jamais d'une donnee
  // inventee.
  it("derive le libelle du compte de l'adresse reelle", () => {
    assert.equal(displayNameFromEmail("thomas.roux@nexaworks.example"), "Thomas R.");
    assert.equal(displayNameFromEmail("thomas@nexaworks.example"), "Thomas");
    assert.equal(displayNameFromEmail("thomas_roux@nexaworks.example"), "Thomas R.");
    assert.equal(displayNameFromEmail(""), "Compte");
    assert.equal(initialsFromName("Thomas R."), "TR");
    assert.equal(initialsFromName(""), "NM");
  });
});