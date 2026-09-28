/** Chat client part 1/4 : imports, types et logique de flux NDJSON. */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  CHAT_UI_MESSAGES,
  citationAriaLabel,
  initialChatStreamState,
  reduceChatEvents,
  segmentAssistantText,
  suggestionLeads,
  type ChatStreamState,
} from "@/lib/chat/ui";
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
}: ChatClientProps) {
  const [messages, setMessages] = useState<PostedMessage[]>(() =>
    initialMessages.map((m) => ({ ...m, errorMessage: null })),
  );
  const [input, setInput] = useState("");
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
      <header className={styles.header}>
        <h1 className={styles.title}>Assistant</h1>
        <p className={styles.subtitle}>
          Réponses fondées sur les documents internes — avec citations.
        </p>
      </header>

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
                  <span className={abstained ? styles.bubbleAssistantAbstention : undefined}>
                    {segmentAssistantText(text, stream?.meta?.citations.length ?? 0).map(
                      (segment, i) =>
                        segment.citationIndex !== null ? (
                          <button
                            key={i}
                            type="button"
                            className={styles.citationChip}
                            aria-label={citationAriaLabel(
                              segment.citationIndex,
                              stream?.meta?.citations[segment.citationIndex],
                            )}
                            onClick={() => {
                              const citation = stream?.meta?.citations[segment.citationIndex ?? -1];
                              if (citation) setOpenCitation({ citation, asLead: false });
                            }}
                          >
                            [{segment.text}]
                          </button>
                        ) : (
                          <span key={i}>{segment.text}</span>
                        ),
                    )}
                  </span>
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
            {openCitation.citation.chunkId ? (
              <Link
                className={styles.drawerLink}
                href={`/resources/${openCitation.citation.sourceId}?chunk=${openCitation.citation.chunkId}`}
                onClick={() => setOpenCitation(null)}
              >
                Ouvrir dans le document
              </Link>
            ) : null}
          </aside>
        </>
      ) : null}
    </section>
  );
}
