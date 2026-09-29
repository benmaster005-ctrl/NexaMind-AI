import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getNavItems } from "@/lib/dashboard/helpers";
import { Card, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import AppNav from "@/components/ui/app-nav";
import { READY_STATUS } from "@/lib/ai/summary";
import { buildDocumentView, formatChunkPosition } from "@/lib/resources/view";
import dashboardStyles from "@/components/dashboard/dashboard.module.css";
import SummarySheet from "@/components/resources/summary-sheet";
import ChunkAnchor from "@/components/resources/chunk-anchor";
import styles from "./resource-fiche.module.css";

export const metadata: Metadata = {
  title: "Document — NexaMind AI",
  description: "Consultation d'un document interne et synthèse automatique.",
};

/**
 * Budget d'exécution (préparation déploiement Vercel) : le bouton « Résumer »
 * envoie l'ensemble des morceaux du document à Gemini (`generateText`) dans
 * une Server Action de cette page. Plafond explicite et portable, aligné sur
 * celui de la route de chat (120 s) : un document long dépasse le plafond
 * historique de 60 s du plan Hobby, et une action coupée laisserait le
 * document sans synthèse.
 */
export const maxDuration = 120;

/**
 * Page /resources/[id] — fiche de consultation (stories 5.1 FR-14 et 6.1).
 *
 * Elle rend fonctionnel le lien deja present dans les resultats de recherche
 * (`components/search/search-client.tsx`), qui renvoyait 404. RLS masque les
 * documents : introuvable -> 404 (pas de fuite d'information, R-7).
 *
 * 6.1 : le contenu vient des morceaux deja stockes (`document_chunks.content`,
 * lecture RLS ouverte aux authentifies) — aucune migration, aucun appel IA.
 * `?chunk=<uuid>` marque le passage cite : surbrillance posee par le serveur,
 * URL partageable, et la page reste lisible sans JavaScript.
 */
export default async function ResourceFichePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ chunk?: string | string[] }>;
}) {
  const { id } = await params;
  const rawChunk = (await searchParams)?.chunk;
  // Ancre invalide (vide, tableau, id forge) -> simple affichage du document.
  const targetChunkId = typeof rawChunk === "string" ? rawChunk.trim() : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Hors du try : `redirect` leve une erreur interne de Next qu'un `catch`
  // avalerait, transformant la redirection en 404 silencieux.
  if (!user) redirect("/login");

  let resource: {
    id: string;
    title: string;
    category: string;
    status: string;
    created_at: string;
    tags: string[] | null;
    storage_path: string | null;
  } | null = null;
  let view: ReturnType<typeof buildDocumentView> | null = null;

  try {
    const { data } = await supabase
      .from("resources")
      .select("id, title, category, status, created_at, tags, storage_path")
      .eq("id", id)
      .maybeSingle();
    resource = data ?? null;

    // 6.1 : contenu issu des morceaux indexes, dans l'ordre de lecture.
    if (resource) {
      const { data: chunks } = await supabase
        .from("document_chunks")
        .select("id, chunk_index, content")
        .eq("resource_id", id)
        .order("chunk_index", { ascending: true });
      view = buildDocumentView(chunks ?? [], { targetChunkId });
    }
  } catch {
    resource = null;
    view = null;
  }

  if (!resource) notFound();

  const navItems = getNavItems();
  const tags = resource.tags ?? [];
  const canSummarize = resource.status === READY_STATUS;

  return (
    <div className={dashboardStyles.page}>
      <div className={dashboardStyles.inner}>
        <PageHeader
          title={resource.title}
          description="Document partagé — le contenu est indexé et citable depuis la recherche et l’assistant."
        />

        <Card aria-label="Document">
          <p className={styles.meta}>
            {resource.category} · {resource.status} ·{" "}
            {new Date(resource.created_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          {tags.length > 0 ? (
            <p className={styles.tags}>{tags.join(" · ")}</p>
          ) : null}
          {!canSummarize ? (
            <p className={styles.notice} role="status">
              Ce document n’est pas encore indexé : la synthèse sera disponible
              dès que son indexation sera terminée.
            </p>
          ) : null}

          <div className={styles.actions}>
            <SummarySheet
              resourceId={resource.id}
              title={resource.title}
              canSummarize={canSummarize}
            />
          </div>
        </Card>

        {/* 6.1 : contenu du document, en sections (texte React, jamais de
            HTML brut). Le defilement vers le passage cite est le seul
            JavaScript de la page, via ChunkAnchor. */}
        {view && view.chunks.length > 0 ? (
          <Card aria-label="Contenu du document">
            <CardTitle>Contenu</CardTitle>
            {view.truncated ? (
              <p className={styles.notice} role="status">
                Document volumineux : seule une partie du contenu est affichée
                ici.
              </p>
            ) : null}
            <div className={styles.document}>
              {view.chunks.map((chunk) => (
                <article
                  key={chunk.id}
                  id={`passage-${chunk.index}`}
                  data-active={chunk.isActive ? "true" : "false"}
                  className={chunk.isActive ? styles.passageActive : styles.passage}
                  aria-current={chunk.isActive ? "true" : undefined}
                  aria-label={formatChunkPosition(chunk.index, view.chunks.length)}
                >
                  <p className={styles.passageLabel}>
                    {formatChunkPosition(chunk.index, view.chunks.length)}
                    {/* La couleur seule ne suffit pas : on annonce le
                        passage cible aux lecteurs d'ecran et a l'oeil nu. */}
                    {chunk.isActive ? (
                      <span className={styles.passageBadge}>Passage cité</span>
                    ) : null}
                  </p>
                  <p className={styles.passageText}>{chunk.text}</p>
                </article>
              ))}
            </div>
            <p className={styles.actions}>
              <Link
                className={styles.documentLink}
                href={`/search?q=${encodeURIComponent(resource.title)}`}
              >
                Rechercher d’autres documents
              </Link>
            </p>
          </Card>
        ) : (
          <Card aria-label="Contenu du document">
            <CardTitle>Contenu</CardTitle>
            <p className={styles.notice} role="status">
              {canSummarize
                ? "Contenu non disponible : ce document n’a pas encore de texte indexé."
                : "Le contenu sera disponible dès que l’indexation du document sera terminée."}
            </p>
          </Card>
        )}

        <ChunkAnchor active={Boolean(view?.hasAnchor)} />

        <AppNav items={navItems} active="/search" />
      </div>
    </div>
  );
}
