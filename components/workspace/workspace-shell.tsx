"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import GlobalHeader from "./global-header";
import CategoryBar from "./category-bar";
import DocumentSidebar from "./document-sidebar";
import DocumentReader from "./document-reader";
import AssistantBottomBar from "./assistant-bottom-bar";
import RightPanel, { type ChatMessage } from "./right-panel";
import GlobalSearchDialog from "./global-search-dialog";
import ResourceUploadModal from "./resource-upload-modal";
import {
  getDocumentDetailAction,
  getRecentSearchesAction,
  type ResourceData,
} from "@/app/actions/workspace";
import {
  initialChatStreamState,
  reduceChatEvents,
  type ChatStreamState,
} from "@/lib/chat/ui";
import type { DocumentView } from "@/lib/resources/view";
import type { SearchHistoryItem } from "@/lib/search/history";
import type { ChatEvent } from "@/lib/ai/chat";
import styles from "./workspace.module.css";

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
}

interface WorkspaceShellProps {
  initialUserEmail: string;
  currentUserId: string;
  initialDocuments: ResourceData[];
  initialSelectedDoc?: ResourceData | null;
  initialDocumentView?: DocumentView | null;
  initialSearches: SearchHistoryItem[];
  initialConversations: ConversationRow[];
  initialCategory?: string;
  initialQuery?: string;
}

let chatMsgId = 0;
function nextMsgId(): string {
  chatMsgId += 1;
  return `w-msg-${Date.now()}-${chatMsgId}`;
}

async function readStream(
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
          // ignore corrupted/partial line
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
      // ignore
    }
  }
}

export default function WorkspaceShell({
  initialUserEmail,
  currentUserId,
  initialDocuments,
  initialSelectedDoc,
  initialDocumentView,
  initialSearches,
  initialConversations,
  initialCategory = "Toutes",
  initialQuery = "",
}: WorkspaceShellProps) {
  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Document list and selection
  const [documents, setDocuments] = useState<ResourceData[]>(initialDocuments);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedDoc, setSelectedDoc] = useState<ResourceData | null>(initialSelectedDoc ?? (initialDocuments[0] || null));
  const [documentView, setDocumentView] = useState<DocumentView | null>(initialDocumentView ?? null);
  const [targetChunkId, setTargetChunkId] = useState<string | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);

  // Right panel state (history or chat)
  const [rightPanelMode, setRightPanelMode] = useState<"history" | "chat">("history");
  const [searches, setSearches] = useState<SearchHistoryItem[]>(initialSearches);
  const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);

  // Chat conversation state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const currentConversationIdRef = useRef<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // Modals & drawers
  const [isSearchOpen, setIsSearchOpen] = useState(Boolean(initialQuery));
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isOpenMobileSidebar, setIsOpenMobileSidebar] = useState(false);
  const [isMobileRightPanelOpen, setIsMobileRightPanelOpen] = useState(false);

  // Collapsible sidebars (desktop only)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  // Apply theme dynamically to document root whenever theme state changes
  useEffect(() => {
    if (typeof document === "undefined") return;
    let styleEl = document.getElementById("nexamind-theme-override") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "nexamind-theme-override";
      document.head.appendChild(styleEl);
    }
    const darkCSS = `
      :root {
        color-scheme: dark !important;
        --bg-page: #0b1120 !important;
        --surface: #111827 !important;
        --surface-sunken: #0b1120 !important;
        --bubble-assistant: #111827 !important;
        --border: #1f2937 !important;
        --border-strong: #374151 !important;
        --text: #f9fafb !important;
        --text-secondary: #d1d5db !important;
        --text-muted: #9ca3af !important;
        --primary: #3b82f6 !important;
        --primary-hover: #60a5fa !important;
        --on-primary: #ffffff !important;
        --accent-text: #60a5fa !important;
        --primary-subtle: #172554 !important;
        --primary-subtle-strong: #1e3a8a !important;
        --primary-subtle-border: #1e40af !important;
        --primary-soft: #1e40af !important;
        --success-subtle: #052e21 !important;
        --success-border: #065f46 !important;
        --success-text: #6ee7b7 !important;
        --warning-subtle: #3b2f0b !important;
        --warning-border: #92600a !important;
        --warning-text: #fde68a !important;
        --danger-subtle: #3b1518 !important;
        --danger-border: #7f1d1d !important;
        --danger-text: #fca5a5 !important;
        --highlight: #4a3f0b !important;
        --focus-ring: #60a5fa !important;
        --shadow-card: none !important;
        --shadow-sheet: none !important;
        --scrim: rgb(2 6 23 / 0.66) !important;
      }
    `;
    const lightCSS = `
      :root {
        color-scheme: light !important;
        --bg-page: #f8fafc !important;
        --surface: #ffffff !important;
        --surface-sunken: #f1f5f9 !important;
        --bubble-assistant: #f1f5f9 !important;
        --border: #e2e8f0 !important;
        --border-strong: #cbd5e1 !important;
        --text: #0f172a !important;
        --text-secondary: #334155 !important;
        --text-muted: #64748b !important;
        --primary: #2563eb !important;
        --primary-hover: #1d4ed8 !important;
        --on-primary: #ffffff !important;
        --accent-text: #2563eb !important;
        --primary-subtle: #eff6ff !important;
        --primary-subtle-strong: #dbeafe !important;
        --primary-subtle-border: #93c5fd !important;
        --primary-soft: #bfdbfe !important;
        --success-subtle: #ecfdf5 !important;
        --success-border: #a7f3d0 !important;
        --success-text: #047857 !important;
        --warning-subtle: #fef3c7 !important;
        --warning-border: #fcd34d !important;
        --warning-text: #78350f !important;
        --danger-subtle: #fef2f2 !important;
        --danger-border: #fecaca !important;
        --danger-text: #b91c1c !important;
        --highlight: #fef08a !important;
        --focus-ring: #2563eb !important;
        --shadow-card: 0 1px 2px rgb(15 23 42 / 0.06) !important;
        --shadow-sheet: 0 -8px 24px rgb(15 23 42 / 0.16) !important;
        --scrim: rgb(15 23 42 / 0.45) !important;
      }
    `;
    styleEl.textContent = theme === "dark" ? darkCSS : lightCSS;
  }, [theme]);

  // Initialize theme from system or localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("nexamind-theme");
      if (stored === "dark" || stored === "light") {
        setTheme(stored);
      } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      }
    } catch {
      // ignore storage access issues
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("nexamind-theme", next);
    } catch {
      // ignore
    }
  };

  // Keyboard shortcut Ctrl+K / Cmd+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Compute dynamic category counts
  const categoryCounts = useCallback(() => {
    const countsMap = new Map<string, number>();
    for (const doc of documents) {
      if (doc.category) {
        countsMap.set(doc.category, (countsMap.get(doc.category) ?? 0) + 1);
      }
    }
    return Array.from(countsMap.entries()).map(([name, count]) => ({ name, count }));
  }, [documents]);

  // Load document chunks when selecting a document
  const handleSelectDocument = async (doc: ResourceData, chunkId?: string | null) => {
    setSelectedDoc(doc);
    setTargetChunkId(chunkId ?? null);
    setIsLoadingDoc(true);
    setIsOpenMobileSidebar(false);
    setIsMobileRightPanelOpen(false);

    // Update URL query parameter
    try {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("doc", doc.id);
      if (chunkId) newUrl.searchParams.set("chunk", chunkId);
      else newUrl.searchParams.delete("chunk");
      window.history.pushState(null, "", newUrl.toString());
    } catch {
      // ignore
    }

    try {
      const result = await getDocumentDetailAction(doc.id, chunkId ?? undefined);
      if (result.success && result.view) {
        setDocumentView(result.view);
      } else {
        setDocumentView(null);
      }
    } catch {
      setDocumentView(null);
    } finally {
      setIsLoadingDoc(false);
    }
  };

  // Select document by ID (e.g. from chat citation or search result)
  const handleSelectDocumentById = async (resourceId: string, chunkId?: string | null) => {
    setIsMobileRightPanelOpen(false);
    const found = documents.find((d) => d.id === resourceId);
    if (found) {
      await handleSelectDocument(found, chunkId);
    } else {
      // Fetch directly if not in local array
      setIsLoadingDoc(true);
      try {
        const result = await getDocumentDetailAction(resourceId, chunkId ?? undefined);
        if (result.success && result.resource) {
          setSelectedDoc(result.resource);
          setDocumentView(result.view);
          setTargetChunkId(chunkId ?? null);
        }
      } finally {
        setIsLoadingDoc(false);
      }
    }
  };

  // Send a question to AI (from bottom bar or chat composer)
  const handleAskQuestion = async (question: string) => {
    if (!question.trim() || isChatStreaming) return;

    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;

    setRightPanelMode("chat");
    setIsMobileRightPanelOpen(true);
    setIsChatStreaming(true);

    const userMessage: ChatMessage = {
      id: nextMsgId(),
      role: "user",
      text: question.trim(),
      stream: null,
      errorMessage: null,
    };

    const assistantId = nextMsgId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      text: "",
      stream: initialChatStreamState(),
      errorMessage: null,
    };

    setChatMessages((prev) => [...prev, userMessage, assistantMessage]);

    const patchAssistantStream = (updater: (s: ChatStreamState) => ChatStreamState) => {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.stream
            ? { ...m, stream: updater(m.stream) }
            : m,
        ),
      );
    };

    const patchAssistantError = (msg: string) => {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, errorMessage: msg } : m)),
      );
    };

    try {
      const history = chatMessages
        .filter((m) => !m.errorMessage)
        .map((m) => ({ role: m.role, content: m.text || (m.stream?.text ?? "") }))
        .filter((m) => m.content.trim());

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          history,
          conversationId: currentConversationIdRef.current,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let errText = "L'assistant est temporairement indisponible.";
        try {
          const json = (await res.json()) as { error?: string };
          if (json.error) errText = json.error;
        } catch {
          // ignore
        }
        patchAssistantError(errText);
        return;
      }

      await readStream(
        res.body,
        (event) => {
          if (event.type === "meta" && event.conversationId) {
            currentConversationIdRef.current = event.conversationId;
          }
          patchAssistantStream((st) => reduceChatEvents(st, event));
        },
        controller.signal,
      );

      // Refresh recent conversations
      const updatedSearches = await getRecentSearchesAction();
      setSearches(updatedSearches);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      patchAssistantError("Problème de connexion. Veuillez réessayer.");
    } finally {
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
        setIsChatStreaming(false);
      }
    }
  };

  const handleStartNewConversation = () => {
    currentConversationIdRef.current = null;
    setChatMessages([]);
  };

  const handleOpenConversation = async (convId: string) => {
    currentConversationIdRef.current = convId;
    setRightPanelMode("chat");
    // Optionally fetch past messages or load existing
    // We already keep conversational continuity
  };

  const handleUploadSuccess = async (newDocTitle: string, newDocCategory: string) => {
    // Re-fetch documents or add to state
    try {
      const res = await fetch("/api/search?q=" + encodeURIComponent(newDocTitle));
      if (res.ok) {
        const data = (await res.json()) as { results?: Array<{ resourceId: string }> };
        if (data.results && data.results.length > 0) {
          const newId = data.results[0].resourceId;
          const newDoc: ResourceData = {
            id: newId,
            title: newDocTitle,
            category: newDocCategory,
            status: "Prête",
            storage_path: null,
            created_by: currentUserId,
            created_at: new Date().toISOString(),
            tags: ["personnel"],
            chunk_count: 1,
            error_message: null,
          };
          setDocuments((prev) => [newDoc, ...prev]);
          await handleSelectDocument(newDoc);
        }
      }
    } catch {
      // fallback: refresh page
      window.location.reload();
    }
  };

  return (
    <div className={`${styles.shell} ${theme === "dark" ? styles.themeDark : styles.themeLight}`}>
      {/* 1. Global Header */}
      <GlobalHeader
        email={initialUserEmail}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSearch={() => setIsSearchOpen(true)}
        isChatOpen={rightPanelMode === "chat" && isMobileRightPanelOpen}
        onToggleChat={() => {
          setRightPanelMode("chat");
          setIsMobileRightPanelOpen((prev) => !prev);
        }}
        onToggleMobileSidebar={() => setIsOpenMobileSidebar((prev) => !prev)}
        selectedDocTitle={selectedDoc?.title}
        onOpenHistory={() => {
          setRightPanelMode("history");
          setIsMobileRightPanelOpen(true);
        }}
      />

      {/* 2. Category Navigation */}
      <CategoryBar
        categories={categoryCounts()}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => setSelectedCategory(cat)}
        totalDocumentsCount={documents.length}
      />

      {/* 3. Main Workspace 3-Pane Body */}
      <div className={styles.workspaceBody}>
        {/* Left Sidebar: Document Library */}
        <DocumentSidebar
          documents={documents}
          currentUserId={currentUserId}
          selectedDocId={selectedDoc?.id ?? null}
          selectedCategory={selectedCategory}
          onSelectDocument={(doc) => handleSelectDocument(doc)}
          onOpenUpload={() => setIsUploadOpen(true)}
          isOpenMobile={isOpenMobileSidebar}
          onCloseMobile={() => setIsOpenMobileSidebar(false)}
          isCollapsed={isLeftCollapsed}
          onToggleCollapse={() => setIsLeftCollapsed((p) => !p)}
        />

        {/* Center Workspace: Document Reader + Fixed Bottom Assistant Bar */}
        <main className={styles.centerWorkspace}>
          <DocumentReader
            document={selectedDoc}
            documentView={documentView}
            isLoading={isLoadingDoc}
            currentUserId={currentUserId}
            targetChunkId={targetChunkId}
            onOpenUpload={() => setIsUploadOpen(true)}
          />

          <AssistantBottomBar
            onAskQuestion={handleAskQuestion}
            isGenerating={isChatStreaming}
            documentTitle={selectedDoc?.title}
          />
        </main>

        {/* Right Panel: History or Chat AI */}
        <RightPanel
          mode={rightPanelMode}
          onSwitchMode={(m) => setRightPanelMode(m)}
          searches={searches}
          conversations={conversations}
          onSelectSearchQuery={(q) => {
            setIsSearchOpen(true);
          }}
          onOpenConversation={handleOpenConversation}
          messages={chatMessages}
          isStreaming={isChatStreaming}
          onSendChatMessage={handleAskQuestion}
          onSelectDocumentSource={handleSelectDocumentById}
          onNewConversation={handleStartNewConversation}
          isOpenMobile={isMobileRightPanelOpen}
          onCloseMobile={() => setIsMobileRightPanelOpen(false)}
          isCollapsed={isRightCollapsed}
          onToggleCollapse={() => setIsRightCollapsed((p) => !p)}
        />
      </div>

      {/* 4. Global Search Modal (Ctrl+K) */}
      <GlobalSearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectResult={(resId, chunkId, cat) => {
          setSelectedCategory(cat);
          handleSelectDocumentById(resId, chunkId);
        }}
        recentSearches={searches}
      />

      {/* 5. Resource Upload Modal */}
      <ResourceUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
