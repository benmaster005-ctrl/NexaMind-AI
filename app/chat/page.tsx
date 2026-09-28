import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { normalizeUserRole, getNavItems } from "@/lib/dashboard/helpers";
import AppNav from "@/components/ui/app-nav";
import dashboardStyles from "@/components/dashboard/dashboard.module.css";
import ChatClient from "@/components/chat/chat-client";

export const metadata: Metadata = {
  title: "Assistant — NexaMind AI",
  description:
    "Posez vos questions en langage naturel sur les documents internes de NexaWorks (RAG avec citations).",
};

/**
 * Page /chat (story 4.3, FR-10/FR-11/FR-12).
 * Server mince : nav rolee + chargement leger. La discussion elle-meme
 * est cote client (streaming NDJSON vers /api/chat).
 */
export default async function ChatPage() {
  let navRole = normalizeUserRole(null);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    navRole = normalizeUserRole(user?.app_metadata?.["role"]);
  } catch {
    navRole = normalizeUserRole(null);
  }
  const navItems = getNavItems(navRole);

  return (
    <div className={dashboardStyles.page}>
      <div className={dashboardStyles.inner}>
        <ChatClient />
        <AppNav items={navItems} active="/chat" />
      </div>
    </div>
  );
}
