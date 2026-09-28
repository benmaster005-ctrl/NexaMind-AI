// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Tests de l'historique des recherches (story 5.3, FR-16).
 * Execute avec `npm run test:search-history` : aucun reseau.
 * Une assertion par ligne de la matrice I/O du plan + audit de la migration.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MAX_RECORDED_QUERY,
  SEARCH_HISTORY_LIMIT,
  buildSearchHistoryItems,
  formatResultCount,
  normalizeQuery,
  prependSearchItem,
  removeSearchItem,
  shouldRecordSearch,
} from "../lib/search/history.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("normalizeQuery / shouldRecordSearch", () => {
  it("normalise espaces et casse pour comparer", () => {
    assert.equal(normalizeQuery("  Congés   payés "), "congés payés");
  });

  it("RECORD_SKIP : requete vide, trop longue ou identique a la derniere", () => {
    assert.equal(shouldRecordSearch("vacances", "vacances"), false);
    assert.equal(shouldRecordSearch("VACANCES", "  vacances "), false);
    assert.equal(shouldRecordSearch(null, ""), false);
    assert.equal(shouldRecordSearch(null, "   "), false);
    assert.equal(shouldRecordSearch("x", "y".repeat(MAX_RECORDED_QUERY + 1)), false);
  });

  it("RECORD_OK : une requete nouvelle et exploitable est enregistrable", () => {
    assert.equal(shouldRecordSearch("vacances", "remboursement frais"), true);
    assert.equal(shouldRecordSearch(null, "premier lancement"), true);
  });
});

describe("buildSearchHistoryItems — LIST", () => {
  it("trie decroissant, garde texte et compte, plafonne a la limite", () => {
    const rows = Array.from({ length: SEARCH_HISTORY_LIMIT + 4 }, (_, i) => ({
      id: `s-${i}`,
      query: `Requete ${i}`,
      result_count: i,
      created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    }));
    const items = buildSearchHistoryItems(rows);
    assert.equal(items.length, SEARCH_HISTORY_LIMIT);
    assert.equal(items[0].query, `Requete ${SEARCH_HISTORY_LIMIT + 3}`);
    assert.equal(items[0].resultCount, SEARCH_HISTORY_LIMIT + 3);
  });

  it("normalise les lignes invalides (id, requete, date, compte)", () => {
    const items = buildSearchHistoryItems([
      { id: "ok", query: "  vacances  ", result_count: 3, created_at: "2026-09-20T10:00:00Z" },
      { id: "sans-query", query: "   ", created_at: "2026-09-20T10:00:00Z" },
      { id: "", query: "ignore", created_at: "2026-09-20T10:00:00Z" },
      { id: "date-ko", query: "date cassee", result_count: null, created_at: "nope" },
      null,
      42,
    ]);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    assert.equal(byId.ok.query, "vacances");
    assert.equal(byId["date-ko"].resultCount, 0);
    assert.equal(byId["date-ko"].createdAt, "nope");
    // La date invalide passe en fin de liste, la requete vide est exclue.
    assert.equal(items[items.length - 1].id, "date-ko");
    assert.equal(items.length, 2);
  });

  it("entree absente -> tableau vide", () => {
    assert.deepEqual(buildSearchHistoryItems(undefined), []);
    assert.deepEqual(buildSearchHistoryItems(null), []);
  });
});

describe("formatResultCount", () => {
  it("accorde le resultat et gere l'absence de resultat", () => {
    assert.equal(formatResultCount(0), "Aucun résultat");
    assert.equal(formatResultCount(1), "1 résultat");
    assert.equal(formatResultCount(5), "5 résultats");
    assert.equal(formatResultCount(-3), "Aucun résultat");
  });
});

describe("ajout optimiste et suppression locale", () => {
  it("prependSearchItem place en tete et dedoublonne", () => {
    const base = [
      { id: "a", query: "Alpha", resultCount: 1, createdAt: "2026-09-20T10:00:00Z" },
    ];
    const next = prependSearchItem(base, { query: "Beta", resultCount: 2 });
    assert.equal(next[0].query, "Beta");
    assert.equal(next.length, 2);
    const deduped = prependSearchItem(next, { query: " alpha ", resultCount: 9 });
    assert.equal(deduped.length, 2);
    // L'entree precedente est remplacee par le texte EXACT de la nouvelle
    // recherche (le contrat du PRD est de conserver la requete saisie).
    assert.equal(deduped.filter((i) => i.query === "Alpha").length, 0);
    assert.equal(deduped[0].query, "alpha");
    assert.equal(deduped[0].resultCount, 9);
  });

  it("prependSearchItem ignore une requete vide et plafonne", () => {
    const base = [];
    assert.deepEqual(prependSearchItem(base, { query: "  ", resultCount: 1 }), base);
    const many = Array.from({ length: SEARCH_HISTORY_LIMIT }, (_, i) => ({
      id: `s-${i}`,
      query: `q${i}`,
      resultCount: 0,
      createdAt: "2026-09-20T10:00:00Z",
    }));
    assert.equal(
      prependSearchItem(many, { query: "nouvelle", resultCount: 1 }).length,
      SEARCH_HISTORY_LIMIT,
    );
  });

  it("removeSearchItem retire l'entree visee", () => {
    const base = [
      { id: "a", query: "A", resultCount: 1, createdAt: "" },
      { id: "b", query: "B", resultCount: 1, createdAt: "" },
    ];
    assert.deepEqual(
      removeSearchItem(base, "a").map((i) => i.id),
      ["b"],
    );
    assert.equal(removeSearchItem(base, "inconnu").length, 2);
  });
});

describe("migration 0007 — audit statique (matrice NO_MIGRATION)", () => {
  const sql = readFileSync(
    join(root, "supabase/migrations/0007_search_history.sql"),
    "utf8",
  );
  const lower = sql.toLowerCase();

  it("cree search_history de maniere idempotente avec les colonnes du PRD", () => {
    assert.match(sql, /create table if not exists public\.search_history/i);
    assert.match(sql, /owner_id uuid not null references auth\.users/i);
    assert.match(sql, /query text not null/i);
    assert.match(sql, /result_count integer not null default 0/i);
    assert.match(sql, /created_at timestamptz not null default now\(\)/i);
  });

  it("indexe (owner_id, created_at desc) pour la lecture de l'historique", () => {
    assert.match(sql, /create index if not exists/i);
    assert.match(lower, /on public\.search_history\s*\(\s*owner_id,\s*created_at desc\s*\)/);
  });

  it("RLS active + policy proprietaire (R-7), idempotente", () => {
    assert.match(lower, /alter table public\.search_history enable row level security/);
    assert.match(lower, /drop policy if exists "owner_search_history"/);
    assert.match(lower, /create policy "owner_search_history"[\s\S]*for all to authenticated/);
    assert.match(lower, /using \(auth\.uid\(\) = owner_id\)/);
    assert.match(lower, /with check \(auth\.uid\(\) = owner_id\)/);
  });
});

describe("integration — aucun owner_id recu du client", () => {
  const files = [
    "app/search/page.tsx",
    "app/search/actions.ts",
    "app/(dashboard)/history/page.tsx",
    "lib/search/history-store.ts",
    "app/api/search/route.ts",
  ];
  it("l'isolation reste dans la RLS (audit du code, commentaires exclus)", () => {
    for (const file of files) {
      const raw = readFileSync(join(root, file), "utf8");
      const code = raw
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      // Seul le store ecrit owner_id, et uniquement depuis l'identifiant de
      // session fourni par l'appelant serveur.
      const occurrences = (code.match(/owner_id/g) ?? []).length;
      if (file === "lib/search/history-store.ts") {
        assert.ok(occurrences >= 1, "le store doit poser owner_id a l'insertion");
      } else {
        assert.equal(occurrences, 0, `${file} ne doit pas manipuler owner_id`);
      }
    }
  });
});

