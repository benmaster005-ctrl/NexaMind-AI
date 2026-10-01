"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { documentTypeLabel } from "@/lib/dashboard/helpers";
import type { ResourceData } from "@/app/actions/workspace";
import styles from "./workspace.module.css";

interface DocumentSidebarProps {
  documents: ResourceData[];
  currentUserId: string;
  selectedDocId: string | null;
  selectedCategory: string;
  onSelectDocument: (doc: ResourceData) => void;
  onOpenUpload: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function DocumentSidebar({
  documents,
  currentUserId,
  selectedDocId,
  selectedCategory,
  onSelectDocument,
  onOpenUpload,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}: DocumentSidebarProps) {
  // Accordion state: keep track of collapsed categories
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [isMyDocsCollapsed, setIsMyDocsCollapsed] = useState(false);

  // Split documents: "Mes ressources" (created_by === currentUserId) vs "Ressources entreprise"
  const myDocuments = documents.filter((doc) => doc.created_by && doc.created_by === currentUserId);
  const companyDocuments = documents.filter((doc) => !doc.created_by || doc.created_by !== currentUserId);

  // Group company documents by category
  const categoriesMap = new Map<string, ResourceData[]>();
  for (const doc of companyDocuments) {
    const list = categoriesMap.get(doc.category) ?? [];
    list.push(doc);
    categoriesMap.set(doc.category, list);
  }

  // Filtered view when a specific category is selected
  const isAllCategories = selectedCategory === "Toutes";
  const filteredCompanyDocuments = isAllCategories
    ? companyDocuments
    : companyDocuments.filter((doc) => doc.category === selectedCategory);

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const renderDocumentRow = (doc: ResourceData) => {
    const isActive = selectedDocId === doc.id;
    const format = documentTypeLabel(doc.storage_path);
    return (
      <li key={doc.id}>
        <button
          type="button"
          className={`${styles.docRow} ${isActive ? styles.docRowActive : ""}`}
          onClick={() => onSelectDocument(doc)}
          title={doc.title}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon name="file" />
          <span className={styles.docTitle}>{doc.title}</span>
          {format ? <span className={styles.formatTag}>{format}</span> : null}
        </button>
      </li>
    );
  };

  return (
    <>
      {isOpenMobile ? (
        <div
          className={styles.drawerBackdrop}
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`${styles.sidebar} ${isOpenMobile ? styles.sidebarOpen : ""} ${isCollapsed ? styles.sidebarCollapsed : ""} ${styles.desktopOnly}`}
        aria-label="Navigation de la bibliothèque documentaire"
      >
        {/* Mobile header — only shown in mobile drawer mode */}
        <div className={`${styles.drawerHeader} ${styles.mobileOnly}`}>
          <div className={styles.drawerTitleWrap}>
            <button
              type="button"
              className={styles.drawerBackAction}
              onClick={onCloseMobile}
              aria-label="Fermer la bibliothèque"
            >
              <Icon name="arrow" className={styles.iconRotate180} />
            </button>
            <span className={styles.drawerTitle}>Bibliothèque</span>
          </div>
          <button
            type="button"
            className={styles.drawerCloseControl}
            onClick={onCloseMobile}
            aria-label="Fermer"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Collapsed rail — only the toggle button visible */}
        {isCollapsed ? (
          <div className={styles.sidebarCollapseRail}>
            <button
              type="button"
              className={styles.sidebarCollapseControl}
              onClick={onToggleCollapse}
              aria-label="Développer la bibliothèque"
              title="Développer la bibliothèque"
            >
              <Icon name="sidebar" />
            </button>
          </div>
        ) : (
          <>
            {/* Top row with title + collapse toggle */}
            <div className={styles.sidebarTopRow}>
              <span className={styles.sidebarTopRowTitle}>Bibliothèque</span>
              <button
                type="button"
                className={styles.sidebarCollapseControl}
                onClick={onToggleCollapse}
                aria-label="Réduire la bibliothèque"
                title="Réduire la bibliothèque"
              >
                <Icon name="sidebar" />
              </button>
            </div>

            <div className={styles.sidebarTop}>
              <button
                type="button"
                className={styles.addResourceAction}
                onClick={() => {
                  onOpenUpload();
                  onCloseMobile();
                }}
              >
                <Icon name="plus" />
                <span>Ajouter une ressource</span>
              </button>
            </div>

          <div className={styles.sidebarScroll}>
            {/* Section 1: MES RESSOURCES */}
            {myDocuments.length > 0 ? (
              <div className={styles.sidebarSection}>
                <div className={styles.sectionHeader}>Mes ressources</div>
                <button
                  type="button"
                  className={styles.accordionHeader}
                  onClick={() => setIsMyDocsCollapsed(!isMyDocsCollapsed)}
                  aria-expanded={!isMyDocsCollapsed}
                >
                  <span className={styles.accordionTitle}>
                    <Icon name={isMyDocsCollapsed ? "chevronRight" : "chevronDown"} />
                    <span>Mes documents</span>
                  </span>
                  <span className={styles.categoryBadge}>{myDocuments.length}</span>
                </button>
                {!isMyDocsCollapsed ? (
                  <ul className={styles.docList} role="list">
                    {myDocuments.map(renderDocumentRow)}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {/* Section 2: RESSOURCES DE L'ENTREPRISE */}
            <div className={styles.sidebarSection}>
              <div className={styles.sectionHeader}>Ressources de l&apos;entreprise</div>

              {isAllCategories ? (
                // Mode "Toutes" : affichage de toutes les catégories en accordéon
                Array.from(categoriesMap.entries()).map(([catName, catDocs]) => {
                  const isCategoryCollapsed = Boolean(collapsedCategories[catName]);
                  return (
                    <div key={catName} className={styles.accordionWrap}>
                      <button
                        type="button"
                        className={styles.accordionHeader}
                        onClick={() => toggleCategory(catName)}
                        aria-expanded={!isCategoryCollapsed}
                      >
                        <span className={styles.accordionTitle}>
                          <Icon name={isCategoryCollapsed ? "chevronRight" : "chevronDown"} />
                          <span>{catName}</span>
                        </span>
                        <span className={styles.categoryBadge}>{catDocs.length}</span>
                      </button>
                      {!isCategoryCollapsed ? (
                        <ul className={styles.docList} role="list">
                          {catDocs.map(renderDocumentRow)}
                        </ul>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                // Mode catégorie spécifique : liste des documents de cette catégorie
                <ul className={styles.docList} role="list">
                  {filteredCompanyDocuments.length > 0 ? (
                    filteredCompanyDocuments.map(renderDocumentRow)
                  ) : (
                    <li className={styles.emptyNotice}>
                      Aucun document dans cette catégorie.
                    </li>
                  )}
                </ul>
              )}

              {documents.length === 0 ? (
                <div className={styles.emptyNotice}>
                  Aucun document pour le moment.
                </div>
              ) : null}
            </div>
          </div>
          </>
        )}
      </aside>

      {/* Mobile sidebar — separate from the desktop collapsed one */}
      <aside
        className={`${styles.sidebar} ${isOpenMobile ? styles.sidebarOpen : ""} ${styles.mobileOnly}`}
        aria-label="Navigation de la bibliothèque documentaire (mobile)"
      >
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitleWrap}>
            <button
              type="button"
              className={styles.drawerBackAction}
              onClick={onCloseMobile}
              aria-label="Fermer la bibliothèque"
            >
              <Icon name="arrow" className={styles.iconRotate180} />
            </button>
            <span className={styles.drawerTitle}>Bibliothèque</span>
          </div>
          <button
            type="button"
            className={styles.drawerCloseControl}
            onClick={onCloseMobile}
            aria-label="Fermer"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className={styles.sidebarTop}>
          <button
            type="button"
            className={styles.addResourceAction}
            onClick={() => {
              onOpenUpload();
              onCloseMobile();
            }}
          >
            <Icon name="plus" />
            <span>Ajouter une ressource</span>
          </button>
        </div>

        <div className={styles.sidebarScroll}>
          {myDocuments.length > 0 ? (
            <div className={styles.sidebarSection}>
              <div className={styles.sectionHeader}>Mes ressources</div>
              <ul className={styles.docList} role="list">
                {myDocuments.map(renderDocumentRow)}
              </ul>
            </div>
          ) : null}
          <div className={styles.sidebarSection}>
            <div className={styles.sectionHeader}>Ressources de l&apos;entreprise</div>
            <ul className={styles.docList} role="list">
              {companyDocuments.map(renderDocumentRow)}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}

