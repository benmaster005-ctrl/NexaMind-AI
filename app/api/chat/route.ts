import { NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

import { createClient } from "@/lib/supabase/server";
import { searchDocuments } from "@/lib/ai/search";
import { getGeminiApiKey } from "@/lib/ai/embeddings";
import { prepareChatTurn, RAG_MESSAGES, type ChatMeta } from "@/lib/ai/rag";
import {
  createChatEventStream,
  parseChatRequest,
  NDJSON_HEADERS,
} from "@/lib/ai/chat";
import {
  CONVERSATION_MESSAGES,
  deriveConversationTitle,
  rowsToHistory,
} from "@/lib/chat/conversations";
import { supabaseSearchDeps } from "@/app/api/search/route";

// Modele de generation (valide en live le 2026-09-27).
// ⚠ Contrainte importante : le SDK est epingle a `ai` 4.3.19 /
// `@ai-sdk/google` 1.2.22 (nov. 2024). Avec les modeles Gemini qui « pensent »
// (gemini-flash-latest, gemini-2.5-flash-lite, ...), ce SDK laisse le flux de
// texte ouvert et ne produit AUCUN caractere (promesse `finishReason` jamais
// resolue) : on evitait les reponses vides, pas les questions.
// `gemini-3.1-flash-lite` : modele non pensant, verifie en flux sur le vrai
// prompt RAG (retour en 4 s, texte complet). Ne pas repasser a un alias
// « *-latest » sans repasser par `npm run validate:chat-live`.
export const GENERATION_MODEL = "gemini-3.1-flash-lite";

/**
 * Budget d'exécution (préparation déploiement Vercel).
 *
 * Sous Fluid Compute (activé par défaut sur les nouveaux projets Vercel), la
 * durée maximale par défaut est déjà de 300 s sur tous les plans — mais elle
 * n'était que de 60 s sur le plan Hobby avant Fluid Compute, et n'est pas
 * garantie sur les autres cibles (Node autonome, autres hébergeurs). Une
 * réponse RAG en flux — embedding de la question, recherche vectorielle puis
 * génération Gemini — doit survivre partout : on déclare donc un plafond
 * explicite, portable, et plus serré que les 300 s pour ne pas immobiliser
 * une instance (120 s très au-delà des ~4 s observées en réel).
 * Doit rester ≤ 300 (plafond du plan Hobby).
 */
export const maxDuration = 120;


type ChatSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Persistance 4.4 : ouvre ou verifie la conversation (auteur seul, sinon
 * null = 403), insere le message utilisateur, retourne l'historique DB.
 * Retourne null si la conversation fournie est etrangere/inconnue.
 */
async function openConversation(input: {
  supabase: ChatSupabase;
  userId: string;
  conversationId: string | null;
  question: string;
}): Promise<{ id: string; history: { role: string; content: string }[] } | null> {
  const { supabase, userId, conversationId, question } = input;

  if (conversationId) {
    // RLS filtre deja les conversations d'autrui : select = test d'auteur.
    const { data: conversation, error } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (error || !conversation) return null;

    const { data: rows } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    const history = rowsToHistory(rows ?? []);

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: question,
    });
    return { id: conversationId, history };
  }

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({
      owner_id: userId,
      title: deriveConversationTitle(question),
    })
    .select("id")
    .single();
  if (createError || !created) return null;

  await supabase.from("messages").insert({
    conversation_id: created.id as string,
    role: "user",
    content: question,
  });
  return { id: created.id as string, history: [] };
}

/**
 * POST /api/chat (stories 4.2 + 4.4, FR-10/FR-11/FR-12/FR-13).
 * Corps `{ question, history?, conversationId? }` -> flux NDJSON :
 * meta (citations + conversationId) puis texte filant puis done.
 * Abstention : formule standard, 0 appel Gemini. Persistance best effort
 * de la reponse assistant apres la derniere donnee du flux.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: RAG_MESSAGES.unauthorized }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = null;
  }
  const parsed = parseChatRequest(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const conversation = await openConversation({
    supabase,
    userId: user.id,
    conversationId: parsed.conversationId,
    question: parsed.question,
  });
  if (!conversation) {
    return NextResponse.json(
      { error: CONVERSATION_MESSAGES.notOwner },
      { status: 403 },
    );
  }

  const searchDeps = supabaseSearchDeps(supabase);
  const plan = await prepareChatTurn({
    question: parsed.question,
    history: conversation.history,
    retrieve: async (query) => {
      const outcome = await searchDocuments({ query, deps: searchDeps });
      if (!outcome.ok) throw new Error(outcome.message);
      return outcome.results;
    },
  });

  if (plan.kind === "error") {
    // Seule reste l'erreur retrieval : les validations sont passees en amont.
    return NextResponse.json({ error: plan.message }, { status: 502 });
  }

  const conversationId = conversation.id;
  /** Insertion best effort de la reponse assistant + meta (4.4). */
  const persistAssistant = async (content: string, meta: ChatMeta) => {
    if (!content.trim()) return;
    // Objet brut : supabase-js serialise pour la colonne jsonb (pas de
    // JSON.stringify, qui produirait une chaine doublement encodee).
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content,
      meta,
    });
  };

  if (plan.kind === "abstained") {
    // Zéro-hallucination : aucun appel Gemini, formule standard en flux.
    return new Response(
      createChatEventStream({
        meta: plan.meta,
        conversationId,
        staticText: plan.answer,
        textSource: [],
        onFinish: (text) => persistAssistant(text, plan.meta),
      }),
      { headers: NDJSON_HEADERS },
    );
  }

  try {
    const apiKey = getGeminiApiKey();
    const google = createGoogleGenerativeAI({ apiKey });
    const result = streamText({
      model: google.languageModel(GENERATION_MODEL),
      system: plan.system,
      messages: plan.messages,
    });
    // Observabilite sans cout ni blocage : `finishReason` est une promesse qui,
    // avec le SDK 1.x, ne resout pas toujours — on la lit sans jamais await.
    let finishReason: string | undefined;
    void Promise.resolve(result.finishReason)
      .then((reason) => {
        finishReason = reason as string;
      })
      .catch(() => undefined);
    return new Response(
      createChatEventStream({
        meta: plan.meta,
        conversationId,
        textSource: result.textStream,
        emptyFallback: RAG_MESSAGES.generationEmpty,
        beforeDone: () => ({ finishReason }),
        onFinish: (text) => persistAssistant(text, plan.meta),
      }),
      { headers: NDJSON_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { error: RAG_MESSAGES.generationFailure },
      { status: 502 },
    );
  }
}
