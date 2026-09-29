// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Audit de la gestion des ressources (plan 2.4, FR-5/FR-7).
 * Execute avec `npm run test:resources-management` : aucun reseau,
 * aucun Supabase reel (faux client injecte dans lib/resources/management).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MSG_DELETED,
  MSG_DELETED_PARTIAL,
  MSG_METADATA_SAVED,
  MSG_NOT_FOUND,
  deleteResource,
  updateResourceMetadata,
} from "../lib/resources/management.ts";
const RESOURCE_ID = "11111111-2222-3333-4444-555555555555";

function stubClient(options = {}) {
  const calls = [];
  const client = {
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => ({
          maybeSingle: async () => {
            calls.push({ table, op: "select.eq", columns, column, value });
            if (options.selectError) return { data: null, error: { message: options.selectError } };
            if (options.missingPath) return { data: { storage_path: null }, error: null };
            return { data: { storage_path: "u1/abc.pdf" }, error: null };
          },
        }),
      }),
      update: (values) => ({
        eq: async (column, value) => {
          calls.push({ table, op: "update.eq", values, column, value });
          if (options.updateError) return { error: { message: options.updateError } };
          return { error: null };
        },
      }),
      delete: () => ({
        eq: async (column, value) => {
          calls.push({ table, op: "delete.eq", column, value });
          if (options.deleteError) return { error: { message: options.deleteError } };
          return { error: null };
        },
      }),
    }),
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          calls.push({ table: "storage:" + bucket, op: "remove", paths });
          if (options.storageError) return { error: { message: options.storageError } };
          return { error: null };
        },
      }),
    },
  };
  return { client, calls };
}

describe("gestion ressources (plan 2.4)", () => {
  it("MAJ : persiste categorie + tags normalises", async () => {
    const { client, calls } = stubClient();
    const result = await updateResourceMetadata({
      client,
      resourceId: RESOURCE_ID,
      category: "FAQ",
      tags: "RH, Congés, rh",
    });
    assert.equal(result.success, true);
    assert.equal(result.message, MSG_METADATA_SAVED);
    const update = calls.find((c) => c.op === "update.eq");
    assert.deepEqual(update.values, { category: "FAQ", tags: ["rh", "congés"] });
  });

  it("MAJ : categorie invalide et identifiant malforme rejetes", async () => {
    const { client } = stubClient();
    const badCat = await updateResourceMetadata({
      client,
      resourceId: RESOURCE_ID,
      category: "Hors liste",
      tags: "",
    });
    assert.equal(badCat.success, false);

    const badId = await updateResourceMetadata({
      client,
      resourceId: "nope",
      category: "FAQ",
      tags: "",
    });
    assert.equal(badId.success, false);
    assert.equal(badId.message, MSG_NOT_FOUND);
  });

  it("suppression : DB d'abord (cascade), puis Storage", async () => {
    const { client, calls } = stubClient();
    const result = await deleteResource({ client, resourceId: RESOURCE_ID });
    assert.equal(result.success, true);
    assert.equal(result.message, MSG_DELETED);
    assert.deepEqual(
      calls.map((c) => c.op),
      ["select.eq", "delete.eq", "remove"],
    );
    assert.equal(calls[1].table, "resources");
    assert.deepEqual(calls[2].paths, ["u1/abc.pdf"]);
  });

  it("suppression : ressource absente signalee", async () => {
    const { client: missing } = stubClient({ missingPath: true });
    const notFound = await deleteResource({ client: missing, resourceId: RESOURCE_ID });
    assert.equal(notFound.success, false);
    assert.equal(notFound.message, MSG_NOT_FOUND);
  });

  it("suppression : echec Storage apres DB = message partiel (base coherente)", async () => {
    const { client, calls } = stubClient({ storageError: "boom" });
    const result = await deleteResource({ client, resourceId: RESOURCE_ID });
    assert.equal(result.success, true);
    assert.equal(result.message, MSG_DELETED_PARTIAL);
    assert.equal(calls.some((c) => c.op === "delete.eq"), true);
  });
});
