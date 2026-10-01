"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";
import styles from "./workspace.module.css";

interface AssistantBottomBarProps {
  onAskQuestion: (question: string) => void;
  isGenerating: boolean;
  documentTitle?: string | null;
}

export default function AssistantBottomBar({
  onAskQuestion,
  isGenerating,
  documentTitle,
}: AssistantBottomBarProps) {
  const [question, setQuestion] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const trimmed = question.trim();
  const canSubmit = trimmed.length > 0 && !isGenerating;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onAskQuestion(trimmed);
    setQuestion("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const placeholderText = documentTitle
    ? `Posez une question sur « ${documentTitle} » ou l'entreprise...`
    : "Posez une question sur les connaissances de l'entreprise...";

  return (
    <div className={styles.bottomAssistantWrap}>
      <div className={styles.bottomAssistantBox}>
        <textarea
          ref={textareaRef}
          className={styles.bottomTextarea}
          rows={1}
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          aria-label="Poser une question à l'assistant AI"
          disabled={isGenerating}
          maxLength={2000}
        />
        <button
          type="button"
          className={[
            styles.bottomSubmitAction,
            isGenerating ? styles.bottomSubmitGenerating : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label="Envoyer la question"
        >
          <Icon name="send" />
        </button>
      </div>
    </div>
  );
}
