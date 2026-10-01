"use client";

import { useState, useMemo } from "react";
import { Icon } from "@/components/ui/icon";
import { documentTypeLabel, type IconName } from "@/lib/dashboard/helpers";
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

function getCategoryIcon(cat: string, isExpanded: boolean): IconName {
  const lower = cat.toLowerCase();
  if (lower.includes("procédure") || lower.includes("procedure")) return "check";
  if (lower.includes("faq") || lower.includes("question")) return "chat";
  if (lower.includes("guide") || lower.includes("ressource")) return "book";
  if (lower.includes("mes") || lower.includes("personnel")) return "user";
  return isExpanded ? "folderOpen" : "folder";
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
  // Filter state for quick search in sidebar
  const [filterQuery, setFilterQuery] = useState("");

  // Accordion state: keep track of collapsed categories
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [isMyDocsCollapsed, setIsMyDocsCollapsed] = useState(false);

  // Filter predicate
  const query = filterQuery.trim().toLowerCase();
  const matchesFilter = (doc: ResourceData) =>
    !query ||
    doc.title.toLowerCase().includes(query) ||
    doc.category.toLowerCase().includes(query);

  // Split documents: "Mes ressources" vs "Ressources entreprise"
  const myDocuments = useMemo(
    () => documents.filter((doc) => doc.created_by && doc.created_by === currentUserId && matchesFilter(doc)),
    [documents, currentUserId, query],
  );
  const companyDocuments = useMemo(
    () => documents.filter((doc) => (!doc.created_by || doc.created_by !== currentUserId) && matchesFilter(doc)),
    [documents, currentUserId, query],
  );

  // Group company documents by category
  const categoriesMap = useMemo(() => {
    const map = new Map<string, ResourceData[]>();
    for (const doc of companyDocuments) {
      const list = map.get(doc.category) ?? [];
      list.push(doc);
      map.set(doc.category, list);
    }
    return map;
  }, [companyDocuments]);

  // Filtered view when a specific category is selected
  const isAllCategories = selectedCategory === "Toutes";
  const filteredCompanyDocuments = useMemo(() => {
    return isAllCategories
      ? companyDocuments
      : companyDocuments.filter((doc) => doc.category === selectedCategory);
  }, [isAllCategories, companyDocuments, selectedCategory]);

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
          onClick={() => {
            onSelectDocument(doc);
            onCloseMobile?.();
          }}
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

        {/* Collapsed rail — sleek compact toolbar */}
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
            <button
              type="button"
              className={styles.sidebarRailAction}
              onClick={onOpenUpload}
              aria-label="Ajouter une ressource"
              title="Ajouter une ressource"
            >
              <Icon name="plus" />
            </button>
            <div className={styles.sidebarRailDivider} />
            <button
              type="button"
              className={styles.sidebarRailAction}
              onClick={onToggleCollapse}
              aria-label="Bibliothèque de documents"
              title={`Bibliothèque (${documents.length} documents)`}
            >
              <Icon name="book" />
            </button>
          </div>
        ) : (
          <>
            {/* Top row with Title, Doc Count, and Action Controls */}
            <div className={styles.sidebarTopRow}>
              <div className={styles.sidebarTopRowTitle}>
                <span>Bibliothèque</span>
                <span className={styles.categoryBadge}>{documents.length}</span>
              </div>
              <div className={styles.sidebarHeaderActions}>
                <button
                  type="button"
                  className={styles.sidebarHeaderAction}
                  onClick={onOpenUpload}
                  title="Ajouter une ressource"
                  aria-label="Ajouter une ressource"
                >
                  <Icon name="plus" />
                </button>
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
            </div>

            {/* Quick Filter Search Box */}
            <div className={styles.sidebarFilterWrap}>
              <div className={styles.sidebarFilterBox}>
                <Icon name="search" />
                <input
                  type="text"
                  className={styles.sidebarFilterInput}
                  placeholder="Filtrer les documents…"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  aria-label="Filtrer les documents"
                />
                {filterQuery ? (
                  <button
                    type="button"
                    className={styles.sidebarFilterClear}
                    onClick={() => setFilterQuery("")}
                    aria-label="Effacer le filtre"
                  >
                    <Icon name="close" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className={styles.sidebarScroll}>
              {/* Section 1: MES RESSOURCES */}
              {myDocuments.length > 0 ? (
                <div className={styles.sidebarSection}>
                  <div className={styles.sectionHeader}>Mes ressources</div>
                  <div className={styles.accordionWrap}>
                    <button
                      type="button"
                      className={styles.accordionHeader}
                      onClick={() => setIsMyDocsCollapsed(!isMyDocsCollapsed)}
                      aria-expanded={!isMyDocsCollapsed}
                    >
                      <span className={styles.accordionTitle}>
                        <span className={`${styles.accordionChevron} ${!isMyDocsCollapsed ? styles.accordionChevronOpen : ""}`}>
                          <Icon name="chevronRight" />
                        </span>
                        <span className={styles.categoryIcon}>
                          <Icon name="user" />
                        </span>
                        <span className={styles.accordionTitleText}>Mes documents</span>
                      </span>
                      <span className={styles.categoryBadge}>{myDocuments.length}</span>
                    </button>
                    {!isMyDocsCollapsed ? (
                      <ul className={styles.nestedDocList} role="list">
                        {myDocuments.map(renderDocumentRow)}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Section 2: RESSOURCES DE L'ENTREPRISE */}
              <div className={styles.sidebarSection}>
                <div className={styles.sectionHeader}>Ressources de l&apos;entreprise</div>

                {isAllCategories ? (
                  // Mode "Toutes" : affichage en accordéons organisés par catégorie
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
                            <span className={`${styles.accordionChevron} ${!isCategoryCollapsed ? styles.accordionChevronOpen : ""}`}>
                              <Icon name="chevronRight" />
                            </span>
                            <span className={styles.categoryIcon}>
                              <Icon name={getCategoryIcon(catName, !isCategoryCollapsed)} />
                            </span>
                            <span className={styles.accordionTitleText}>{catName}</span>
                          </span>
                          <span className={styles.categoryBadge}>{catDocs.length}</span>
                        </button>
                        {!isCategoryCollapsed ? (
                          <ul className={styles.nestedDocList} role="list">
                            {catDocs.map(renderDocumentRow)}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  // Mode catégorie spécifique
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

                {documents.length > 0 && query && myDocuments.length === 0 && companyDocuments.length === 0 ? (
                  <div className={styles.emptyNotice}>
                    Aucun document correspondant à « {filterQuery} ».
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

        <div className={styles.sidebarFilterWrap}>
          <div className={styles.sidebarFilterBox}>
            <Icon name="search" />
            <input
              type="text"
              className={styles.sidebarFilterInput}
              placeholder="Filtrer les documents…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              aria-label="Filtrer les documents"
            />
            {filterQuery ? (
              <button
                type="button"
                className={styles.sidebarFilterClear}
                onClick={() => setFilterQuery("")}
                aria-label="Effacer le filtre"
              >
                <Icon name="close" />
              </button>
            ) : null}
          </div>
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
