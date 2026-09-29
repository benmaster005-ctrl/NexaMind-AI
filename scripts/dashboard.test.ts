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
  formatRelativeDate,
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
});