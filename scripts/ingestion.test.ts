// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Audit du pipeline d'ingestion (plan 2.2, FR-6).
 * Exécuté avec `npm run test:ingestion` : aucun réseau, aucun Supabase réel
 * (dépendances injectées + faux client pour l'adaptateur).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SupabaseClient } from "@supabase/supabase-js";

import { EXTRACTION_MESSAGES, ExtractionError } from "../lib/ai/extraction.ts";
import {
  ingestResource,
  supabaseIngestDeps,
} from "../lib/ingestion/ingest-resource.ts";

const RESOURCE_ID = "11111111-2222-3333-4444-555555555555";

/** Texte long : 60 phrases, soit largement plus de 400 tokens. */
function longText(sentences = 60): string {
  const parts: string[] = [];
  for (let index = 0; index < sentences; index += 1) {
    parts.push(
      `Phrase ${index} : les procedures internes decrivent le circuit de validation des demandes.`,
    );
  }
  return parts.join(" ");
}

interface Recorder {
  chunks: unknown[][];
  chunked: number[];
  ready: number[];
  failed: string[];
  reads: number;
}

interface DepsOptions {
  text?: string;
  extractThrows?: Error;
  readThrows?: Error;
  replaceThrows?: Error;
  markFailedThrows?: Error;
  embedThrows?: Error;
}

function createDeps(options: DepsOptions = {}) {
  const record: Recorder = { chunks: [], chunked: [], ready: [], failed: [], reads: 0 };
  const deps = {
    title: "Procedure conges payes",
    fileName: "documents/u1/abc.txt",
    readDocument: async () => {
      record.reads += 1;
      if (options.readThrows) throw options.readThrows;
      return new Uint8Array([65, 66, 67]);
    },
    replaceChunks: async (chunks: unknown[]) => {
      record.chunks.push(chunks);
      if (options.replaceThrows) throw options.replaceThrows;
    },
    markReady: async (chunkCount: number) => {
      record.ready.push(chunkCount);
      record.chunked.push(chunkCount);
    },
    markChunked: async (chunkCount: number) => {
      record.chunked.push(chunkCount);
    },
    markFailed: async (reason: string) => {
      record.failed.push(reason);
      if (options.markFailedThrows) throw options.markFailedThrows;
    },
    extract: async () => {
      if (options.extractThrows) throw options.extractThrows;
      return { text: options.text ?? longText(), format: "text" as const };
    },
    embed: async (texts: string[]) => {
      if (options.embedThrows) throw options.embedThrows;
      return texts.map(() => new Array(768).fill(0.1));
    },
  };
  return { deps, record };
}

/** Faux client Supabase : enregistre l'ordre des opérations. */
function createStubClient(options: { deleteError?: string } = {}) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  const client = {
    storage: {
      from: (bucket: string) => ({
        download: async (path: string) => {
          calls.push({ table: `storage:${bucket}`, op: "download", payload: path });
          return { data: new Blob([new Uint8Array([65, 66])]), error: null };
        },
      }),
    },
    from: (table: string) => ({
      delete: () => ({
        eq: async (column: string, value: string) => {
          calls.push({ table, op: `delete.eq(${column})`, payload: value });
          return { error: options.deleteError ? { message: options.deleteError } : null };
        },
      }),
      insert: async (rows: unknown[]) => {
        calls.push({ table, op: "insert", payload: rows });
        return { error: null };
      },
      update: (values: Record<string, unknown>) => ({
        eq: async (column: string, value: string) => {
          calls.push({ table, op: `update.eq(${column})`, payload: { id: value, values } });
          return { error: null };
        },
      }),
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("ingestion d'un document déposé (FR-6)", () => {
  it("dépôt exploitable : découpe, vectorise et persiste les morceaux, statut Prête", async () => {
    const { deps, record } = createDeps();
    const result = await ingestResource({ resourceId: RESOURCE_ID, deps });

    assert.equal(result.ok, true);
    assert.ok(result.chunkCount > 1, `morceaux attendus > 1, reçu ${result.chunkCount}`);
    assert.deepEqual(record.ready, [result.chunkCount]);
    assert.deepEqual(record.failed, []);
    assert.equal(record.chunks.length, 1);

    const chunks = record.chunks[0];
    assert.equal(chunks.length, result.chunkCount);
    chunks.forEach((chunk, index) => {
      assert.equal(chunk.resourceId, RESOURCE_ID);
      assert.equal(chunk.chunkIndex, index);
      assert.ok(chunk.content.startsWith("# Procedure conges payes\n\n"));
      assert.ok(chunk.tokens <= 500);
      assert.equal(chunk.embedding.length, 768);
    });
  });

  it("échec de vectorisation Gemini : bascule en Échec avec message explicite", async () => {
    const { deps, record } = createDeps({
      embedThrows: new Error("Quota 429 dépassé"),
    });
    const result = await ingestResource({ resourceId: RESOURCE_ID, deps });

    assert.equal(result.ok, false);
    assert.equal(record.failed.length, 1);
    assert.match(record.failed[0], /Échec de vectorisation/);
  });

  it("PDF scanné : ressource en Échec avec la raison explicite", async () => {
    const { deps, record } = createDeps({
      extractThrows: new ExtractionError("scanned-pdf", EXTRACTION_MESSAGES.scanned),
    });
    const result = await ingestResource({ resourceId: RESOURCE_ID, deps });

    assert.equal(result.ok, false);
    assert.equal(result.chunkCount, 0);
    assert.deepEqual(record.chunks, []);
    assert.deepEqual(record.failed, [EXTRACTION_MESSAGES.scanned]);
    assert.match(result.message, /PDF scanné/);
  });

  it("fichier corrompu : ressource en Échec sans planter le service", async () => {
    const { deps, record } = createDeps({
      extractThrows: new ExtractionError("corrupted", EXTRACTION_MESSAGES.corrupted),
    });
    const result = await ingestResource({ resourceId: RESOURCE_ID, deps });

    assert.equal(result.ok, false);
    assert.deepEqual(record.failed, [EXTRACTION_MESSAGES.corrupted]);
  });

  it("fichier vide : ressource en Échec avec la raison « aucun contenu »", async () => {
    const { deps, record } = createDeps({ text: "   \n\n  " });
    const result = await ingestResource({ resourceId: RESOURCE_ID, deps });

    assert.equal(result.ok, false);
    assert.deepEqual(record.failed, [EXTRACTION_MESSAGES.empty]);
    assert.deepEqual(record.chunked, []);
  });

  it("PDF trop long : ressource en Échec avec la raison de taille", async () => {
    const { deps, record } = createDeps({
      extractThrows: new ExtractionError(
        "too-many-pages",
        EXTRACTION_MESSAGES.tooManyPages,
      ),
    });
    const result = await ingestResource({ resourceId: RESOURCE_ID, deps });

    assert.equal(result.ok, false);
    assert.deepEqual(record.failed, [EXTRACTION_MESSAGES.tooManyPages]);
  });
describe("nouvelle ingestion et pannes d'infrastructure", () => {
  it("ré-ingestion : remplace les morceaux au lieu d'en ajouter", async () => {
    const { deps, record } = createDeps();
    const first = await ingestResource({ resourceId: RESOURCE_ID, deps });
    const second = await ingestResource({ resourceId: RESOURCE_ID, deps });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(record.chunks.length, 2);
    for (const call of record.chunks) {
      const indices = call.map((chunk: { chunkIndex: number }) => chunk.chunkIndex);
      assert.deepEqual(indices, indices.map((_, index) => index));
      assert.equal(new Set(indices).size, indices.length);
    }
    assert.deepEqual(record.ready, [first.chunkCount, second.chunkCount]);
  });

  it("migration 0003 non jouée : raison invitant à la jouer", async () => {
    const { deps, record } = createDeps({
      replaceThrows: new Error('relation "public.document_chunks" does not exist'),
    });
    const result = await ingestResource({ resourceId: RESOURCE_ID, deps });

    assert.equal(result.ok, false);
    assert.equal(record.failed.length, 1);
    assert.match(record.failed[0], /0003_ingestion_chunks\.sql/);
  });

  it("marquage en échec impossible : la raison est tout de même renvoyée", async () => {
    const { deps } = createDeps({
      extractThrows: new ExtractionError("corrupted", EXTRACTION_MESSAGES.corrupted),
      markFailedThrows: new Error("permission denied"),
    });
    const result = await ingestResource({ resourceId: RESOURCE_ID, deps });

    assert.equal(result.ok, false);
    assert.equal(result.message, EXTRACTION_MESSAGES.corrupted);
  });

  it("fichier absent du Storage : raison invitant à redéposer", async () => {
    const { deps, record } = createDeps({
      readThrows: new Error("Object not found"),
    });
    const result = await ingestResource({ resourceId: RESOURCE_ID, deps });

    assert.equal(result.ok, false);
    assert.equal(record.failed.length, 1);
    assert.match(record.failed[0], /stockage/);
  });
});

describe("adaptateur Supabase de l'ingestion", () => {
  it("télécharge l'objet, supprime puis insère les morceaux et met à jour la ressource", async () => {
    const { client, calls } = createStubClient();
    const deps = supabaseIngestDeps({
      supabase: client,
      resourceId: RESOURCE_ID,
      title: "Procedure conges payes",
      storagePath: "admin/abc.txt",
    });

    assert.equal((await deps.readDocument()).length, 2);
    await deps.replaceChunks([
      { resourceId: RESOURCE_ID, chunkIndex: 0, content: "morceau 0", tokens: 10, embedding: null },
      { resourceId: RESOURCE_ID, chunkIndex: 1, content: "morceau 1", tokens: 10, embedding: null },
    ]);
    await deps.markReady(2);
    await deps.markFailed("raison de test");

    assert.equal(calls[0].op, "download");
    assert.equal(calls[0].payload, "admin/abc.txt");
    assert.deepEqual(
      calls.slice(1, 3).map((call) => call.op),
      ["delete.eq(resource_id)", "insert"],
    );
    assert.deepEqual(calls[2].payload, [
      { resource_id: RESOURCE_ID, chunk_index: 0, content: "morceau 0", embedding: null },
      { resource_id: RESOURCE_ID, chunk_index: 1, content: "morceau 1", embedding: null },
    ]);
    assert.deepEqual(calls[3].payload, {
      id: RESOURCE_ID,
      values: { status: "Prête", chunk_count: 2, error_message: null },
    });
    assert.deepEqual(calls[4].payload, {
      id: RESOURCE_ID,
      values: { status: "Échec", error_message: "raison de test", chunk_count: 0 },
    });
  });

  it("remonte une erreur de schéma jusqu'à la raison de migration", async () => {
    const { client, calls } = createStubClient({
      deleteError: 'relation "public.document_chunks" does not exist',
    });
    const result = await ingestResource({
      resourceId: RESOURCE_ID,
      deps: {
        ...supabaseIngestDeps({
          supabase: client,
          resourceId: RESOURCE_ID,
          title: "Procedure conges payes",
          storagePath: "admin/abc.txt",
        }),
        embed: async (texts) => texts.map(() => new Array(768).fill(0.1)),
      },
    });

    assert.equal(result.ok, false);
    const failedCall = calls.find((call) => call.op === "update.eq(id)");
    assert.match(String(failedCall.payload.values.error_message), /0003_ingestion_chunks\.sql/);
  });

  it("stockage non configuré : raison invitant à jouer la migration 0002", async () => {
    const { deps, record } = createDeps({
      readThrows: new Error("Bucket not found"),
    });
    const result = await ingestResource({ resourceId: RESOURCE_ID, deps });

    assert.equal(result.ok, false);
    assert.equal(record.failed.length, 1);
    assert.match(record.failed[0], /0002_storage_resources\.sql/);
  });
});

});

