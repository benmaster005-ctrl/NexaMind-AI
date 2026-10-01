"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { formatHistoryStamp, formatRelativeDate } from "@/lib/dashboard/helpers";
import { parseAnswerBlocks, type InlineToken } from "@/lib/text/markdown";
import {
  reduceChatEvents,
  initialChatStreamState,
  type ChatStreamState,
} from "@/lib/chat/ui";
import type { ChatEvent } from "@/lib/ai/chat";
import type { RagCitation } from "@/lib/ai/rag";
import type { SearchHistoryItem } from "@/lib/search/history";
import styles from "./workspace.module.css";

interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  stream: ChatStreamState | null;
  errorMessage: string | null;
}

interface RightPanelProps {
  mode: "history" | "chat";
  onSwitchMode: (mode: "history" | "chat") => void;
  searches: SearchHistoryItem[];
  conversations: ConversationItem[];
  onSelectSearchQuery: (query: string) => void;
  onOpenConversation: (conversationId: string) => void;
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendChatMessage: (text: string) => void;
  onSelectDocumentSource: (resourceId: string, chunkId?: string | null) => void;
  onNewConversation: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onDeleteSearch?: (id: string) => void;
  onClearAllSearches?: () => void;
}

function AnswerLine({
  tokens,
  citations,
  onCitation,
}: {
  tokens: InlineToken[];
  citations: RagCitation[];
  onCitation: (citation: RagCitation) => void;
}) {
  return (
    <>
      {tokens.map((token, i) => {
        if (token.citationIndex !== null) {
          const citation = citations[token.citationIndex];
          return (
            <button
              key={i}
              type="button"
              className={styles.formatTag}
              onClick={() => citation && onCitation(citation)}
              title={citation?.title ?? "Source"}
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

function AnswerBody({
  text,
  citations,
  onCitation,
}: {
  text: string;
  citations: RagCitation[];
  onCitation: (citation: RagCitation) => void;
}) {
  const blocks = parseAnswerBlocks(text, citations.length);
  return (
    <div>
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
            <List key={blockIndex} className={styles.answerList}>
              {block.items.map((tokens, i) => (
                <li key={i}>
                  <AnswerLine tokens={tokens} citations={citations} onCitation={onCitation} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={blockIndex} className={styles.answerPara}>
            {block.items.map((tokens, i) => (
              <AnswerLine key={i} tokens={tokens} citations={citations} onCitation={onCitation} />
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function RightPanel({
  mode,
  onSwitchMode,
  searches,
  conversations,
  onSelectSearchQuery,
  onOpenConversation,
  messages,
  isStreaming,
  onSendChatMessage,
  onSelectDocumentSource,
  onNewConversation,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
  onDeleteSearch,
  onClearAllSearches,
}: RightPanelProps) {
  const [composerInput, setComposerInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSend = () => {
    const trimmed = composerInput.trim();
    if (!trimmed || isStreaming) return;
    onSendChatMessage(trimmed);
    setComposerInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {isOpenMobile ? (
        <div
          className={styles.drawerBackdrop}
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`${styles.rightPane} ${isOpenMobile ? styles.rightPaneOpen : ""} ${isCollapsed && !isOpenMobile ? styles.rightPaneCollapsed : ""}`}
        aria-label="Volet secondaire : Historique et Assistant"
      >
        {isCollapsed && !isOpenMobile ? (
          <div className={styles.rightPaneCollapseRail}>
            <button
              type="button"
              className={styles.rightPaneCollapseControl}
              onClick={onToggleCollapse}
              aria-label="Développer le volet latéral"
              title="Développer le volet latéral"
            >
              <Icon name="panelRight" />
            </button>
          </div>
        ) : (
          <>
            <div className={styles.rightPaneHeader}>
              <div className={styles.rightPaneTabs}>
                {isOpenMobile ? (
                  <button
                    type="button"
                    className={`${styles.drawerBackAction} ${styles.mobileOnly}`}
                    onClick={onCloseMobile}
                    aria-label="Fermer le volet"
                  >
                    <Icon name="arrow" className={styles.iconRotate180} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`${styles.rightPaneTab} ${mode === "history" ? styles.rightPaneTabActive : ""}`}
                  onClick={() => onSwitchMode("history")}
                >
                  Historique
                </button>
                <button
                  type="button"
                  className={`${styles.rightPaneTab} ${mode === "chat" ? styles.rightPaneTabActive : ""}`}
                  onClick={() => onSwitchMode("chat")}
                >
                  Assistant AI
                </button>
              </div>

              <div className={styles.headerRightControls}>
                {mode === "chat" ? (
                  <button
                    type="button"
                    className={styles.formatTag}
                    onClick={onNewConversation}
                    title="Nouvelle conversation"
                  >
                    + Nouveau
                  </button>
                ) : null}
                {isOpenMobile ? (
                  <button
                    type="button"
                    className={`${styles.drawerCloseControl} ${styles.mobileOnly}`}
                    onClick={onCloseMobile}
                    aria-label="Fermer"
                  >
                    <Icon name="close" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.rightPaneCollapseControl} ${styles.desktopOnly}`}
                    onClick={onToggleCollapse}
                    aria-label="Réduire le volet latéral"
                    title="Réduire le volet latéral"
                  >
                    <Icon name="panelRight" />
                  </button>
                )}
              </div>
            </div>

            <div className={styles.rightPaneContent}>
        {mode === "history" ? (
          /* --- MODE HISTORIQUE --- */
          <div className={styles.historySection}>
            <div className={styles.historySectionHeaderRow}>
              <div className={styles.sectionHeader}>Recherches récentes</div>
              {searches.length > 0 && onClearAllSearches ? (
                <button
                  type="button"
                  className={styles.clearHistoryAction}
                  onClick={onClearAllSearches}
                  title="Effacer tout l'historique de recherche"
                >
                  Effacer tout
                </button>
              ) : null}
            </div>
            {searches.length > 0 ? (
              <ul className={styles.historyList} role="list">
                {searches.slice(0, 10).map((item) => (
                  <li key={item.id} className={styles.historyItemRow}>
                    <button
                      type="button"
                      className={`${styles.historyItemLink} ${styles.wFullLeft}`}
                      onClick={() => {
                        onSelectSearchQuery(item.query);
                        onCloseMobile?.();
                      }}
                    >
                      <span className={styles.historyItemTitle}>{item.query}</span>
                      <span className={styles.historyItemTime}>
                        {formatHistoryStamp(item.createdAt)} · {item.resultCount} résultat{item.resultCount > 1 ? "s" : ""}
                      </span>
                    </button>
                    {onDeleteSearch ? (
                      <button
                        type="button"
                        className={styles.historyItemDeleteAction}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSearch(item.id);
                        }}
                        aria-label={`Supprimer ${item.query} de l'historique`}
                        title="Supprimer cette recherche"
                      >
                        <Icon name="trash" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyNotice}>Aucune recherche récente.</p>
            )}

            <div className={`${styles.sectionHeader} ${styles.historySectionSpacing}`}>
              Dernières conversations
            </div>
            {conversations.length > 0 ? (
              <ul className={styles.historyList} role="list">
                {conversations.slice(0, 10).map((conv) => (
                  <li key={conv.id}>
                    <button
                      type="button"
                      className={`${styles.historyItemLink} ${styles.wFullLeft}`}
                      onClick={() => onOpenConversation(conv.id)}
                    >
                      <span className={styles.historyItemTitle}>{conv.title}</span>
                      <span className={styles.historyItemTime}>
                        {formatRelativeDate(conv.created_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyNotice}>Aucune conversation passée.</p>
            )}
          </div>
        ) : (
          /* --- MODE CHAT AI --- */
          <>
            <div className={styles.chatMessagesList} role="log" aria-live="polite">
              {messages.length === 0 ? (
                <div className={styles.chatBubbleAssistant}>
                  Bonjour ! Je suis votre assistant NexaMind AI. Posez-moi une question sur le document affiché au centre ou sur les connaissances internes de l&apos;entreprise.
                </div>
              ) : null}

              {messages.map((msg) => {
                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className={styles.chatBubbleUser}>
                      {msg.text}
                    </div>
                  );
                }

                const stream = msg.stream;
                const text = stream?.text || msg.text || "";
                const citations = stream?.meta?.citations ?? [];

                return (
                  <div key={msg.id} className={styles.chatBubbleAssistant}>
                    {msg.errorMessage ? (
                      <div className={`${styles.emptyNotice} ${styles.textDanger}`}>
                        {msg.errorMessage}
                      </div>
                    ) : null}

                    {isStreaming && !text && !msg.errorMessage ? (
                      <div className={styles.emptyNotice}>
                        Génération de la réponse en cours…
                      </div>
                    ) : null}

                    {text ? (
                      <AnswerBody
                        text={text}
                        citations={citations}
                        onCitation={(cit) => {
                          onSelectDocumentSource(cit.sourceId, cit.chunkId);
                          onCloseMobile?.();
                        }}
                      />
                    ) : null}

                    {citations.length > 0 ? (
                      <div className={styles.sourcesBox}>
                        <div className={styles.sourcesHeading}>Sources utilisées :</div>
                        <div className={styles.sourcesChips}>
                          {citations.map((c, i) => (
                            <button
                              key={c.sourceId + i}
                              type="button"
                              className={styles.sourceChipAction}
                              onClick={() => {
                                onSelectDocumentSource(c.sourceId, c.chunkId);
                                onCloseMobile?.();
                              }}
                            >
                              <Icon name="file" />
                              <span className={styles.chipTruncate}>
                                [{i + 1}] {c.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.chatComposerWrap}>
              <div className={styles.chatComposerBox}>
                <textarea
                  className={styles.chatInput}
                  rows={2}
                  value={composerInput}
                  onChange={(e) => setComposerInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Poser une question de suivi…"
                  disabled={isStreaming}
                />
                <button
                  type="button"
                  className={styles.bottomSubmitAction}
                  onClick={handleSend}
                  disabled={!composerInput.trim() || isStreaming}
                  aria-label="Envoyer"
                >
                  <Icon name="send" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      </>
    )}
    </aside>
    </>
  );
}
