import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getNavItems } from "@/lib/dashboard/helpers";
import AppNav from "@/components/ui/app-nav";
import dashboardStyles from "@/components/dashboard/dashboard.module.css";
import ChatClient from "@/components/chat/chat-client";
import { rowsToInitialMessages } from "@/lib/chat/conversations";

export const metadata: Metadata = {
  title: "Conversation — NexaMind AI",
  description: "Relecture et poursuite d'une conversation avec l'assistant.",
};

/**
 * Page /chat/[id] (story 4.4, FR-13).
 * Recharge le fil cote serveur. RLS masque les conversations d'autrui :
 * introuvable -> redirection vers /chat (pas de fuite d'information).
 */
export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let initialMessages: ReturnType<typeof rowsToInitialMessages> = [];
  let found = false;

  try {
    const supabase = await createClient();

    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    found = Boolean(conversation);

    if (found) {
      const { data: rows } = await supabase
        .from("messages")
        .select("id, role, content, meta, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });
      initialMessages = rowsToInitialMessages(rows ?? []);
    }
  } catch {
    found = false;
  }

  // Etrangere, inconnue ou requete en echec : redirection (FR-13 / R-7).
  if (!found) redirect("/chat");

  const navItems = getNavItems();

  return (
    <div className={dashboardStyles.page}>
      <div className={dashboardStyles.inner}>
        <ChatClient initialMessages={initialMessages} conversationId={id} />
        <AppNav items={navItems} active="/chat" />
      </div>
    </div>
  );
}
