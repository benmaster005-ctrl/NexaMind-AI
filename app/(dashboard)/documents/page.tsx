import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getNavItems } from "@/lib/dashboard/helpers";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import AppNav from "@/components/ui/app-nav";
import { buttonClass } from "@/components/ui/button";
import ResourceItem from "@/components/resources/resource-item";
import UploadForm from "@/components/resources/upload-form";
import dashboardStyles from "@/components/dashboard/dashboard.module.css";

/**
 * Budget d'exécution (préparation déploiement Vercel).
 *
 * Le dépôt d'un document déclenche une Server Action qui téléverse le fichier
 * dans Supabase Storage puis lance l'ingestion (extraction du texte +
 * découpage + vectorisation Gemini) dans la même requête : c'est le chemin le
 * plus long de l'application, et un plafond trop bas couperait l'action en
 * cours d'indexation, laissant un document sans morceaux.
 * `maxDuration` se déclare au niveau de la page pour s'appliquer à ses
 * Server Actions. 300 s = le plafond du plan Hobby sous Fluid Compute : on
 * reste dans la garantie de la plateforme, sans la dépasser.
 */
export const maxDuration = 300;

interface ResourceRow {
  id: string;
  title: string;
  category: string;
  tags: string[];
  status: string;
  created_at: string;
  chunk_count: number | null;
  error_message: string | null;
}

/**
 * Espace de depot et de gestion documentaire partage (stories 2.1-2.4,
 * FR-5/FR-6/FR-7).
 * Ouvert a tout utilisateur authentifie (garde 1.3 : session requise, aucun
 * controle de role). Dépôt + édition métadonnées + suppression avec cascade
 * pgvector.
 */
export default async function DocumentsPage() {
  let resources: ResourceRow[] = [];
  let degraded = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("resources")
      .select(
        "id, title, category, tags, status, created_at, chunk_count, error_message",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    resources = (data ?? []) as ResourceRow[];
  } catch {
    degraded = true;
  }

  return (
    <div className={dashboardStyles.page}>
      <AppNav items={getNavItems()} active="/documents" />
      <div className={dashboardStyles.inner}>
        <header className={dashboardStyles.header}>
          <h1 className={dashboardStyles.brand}>
            Gérer les documents
            <Badge>Partage</Badge>
          </h1>
          <Link className={buttonClass("ghost")} href="/">
            ← Accueil
          </Link>
        </header>

        <Card aria-label="Déposer">
          <CardTitle>
            Déposer un document
          </CardTitle>
          <UploadForm />
        </Card>

        <Card aria-label="Ressources">
          <CardTitle>
            Ressources ({resources.length})
          </CardTitle>
          {resources.length > 0 ? (
            <ul className={dashboardStyles.conversations}>
              {resources.map((res) => (
                <ResourceItem
                  key={res.id}
                  id={res.id}
                  title={res.title}
                  category={res.category}
                  status={res.status}
                  createdAt={res.created_at}
                  chunkCount={res.chunk_count}
                  tags={Array.isArray(res.tags) ? res.tags : []}
                  errorMessage={res.error_message}
                />
              ))}
            </ul>
          ) : (
            <p className={dashboardStyles.empty}>
              Aucune ressource pour le moment. Déposez votre premier document
              ci-dessus.
            </p>
          )}
          {degraded ? (
            <p className={dashboardStyles.degraded} role="status">
              Liste temporairement indisponible — si le problème persiste, jouez
              la migration 0003_ingestion_chunks.sql dans Supabase &gt; SQL
              Editor &gt; Run. Le dépôt reste accessible.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}