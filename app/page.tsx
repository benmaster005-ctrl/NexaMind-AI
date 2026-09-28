import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  getNavItems,
  formatRelativeDate,
  normalizeUserRole,
} from "@/lib/dashboard/helpers";
import AppNav from "@/components/ui/app-nav";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import SignOutButton from "@/components/dashboard/signout-button";
import styles from "@/components/dashboard/dashboard.module.css";

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
}

/**
 * Tableau de bord (story 1.4, FR-4) - Server Component.
 * Protege par le middleware 1.3 : ici l'utilisateur est connecte.
 * Requete Supabase en echec -> mode degrade, jamais d'ecran bloque.
 */
export default async function Home() {
  let role = normalizeUserRole(null);
  let readyCount: number | null = null;
  let lastUpdate: string | null = null;
  let conversations: ConversationRow[] = [];
  let degraded = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    role = normalizeUserRole(user?.app_metadata?.["role"]);

    const { count, error: countError } = await supabase
      .from("resources")
      .select("id", { count: "exact", head: true })
      // Statut stocke exactement ainsi par la contrainte CHECK 0001 : 'Prête'.
      .eq("status", "Prête");
    if (countError) throw countError;
    readyCount = count ?? 0;

    const { data: latestResource } = await supabase
      .from("resources")
      .select("created_at")
      .eq("status", "Prête")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastUpdate = latestResource?.created_at ?? null;

    const { data: convs, error: convsError } = await supabase
      .from("conversations")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    if (convsError) throw convsError;
    conversations = (convs ?? []) as ConversationRow[];
  } catch {
    degraded = true;
  }

  const navItems = getNavItems(role);
  const isAdmin = role === "admin";

  return (
    <div className={styles.page}>
      <AppNav items={navItems} active="/" />

      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.brand}>
            NexaMind AI
            <Badge>{isAdmin ? "Admin" : "Collaborateur"}</Badge>
          </h1>
          <SignOutButton />
        </header>

        <Card aria-label="Recherche rapide">
          <CardTitle>Rechercher</CardTitle>
          <Link className={styles.searchLink} href="/search">
            <Icon name="search" className={styles.shortcutIcon} />
            Poser une question ou rechercher un document...
          </Link>
        </Card>

        <Card aria-label="Ressources disponibles">
          <CardTitle>Fonds documentaire</CardTitle>
          {readyCount !== null ? (
            <div className={styles.metric}>
              <span className={styles.metricNumber}>{readyCount}</span>
              <span className={styles.metricLabel}>
                ressource{readyCount > 1 ? "s" : ""} prete
                {readyCount > 1 ? "s" : ""}
              </span>
            </div>
          ) : null}
          {lastUpdate ? (
            <p className={styles.metricDate}>
              Mis a jour le{" "}
              {new Date(lastUpdate).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          ) : null}
          {degraded ? (
            <p className={styles.degraded} role="status">
              Donnees temporairement indisponibles - les raccourcis restent
              accessibles.
            </p>
          ) : null}
        </Card>

        <Card aria-label="Raccourcis">
          <CardTitle>Raccourcis</CardTitle>
          <div className={styles.shortcuts}>
            <Link className={styles.shortcut} href="/search">
              <Icon name="search" className={styles.shortcutIcon} />
              <span className={styles.shortcutLabel}>Recherche</span>
              <span className={styles.shortcutHint}>Retrouver un document</span>
            </Link>
            <Link className={styles.shortcut} href="/chat">
              <Icon name="chat" className={styles.shortcutIcon} />
              <span className={styles.shortcutLabel}>Assistant</span>
              <span className={styles.shortcutHint}>Poser une question</span>
            </Link>
          </div>
        </Card>

        {isAdmin ? (
          <Card aria-label="Administration">
            <CardTitle>Administration</CardTitle>
            <Link className={buttonClass("secondary")} href="/admin/resources">
              Deposer un document
            </Link>
          </Card>
        ) : null}

        <Card aria-label="Dernieres conversations">
          <CardTitle>Dernieres conversations</CardTitle>
          {conversations.length > 0 ? (
            <ul className={styles.conversations}>
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <Link
                    className={styles.conversationLink}
                    href={`/chat/${conv.id}`}
                  >
                    <span className={styles.conversationTitle}>
                      {conv.title}
                    </span>
                    <span className={styles.conversationDate}>
                      {formatRelativeDate(conv.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>
              Aucune conversation pour le moment.{" "}
              <Link href="/chat">Posez votre premiere question</Link> pour
              demarrer.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
