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
 *
 * `?q=` : question transmise par le tableau de bord. Elle pre-remplit le
 * composeur ; l'envoi reste une action explicite, sur le flux existant.
 */
export default async function ChatPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const raw = params.q;
  const initialQuestion =
    typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 2000) : "";

  const navItems = getNavItems();

  return (
    <div className={dashboardStyles.page}>
      <div className={dashboardStyles.inner}>
        <ChatClient initialQuestion={initialQuestion} />
        <AppNav items={navItems} active="/chat" />
      </div>
    </div>
  );
}
