/** Chat client part 1/4 : imports, types et logique de flux NDJSON. */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  CHAT_UI_MESSAGES,
  answerHasInlineCitations,
  answerSources,
  citationAriaLabel,
  citationHref,
  citationLinkLabel,
  initialChatStreamState,
  reduceChatEvents,
  suggestionLeads,
  type ChatStreamState,
} from "@/lib/chat/ui";
import { parseAnswerBlocks, type InlineToken } from "@/lib/text/markdown";
import type { InitialChatMessage } from "@/lib/chat/conversations";
import type { ChatEvent } from "@/lib/ai/chat";
import type { RagCitation } from "@/lib/ai/rag";
import styles from "./chat.module.css";

const MAX_QUESTION_LENGTH = 2000;
const AUTO_GROW_MAX_ROWS = 4;

interface PostedMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  stream: ChatStreamState | null;
  errorMessage: string | null;
}

interface ChatClientProps {
  /** Fil precharge depuis la DB (relecture /chat/[id], story 4.4). */
  initialMessages?: InitialChatMessage[];
  /** Conversation deja ouverte (4.4) : relayee a /api/chat. */
  conversationId?: string;
  /**
   * Question pre-remplie depuis le tableau de bord (`/chat?q=...`).
   * Elle atterrit dans le composeur : l'envoi reste une action explicite de
   * l'utilisateur, via le flux NDJSON deja en place (aucun nouvel appel).
   */
  initialQuestion?: string;
}

/**
 * Une ligne de la reponse : le texte est rendu en markdown-lite (gras,
 * italique) et les references `[n]` restent des puces cliquables. Les
 * marqueurs d'emphase ne sont jamais affiches, meme pendant le flux.
 */
function AnswerLine({
  tokens,
  citations,
  onCitation,
}: {
  tokens: InlineToken[];
  citations: RagCitation[];
  onCitation: (index: number) => void;
}) {
  return (
    <>
      {tokens.map((token, i) => {
        if (token.citationIndex !== null) {
          const index = token.citationIndex;
          return (
            <button
              key={i}
              type="button"
              className={styles.citationChip}
              aria-label={citationAriaLabel(index, citations[index])}
              onClick={() => onCitation(index)}
            >
              [{token.text}]
            </button>
          );
        }
        if (token.strong) return <strong key={i}>{token.text}</strong>;
        if (token.emphasis) return <em key={i}>{token.text}</em>;
        return <span key={i}>{token.text}</span>;
      })}
    </>
  );
}

/** Structure de la reponse : paragraphes, titres et listes du markdown-lite. */
function AnswerBody({
  text,
  citations,
  onCitation,
}: {
  text: string;
  citations: RagCitation[];
  onCitation: (index: number) => void;
}) {
  const blocks = parseAnswerBlocks(text, citations.length);
  return (
    <div className={styles.answer}>
      {blocks.map((block, blockIndex) => {
        if (block.kind === "heading") {
          return (
            <p key={blockIndex} className={styles.answerHeading}>
              {block.items.map((tokens, i) => (
                <AnswerLine key={i} tokens={tokens} citations={citations} onCitation={onCitation} />
              ))}
            </p>
          );
        }
        if (block.kind === "bullets" || block.kind === "numbers") {
          const List = block.kind === "bullets" ? "ul" : "ol";
          return (
            <List key={blockIndex} className={styles.answerList} role="list">
              {block.items.map((tokens, i) => (
                <li key={i} className={styles.answerItem}>
                  <AnswerLine tokens={tokens} citations={citations} onCitation={onCitation} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={blockIndex} className={styles.answerParagraph}>
            {block.items.map((tokens, i) => (
              <AnswerLine key={i} tokens={tokens} citations={citations} onCitation={onCitation} />
            ))}
          </p>
        );
      })}
    </div>
  );
}


let messageSeq = 0;
function nextId(): string {
  messageSeq += 1;
  return `m${messageSeq}`;
}

/** Lecture du flux NDJSON : applique chaque ligne au reducer d'etat. */
async function readNdjsonStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    if (signal.aborted) {
      await reader.cancel().catch(() => undefined);
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as ChatEvent);
        } catch {
          // Ligne partielle/corrompue : ignoree, le suivante reprendra le fil.
        }
      }
      newline = buffer.indexOf("\n");
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      onEvent(JSON.parse(tail) as ChatEvent);
    } catch {
      // Queue non JSON : ignoree silencieusement.
    }
  }
}

/** Chat client part 2/3 : etat, envoi et fil de discussion. */
export default function ChatClient({
  initialMessages = [],
  conversationId,
  initialQuestion = "",
}: ChatClientProps) {
  const [messages, setMessages] = useState<PostedMessage[]>(() =>
    initialMessages.map((m) => ({ ...m, errorMessage: null })),
  );
  // La question du tableau de bord est bornee comme une saisie manuelle.
  const [input, setInput] = useState(
    initialQuestion.trim().slice(0, MAX_QUESTION_LENGTH),
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [openCitation, setOpenCitation] = useState<{
    citation: RagCitation;
    asLead: boolean;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  /**
   * 4.4 : conversation courante dans un ref, PAS dans un state. L'updater d'un
   * setState peut s'executer pendant la phase de rendu ; y appeler
   * `history.replaceState` (intercepte par l'App Router Next) mettait a jour
   * <Router> depuis le rendu de ChatClient -> « Cannot update a component
   * (Router) while rendering a different component (ChatClient) ».
   * La valeur n'est jamais affichee : un ref suffit et evite tout setState.
   */
  const conversationRef = useRef<string | null>(conversationId ?? null);

  const trimmed = input.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_QUESTION_LENGTH && !isStreaming;

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, isStreaming]);

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight || "24") || 24;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * AUTO_GROW_MAX_ROWS)}px`;
  }

  async function sendQuestion(question: string, history: { role: string; content: string }[]) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setClientError(null);

    const userMessage: PostedMessage = {
      id: nextId(),
      role: "user",
      text: question,
      stream: null,
      errorMessage: null,
    };
    const assistantId = nextId();
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", text: "", stream: initialChatStreamState(), errorMessage: null },
    ]);
    setInput("");
    requestAnimationFrame(autoGrow);

    const patchAssistant = (patch: Partial<PostedMessage>) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
      );
    const patchStream = (updater: (state: ChatStreamState) => ChatStreamState) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.stream
            ? { ...m, stream: updater(m.stream) }
            : m,
        ),
      );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history,
          conversationId: conversationRef.current,
        }),
        signal: controller.signal,
      });
      if (res.status === 401) {
        patchAssistant({ errorMessage: CHAT_UI_MESSAGES.unauthorized, stream: null });
        return;
      }
      if (!res.ok || !res.body) {
        let message: string = CHAT_UI_MESSAGES.networkError;
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // Corps non JSON : message generique conserve.
        }
        patchAssistant({ errorMessage: message, stream: null });
        return;
      }
      await readNdjsonStream(
        res.body,
        (event) => {
          // 4.4 : la meta porte l'UUID cree cote serveur -> URL memorisable
          // sans remount React (replaceState, le fil reste en memoire).
          // Effet de bord hors de tout updater de state (cf. conversationRef).
          if (event.type === "meta" && event.conversationId) {
            const cid = event.conversationId;
            if (conversationRef.current !== cid) {
              conversationRef.current = cid;
              window.history.replaceState(null, "", `/chat/${cid}`);
            }
          }
          patchStream((state) => reduceChatEvents(state, event));
        },
        controller.signal,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      patchAssistant({ errorMessage: CHAT_UI_MESSAGES.networkError });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsStreaming(false);
      }
    }
  }

  function handleSubmit() {
    if (!canSend) {
      if (!trimmed) setClientError(CHAT_UI_MESSAGES.emptyInput);
      else setClientError(CHAT_UI_MESSAGES.tooLong);
      return;
    }
    const history = messages
      .filter((m) => !m.errorMessage)
      .map((m) => ({ role: m.role, content: m.text || (m.stream?.text ?? "") }))
      .filter((m) => m.content.trim());
    void sendQuestion(trimmed, history);
  }

/** Chat client part 3/4 : fil de discussion et bulles. */
  const activeLeads = suggestionLeads(
    [...messages].reverse().find((m) => m.role === "assistant")?.stream?.meta ?? null,
  );

  return (
    <section className={styles.screen} aria-label="Assistant conversationnel">

      <div className={styles.thread} ref={threadRef} role="log" aria-live="polite" aria-label="Fil de discussion">
        {messages.length === 0 ? (
          <div className={`${styles.bubbleRow} ${styles.bubbleRowAssistant}`}>
            <p className={`${styles.bubble} ${styles.bubbleAssistant}`}>
              {CHAT_UI_MESSAGES.assistantGreeting}
            </p>
          </div>
        ) : null}

        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message.id} className={`${styles.bubbleRow} ${styles.bubbleRowUser}`}>
                <p className={`${styles.bubble} ${styles.bubbleUser}`}>{message.text}</p>
              </div>
            );
          }

          const stream = message.stream;
          const abstained = stream?.meta?.abstained ?? false;
          const text = stream?.text ?? "";
          const citations = stream?.meta?.citations ?? [];
          const sources = answerSources(stream?.meta ?? null);
          const openSource = (index: number) => {
            const citation = citations[index];
            if (citation) setOpenCitation({ citation, asLead: false });
          };

          return (
            <div key={message.id} className={`${styles.bubbleRow} ${styles.bubbleRowAssistant}`}>
              <div className={styles.bubble} style={{ display: "block" }}>
                {message.errorMessage ? (
                  <p className={`${styles.bubble} ${styles.bubbleError}`} style={{ margin: 0, border: "none", padding: 0 }}>
                    {message.errorMessage}
                  </p>
                ) : null}

                {stream && !text && !stream.error ? (
                  <span className={styles.typing} role="status">
                    <span className={styles.typingDot} aria-hidden="true" />
                    <span className={styles.typingDot} aria-hidden="true" />
                    <span className={styles.typingDot} aria-hidden="true" />
                    {" "}{CHAT_UI_MESSAGES.thinking}
                  </span>
                ) : null}

                {text ? (
                  <div className={abstained ? styles.bubbleAssistantAbstention : undefined}>
                    <AnswerBody text={text} citations={citations} onCitation={openSource} />
                  </div>
                ) : null}

                {/* FR-11 : la reference reste cliquable meme lorsque le modele
                    n'ecrit aucun `[n]` dans sa reponse. Sans ce bloc, la
                    citation dependait de la seule humeur du generateur : le
                    meme questionnaire pouvait reussir et echouer selon
                    l'utilisateur. */}
                {!abstained && sources.length > 0 ? (
                  <div className={styles.sourcesBox}>
                    <p className={styles.sourcesTitle}>{CHAT_UI_MESSAGES.sourcesTitle}</p>
                    {answerHasInlineCitations(text, citations.length) ? null : (
                      <p className={styles.sourcesNote}>
                        {CHAT_UI_MESSAGES.sourcesWithoutMarker}
                      </p>
                    )}
                    <ol className={styles.sourcesList} role="list">
                      {sources.map(({ index, citation }) => (
                        <li key={citation.sourceId} className={styles.sourcesItem}>
                          <button
                            type="button"
                            className={styles.citationChip}
                            aria-label={citationAriaLabel(index, citation)}
                            onClick={() => openSource(index)}
                          >
                            [{index + 1}]
                          </button>{" "}
                          <Link className={styles.sourcesLink} href={citationHref(citation)}>
                            {citation.title}
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {stream?.error ? (
                  <p className={styles.hint} role="alert">{stream.error}</p>
                ) : null}

                {abstained && activeLeads.length > 0 ? (
                  <div className={styles.leadsBox}>
                    <p className={styles.leadsTitle}>Documents proches (pistes, non une réponse) :</p>
                    <ul className={styles.leadsList}>
                      {activeLeads.map((lead) => (
                        <li key={lead.sourceId}>
                          <button
                            type="button"
                            className={styles.citationChip}
                            aria-label={citationAriaLabel(0, lead)}
                            onClick={() => setOpenCitation({ citation: lead, asLead: true })}
                          >
                            Voir
                          </button>{" "}
                          {lead.title} — {lead.category}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {clientError ? (
        <p className={styles.hint} role="alert">{clientError}</p>
      ) : null}

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <label
          htmlFor="chat-input"
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
        >
          Votre question
        </label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          className={styles.input}
          rows={1}
          value={input}
          maxLength={MAX_QUESTION_LENGTH + 100}
          placeholder="Ex. Combien de jours de congés payés ?"
          onChange={(e) => {
            setInput(e.target.value);
            setClientError(null);
            autoGrow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!canSend}
          aria-label={CHAT_UI_MESSAGES.send}
        >
          ↑
        </button>
      </form>

      {openCitation ? (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Fermer le tiroir des sources"
            onClick={() => setOpenCitation(null)}
          />
          <aside
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label={CHAT_UI_MESSAGES.sourceDrawerTitle}
          >
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>{openCitation.citation.title}</h2>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Fermer"
                onClick={() => setOpenCitation(null)}
              >
                ✕
              </button>
            </div>
            <p className={styles.drawerMeta}>
              {openCitation.citation.category}
              {openCitation.asLead ? " — piste proche" : ""}
            </p>
            {openCitation.asLead ? (
              <p className={styles.drawerLeadNote}>
                Document proposé comme piste, pas comme réponse à la question.
              </p>
            ) : null}
            <p className={styles.drawerExcerpt}>{openCitation.citation.excerpt}</p>
            {/* 6.1 (FR-11) : la citation mene a la ressource AU PASSAGE
                utilise. Le tiroir reste intact (extrait immediat) : c'est un
                second acces, decision de l'utilisateur. */}
            {/* 6.1 (FR-11) : la citation mene a la ressource AU PASSAGE
                utilise. Sans morceau identifie (resultat purement textuel),
                le lien mene quand meme au document : une reference qui ne
                mene nulle part n'est pas une reference. */}
            <Link
              className={styles.drawerLink}
              href={citationHref(openCitation.citation)}
              onClick={() => setOpenCitation(null)}
            >
              {citationLinkLabel(openCitation.citation)}
            </Link>
          </aside>
        </>
      ) : null}
    </section>
  );
}
