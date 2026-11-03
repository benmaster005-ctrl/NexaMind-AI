import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import DocsView from "@/components/docs/docs-view";

export const metadata: Metadata = {
  title: "Guide & Documentation Complète — NexaMind AI",
  description:
    "Guide officiel complet d'utilisation de NexaMind AI pour toutes les catégories d'utilisateurs : débutant, collaborateur métier, ingénieur pro et administrateur.",
};

export default async function DocsPage() {
  let userEmail: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      userEmail = user.email;
    }
  } catch {
    userEmail = null;
  }

  return <DocsView userEmail={userEmail} />;
}

