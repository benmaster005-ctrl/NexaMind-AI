"use client";

import { useEffect, useState } from "react";

/**
 * Bascule clair / sombre partagee par le workspace et la documentation.
 *
 * Les tokens de `app/globals.css` suivent l'OS ; le choix manuel les
 * surcharge via une feuille injectee dans <head> (memorisee dans
 * localStorage). Les valeurs ci-dessous recopient les deux blocs :root de
 * globals.css : toute modification de la charte doit etre faite aux deux
 * endroits.
 */
export type AppTheme = "light" | "dark";

const STORAGE_KEY = "nexamind-theme";
const STYLE_ID = "nexamind-theme-override";

const DARK_CSS = `
  :root {
    color-scheme: dark !important;
    --bg-page: #0e1116 !important;
    --surface: #151a21 !important;
    --surface-sunken: #11151b !important;
    --surface-nav: #12161c !important;
    --bubble-assistant: #1a2029 !important;
    --appbar-bg: #0a0d12 !important;
    --appbar-text: #e8ecf1 !important;
    --appbar-muted: #8a94a3 !important;
    --appbar-hover: rgb(255 255 255 / 0.07) !important;
    --appbar-field: rgb(255 255 255 / 0.05) !important;
    --appbar-border: rgb(255 255 255 / 0.1) !important;
    --border: #252c36 !important;
    --border-strong: #36404d !important;
    --text: #e8ecf1 !important;
    --text-secondary: #c3cad4 !important;
    --text-muted: #8a94a3 !important;
    --primary: #3d7fe0 !important;
    --primary-hover: #5a95ea !important;
    --on-primary: #ffffff !important;
    --accent-text: #7aaef2 !important;
    --primary-subtle: #13233d !important;
    --primary-subtle-strong: #1a3156 !important;
    --primary-subtle-border: #2b4f86 !important;
    --primary-soft: #2b4f86 !important;
    --success-subtle: #0f2a1d !important;
    --success-border: #1d5a3a !important;
    --success-text: #7fd6a4 !important;
    --warning-subtle: #2e2410 !important;
    --warning-border: #7a5a17 !important;
    --warning-text: #f2d08a !important;
    --danger-subtle: #2f1517 !important;
    --danger-border: #7a2a2d !important;
    --danger-text: #f3a5a5 !important;
    --highlight: #4a3f0b !important;
    --focus-ring: #7aaef2 !important;
    --shadow-card: none !important;
    --shadow-pop: 0 4px 16px rgb(0 0 0 / 0.4) !important;
    --shadow-sheet: 0 16px 40px rgb(0 0 0 / 0.5) !important;
    --scrim: rgb(2 6 23 / 0.66) !important;
  }
`;

const LIGHT_CSS = `
  :root {
    color-scheme: light !important;
    --bg-page: #f3f4f6 !important;
    --surface: #ffffff !important;
    --surface-sunken: #f6f7f9 !important;
    --surface-nav: #f8f9fb !important;
    --bubble-assistant: #f6f7f9 !important;
    --appbar-bg: #ffffff !important;
    --appbar-text: #0f172a !important;
    --appbar-muted: #64748b !important;
    --appbar-hover: #f1f5f9 !important;
    --appbar-field: #f8fafc !important;
    --appbar-border: #e2e8f0 !important;
    --border: #e3e6ea !important;
    --border-strong: #c8cdd5 !important;
    --text: #161b26 !important;
    --text-secondary: #3b4453 !important;
    --text-muted: #687183 !important;
    --primary: #1d5bbf !important;
    --primary-hover: #164a9e !important;
    --on-primary: #ffffff !important;
    --accent-text: #1d5bbf !important;
    --primary-subtle: #edf3fc !important;
    --primary-subtle-strong: #d9e6f8 !important;
    --primary-subtle-border: #a9c4ec !important;
    --primary-soft: #c4d7f3 !important;
    --success-subtle: #ecf8f1 !important;
    --success-border: #a8dcbd !important;
    --success-text: #146c3c !important;
    --warning-subtle: #fdf5e3 !important;
    --warning-border: #f0cf86 !important;
    --warning-text: #7a4a07 !important;
    --danger-subtle: #fdf0f0 !important;
    --danger-border: #f3c0c0 !important;
    --danger-text: #b42323 !important;
    --highlight: #fdf0a6 !important;
    --focus-ring: #1d5bbf !important;
    --shadow-card: 0 1px 2px rgb(16 24 40 / 0.05) !important;
    --shadow-pop: 0 4px 16px rgb(16 24 40 / 0.1), 0 1px 3px rgb(16 24 40 / 0.06) !important;
    --shadow-sheet: 0 16px 40px rgb(16 24 40 / 0.18), 0 2px 6px rgb(16 24 40 / 0.08) !important;
    --scrim: rgb(15 23 42 / 0.45) !important;
  }
`;

export function useAppTheme() {
  const [theme, setTheme] = useState<AppTheme>("light");

  // Initialise depuis localStorage, sinon depuis la preference systeme.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        setTheme(stored);
      } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      }
    } catch {
      // ignore storage access issues
    }
  }, []);

  // Applique le theme courant en surchargeant les tokens de :root.
  useEffect(() => {
    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = theme === "dark" ? DARK_CSS : LIGHT_CSS;
  }, [theme]);

  const toggleTheme = () => {
    const next: AppTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return { theme, toggleTheme };
}
