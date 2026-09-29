/**
 * Validation LIVE du pipeline assistant chat RAG (Epic 4) contre le serveur
 * dev + le vrai projet Supabase + l'API Gemini.
 *
 * Chaîne vérifiée :
 *   1. Session auth réelle (compte existant via VALIDATE_EMAIL/VALIDATE_PASSWORD,
 *      sinon création d'un compte de test horodaté).
 *   2. Accès DB aux ressources/morceaux (« le système a bien accès ») +
 *      migration 0006 (colonne messages.meta) + fichier Storage signé.
 *   3. GET /api/search : hit sémantique >= 0.65 sur une question tirée du
 *      contenu réel d'une ressource « Prête ».
 *   4. POST /api/chat : réponse fondée avec citations + conversationId.
 *   5. Reprise de conversation (conversationId) + persistance des messages.
 *   6. Abstention sur question hors périmètre (zéro-hallucination).
 *   7. Garde 401 sans session.
 *
 * Usage : npm run validate:chat-live  (le serveur dev doit tourner sur :3000)
 * Écrit : un compte de test, une conversation + messages (supprimables).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// Charge .env.local (pattern identique à scripts/check-supabase.mjs).
try {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = join(root, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
} catch {
  // Le contrôle ci-dessous signalera les variables manquantes.
}

const URL_SB = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const ANON = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""
).trim();
const APP = (process.env.VALIDATE_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const THRESHOLD = 0.65;
const TIMEOUT_MS = 120_000;

if (!URL_SB || !ANON) {
  console.error("MANQUANT : NEXT_PUBLIC_SUPABASE_URL / clé publique dans .env.local");
  process.exit(1);
}

/** Registre des vérifications ✅/❌ (nom, ok, détail). */
const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}
function skip(name, detail) {
  console.log(`⚠️  ${name} — ${detail}`);
}

/** Bocal cookies @supabase/ssr : la session devient un en-tête Cookie réel. */
const jar = new Map();
const ssr = createServerClient(URL_SB, ANON, {
  cookies: {
    getAll: () => [...jar.entries()].map(([ name, value ]) => ({ name, value })),
    setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
  },
});

function cookieHeader() {
  return [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

/** Analyse le corps NDJSON : renvoie { meta, text, done, error }. */
function parseNdjson(body) {
  const out = { meta: null, text: "", done: false, error: null };
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const evt = JSON.parse(trimmed);
      if (evt.type === "meta") out.meta = evt;
      else if (evt.type === "text") out.text += evt.text ?? "";
      else if (evt.type === "done") out.done = true;
      else if (evt.type === "error") out.error = evt.message ?? "erreur inconnue";
    } catch {
      // Ligne partielle / parasite : ignorée (le parse complet est plus bas).
    }
  }
  return out;
}


// ---------------------------------------------------------------------------
// 1. Session auth réelle
// ---------------------------------------------------------------------------
async function authenticate() {
  const emailEnv = (process.env.VALIDATE_EMAIL ?? "").trim();
  const passwordEnv = (process.env.VALIDATE_PASSWORD ?? "").trim();
  if (emailEnv && passwordEnv) {
    const { data, error } = await ssr.auth.signInWithPassword({
      email: emailEnv,
      password: passwordEnv,
    });
    if (error || !data.session) {
      check("Connexion au compte fourni (VALIDATE_EMAIL)", false, error?.message ?? "session absente");
      return null;
    }
    check("Connexion au compte fourni (VALIDATE_EMAIL)", true, emailEnv);
    return data.session;
  }
  // Compte de test horodaté (aucun compte réel touché).
  const email = `nexamind.e2e+${Date.now()}@example.com`;
  const { data, error } = await ssr.auth.signUp({
    email,
    password: "NexaMind-E2E-2026!",
    options: { data: { role: "collaborateur" } },
  });
  if (error) {
    check("Création du compte de test", false, error.message);
    return null;
  }
  if (!data.session) {
    check(
      "Création du compte de test",
      false,
      "confirmation e-mail requise par Supabase : relancez avec VALIDATE_EMAIL=... VALIDATE_PASSWORD=... (votre compte existant)",
    );
    return null;
  }
  check("Création du compte de test", true, email);
  return data.session;
}

const session = await authenticate();
if (!session) {
  console.error("\nImpossible d'établir une session : validation interrompue.");
  process.exit(1);
}

/** Client DB avec le jeton de l'utilisateur (RLS = comportement réel app). */
const db = createClient(URL_SB, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${session.access_token}` } },
});

// ---------------------------------------------------------------------------
// 2. Accès aux données : ressources, morceaux, migration 0006, Storage
// ---------------------------------------------------------------------------
const { data: resources, error: resErr } = await db
  .from("resources")
  .select("id, title, status, chunk_count, error_message, storage_path, created_at");
check(
  "Lecture table resources (RLS authentifié)",
  !resErr && Array.isArray(resources),
  resErr ? resErr.message : `${resources.length} ligne(s)`,
);
const allResources = resources ?? [];
for (const r of allResources) {
  console.log(
    `   • "${r.title}" — statut=${r.status} chunks=${r.chunk_count}` +
      (r.error_message ? ` erreur=${r.error_message}` : ""),
  );
}

// Migration 0006 : la colonne meta doit exister (sinon persistance citations KO).
const metaProbe = await db.from("messages").select("meta").limit(1);
check(
  "Migration 0006 jouée (colonne messages.meta)",
  !metaProbe.error,
  metaProbe.error
    ? `${metaProbe.error.message} → jouez supabase/migrations/0006_message_meta.sql dans le SQL Editor`
    : "colonne présente",
);

// Migration 0005 : la fonction RPC match_chunks doit exister (recherche sémantique).
const { error: rpcProbeErr } = await db.rpc("match_chunks", {
  query_embedding: new Array(768).fill(0),
  match_threshold: 1,
  match_count: 1,
});
const rpcMissing = Boolean(rpcProbeErr && rpcProbeErr.code === "PGRST202");
check(
  "Migration 0005 jouée (RPC match_chunks)",
  !rpcProbeErr,
  rpcMissing
    ? "fonction absente → jouez supabase/migrations/0005_match_chunks.sql dans le SQL Editor"
    : rpcProbeErr
      ? rpcProbeErr.message
      : "fonction présente",
);

const ready = allResources.filter((r) => r.status === "Prête" && r.chunk_count > 0);
check(
  "Au moins une ressource « Prête » avec morceaux indexés",
  ready.length > 0,
  ready.length > 0
    ? ready.map((r) => `"${r.title}"`).join(", ")
    : "aucune : deposez un document via /documents puis relancez",
);

// Morceaux vectorisés : preuve que le contenu indexé est lisible.
let seedChunk = null;
if (ready.length > 0) {
  const { data: chunks, error: chunkErr } = await db
    .from("document_chunks")
    .select("id, resource_id, chunk_index, content, embedding")
    .eq("resource_id", ready[0].id)
    .order("chunk_index", { ascending: true })
    .limit(5);
  const hasEmbedding = !chunkErr && (chunks ?? []).some((c) => c.embedding !== null);
  check(
    "Lecture des morceaux (document_chunks) + embedding stocké",
    !chunkErr && (chunks ?? []).length > 0 && hasEmbedding,
    chunkErr
      ? chunkErr.message
      : `${chunks.length} morceau(x), embedding: ${hasEmbedding ? "present" : "ABSENT"}`,
  );
  seedChunk = chunks?.[0] ?? null;
  if (seedChunk) {
    console.log(`   • Extrait : "${seedChunk.content.slice(0, 160).replace(/\s+/g, " ")}…"`);
  }
} else {
  skip("Lecture des morceaux", "aucune ressource Prête à interroger");
}

// Accès au fichier brut (re-ingestion possible).
const withFile = ready.find((r) => r.storage_path);
if (withFile) {
  const { data: signed, error: signErr } = await db.storage
    .from("documents")
    .createSignedUrl(withFile.storage_path, 60);
  check(
    "Fichier Storage accessible (URL signée documents/)",
    !signErr && !!signed?.signedUrl,
    signErr ? signErr.message : "URL signée générée",
  );
} else {
  skip("Fichier Storage", "aucune ressource Prête avec storage_path");
}

// Question tirée du contenu réel (garde <= 500 car /api/search borne à 500).
const seedResource = ready[0];
let groundedQuestion = "";
if (seedChunk && seedResource) {
  const phrase = seedChunk.content.replace(/\s+/g, " ").trim();
  const budget = Math.max(80, 460 - seedResource.title.length);
  groundedQuestion = `D'après le document « ${seedResource.title} », ${phrase.slice(0, budget)}`;
  console.log(`\n📌 Question de contrôle tirée du document :`);
  console.log(`   "${groundedQuestion.slice(0, 300)}…"\n`);
}

// ---------------------------------------------------------------------------
// 3. Tests HTTP contre le serveur dev (cookies de session réels)
// ---------------------------------------------------------------------------
async function postChat(body, cookies = cookieHeader()) {
  const res = await fetch(`${APP}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const raw = await res.text();
  return { status: res.status, raw, parsed: parseNdjson(raw) };
}

// 3.1 Garde d'authentification : sans session -> 401 (AD-2).
{
  const res = await fetch(`${APP}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "test sans session" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  check("POST /api/chat sans session -> 401", res.status === 401, `HTTP ${res.status}`);
}

// 3.2 Recherche sémantique : la question tirée du document retrouve le document.
if (groundedQuestion) {
  const res = await fetch(`${APP}/api/search?q=${encodeURIComponent(groundedQuestion)}`, {
    headers: { Cookie: cookieHeader() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // corps illisible : détail ci-dessous
  }
  const top = body?.results?.[0];
  const semantic = top?.matchKind === "semantic";
  const above = typeof top?.similarity === "number" && top.similarity >= THRESHOLD;
  check(
    "GET /api/search : hit sémantique >= 0.65 sur le document",
    res.status === 200 && semantic && above,
    res.status !== 200
      ? `HTTP ${res.status} ${body?.error ?? ""}`
      : top
        ? `similarity=${Number(top.similarity).toFixed(3)} matchKind=${top.matchKind} title="${top.title}"`
        : "0 résultat (embedding/RPC KO ou ressource non indexée)",
  );
}

// 3.3 Chat fondé : réponse streamée + citations + conversation créée.
let firstConversationId = null;
if (groundedQuestion) {
  const { status, raw, parsed } = await postChat({ question: groundedQuestion });
  const okMeta =
    parsed.meta &&
    parsed.meta.abstained === false &&
    (parsed.meta.citations?.length ?? 0) > 0;
  check(
    "POST /api/chat : réponse fondée (abstained=false, citations>0, done)",
    status === 200 && okMeta && parsed.done && !parsed.error,
    status !== 200
      ? `HTTP ${status} ${parsed.error ?? raw.slice(0, 200)}`
      : `citations=${parsed.meta?.citations?.length ?? 0} réponse=${parsed.text.length} caractères`,
  );
  if (parsed.meta?.citations?.[0]) {
    const cite = parsed.meta.citations[0];
    console.log(`   • Source 1 : "${cite.title}" (chunk ${cite.chunkId ?? "n/a"})`);
    console.log(`     Extrait : ${String(cite.excerpt ?? "").slice(0, 140)}…`);
  }
  if (parsed.text) {
    console.log(`   • Réponse : "${parsed.text.slice(0, 200).replace(/\s+/g, " ")}…"`);
  }
  check(
    "POST /api/chat : conversationId persisté remonté dans meta",
    typeof parsed.meta?.conversationId === "string" && parsed.meta.conversationId.length > 0,
    parsed.meta?.conversationId ?? "absent (persistance 4.4 KO ?)",
  );
  firstConversationId = parsed.meta?.conversationId ?? null;

  // 3.4 Suivi dans la même conversation : l'historique DB est réinjecté.
  const follow = await postChat({
    question: "Peux-tu résumer ta réponse en une seule phrase ?",
    conversationId: firstConversationId,
  });
  check(
    "POST /api/chat : reprise de conversation (conversationId conservé)",
    follow.status === 200 &&
      follow.parsed.meta?.conversationId === firstConversationId,
    `HTTP ${follow.status}, conversationId=${follow.parsed.meta?.conversationId ?? "absent"}`,
  );
}


// 3.5 Persistance : messages user + assistant avec meta citations (story 4.4).
if (firstConversationId) {
  // Laisse un instant à l'insertion best effort exécutée avant close().
  await new Promise((r) => setTimeout(r, 800));
  const { data: rows, error: msgErr } = await db
    .from("messages")
    .select("role, content, meta, created_at")
    .eq("conversation_id", firstConversationId)
    .order("created_at", { ascending: true });
  const userRows = (rows ?? []).filter((m) => m.role === "user");
  const assistantRows = (rows ?? []).filter((m) => m.role === "assistant");
  const metaOk =
    assistantRows.length > 0 &&
    assistantRows.every((m) => Array.isArray(m.meta?.citations));
  check(
    "Persistance : messages user+assistant avec meta.citations (4.4)",
    !msgErr && userRows.length >= 2 && assistantRows.length >= 2 && metaOk,
    msgErr
      ? msgErr.message
      : `user=${userRows.length} assistant=${assistantRows.length} meta.citations présent sur ${assistantRows.filter((m) => Array.isArray(m.meta?.citations)).length}/${assistantRows.length}`,
  );
}

// 3.6 Abstention : question hors périmètre -> formule standard, 0 citation.
{
  const out = await postChat({
    question: "Quel temps fera-t-il à Melbourne mercredi prochain ?",
  });
  const ok =
    out.status === 200 &&
    out.parsed.meta?.abstained === true &&
    (out.parsed.meta?.citations?.length ?? 0) === 0 &&
    out.parsed.text.length > 0 &&
    out.parsed.done;
  check(
    "POST /api/chat : abstention hors périmètre (zéro-hallucination)",
    ok,
    `HTTP ${out.status} abstained=${out.parsed.meta?.abstained} citations=${out.parsed.meta?.citations?.length ?? 0} texte=${out.parsed.text.length}`,
  );
  if (out.parsed.text) {
    console.log(`   • Réponse : "${out.parsed.text.slice(0, 140).replace(/\s+/g, " ")}…"`);
  }
}

// ---------------------------------------------------------------------------
// 4. Synthèse
// ---------------------------------------------------------------------------
const failed = checks.filter((c) => !c.ok);
console.log(`\n${"─".repeat(64)}`);
console.log(
  `VALIDATION CHAT RAG : ${checks.length - failed.length}/${checks.length} vérifications OK`,
);
if (failed.length > 0) {
  console.log("À corriger :");
  for (const f of failed) {
    console.log(`  ❌ ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
  }
}
process.exit(failed.length > 0 ? 1 : 0);


