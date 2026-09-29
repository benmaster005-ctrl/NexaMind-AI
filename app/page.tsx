import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  getTopNavItems,
  formatRelativeDate,
  formatHistoryStamp,
  documentTypeLabel,
  formatShortDate,
  type IconName,
} from "@/lib/dashboard/helpers";
import { listSearchHistory } from "@/lib/search/history-store";
import type { SearchHistoryItem } from "@/lib/search/history";
import AppNav from "@/components/ui/app-nav";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { READY_STATUS } from "@/lib/ai/summary";
import Brand from "@/components/dashboard/brand";
import UserBlock from "@/components/dashboard/user-block";
import styles from "@/components/dashboard/dashboard-home.module.css";

const RECENT_DOCUMENTS_LIMIT = 6;
const RECENT_SEARCHES_LIMIT = 5;
const RECENT_CONVERSATIONS_LIMIT = 4;

interface ResourceRow {
  id: string;
  title: string;
  category: string;
  status: string;
  storage_path: string | null;
  created_at: string;
}

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
}

/**
 * Les quatre entrees de l'accueil. Aucun bloc « Recherche » : la grande barre
 * tient deja ce role, un doublon la rendrait ambigue.
 */
const ACTIONS: {
  href: string;
  icon: IconName;
  title: string;
  text: string;
  cta: string;
}[] = [
  {
    href: "/chat",
    icon: "chat",
    title: "Assistant",
    text: "Posez une question à NexaMind et obtenez une réponse à partir des connaissances de l'entreprise.",
    cta: "Commencer une conversation",
  },
  {
    href: "/documents",
    icon: "upload",
    title: "Uploader une ressource",
    text: "Ajoutez un document pour enrichir la base de connaissances.",
    cta: "Ajouter une ressource",
  },
  {
    href: "/documents",
    icon: "documents",
    title: "Documents",
    text: "Consultez l'ensemble des documents de l'entreprise.",
    cta: "Voir les documents",
  },
  {
    href: "/history",
    icon: "history",
    title: "Historique de recherche",
    text: "Retrouvez vos recherches précédentes.",
    cta: "Voir l'historique",
  },
];

/**
 * Tableau de bord — point d'entree de la plateforme (FR-4, refonte 2026-09-29).
 *
 * Server Component : en-tete horizontal de 64px, titre fonctionnel, grande
 * barre de recherche, quatre blocs d'action, puis trois colonnes de contenu
 * reel (documents, recherches, conversations). Aucune salutation, aucune
 * donnee fictive : chaque bloc lit la base via la RLS, et une lecture en echec
 * degrade la colonne concernee — jamais la page entiere.
 *
 * Aucune API n'est ajoutee : la recherche est un GET vers /search?q=..., la
 * question un GET vers /chat?q=... (composeur de l'assistant pre-rempli) et
 * l'historique vient de `listSearchHistory`, deja utilise par /search.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let readyCount: number | null = null;
  let documents: ResourceRow[] = [];
  let conversations: ConversationRow[] = [];
  let searches: SearchHistoryItem[] = [];
  // Degradation par colonne (AC story 7.4) : un echec de lecture touche la
  // colonne concernee, jamais la page entiere.
  let documentsFailed = false;
  let conversationsFailed = false;

  try {
    const { count, error } = await supabase
      .from("resources")
      .select("id", { count: "exact", head: true })
      // Statut stocke exactement ainsi par la contrainte CHECK 0001 : 'Prête'.
      .eq("status", "Prête");
    if (error) throw error;
    readyCount = count ?? 0;
  } catch {
    // AC compteur : en echec, le chiffre disparaît au lieu d'afficher zero.
  }

  try {
    const { data, error } = await supabase
      .from("resources")
      .select("id, title, category, status, storage_path, created_at")
      .order("created_at", { ascending: false })
      .limit(RECENT_DOCUMENTS_LIMIT);
    if (error) throw error;
    documents = (data ?? []) as ResourceRow[];
  } catch {
    documentsFailed = true;
  }

  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(RECENT_CONVERSATIONS_LIMIT);
    if (error) throw error;
    conversations = (data ?? []) as ConversationRow[];
  } catch {
    conversationsFailed = true;
  }

  try {
    // Migration 0007 absente -> liste vide, aucun crash (meme contrat que /search).
    searches = (await listSearchHistory({ client: supabase })).slice(
      0,
      RECENT_SEARCHES_LIMIT,
    );
  } catch {
    searches = [];
  }

  return (
    <div className={styles.page}>
      <AppNav
        items={getTopNavItems()}
        active="/"
        variant="topbar"
        brand={<Brand />}
        actions={<UserBlock email={user?.email ?? ""} />}
      />

      <main className={styles.inner}>
        <PageHeader
          title="Vos connaissances d’entreprise, à portée de main"
          description="Retrouvez rapidement une information, consultez vos documents ou posez une question."
        />

        {/* Recherche : GET vers /search?q=... — le rejeu existe deja, aucun
            etat client, aucune nouvelle API. */}
        <form className={styles.searchBar} role="search" action="/search">
          <Icon name="search" className={styles.searchIcon} />
          <label className={styles.visuallyHidden} htmlFor="dashboard-search">
            Rechercher un document, une information ou un sujet
          </label>
          <input
            className={styles.searchInput}
            id="dashboard-search"
            name="q"
            type="search"
            maxLength={500}
            autoComplete="off"
            placeholder="Rechercher un document, une information ou un sujet..."
          />
          <button type="submit" className={buttonClass("primary", styles.searchSubmit)}>
            Rechercher
          </button>
        </form>

        <section className={styles.actions} aria-label="Actions principales">
          {ACTIONS.map((action) => (
            <Link key={action.title} className={styles.actionCard} href={action.href}>
              <span className={styles.actionIcon}>
                <Icon name={action.icon} className={styles.actionIconGlyph} />
              </span>
              <h2 className={styles.actionTitle}>{action.title}</h2>
              <p className={styles.actionText}>{action.text}</p>
              <span className={styles.actionCta}>
                {action.cta}
                <Icon name="arrow" className={styles.actionArrow} />
              </span>
            </Link>
          ))}
        </section>

        <div className={styles.columns}>
          <section className={styles.panel} aria-label="Documents récents">
            <header className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                Documents récents
                {readyCount === null ? null : (
                  <span className={styles.panelCount}>
                    {" "}
                    · {readyCount} prête{readyCount > 1 ? "s" : ""}
                  </span>
                )}
              </h2>
              <Link className={styles.seeAll} href="/documents">
                Voir tout
              </Link>
            </header>
            {documentsFailed ? (
              <p className={styles.degraded} role="status">
                Documents momentanément indisponibles — réessayez plus tard.
              </p>
            ) : documents.length > 0 ? (
              <ul className={styles.list}>
                {documents.map((doc) => {
                  const type = documentTypeLabel(doc.storage_path);
                  const date = formatShortDate(doc.created_at);
                  // Indexation en cours ou en echec : seul cas ou l'etat
                  // merite une pastille. Un document prete reste nu.
                  const pending = doc.status !== READY_STATUS;
                  return (
                    <li key={doc.id}>
                      <Link className={styles.row} href={`/resources/${doc.id}`}>
                        <span className={styles.rowIcon}>
                          <Icon name="file" className={styles.rowIconGlyph} />
                        </span>
                        <span className={styles.rowBody}>
                          <span className={styles.rowTitle}>{doc.title}</span>
                          <span className={styles.rowMeta}>
                            {[type, doc.category, date && `ajouté le ${date}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        {pending ? <Badge>{doc.status}</Badge> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.empty}>
                Aucun document pour le moment. Ajoutez une ressource pour alimenter
                la base.
              </p>
            )}
          </section>

          <section className={styles.panel} aria-label="Historique de recherche">
            <header className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Historique de recherche</h2>
              <Link className={styles.seeAll} href="/history">
                Voir tout
              </Link>
            </header>
            {searches.length > 0 ? (
              <ul className={styles.list}>
                {searches.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      className={styles.row}
                      href={`/search?q=${encodeURIComponent(entry.query)}`}
                    >
                      <Icon name="search" className={styles.rowGlyph} />
                      <span className={styles.rowBody}>
                        <span className={styles.rowTitle}>{entry.query}</span>
                        <span className={styles.rowMeta}>
                          {formatHistoryStamp(entry.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>
                Vos recherches précédentes apparaîtront ici.
              </p>
            )}
          </section>

          <section className={styles.panel} aria-label="Démarrer une conversation">
            <div className={styles.assistantHead}>
              <h2 className={styles.assistantTitle}>Démarrer une conversation</h2>
              <p className={styles.assistantText}>
                Posez une question à NexaMind et obtenez une réponse à partir des
                connaissances de l’entreprise.
              </p>
            </div>

            {/* Reutilise l'assistant existant : la question arrive sur /chat,
                ou le composeur est deja rempli. Aucun nouveau systeme. */}
            <div className={styles.askArea}>
              <form className={styles.askForm} action="/chat">
                <label className={styles.visuallyHidden} htmlFor="dashboard-question">
                  Posez votre question
                </label>
                <input
                  className={styles.askInput}
                  id="dashboard-question"
                  name="q"
                  type="text"
                  maxLength={2000}
                  autoComplete="off"
                  placeholder="Posez votre question..."
                />
                <button type="submit" className={styles.askSubmit}>
                  <Icon name="send" className={styles.askIcon} />
                  <span className={styles.visuallyHidden}>Envoyer la question</span>
                </button>
              </form>
            </div>

            <div className={styles.subhead}>
              <h3 className={styles.subheadTitle}>Dernières conversations</h3>
              <Link className={styles.seeAll} href="/history">
                Voir tout
              </Link>
            </div>

            {conversationsFailed ? (
              <p className={styles.degraded} role="status">
                Conversations momentanément indisponibles — réessayez plus tard.
              </p>
            ) : conversations.length > 0 ? (
              <ul className={styles.list}>
                {conversations.map((conv) => (
                  <li key={conv.id}>
                    <Link className={styles.row} href={`/chat/${conv.id}`}>
                      <span className={styles.rowAvatar}>
                        <Icon name="chat" className={styles.rowAvatarGlyph} />
                      </span>
                      <span className={styles.rowBody}>
                        <span className={styles.rowTitle}>{conv.title}</span>
                        <span className={styles.rowMeta}>
                          {formatRelativeDate(conv.created_at)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>
                Aucune conversation pour le moment. Posez votre première question.
              </p>
            )}
          </section>
        </div>

      </main>
    </div>
  );
}
