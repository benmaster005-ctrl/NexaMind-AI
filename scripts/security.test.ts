// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Audit statique de securite (2026-09-27, relu le 2026-09-29).
 *
 * Execute avec `npm run test:security`, hors reseau. Il verrouille :
 *   1. l'absence totale de mecanique de role dans le code applicatif
 *      (la gestion des roles a ete supprimee le 2026-09-29) ;
 *   2. le verrou de l'anonyme : toute ecriture reste `to authenticated` ;
 *   3. les en-tetes de securite HTTP poses par next.config.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

/** Liste recursive des sources applicatives (hors tests). */
function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(join(root, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(root, rel)).isDirectory()) sourceFiles(rel, acc);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) acc.push(rel);
  }
  return acc;
}

const SOURCES = [
  ...sourceFiles("app"),
  ...sourceFiles("lib"),
  ...sourceFiles("components"),
  // Next 16 : la convention `middleware.ts` est devenue `proxy.ts`.
  "proxy.ts",
];

/**
 * Code sans commentaires : les commentaires citent volontairement
 * `user_metadata` (et `dangerouslySetInnerHTML`) pour expliquer les
 * interdictions — un audit doit porter sur le code, pas sur la prose.
 */
function codeOnly(file) {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    // `[^\n]*` et non `.*$` : les fichiers sont en CRLF, `$` ne matche pas
    // avant le `\r` et le commentaire passerait intact.
    .map((line) => line.replace(/(^|[^:])\/\/[^\n]*/, "$1"))
    .join("\n");
}

describe("1. Suppression de la gestion des roles", () => {
  it("aucune source applicative ne manipule de role", () => {
    // Plus de `app_metadata`/`user_metadata` de role, plus de helper de role :
    // l'autorisation repose uniquement sur « session presente ou non ».
    const rolePattern = /app_metadata|user_metadata|isAdminRole|normalizeUserRole|is_admin/;
    const offenders = SOURCES.filter((file) => rolePattern.test(codeOnly(file)));
    assert.deepEqual(offenders, [], `role encore lu dans : ${offenders.join(", ")}`);
  });

  it("le depot documentaire n'est plus conditionne a un role", () => {
    const upload = codeOnly("app/(dashboard)/documents/actions.ts");
    assert.ok(
      !/role|isAdmin|is_admin/.test(upload),
      "l'action de depot ne doit plus tester de role",
    );
    // Seule condition d'acces : une session.
    assert.match(read("app/(dashboard)/documents/actions.ts"), /if \(!user\)/);
  });

  it("l'inscription n'envoie aucun role au client", () => {
    const auth = read("app/(auth)/actions.ts");
    assert.ok(
      !/options:\s*\{\s*data:\s*\{\s*role/.test(auth),
      "l'inscription ne doit pas proposer de role",
    );
  });

  it("la migration 0009 retire la fonction et le trigger de role", () => {
    const sql = read("supabase/migrations/0009_open_writes_no_roles.sql");
    assert.match(sql, /drop function if exists public\.is_admin\(\)/);
    assert.match(sql, /drop trigger if exists on_auth_user_created on auth\.users/);
  });
});

describe("2. RLS : l'anonyme reste verrouille, l'ecriture est ouverte aux authentifies", () => {
  const lower = read("supabase/migrations/0009_open_writes_no_roles.sql").toLowerCase();

  it("aucune policy d'ecriture n'est exposee a l'anonyme ou au public", () => {
    // `to authenticated` est obligatoire sur toute ecriture : c'est la seule
    // barriere restante apres la suppression des roles.
    const statements = lower
      .split(";")
      .map((s) => s.trim())
      .filter((s) => /^create policy/.test(s));
    assert.ok(statements.length >= 8, `policies trop peu nombreuses : ${statements.length}`);
    for (const statement of statements) {
      if (!/\bfor (insert|update|delete|all)\b/.test(statement)) continue;
      assert.match(
        statement,
        /to authenticated/,
        `policy d'ecriture non restreinte aux authentifies : ${statement.replace(/\s+/g, " ")}`,
      );
      assert.ok(
        !/\bto (anon|public)\b/.test(statement),
        `policy d'ecriture accessible en lecture publique : ${statement.replace(/\s+/g, " ")}`,
      );
    }
  });

  it("l'ecriture documentaire couvre les trois tables attendues", () => {
    for (const table of ["public.resources", "public.document_chunks", "storage.objects"]) {
      const writes = lower
        .split(";")
        .map((s) => s.trim())
        .filter((s) => /^create policy/.test(s) && s.includes(`on ${table}`))
        .filter((s) => /for (insert|update|delete|all)/.test(s));
      assert.ok(writes.length > 0, `aucune ecriture rouverte sur ${table}`);
    }
  });

  it("l'historique reste strictement personnel (R-7)", () => {
    // La 0009 ne doit toucher ni conversations, ni messages, ni recherches.
    for (const table of ["conversations", "messages", "search_history"]) {
      assert.ok(
        !lower.includes(`on public.${table}`),
        `${table} ne doit pas etre reecrite par la migration des roles`,
      );
    }
  });
});

describe("3. En-tetes de securite HTTP", () => {
  const config = read("next.config.ts");

  it("pose CSP, anti-framing et anti-sniffing", () => {
    for (const needle of [
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "poweredByHeader: false",
    ]) {
      assert.ok(config.includes(needle), `en-tete manquant : ${needle}`);
    }
  });

  it("n'autorise pas une origine arbitraire dans connect-src", () => {
    assert.match(config, /connect-src 'self' \$\{supabaseOrigin\}/);
    assert.ok(!/connect-src[^`]*\*/.test(config), "connect-src ne doit pas etre un joker");
  });
});

describe("4. Secrets et rendu", () => {
  it("aucune cle Gemini dans un composant client", () => {
    for (const file of SOURCES.filter((f) => f.startsWith("components"))) {
      assert.ok(
        !/GEMINI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY/.test(read(file)),
        `cle secrate referencee dans ${file}`,
      );
    }
  });

  it("aucun HTML brut rendu (dangerouslySetInnerHTML)", () => {
    const offenders = SOURCES.filter((file) => /dangerouslySetInnerHTML/.test(codeOnly(file)));
    assert.deepEqual(offenders, [], offenders.join(", "));
  });
});
