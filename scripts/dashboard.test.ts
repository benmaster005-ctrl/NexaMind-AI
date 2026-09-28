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
  normalizeUserRole,
} from "../lib/dashboard/helpers.ts";

describe("dashboard helpers (plan 1.4)", () => {
  it("donne Historique au collaborateur et Gerer a l'admin", () => {
    const collab = getNavItems("collaborateur").map((i) => i.label);
    assert.deepEqual(collab, ["Accueil", "Recherche", "Assistant", "Historique"]);
    const admin = getNavItems("admin").map((i) => i.label);
    assert.deepEqual(admin, ["Accueil", "Recherche", "Assistant", "Gérer"]);
  });

  it("ne montre jamais Gerer au collaborateur", () => {
    const items = getNavItems("collaborateur");
    assert.equal(items.some((i) => i.href.startsWith("/admin")), false);
  });

  it("normalise le role (defaut collaborateur)", () => {
    assert.equal(normalizeUserRole("admin"), "admin");
    assert.equal(normalizeUserRole(" Admin "), "admin");
    assert.equal(normalizeUserRole("collaborateur"), "collaborateur");
    assert.equal(normalizeUserRole(null), "collaborateur");
    assert.equal(normalizeUserRole(undefined), "collaborateur");
    assert.equal(normalizeUserRole("superadmin"), "collaborateur");
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