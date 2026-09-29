import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getNavItems, formatRelativeDate } from "@/lib/dashboard/helpers";
import { Card, CardTitle } from "@/components/ui/card";
import AppNav from "@/components/ui/app-nav";
import { buildHistoryItems, formatExchangeLabel, HISTORY_LIMIT } from "@/lib/chat/conversations";
import { listSearchHistory } from "@/lib/search/history-store";
import type { SearchHistoryItem } from "@/lib/search/history";
import SearchHistoryList from "@/components/search/search-history-list";
import dashboardStyles from "@/components/dashboard/dashboard.module.css";
import styles from "./history.module.css";

export const metadata: Metadata = {
  title: "Historique — NexaMind AI",
  description: "Vos conversations passées, reprises avec leurs citations.",
};

/**
 * Page /history (story 5.2, FR-15).
 *
 * L'onglet « Historique » existe deja dans la navigation (`lib/dashboard/helpers.ts`) : cette page le rend fonctionnel. La route est
 * protegee par le middleware (`decideRouteGuard`) et la liste est strictement
 * personnelle grace a la RLS `owner_conversations` (R-7) : aucun `owner_id`
 * n'est transmis ni filtre cote client.
 */
export default async function HistoryPage() {
  let items: ReturnType<typeof buildHistoryItems> = [];
  let searches: SearchHistoryItem[] = [];

  try {
    const supabase = await createClient();
    // 5.3 : recherches personnelles (RLS). Migration 0007 absente -> liste
    // vide, la section est simplement masquee.
    searches = await listSearchHistory({ client: supabase });

    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    const rows = conversations ?? [];
    // 2e lecture uniquement si besoin : le cas « aucune conversation » ne
    // doit pas provoquer de requete (matrice I/O, ligne EMPTY).
    if (rows.length > 0) {
      const { data: messages } = await supabase
        .from("messages")
        .select("conversation_id, role")
        .in(
          "conversation_id",
          rows.map((c) => String(c.id)),
        );
      items = buildHistoryItems(rows, messages ?? []);
    }
  } catch {
    items = [];
  }

  const navItems = getNavItems();

  return (
    <div className={dashboardStyles.page}>
      <div className={dashboardStyles.inner}>
        <Card  aria-label="Historique des conversations">
          <CardTitle>Historique</CardTitle>

          {items.length > 0 ? (
            <ul className={styles.list}>
              {items.map((item) => (
                <li key={item.id}>
                  <Link className={styles.link} href={`/chat/${item.id}`}>
                    <span className={styles.title}>{item.title}</span>
                    <span className={styles.meta}>
                      <span className={styles.date}>
                        {formatRelativeDate(item.createdAt)}
                      </span>
                      <span className={styles.count}>
                        {formatExchangeLabel(item.exchangeCount)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>
              Aucune conversation pour le moment.{" "}
              <Link href="/chat">Posez votre première question</Link> pour
              commencer, elle apparaîtra ici.
            </p>
          )}
        </Card>

        {searches.length > 0 ? (
          <Card
            
            aria-label="Recherches recentes"
          >
            <CardTitle>Recherches récentes</CardTitle>
            <SearchHistoryList items={searches} />
          </Card>
        ) : null}

        <AppNav items={navItems} active="/history" />
      </div>
    </div>
  );
}
