import type { Metadata } from "next";

import { getNavItems } from "@/lib/dashboard/helpers";
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
  const navItems = getNavItems();

  return (
    <div className={dashboardStyles.page}>
      <div className={dashboardStyles.inner}>
        <ChatClient />
        <AppNav items={navItems} active="/chat" />
      </div>
    </div>
  );
}
