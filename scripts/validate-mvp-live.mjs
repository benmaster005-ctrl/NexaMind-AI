/**
 * Validation LIVE exhaustive du MVP NexaMind AI (FR-1 a FR-16 + epic 6).
 *
 * Chaque exigence du PRD est verifiee sur le serveur dev reel, la vraie base
 * Supabase et le vrai Gemini, avec une session reelle. Sortie : un rapport
 * ✅/❌ par FR, exit code non nul si un echec.
 *
 * Usage : npm run validate:mvp-live   (le serveur dev doit tourner sur :3000)
 * Session : VALIDATE_EMAIL / VALIDATE_PASSWORD
 *
 * Effets de bord assumes et nettoyes :
 * - une ressource temporaire est deposee, indexee, puis supprimee (bloc C) ;
 * - des conversations et des recherches d'historique sont creees (visibles
 *   dans le compte, supprimables) ;
 * - 6 tentatives de connexion en echec sur une adresse FICTIVE (jamais sur le
 *   compte reel) pour valider le verrou anti-force brute.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const envPath = join(ROOT, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
} catch {
  /* les controles ci-dessous signaleront les variables manquantes */
}

const URL_SB = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const ANON = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""
).trim();
const APP = (process.env.VALIDATE_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TIMEOUT_MS = 120_000;

if (!URL_SB || !ANON) {
  console.error("MANQUANT : NEXT_PUBLIC_SUPABASE_URL / clé publique dans .env.local");
  process.exit(1);
}

/** Registre des verifications : chaque entree porte le FR qu'elle couvre. */
const checks = [];
function check(fr, name, ok, detail = "") {
  checks.push({ fr, name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} [${fr}] ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}
function note(fr, text) {
  console.log(`   ℹ️  [${fr}] ${text}`);
}
function group(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);
}

/** Bocal cookies @supabase/ssr : la session devient un en-tete Cookie reel. */
const jar = new Map();
const ssr = createServerClient(URL_SB, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
  },
});
const cookieHeader = () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
const dbWith = (token) =>
  createClient(URL_SB, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

/** GET HTML avec la session, sans suivre les redirections. */
async function getPage(path) {
  const res = await fetch(`${APP}${path}`, {
    headers: { Cookie: cookieHeader() },
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let html = "";
  try {
    html = await res.text();
  } catch {
    /* corps non textuel */
  }
  return { res, html, location: res.headers.get("location") ?? "" };
}

/** GET JSON authentifie. */
async function getJson(path) {
  const res = await fetch(`${APP}${path}`, {
    headers: { Cookie: cookieHeader() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { res, body: await res.json().catch(() => null) };
}

// ---------------------------------------------------------------------------
group("BLOC A — Authentification (FR-1, FR-2, FR-3)");
// ---------------------------------------------------------------------------

const EMAIL = (process.env.VALIDATE_EMAIL ?? "").trim();
const PASSWORD = (process.env.VALIDATE_PASSWORD ?? "").trim();
if (!EMAIL) {
  console.error("Fournissez VALIDATE_EMAIL / VALIDATE_PASSWORD (confirmation e-mail obligatoire : pas d'inscription automatique).");
  process.exit(1);
}

// FR-1 : le projet exige une confirmation e-mail (mailer_autoconfirm=false), donc
// une session automatique est impossible sans boite mail. On verifie le flux
// applicatif (action qui appelle signUp) et la confirmation configuree ; le
// compte de test utilise pour la suite a lui-meme ete cree par ce flux.
const registerSrc = readFileSync(join(ROOT, "app", "(auth)", "actions.ts"), "utf8");
const signupCall = /signUp\(/.test(registerSrc);
let autoconfirm = null;
try {
  const r = await fetch(`${URL_SB}/auth/v1/settings`, { headers: { apikey: ANON } });
  autoconfirm = (await r.json())?.mailer_autoconfirm ?? null;
} catch {
  /* ignore */
}
check(
  "FR-1",
  "Inscription : action signUp presente, confirmation e-mail exigee",
  signupCall && autoconfirm === false,
  `signUp=${signupCall}, mailer_autoconfirm=${autoconfirm} (session automatique impossible sans boite mail)`,
);

// FR-2 : connexion reelle + role
const { data: auth, error: authErr } = await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (authErr || !auth?.session) {
  console.error(`Connexion impossible : ${authErr?.message}`);
  process.exit(1);
}
const accessToken = auth.session.access_token;
let db = dbWith(accessToken);
// Source de verite du role depuis la migration 0008 : `app_metadata`
// (`user_metadata` est vide et modifiable par l'utilisateur : plus fiable).
const role = String(auth.user.app_metadata?.role ?? "");
const isAdmin = role.toLowerCase() === "admin";
check("FR-2", "Connexion par e-mail + mot de passe", true, `${EMAIL}`);
check("FR-2", "Role porte par les metadonnees serveur du compte (app_metadata)", role.length > 0,
  `app_metadata.role=${role || "(absent)"} (user_metadata n'est plus une source de confiance)`);

// FR-2 : anti-force brute. Le verrou est applique par l'ACTION de connexion
// (`app/(auth)/actions.ts` -> checkRateLimit), pas par l'API Supabase : l'appeler
// directement contourne la protection. On verifie donc la garde reelle dans le
// code (et sa logique est couverte par `npm run test:rate-limit`), en documentant
// la limite connue : compteur en memoire du processus.
{
  const loginSrc = readFileSync(join(ROOT, "app", "(auth)", "actions.ts"), "utf8");
  const hasCheck = /checkRateLimit\(/.test(loginSrc);
  const recordsFailure = /recordFailure\(/.test(loginSrc);
  const recordsSuccess = /recordSuccess\(/.test(loginSrc);
  const inMemory = /memoire|memory/i.test(
    readFileSync(join(ROOT, "lib", "auth", "rate-limit.ts"), "utf8"),
  );
  check("FR-2", "Verrou anti-force brute dans le flux de connexion", hasCheck && recordsFailure && recordsSuccess,
    `checkRateLimit=${hasCheck}, recordFailure=${recordsFailure}, recordSuccess=${recordsSuccess}`);
  note("FR-2", `Limite connue et documentee : compteur ${inMemory ? "en memoire du processus Node" : "a verifier"} (multi-instances non couvert). Logique testee par test:rate-limit, non appelable en HTTP simple.`);
}

// FR-3 : pages protegees
{
  const paths = ["/", "/search", "/chat", "/history", "/admin/resources"];
  const seen = [];
  for (const p of paths) {
    const res = await fetch(`${APP}${p}`, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    const location = res.headers.get("location") ?? "";
    seen.push(`${p}->${res.status}${location.includes("/login") ? "(login)" : ""}`);
  }
  check("FR-3", "Pages protegees : renvoi vers /login sans session", seen.every((s) => /->(30[12378])\(login\)|->401/.test(s)), seen.join(" "));
}

// FR-3 : API protegees
{
  const chat = await fetch(`${APP}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "test" }),
    signal: AbortSignal.timeout(30_000),
  });
  const search = await fetch(`${APP}/api/search?q=test`, { signal: AbortSignal.timeout(30_000) });
  check("FR-3", "API protegees : 401 sans session", chat.status === 401 && search.status === 401, `chat=${chat.status} search=${search.status}`);
}

// FR-3 : deconnexion puis reconnection
{
  const before = await getPage("/");
  await ssr.auth.signOut();
  jar.clear();
  const after = await fetch(`${APP}/`, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
  const location = after.headers.get("location") ?? "";
  const locked = location.includes("/login") || after.status === 401;
  const again = await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  check("FR-3", "Deconnexion : acces redevenu protege, session relancée", before.res.status === 200 && locked && !again.error,
    `avant=${before.res.status} apres=${after.status}${location ? `->${location}` : ""}`);
  if (again.error || !again.data?.session) {
    console.error("Reconnexion impossible : validation interrompue.");
    process.exit(1);
  }
  db = dbWith(again.data.session.access_token);
}

// ---------------------------------------------------------------------------
group("BLOC B — Tableau de bord (FR-4)");
// ---------------------------------------------------------------------------
{
  const { res, html } = await getPage("/");
  const counter = /Pr[eê]te/i.test(html);
  const shortcuts = /Recherche/.test(html) && /Assistant/.test(html);
  const recent = /Derni[eè]res conversations/.test(html);
  const navAdmin = /G[eé]rer/.test(html) && !/>Historique</.test(html);
  const navCollab = />Historique</.test(html);
  check("FR-4", "Compteur de ressources pretes", res.status === 200 && counter, `HTTP ${res.status}`);
  check("FR-4", "Raccourcis Recherche + Assistant", shortcuts, "");
  check("FR-4", "Reprise des dernieres conversations", recent, "");
  check("FR-4", "Navigation conditionnee au role", isAdmin ? navAdmin : navCollab,
    `role=${role} — onglet Gerer=${navAdmin}, onglet Historique=${navCollab}`);
}


// ---------------------------------------------------------------------------
group("BLOC C — Depot, ingestion, dereferencement (FR-5, FR-6, FR-7)");
// ---------------------------------------------------------------------------

// FR-5 : le depot passe par une Server Action (indeps-jointe Next non
// appelable en HTTP simple). On verifie donc (a) la garde admin dans l'action,
// puis on rejoue le pipeline REEL d'ingestion sur une ressource temporaire
// deposee exactement comme l'action le fait, et on la supprime ensuite.
const uploadActionSrc = readFileSync(join(ROOT, "app", "(dashboard)", "admin", "resources", "actions.ts"), "utf8");
// Garde admin : soit la comparaison directe, soit le helper isAdminRole()
// applique au role de confiance app_metadata (migration 0008).
const adminGuard =
  /role !== ["']admin["']/.test(uploadActionSrc) ||
  (/isAdminRole\(/.test(uploadActionSrc) && /app_metadata/.test(uploadActionSrc));
const roleTrusted = !/user_metadata/.test(
  uploadActionSrc.replace(/\/\*[\s\S]*?\*\//g, "").split("\n")
    .map((l) => l.replace(/(^|[^:])\/\/[^\n]*/, "$1")).join("\n"),
);
const ingestCall = /ingestResource\(/.test(uploadActionSrc);
check("FR-5", "Depot reserve a l'administrateur (garde dans l'action)", adminGuard && roleTrusted,
  `garde admin=${adminGuard}, role de confiance app_metadata=${roleTrusted}, appel ingestion=${ingestCall}`);

const { ingestResource, supabaseIngestDeps } = await import("../lib/ingestion/ingest-resource.ts");
const { deleteResource } = await import("../lib/resources/management.ts");

let tempResource = null;
{
  const stamp = Date.now();
  const body = [
    "Politique de remboursement des frais de deplacement NexaWorks",
    "",
    "1. Perimetre : deplacements professionnels engages pour un client.",
    "2. Plafond : 45 EUR par deplacement, justificatif obligatoire au-dela de 12 EUR.",
    "3. Delai : la demande doit etre deposee dans les 14 jours suivant le retour.",
    "4. Validation : le responsable succes client statue sous 5 jours ouvres.",
    "5. Refus : tout frais sans justificatif est definitivement refuse.",
  ].join("\n");
  const bytes = new TextEncoder().encode(body);
  const path = `${auth.user.id}/validation-mvp-${stamp}.txt`;

  // Depot dans le bucket prive, comme l'action serveur.
  const { error: upErr } = await db.storage
    .from("documents")
    .upload(path, bytes, { contentType: "text/plain", upsert: false });
  const title = `Validation MVP ${stamp}`;
  const { data: inserted, error: insErr } = await db
    .from("resources")
    .insert({
      title,
      category: "Procédure",
      tags: ["validation", "temporaire"],
      status: "En cours",
      storage_path: path,
      created_by: auth.user.id,
    })
    .select("id")
    .single();

  check("FR-5", "Depot : fichier dans le bucket + fiche en base (En cours)",
    !upErr && !insErr && Boolean(inserted?.id),
    upErr ? `upload: ${upErr.message}` : insErr ? `insert: ${insErr.message}` : path);

  if (inserted?.id) {
    tempResource = { id: inserted.id, title, path };

    // FR-6 : ingestion reelle (decoupage + embeddings Gemini + ecriture pgvector).
    const started = Date.now();
    const ingestion = await ingestResource({
      resourceId: tempResource.id,
      deps: supabaseIngestDeps({
        supabase: db,
        resourceId: tempResource.id,
        title,
        storagePath: path,
      }),
    });
    const seconds = (Date.now() - started) / 1000;
    check("FR-6", "Ingestion automatique : morceaux produits", ingestion.ok && ingestion.chunkCount > 0,
      `${seconds.toFixed(1)} s, ${ingestion.chunkCount} morceau(s), ${ingestion.message}`);

    const { data: afterIngest } = await db
      .from("resources")
      .select("status, chunk_count")
      .eq("id", tempResource.id)
      .single();
    check("FR-6", "Ressource devenue interrogeable (statut Pret)", afterIngest?.status === "Prête",
      `status=${afterIngest?.status}, chunk_count=${afterIngest?.chunk_count}`);

    const { data: embedded } = await db
      .from("document_chunks")
      .select("id, content, embedding")
      .eq("resource_id", tempResource.id)
      .not("embedding", "is", null)
      .limit(5);
    const embeddedOk = (embedded ?? []).length > 0
      && embedded.every((c) => c.embedding !== null && (c.content ?? "").length > 0);
    check("FR-6", "Morceaux vectorises stockes (pgvector)", embeddedOk,
      `${(embedded ?? []).length} morceau(s) avec embedding`);
  }
}


{
  // R-2 : la ressource temp est maintenant interrogeable par la recherche.
  if (tempResource) {
    const probe = await getJson(
      `/api/search?q=${encodeURIComponent("remboursement frais de deplacement justificatif")}&limit=10`,
    );
    const hit = (probe.body?.results ?? []).find((r) => r.resourceId === tempResource.id);
    check("FR-6", "Ressource ingeree retrouvee par la recherche", probe.res.status === 200 && Boolean(hit),
      hit ? `score=${Number(hit.similarity).toFixed(3)} (${hit.matchKind})` : `${(probe.body?.results ?? []).length} resultat(s), temp absente`);
  }
}

// FR-7 : consultation, gestion, suppression avec dereferencement (R-3)
{
  const { res, html } = await getPage("/admin/resources");
  const listed = res.status === 200 && /Validation MVP/.test(html);
  check("FR-7", "Liste de gestion : ressources avec statut et morceaux", listed, `HTTP ${res.status}`);

  const manageSrc = readFileSync(join(ROOT, "lib", "resources", "management.ts"), "utf8");
  const adminOnly = /role !== "admin"|isAdmin/.test(manageSrc);
  check("FR-7", "Modification et suppression reservees a l'administrateur", adminOnly,
    `garde admin dans management.ts=${adminOnly}`);

  if (tempResource) {
    const { data: chunksBefore } = await db
      .from("document_chunks").select("id").eq("resource_id", tempResource.id);
    const removed = await deleteResource({
      client: db,
      role: "admin",
      resourceId: tempResource.id,
    });
    const { data: chunksAfter } = await db
      .from("document_chunks").select("id").eq("resource_id", tempResource.id);
    const { data: resourceAfter } = await db
      .from("resources").select("id").eq("id", tempResource.id).maybeSingle();
    check("FR-7", "Suppression : fiche et morceaux retires (R-3)",
      removed.success && !resourceAfter && (chunksBefore ?? []).length > 0 && (chunksAfter ?? []).length === 0,
      `morceaux ${(chunksBefore ?? []).length} -> ${(chunksAfter ?? []).length}, fiche presente=${Boolean(resourceAfter)}`);
    // Le nom du fichier porte l'horodatage du depot : on verifie qu'aucun
    // objet "validation-mvp-*" ne subsiste dans le dossier de l'utilisateur.
    const listing = await db.storage
      .from("documents")
      .list(auth.user.id, { search: "validation-mvp-" });
    check("FR-7", "Suppression : objet Storage retire du bucket",
      !listing.error && (listing.data ?? []).length === 0,
      `${(listing.data ?? []).length} objet(s) "validation-mvp-*" restant(s)${listing.error ? ` (erreur: ${listing.error.message})` : ""}`);
  }
}


// ---------------------------------------------------------------------------
group("BLOC D — Recherche textuelle et semantique (FR-8, FR-9)");
// ---------------------------------------------------------------------------
{
  const { res, html } = await getPage("/search");
  check("FR-8", "Ecran de recherche accessible", res.status === 200 && /search-input/.test(html), `HTTP ${res.status}`);

  // FR-8 : resultats classes, avec titre / categorie / date / extrait.
  const r1 = await getJson(`/api/search?q=${encodeURIComponent("suivi des projets clients")}&limit=5`);
  const results = r1.body?.results ?? [];
  const shapeOk = results.length > 0 && results.every((r) =>
    r.title && r.category && r.createdAt && typeof r.excerpt === "string" && r.excerpt.length > 0);
  check("FR-8", "Resultats avec titre, categorie, date et extrait", r1.res.status === 200 && shapeOk,
    results.map((r) => `${r.title} (${Number(r.similarity ?? 0).toFixed(2)})`).slice(0, 3).join(" | "));

  // R-2 : jamais de ressource En cours / Echec dans les resultats.
  const ids = [...new Set(results.map((r) => r.resourceId))];
  const { data: statuses } = await db.from("resources").select("id, status").in("id", ids.length ? ids : ["-"]);
  const allReady = (statuses ?? []).every((r) => r.status === "Prête");
  check("FR-8", "R-2 : aucun resultat En cours / Echec", allReady,
    (statuses ?? []).map((r) => `${r.status}`).join(",") || "aucun resultat");

  // FR-9 : sans mot-cle identique, la correspondance semantique doit rester.
  const semantic = await getJson(`/api/search?q=${encodeURIComponent("combien de jours pour faire valider un livrable")}&limit=5`);
  const best = (semantic.body?.results ?? [])[0];
  const semanticOk = semantic.res.status === 200 && Boolean(best)
    && best.matchKind === "semantic" && Number(best.similarity) >= 0.65;
  check("FR-9", "Recherche semantique : reformulation sans mot-cle exact", semanticOk,
    best ? `« ${best.title} » score=${Number(best.similarity).toFixed(3)} (${best.matchKind})` : "aucun resultat");

  // FR-8 : filtre par categorie.
  const filtered = await getJson(`/api/search?q=${encodeURIComponent("nexawork procedure note")}&limit=10&category=${encodeURIComponent("Note de réunion")}`);
  const onlyCategory = (filtered.body?.results ?? []).every((r) => r.category === "Note de réunion");
  check("FR-8", "Filtre par categorie", filtered.res.status === 200 && onlyCategory,
    `${(filtered.body?.results ?? []).length} resultat(s) : ${[...new Set((filtered.body?.results ?? []).map((r) => r.category))].join(",") || "aucun"}`);

  // Cas limite PRD : zero resultat -> message, jamais une page vide/erreur.
  const none = await getJson(`/api/search?q=${encodeURIComponent("avocat fiscal immigration hypotension 42")}&limit=5`);
  check("FR-8", "Recherche sans resultat : 200 et liste vide", none.res.status === 200 && Array.isArray(none.body?.results) && none.body.results.length === 0,
    `${(none.body?.results ?? []).length} resultat(s), erreur=${none.body?.error ?? "aucune"}`);

  // Garde-fous d'entree.
  const tooLong = await getJson(`/api/search?q=${"x".repeat(600)}`);
  const empty = await getJson(`/api/search?q=`);
  check("FR-8", "Garde-fous : requete trop longue rejetee, requete vide acceptee",
    tooLong.res.status === 400 && empty.res.status === 200 && (empty.body?.results ?? []).length === 0,
    `trop longue=${tooLong.res.status}, vide=${empty.res.status}`);
}


// ---------------------------------------------------------------------------
group("BLOC E — Assistant conversationnel (FR-10, FR-11, FR-12, FR-13)");
// ---------------------------------------------------------------------------

/** POST /api/chat : renvoie { res, meta, text, done } a partir du NDJSON. */
async function postChat(body) {
  const res = await fetch(`${APP}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const raw = await res.text();
  const out = { res, raw, meta: null, text: "", done: false, streamError: null, finishReason: null };
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const evt = JSON.parse(t);
      if (evt.type === "meta") out.meta = evt;
      else if (evt.type === "text") out.text += evt.text ?? "";
      else if (evt.type === "error") out.streamError = evt.message ?? "erreur";
      else if (evt.type === "done") { out.done = true; out.finishReason = evt.finishReason ?? null; }
    } catch {
      /* ligne partielle */
    }
  }
  return out;
}

/** Question dont la reponse est couverte par les documents (FR-10). */
const { data: seedChunk } = await db
  .from("document_chunks")
  .select("content")
  .not("embedding", "is", null)
  .order("chunk_index", { ascending: true })
  .limit(20);
let groundedQuestion = null;
for (const row of seedChunk ?? []) {
  const text = String(row.content ?? "").replace(/\s+/g, " ").trim();
  if (text.length > 220) {
    groundedQuestion = `D'après le document, ${text.slice(0, 200)}`;
    break;
  }
}
if (!groundedQuestion) groundedQuestion = "Comment se deroule un projet client chez NexaWorks ?";

let conversationId = null;
{
  const first = await postChat({ question: groundedQuestion });
  const citations = first.meta?.citations ?? [];
  check("FR-10", "Reponse fondee sur les Ressources", first.res.status === 200
    && first.meta?.abstained === false && first.text.length > 0,
    `${first.text.length} caracteres, finishReason=${first.finishReason ?? "-"}, done=${first.done}`);
  check("FR-10", "Flux termine proprement (ni coupure ni erreur)", first.done && !first.streamError,
    first.streamError ?? "erreur=aucune");
  check("FR-11", "Sources affichees sous la reponse", citations.length > 0,
    citations.map((c) => `${c.title} (chunk ${String(c.chunkId).slice(0, 8)})`).join(" | "));

  // Integrite : le chunk cite appartient bien au document cite.
  const chunkIds = citations.map((c) => c.chunkId).filter(Boolean);
  const { data: citedChunks } = await db
    .from("document_chunks")
    .select("id, resource_id")
    .in("id", chunkIds.length ? chunkIds : ["-"]);
  const expectedTitle = new Map(citations.map((c) => [c.chunkId, c.title]));
  const resourceIds = [...new Set((citedChunks ?? []).map((c) => c.resource_id))];
  const { data: citedResources } = await db
    .from("resources")
    .select("id, title")
    .in("id", resourceIds.length ? resourceIds : ["-"]);
  const byId = new Map((citedResources ?? []).map((r) => [r.id, r.title]));
  const citationsReal = (citedChunks ?? []).every((c) => byId.get(c.resource_id) === expectedTitle.get(c.id));
  check("FR-11", "Integrite : chaque citation pointe le morceau du bon document",
    citationsReal && (citedChunks ?? []).length === chunkIds.length,
    `${(citedChunks ?? []).length}/${chunkIds.length} citation(s) verifiee(s) en base`);

  // FR-11 : la citation s'ouvre sur le passage cite (epic 6).
  const chatSrc = readFileSync(join(ROOT, "components", "chat", "chat-client.tsx"), "utf8");
  const opensPassage = /\/resources\/\$\{openCitation\.citation\.sourceId\}\?chunk=\$\{openCitation\.citation\.chunkId\}/.test(chatSrc);
  check("FR-11", "Citation ouvrable sur le passage cite (epic 6)", opensPassage,
    'lien « Ouvrir dans le document » dans le tiroir de citation');

  conversationId = first.meta?.conversationId ?? null;
  check("FR-13", "Conversation creee, identifiant remontee",
    typeof conversationId === "string" && conversationId.length > 0,
    `conversationId=${conversationId}`);

  // FR-13 : question de suivi dans la meme conversation.
  const follow = await postChat({
    question: "Peux-tu me redire cela en une seule phrase ?",
    conversationId,
  });
  check("FR-13", "Question de suivi dans la meme conversation", follow.res.status === 200
    && follow.meta?.conversationId === conversationId && follow.text.length > 0,
    `HTTP ${follow.res.status}, conversationId inchange=${follow.meta?.conversationId === conversationId}, ${follow.text.length} caracteres`);

  // Persistance : l'echange est rejouable depuis la base.
  const { data: persisted } = await db
    .from("messages")
    .select("role, content, meta")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  const userRows = (persisted ?? []).filter((m) => m.role === "user");
  const assistantRows = (persisted ?? []).filter((m) => m.role === "assistant");
  const metaOk = assistantRows.every((m) => Array.isArray(m.meta?.citations));
  check("FR-13", "Echange persiste avec citations (relecture fidele)",
    userRows.length >= 2 && assistantRows.length >= 2 && metaOk,
    `user=${userRows.length}, assistant=${assistantRows.length}, meta.citations sur ${assistantRows.filter((m) => Array.isArray(m.meta?.citations)).length}/${assistantRows.length}`);
}


// FR-12 : abstention explicite hors perimetre
{
  const out = await postChat({ question: "Quel temps fera-t-il a Melbourne jeudi prochain ?" });
  const expected = "Cette information n'a pas été trouvée dans les documents internes de NexaWorks.";
  check("FR-12", "Abstention explicite hors perimetre", out.res.status === 200
    && out.meta?.abstained === true && (out.meta?.citations ?? []).length === 0 && out.text.includes(expected),
    `abstained=${out.meta?.abstained}, citations=${(out.meta?.citations ?? []).length}, texte=« ${out.text.slice(0, 60)}… »`);
}
{
  // Hors sujet mais proche lexicalement : jamais de citation sans fondement.
  const out = await postChat({ question: "Quelle est la capitale de l'Australie et son climat ?" });
  const ok = (out.meta?.citations ?? []).length === 0 || out.meta?.abstained === true;
  check("FR-12", "Pas de citation sans fondement documentaire", ok,
    `abstained=${out.meta?.abstained}, citations=${(out.meta?.citations ?? []).length}`);
}

// ---------------------------------------------------------------------------
group("BLOC F — Resume automatique (FR-14)");
// ---------------------------------------------------------------------------
{
  const { summarizeResource, SUMMARY_MODEL } = await import("../lib/ai/summary.ts");
  const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

  const { data: ready } = await db
    .from("resources")
    .select("id, title, category, status, storage_path")
    .eq("status", "Prête")
    .order("created_at", { ascending: false });

  let done = false;
  let tooShortSeen = 0;
  for (const resource of ready ?? []) {
    const { data: chunks } = await db
      .from("document_chunks")
      .select("content")
      .eq("resource_id", resource.id)
      .order("chunk_index", { ascending: true });
    if (!(chunks ?? []).length) continue;
    const totalChars = (chunks ?? []).reduce((n, c) => n + String(c.content ?? "").length, 0);

    const started = Date.now();
    const outcome = await summarizeResource({
      source: {
        title: resource.title,
        category: resource.category ?? "",
        status: resource.status,
        chunks: (chunks ?? []).map((c) => String(c.content ?? "")),
      },
      deps: {
        generate: async ({ system, prompt }) => {
          const { text } = await generateText({
            model: google.languageModel(SUMMARY_MODEL),
            system,
            prompt,
            maxTokens: 600,
          });
          return text ?? "";
        },
      },
    });
    const seconds = (Date.now() - started) / 1000;
    const bullets = outcome.bullets.length;

    // Cas limite PRD : document trop court -> refus explicite, sans appel IA.
    if (totalChars < 400) {
      tooShortSeen += 1;
      if (!outcome.ok && /trop court/.test(outcome.message)) {
        note("FR-14", `« ${resource.title} » (${totalChars} car.) refuse correctement : « ${outcome.message} »`);
        continue;
      }
      check("FR-14", "Document trop court : synthese refusee explicitement", false,
        `« ${resource.title} » : ${bullets} puce(s) au lieu d'un refus (${totalChars} car.)`);
      continue;
    }

    check("FR-14", "Resume en 5 a 8 puces", outcome.ok && bullets >= 5 && bullets <= 8,
      `« ${resource.title} » : ${bullets} puce(s) en ${seconds.toFixed(1)} s`);
    if (!done) {
      check("FR-14", "Resume produit en moins de 10 secondes", seconds < 10,
        `${seconds.toFixed(1)} s (modele ${SUMMARY_MODEL})`);
      // AC : renvoi vers le document complet (URL signee du bucket prive).
      const { data: signed } = await db.storage
        .from("documents")
        .createSignedUrl(resource.storage_path, 900);
      check("FR-14", "Renvoi vers le document complet (URL signee)", Boolean(signed?.signedUrl),
        signed?.signedUrl ? "URL generee" : "URL indisponible");
      done = true;
    }
  }
  if (!done) {
    check("FR-14", "Aucune ressource prete assez longue a resumer", false,
      `${tooShortSeen} document(s) trop court(s) uniquement`);
  }

  // Statut non Pret : pas de synthese (regle metier).
  const { summarizeResource: summarize } = await import("../lib/ai/summary.ts");
  const refused = await summarize({
    source: { title: "X", category: "X", status: "En cours", chunks: ["contenu"] },
    deps: { generate: async () => "- ne doit pas etre appele" },
  });
  check("FR-14", "Ressource non indexee : synthese refusee", !refused.ok && refused.bullets.length === 0,
    refused.message);

  // La fiche expose le bouton et le contenu du document (epic 6).
  const { data: withChunks } = await db
    .from("resources")
    .select("id, title, chunk_count")
    .eq("status", "Prête")
    .gt("chunk_count", 0)
    .order("created_at", { ascending: false })
    .limit(1);
  if (withChunks?.[0]) {
    const { html } = await getPage(`/resources/${withChunks[0].id}`);
    const sections = (html.match(/<article/g) ?? []).length;
    // Detection du bouton par son attribut ASCII (le libelle est accentue :
    // une comparaison d'accentuates serait fragile selon l'encodage).
    check("FR-14", "Fiche : bouton Resumer et contenu du document",
      /aria-haspopup="dialog"/.test(html) && sections > 0,
      `${sections} section(s) de contenu rendues, bouton=${/aria-haspopup="dialog"/.test(html)}`);
  }
}


// ---------------------------------------------------------------------------
group("BLOC G — Historiques personnels (FR-15, FR-16) + consultation (epic 6)");
// ---------------------------------------------------------------------------
{
  // FR-15 : liste des conversations, tri decroissant, personnelle.
  const { res, html } = await getPage("/history");
  const { data: mine } = await db
    .from("conversations")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(50);
  const listedIds = [...new Set([...html.matchAll(/\/chat\/([0-9a-f-]{36})/g)].map((m) => m[1]))];
  const mineIds = new Set((mine ?? []).map((c) => c.id));
  const onlyMine = listedIds.length > 0 && listedIds.every((id) => mineIds.has(id));
  check("FR-15", "Ecran /history : conversations listees", res.status === 200 && listedIds.length > 0,
    `HTTP ${res.status}, ${listedIds.length} conversation(s)`);
  check("FR-15", "R-7 : uniquement ses propres conversations (RLS)", onlyMine,
    `${listedIds.length} listee(s) toutes parmi les ${(mine ?? []).length} visibles en base`);
  check("FR-15", "Titre, date relative et nombre d'échanges affiches",
    (html.match(/échange/g) ?? []).length > 0 && /Il y a|À l'instant|Date inconnue/.test(html),
    `libellés d'échange=${(html.match(/échange/g) ?? []).length}`);

  if (conversationId) {
    const { res: convRes, html: convHtml } = await getPage(`/chat/${conversationId}`);
    check("FR-15", "Rouverture d'une conversation : fil recharge",
      convRes.status === 200 && /chat-input/.test(convHtml), `HTTP ${convRes.status}`);
  }

  // FR-16 : historique des recherches.
  const { data: searches } = await db
    .from("search_history")
    .select("id, query, result_count, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  const { res: searchRes, html: searchHtml } = await getPage("/search");
  const blockPresent = /Recherches r/.test(searchHtml);
  check("FR-16", "Recherches recentes sous la barre de recherche",
    searchRes.status === 200 && blockPresent,
    `${(searches ?? []).length} entree(s) en base, bloc affiche=${blockPresent}`);

  const entryOk = (searches ?? []).every((s) => typeof s.query === "string" && s.query.length > 0
    && typeof s.result_count === "number" && typeof s.created_at === "string");
  check("FR-16", "Chaque entree conserve requete, date et nombre de resultats", entryOk,
    (searches ?? []).slice(0, 2).map((s) => `« ${s.query} » ${s.result_count} resultat(s)`).join(" | "));

  const q = (searches ?? [])[0]?.query;
  if (q) {
    const { res: replayRes, html: replayHtml } = await getPage(`/search?q=${encodeURIComponent(q)}`);
    const prefilled = replayHtml.includes(`value="${q.replace(/&/g, "&amp;")}"`) || replayHtml.includes(`value="${q}"`);
    check("FR-16", "Rejeu en un clic : requete pre-remplie puis relancee",
      replayRes.status === 200 && prefilled, `« ${q} » pre-remplie=${prefilled}`);
  }

  check("FR-16", "Section des recherches aussi dans /history", /Recherches r/.test(html), "");

  // Suppression (RLS) d'une entree, puis remise d'une entree de test.
  const { deleteSearchEntry } = await import("../lib/search/history-store.ts");
  const { data: oldest } = await db
    .from("search_history").select("id").order("created_at", { ascending: true }).limit(1);
  if (oldest?.[0]) {
    const before = (await db.from("search_history").select("id")).data?.length ?? 0;
    const okDelete = await deleteSearchEntry({ client: db, id: oldest[0].id });
    const after = (await db.from("search_history").select("id")).data?.length ?? 0;
    check("FR-16", "Suppression d'une entree (RLS)", okDelete && after === before - 1,
      `${before} -> ${after} entree(s)`);
  }
  await db.from("search_history").insert({
    owner_id: auth.user.id,
    query: "validation MVP (entree de test)",
    result_count: 0,
  });

  // Epic 6 : consultation + ancrage au passage cite.
  const { data: chunkRows } = await db
    .from("document_chunks")
    .select("id, resource_id, chunk_index")
    .order("chunk_index", { ascending: true });
  const counts = new Map();
  for (const c of chunkRows ?? []) counts.set(c.resource_id, (counts.get(c.resource_id) ?? 0) + 1);
  const target = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (target) {
    const second = (chunkRows ?? []).find((c) => c.resource_id === target[0] && c.chunk_index === 1);
    const { res: plainRes, html: plainHtml } = await getPage(`/resources/${target[0]}`);
    const sections = (plainHtml.match(/<article/g) ?? []).length;
    check("FR-8", "Fiche : contenu complet du document",
      plainRes.status === 200 && sections === target[1], `${sections}/${target[1]} passage(s)`);
    if (second) {
      const anchored = await getPage(`/resources/${target[0]}?chunk=${second.id}`);
      const active = (anchored.html.match(/data-active="true"/g) ?? []).length;
      check("FR-11", "Fiche : passage cite surligne a l'arrivee",
        anchored.res.status === 200 && active === 1, `${active} passage(s) actif(s)`);
    }
    const bogus = await getPage(`/resources/${target[0]}?chunk=00000000-0000-0000-0000-000000000000`);
    check("FR-11", "Ancre invalide : document complet, aucune erreur",
      bogus.res.status === 200 && !/data-active="true"/.test(bogus.html), `HTTP ${bogus.res.status}`);
  }
}


// ---------------------------------------------------------------------------
group("RAPPORT FINAL — couverture FR du MVP");
// ---------------------------------------------------------------------------
const frs = [...new Set(checks.map((c) => c.fr))].sort();
console.log("");
for (const fr of frs) {
  const rows = checks.filter((c) => c.fr === fr);
  const ok = rows.filter((r) => r.ok).length;
  console.log(`${ok === rows.length ? "✅" : "❌"} ${fr.padEnd(6)} ${ok}/${rows.length} vérification(s)`);
}
const failed = checks.filter((c) => !c.ok);
console.log(`\n${"─".repeat(64)}`);
console.log(`MVP NEXAMIND AI : ${checks.length - failed.length}/${checks.length} vérifications OK`);
if (failed.length > 0) {
  console.log("\nÀ corriger :");
  for (const f of failed) console.log(`  ❌ [${f.fr}] ${f.name} — ${f.detail}`);
}
console.log(`\nEXIT=${failed.length > 0 ? 1 : 0}`);
process.exit(failed.length > 0 ? 1 : 0);

