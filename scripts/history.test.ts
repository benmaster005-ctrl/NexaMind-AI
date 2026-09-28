// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Tests de l'historique des conversations (story 5.2, FR-15).
 * Execute avec `npm run test:history` : aucun reseau, aucun React.
 * Une assertion par ligne de la matrice I/O du plan.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONVERSATION_MESSAGES,
  HISTORY_LIMIT,
  buildHistoryItems,
  formatExchangeLabel,
} from "../lib/chat/conversations.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Lignes de conversations chronologiques (ancien -> recent). */
const CONVERSATIONS = [
  { id: "c-old", title: "Ancienne question", created_at: "2026-09-20T08:00:00Z" },
  { id: "c-mid", title: "Question intermediaire", created_at: "2026-09-25T10:00:00Z" },
  { id: "c-new", title: "Question recente", created_at: "2026-09-27T12:00:00Z" },
];

/** 2 messages pour c-old, 4 pour c-mid, 1 pour c-new. */
const MESSAGES = [
  { conversation_id: "c-old", role: "user" },
  { conversation_id: "c-old", role: "assistant" },
  { conversation_id: "c-mid", role: "user" },
  { conversation_id: "c-mid", role: "assistant" },
  { conversation_id: "c-mid", role: "user" },
  { conversation_id: "c-mid", role: "assistant" },
  { conversation_id: "c-new", role: "user" },
];

describe("buildHistoryItems — matrice I/O", () => {
  it("HAPPY_PATH : tri decroissant, titres, dates et nombre d'echanges", () => {
    const items = buildHistoryItems(CONVERSATIONS, MESSAGES);
    assert.deepEqual(
      items.map((i) => i.id),
      ["c-new", "c-mid", "c-old"],
      "la plus recente doit venir en premier",
    );
    assert.equal(items[0].title, "Question recente");
    assert.equal(items[0].createdAt, "2026-09-27T12:00:00Z");
    // Un echange = une question utilisateur.
    assert.deepEqual(
      items.map((i) => i.exchangeCount),
      [1, 2, 1],
    );
  });

  it("EMPTY : aucune conversation -> liste vide, 0 message lu", () => {
    assert.deepEqual(buildHistoryItems([], []), []);
    assert.deepEqual(buildHistoryItems(undefined, undefined), []);
  });

  it("SINGLE : une conversation rend le meme element qu'en liste", () => {
    const items = buildHistoryItems([CONVERSATIONS[0]], MESSAGES);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "c-old");
    assert.equal(items[0].exchangeCount, 1);
  });

  it("ROWS_INVALID : titre vide et date invalide nproviennent pas de crasher", () => {
    const items = buildHistoryItems(
      [
        { id: "c-bad-date", title: "Date cassee", created_at: "pas-une-date" },
        { id: "c-no-title", title: "   ", created_at: "2026-09-27T12:00:00Z" },
        { id: "", title: "Sans id", created_at: "2026-09-27T12:00:00Z" },
        null,
        "peu importe",
      ],
      [],
    );
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    assert.equal(byId["c-no-title"].title, CONVERSATION_MESSAGES.defaultTitle);
    assert.equal(byId["c-bad-date"].createdAt, "pas-une-date");
    // La date invalide ne casse pas le tri : elle passe en fin de liste.
    assert.equal(items[items.length - 1].id, "c-bad-date");
  });

  it("ISOLATION : aucun owner_id ni filtre manuel, la RLS fait le tri", () => {
    const raw = readFileSync(
      join(root, "app/(dashboard)/history/page.tsx"),
      "utf8",
    );
    // Audit du CODE uniquement : les commentaires de la page citent
    // volontairement `owner_id` pour expliquer pourquoi on ne l'utilise pas.
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    assert.ok(
      !/owner_id/.test(code),
      "la page ne doit pas filtrer par owner_id : la RLS garantit deja l'isolation",
    );
    assert.match(code, /from\("conversations"\)/);
    assert.match(code, /order\("created_at", \{ ascending: false \}\)/);
    assert.match(code, /\.limit\(HISTORY_LIMIT\)/);
  });

  it("ignore les messages qui ne correspondent a aucune conversation listee", () => {
    const items = buildHistoryItems([CONVERSATIONS[0]], [
      ...MESSAGES,
      { conversation_id: "c-inconnue", role: "user" },
    ]);
    assert.equal(items[0].exchangeCount, 1);
  });

  it("plafonne a HISTORY_LIMIT conversations", () => {
    const many = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => ({
      id: `c-${i}`,
      title: `Question ${i}`,
      created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    }));
    const items = buildHistoryItems(many, []);
    assert.equal(items.length, HISTORY_LIMIT);
    // Les plus recentes sont conservees.
    assert.equal(items[0].id, `c-${HISTORY_LIMIT + 4}`);
  });
});

describe("formatExchangeLabel", () => {
  it("accord au singulier et au pluriel", () => {
    assert.equal(formatExchangeLabel(1), "1 échange");
    assert.equal(formatExchangeLabel(0), "0 échanges");
    assert.equal(formatExchangeLabel(4), "4 échanges");
  });
});
