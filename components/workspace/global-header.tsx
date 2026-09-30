"use client";

import { useState } from "react";
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
  selectedDocTitle?: string | null;
  onOpenHistory?: () => void;
}

export default function GlobalHeader({
  email,
  theme,
  onToggleTheme,
  onOpenSearch,
  isChatOpen,
  onToggleChat,
  onToggleMobileSidebar,
  selectedDocTitle,
  onOpenHistory,
}: GlobalHeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const displayName = displayNameFromEmail(email);
  const initials = initialsFromName(displayName);

  return (
    <header className={styles.header}>
      {/* --- HEADER LEFT --- */}
      <div className={styles.headerLeft}>
        <button
          type="button"
          className={`${styles.mobileMenuAction} ${styles.belowDesktop}`}
          onClick={onToggleMobileSidebar}
          aria-label="Ouvrir la bibliothèque documentaire"
        >
          <Icon name="menu" />
        </button>

        <div className={`${styles.brandLink} ${styles.desktopOnly}`}>
          <Brand />
        </div>
      </div>

      {/* --- CENTER: SEARCH TRIGGER (DESKTOP) OR SHORT TITLE (MOBILE) --- */}
      <div className={styles.headerCenter}>
        <div className={`${styles.mobileHeaderTitle} ${styles.mobileOnly}`}>
          {selectedDocTitle || "NexaMind AI"}
        </div>

        <button
          type="button"
          className={`${styles.searchTrigger} ${styles.desktopOnly}`}
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

      {/* --- RIGHT: ACTIONS --- */}
      <div className={styles.headerRight}>
        {/* Mobile search button */}
        <button
          type="button"
          className={`${styles.mobileSearchControl} ${styles.mobileOnly}`}
          onClick={onOpenSearch}
          aria-label="Rechercher"
        >
          <Icon name="search" />
        </button>

        {/* Mobile profile button */}
        <button
          type="button"
          className={`${styles.mobileUserControl} ${styles.mobileOnly}`}
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          aria-label="Profil et options"
          aria-expanded={isUserMenuOpen}
        >
          <span className={styles.avatar}>{initials}</span>
        </button>

        {/* Mobile User Popover */}
        {isUserMenuOpen ? (
          <div className={styles.userDropdown} role="menu">
            <div className={styles.userDropdownEmail}>{email}</div>
            <button
              type="button"
              className={styles.userDropdownItem}
              onClick={() => {
                setIsUserMenuOpen(false);
                onToggleChat();
              }}
            >
              <Icon name="chat" />
              <span>Assistant AI</span>
            </button>
            {onOpenHistory ? (
              <button
                type="button"
                className={styles.userDropdownItem}
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onOpenHistory();
                }}
              >
                <Icon name="history" />
                <span>Historique</span>
              </button>
            ) : null}
            <button
              type="button"
              className={styles.userDropdownItem}
              onClick={() => {
                onToggleTheme();
              }}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
              <span>{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>
            </button>
            <SignOutButton plain className={styles.userDropdownItem}>
              <Icon name="logout" />
              <span>Déconnexion</span>
            </SignOutButton>
          </div>
        ) : null}

        {/* Desktop Assistant Trigger */}
        <button
          type="button"
          className={`${styles.headerAssistant} ${styles.desktopOnly} ${isChatOpen ? styles.headerAssistantActive : ""}`}
          onClick={onToggleChat}
          aria-label="Ouvrir l'assistant AI"
        >
          <Icon name="chat" />
          <span>Assistant</span>
        </button>

        {/* Desktop Theme Control */}
        <button
          type="button"
          className={`${styles.iconControl} ${styles.desktopOnly}`}
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          title={theme === "dark" ? "Mode clair" : "Mode sombre"}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>

        {/* Desktop User Menu */}
        <div className={`${styles.userMenu} ${styles.desktopOnly}`}>
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
