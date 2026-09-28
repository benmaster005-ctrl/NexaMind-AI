// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Audit de la matrice I/O du plan 1.2 : garde anti-bruteforce.
 * Exécuté avec `npm run test:rate-limit` (node --test, sans dépendance).
 *
 * Ligne couverte : "5 échecs consécutifs -> blocage temporaire".
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checkRateLimit,
  recordFailure,
  recordSuccess,
  resetRateLimitForTests,
  RATE_LIMIT_MAX_ATTEMPTS,
} from "../lib/auth/rate-limit.ts";

describe("rate-limit (plan 1.2)", () => {
  it("autorise les tentatives sous le seuil de 5 échecs", () => {
    resetRateLimitForTests();
    const decision = checkRateLimit("audit@example.fr");
    assert.equal(decision.allowed, true);
    assert.equal(decision.remainingAttempts, RATE_LIMIT_MAX_ATTEMPTS);
  });

  it("bloque temporairement après 5 échecs consécutifs", () => {
    resetRateLimitForTests();
    const key = "bruteforce@example.fr";
    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      recordFailure(key);
    }
    const decision = checkRateLimit(key);
    assert.equal(decision.allowed, false);
    assert.equal(decision.remainingAttempts, 0);
    assert.ok(decision.retryAfterSeconds > 0);
  });

  it("réinitialise le compteur après un succès", () => {
    resetRateLimitForTests();
    const key = "quasiment-bloque@example.fr";
    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS - 1; i++) {
      recordFailure(key);
    }
    recordSuccess(key);
    const decision = checkRateLimit(key);
    assert.equal(decision.allowed, true);
    assert.equal(decision.remainingAttempts, RATE_LIMIT_MAX_ATTEMPTS);
  });
});
