import { Card, CardTitle } from "@/components/ui/card";
import dashboardStyles from "@/components/dashboard/dashboard.module.css";

/** Skeleton de chargement de /search (Suspense Next.js). */
export default function SearchLoading() {
  return (
    <div className={dashboardStyles.page}>
      <div className={dashboardStyles.inner}>
        <Card aria-label="Chargement">
          <CardTitle>Recherche</CardTitle>
          <p className={dashboardStyles.empty} role="status">
            Chargement de la recherche...
          </p>
        </Card>
      </div>
    </div>
  );
}
