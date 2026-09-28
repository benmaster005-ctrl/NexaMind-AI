// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Audit de la garde de routes (plan 1.3, FR-3).
 * Execute avec `npm run test:guard` (node --test, sans dependance).
 *
 * La fonction decideRouteGuard est pure : chaque ligne de la matrice I/O
 * est verifiee sans reseau ni ecriture distante.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { decideRouteGuard } from "../lib/auth/route-guard.ts";

describe("decideRouteGuard (plan 1.3)", () => {
  it("laisse passer les pages publiques meme sans session", () => {
    for (const pathname of ["/login", "/register", "/auth/callback"]) {
      assert.deepEqual(
        decideRouteGuard({ pathname, hasSession: false, role: null }),
        { allowed: true },
      );
    }
  });

  it("redirige / vers /login sans session (y compris session expiree)", () => {
    assert.deepEqual(
      decideRouteGuard({ pathname: "/", hasSession: false, role: null }),
      { allowed: false, redirectTo: "/login" },
    );
  });

  it("laisse passer / avec session collaborateur ou admin", () => {
    for (const role of ["collaborateur", "admin", " Admin "]) {
      assert.deepEqual(
        decideRouteGuard({ pathname: "/", hasSession: true, role }),
        { allowed: true },
      );
    }
  });

  it("redirige /admin/* vers /login sans session", () => {
    assert.deepEqual(
      decideRouteGuard({
        pathname: "/admin/resources",
        hasSession: false,
        role: null,
      }),
      { allowed: false, redirectTo: "/login" },
    );
  });

  it("redirige /admin/* vers / avec un role non-admin", () => {
    for (const role of ["collaborateur", null, undefined, ""]) {
      assert.deepEqual(
        decideRouteGuard({
          pathname: "/admin/resources",
          hasSession: true,
          role,
        }),
        { allowed: false, redirectTo: "/" },
      );
    }
  });

  it("laisse passer /admin/* avec le role admin", () => {
    assert.deepEqual(
      decideRouteGuard({
        pathname: "/admin/resources",
        hasSession: true,
        role: "admin",
      }),
      { allowed: true },
    );
  });

  it("laisse passer les routes inconnues (ex. /_not-found)", () => {
    assert.deepEqual(
      decideRouteGuard({
        pathname: "/_not-found",
        hasSession: false,
        role: null,
      }),
      { allowed: true },
    );
  });

  // R-1 : toute page applicative exige une session. Detecte par la
  // validation MVP (2026-09-27) : /search, /chat et /history repondaient
  // 200 sans session.
  it("redirige les pages applicatives vers /login sans session", () => {
    for (const pathname of [
      "/search",
      "/chat",
      "/chat/abc",
      "/history",
      "/resources",
      "/resources/abc",
    ]) {
      assert.deepEqual(
        decideRouteGuard({ pathname, hasSession: false, role: null }),
        { allowed: false, redirectTo: "/login" },
        pathname,
      );
    }
  });

  it("laisse passer les pages applicatives avec session", () => {
    for (const pathname of ["/search", "/chat/abc", "/history", "/resources/abc"]) {
      assert.deepEqual(
        decideRouteGuard({ pathname, hasSession: true, role: "collaborateur" }),
        { allowed: true },
        pathname,
      );
    }
  });

  it("ne confond pas un prefixe avec un chemin voisin", () => {
    // /searchxyz et /chatterie ne sont pas des pages de recherche/chat.
    for (const pathname of ["/chatterie", "/searchx"]) {
      assert.deepEqual(
        decideRouteGuard({ pathname, hasSession: false, role: null }),
        { allowed: true },
        pathname,
      );
    }
  });
});