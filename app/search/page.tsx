import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { normalizeUserRole, getNavItems } from "@/lib/dashboard/helpers";
import AppNav from "@/components/ui/app-nav";
import dashboardStyles from "@/components/dashboard/dashboard.module.css";
import SearchClient from "@/components/search/search-client";
import { listSearchHistory } from "@/lib/search/history-store";
import type { SearchHistoryItem } from "@/lib/search/history";

export const metadata: Metadata = {
  title: "Recherche — NexaMind AI",
  description:
    "Interrogez le fonds documentaire NexaWorks : recherche semantique et textuelle.",
};

/**
 * Page /search (stories 3.3 FR-8 et 5.3 FR-16).
 * Server mince : nav rolee, categorie initiale (?category=), requete de rejeu
 * (?q=) et historique personnel lus en base (RLS).
 * La recherche elle-meme est cote client (debounce + fetch /api/search).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string; q?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const initialCategory =
    typeof params.category === "string" && params.category.trim()
      ? params.category.trim()
      : "Tous";
  // Rejeu depuis /history : la requete passee repart dans la barre.
  const initialQuery =
    typeof params.q === "string" && params.q.trim() ? params.q.trim() : "";

  let navRole = normalizeUserRole(null);
  let initialHistory: SearchHistoryItem[] = [];
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    navRole = normalizeUserRole(user?.app_metadata?.["role"]);
    // Migration 0007 absente -> liste vide, aucun crash (matrice I/O).
    initialHistory = await listSearchHistory({ client: supabase });
  } catch {
    navRole = normalizeUserRole(null);
    initialHistory = [];
  }
  const navItems = getNavItems(navRole);

  return (
    <div className={dashboardStyles.page}>
      <div className={dashboardStyles.inner}>
        <SearchClient
          initialCategory={initialCategory}
          initialQuery={initialQuery}
          initialHistory={initialHistory}
        />
        <AppNav items={navItems} active="/search" />
      </div>
    </div>
  );
}
