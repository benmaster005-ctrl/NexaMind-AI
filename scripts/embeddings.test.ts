/**
 * Tests unitaires du module d'embeddings Gemini (Story 2.3, AD-3, FR-6).
 * Exécuté avec `node --test --experimental-strip-types scripts/embeddings.test.ts`.
 * Aucun appel réseau réel n'est effectué : injection de customEmbedMany ou d'erreurs stubs.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  chunkArray,
  EmbeddingError,
  generateEmbeddings,
  getGeminiApiKey,
  isRateLimitError,
  EMBEDDING_DIMENSION,
} from "../lib/ai/embeddings.ts";

function createDummyVector(dimension = EMBEDDING_DIMENSION): number[] {
  return new Array(dimension).fill(0.1234);
}

describe("utilitaires d'embeddings", () => {
  it("chunkArray découpe correctement les listes", () => {
    const items = [1, 2, 3, 4, 5];
    assert.deepEqual(chunkArray(items, 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(chunkArray(items, 10), [[1, 2, 3, 4, 5]]);
    assert.deepEqual(chunkArray([], 2), []);
  });

  it("getGeminiApiKey extrait la clé fournie ou échoue clairement", () => {
    assert.equal(getGeminiApiKey("my-test-key"), "my-test-key");

    const oldKey = process.env.GEMINI_API_KEY;
    const oldGoogle = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    assert.throws(
      () => getGeminiApiKey(),
      (err: unknown) => {
        assert(err instanceof EmbeddingError);
        assert.equal(err.code, "MISSING_KEY");
        assert.match(err.message, /GEMINI_API_KEY/);
        return true;
      },
    );

    process.env.GEMINI_API_KEY = oldKey;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = oldGoogle;
  });

  it("isRateLimitError détecte 429 et les messages de quota", () => {
    assert.equal(isRateLimitError(new Error("Resource exhausted: 429 quota")), true);
    assert.equal(isRateLimitError({ status: 429, message: "Too Many Requests" }), true);
    assert.equal(isRateLimitError(new Error("Invalid parameter")), false);
    assert.equal(isRateLimitError(null), false);
  });
});

describe("generateEmbeddings (Gemini text-embedding-004)", () => {
  it("renvoie une liste vide quand la liste de textes est vide", async () => {
    const vectors = await generateEmbeddings({ texts: [], apiKey: "dummy" });
    assert.deepEqual(vectors, []);
  });

  it("génère les vecteurs 768d pour un ensemble de textes", async () => {
    const texts = ["Morceau 1", "Morceau 2"];
    const customEmbedMany = async ({ values }: { values: string[] }) => {
      return {
        embeddings: values.map(() => createDummyVector()),
      };
    };

    const vectors = await generateEmbeddings({
      texts,
      apiKey: "dummy-key",
      customEmbedMany,
    });

    assert.equal(vectors.length, 2);
    assert.equal(vectors[0].length, 768);
    assert.equal(vectors[1].length, 768);
  });

  it("découpe en batches de taille max (ex: batchSize = 2)", async () => {
    const texts = ["T1", "T2", "T3", "T4", "T5"];
    const calls: number[] = [];

    const customEmbedMany = async ({ values }: { values: string[] }) => {
      calls.push(values.length);
      return {
        embeddings: values.map(() => createDummyVector()),
      };
    };

    const vectors = await generateEmbeddings({
      texts,
      apiKey: "dummy-key",
      batchSize: 2,
      customEmbedMany,
    });

    assert.deepEqual(calls, [2, 2, 1]);
    assert.equal(vectors.length, 5);
  });

  it("rejoue avec backoff sur une erreur transitoire de rate limit (429)", async () => {
    let callCount = 0;
    const sleepDelays: number[] = [];

    const customEmbedMany = async ({ values }: { values: string[] }) => {
      callCount += 1;
      if (callCount <= 2) {
        throw new Error("429 Too Many Requests: Quota exceeded");
      }
      return {
        embeddings: values.map(() => createDummyVector()),
      };
    };

    const vectors = await generateEmbeddings({
      texts: ["Morceau avec retry"],
      apiKey: "dummy-key",
      maxRetries: 3,
      initialBackoffMs: 10,
      sleep: async (ms) => {
        sleepDelays.push(ms);
      },
      customEmbedMany,
    });

    assert.equal(callCount, 3); // 2 échecs + 1 succès
    assert.equal(sleepDelays.length, 2);
    assert(sleepDelays[0] >= 10);
    assert(sleepDelays[1] >= 20);
    assert.equal(vectors.length, 1);
  });

  it("lève une EmbeddingError RATE_LIMIT si les retries sont épuisés", async () => {
    const customEmbedMany = async () => {
      throw new Error("429 RESOURCE_EXHAUSTED");
    };

    await assert.rejects(
      async () => {
        await generateEmbeddings({
          texts: ["Morceau bloqué"],
          apiKey: "dummy-key",
          maxRetries: 2,
          initialBackoffMs: 1,
          sleep: async () => {},
          customEmbedMany,
        });
      },
      (err: unknown) => {
        assert(err instanceof EmbeddingError);
        assert.equal(err.code, "RATE_LIMIT");
        return true;
      },
    );
  });

  it("rejette immédiatement si la dimensionnalité est incorrecte", async () => {
    const customEmbedMany = async ({ values }: { values: string[] }) => {
      return {
        embeddings: values.map(() => createDummyVector(512)), // Erreur: 512 au lieu de 768
      };
    };

    await assert.rejects(
      async () => {
        await generateEmbeddings({
          texts: ["Texte test"],
          apiKey: "dummy-key",
          customEmbedMany,
        });
      },
      (err: unknown) => {
        assert(err instanceof EmbeddingError);
        assert.equal(err.code, "INVALID_DIMENSION");
        return true;
      },
    );
  });
});
