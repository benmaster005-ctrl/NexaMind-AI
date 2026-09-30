"use client";

import Brand from "@/components/dashboard/brand";
import { Icon } from "@/components/ui/icon";
import SignOutButton from "@/components/dashboard/signout-button";
import { displayNameFromEmail, initialsFromName } from "@/lib/dashboard/helpers";
import styles from "./workspace.module.css";

interface GlobalHeaderProps {
  email: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  onToggleMobileSidebar: () => void;
}

export default function GlobalHeader({
  email,
  theme,
  onToggleTheme,
  onOpenSearch,
  isChatOpen,
  onToggleChat,
  onToggleMobileSidebar,
}: GlobalHeaderProps) {
  const displayName = displayNameFromEmail(email);
  const initials = initialsFromName(displayName);

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <button
          type="button"
          className={styles.mobileToggle}
          onClick={onToggleMobileSidebar}
          aria-label="Menu des documents"
        >
          <Icon name="documents" />
        </button>
        <div className={styles.brandLink}>
          <Brand />
        </div>
      </div>

      <div className={styles.headerCenter}>
        <button
          type="button"
          className={styles.searchTrigger}
          onClick={onOpenSearch}
          aria-label="Recherche globale (Ctrl+K)"
        >
          <span className={styles.searchTriggerLeft}>
            <Icon name="search" />
            <span>Rechercher dans NexaMind...</span>
          </span>
          <kbd className={styles.kbdShortcut}>Ctrl K</kbd>
        </button>
      </div>

      <div className={styles.headerRight}>
        <button
          type="button"
          className={`${styles.headerAssistant} ${isChatOpen ? styles.headerAssistantActive : ""}`}
          onClick={onToggleChat}
          aria-label="Ouvrir l'assistant AI"
        >
          <Icon name="chat" />
          <span>Assistant</span>
        </button>

        <button
          type="button"
          className={styles.iconControl}
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          title={theme === "dark" ? "Mode clair" : "Mode sombre"}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>

        <div className={styles.userMenu}>
          <span className={styles.avatar} title={email || "Utilisateur"}>
            {initials}
          </span>
          <SignOutButton plain className={styles.iconControl}>
            <Icon name="logout" />
          </SignOutButton>
        </div>
      </div>
    </header>
  );
}
