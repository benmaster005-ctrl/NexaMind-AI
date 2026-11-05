"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Brand from "@/components/dashboard/brand";
import { Icon } from "@/components/ui/icon";
import { useAppTheme } from "@/lib/theme/use-app-theme";
import styles from "./docs.module.css";

interface DocsViewProps {
  userEmail: string | null;
}

type AudienceCategory = "all" | "beginner" | "intermediate" | "pro" | "faq";

export default function DocsView({ userEmail }: DocsViewProps) {
  const { theme, toggleTheme } = useAppTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeAudience, setActiveAudience] = useState<AudienceCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<Record<string, boolean>>({
    faq1: true,
    faq2: false,
    faq3: false,
    faq4: false,
    faq5: false,
  });

  const toggleFaq = (id: string) => {
    setOpenFaq((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const q = searchQuery.toLowerCase().trim();

  const isVisible = (category: "beginner" | "intermediate" | "pro" | "faq", textContent: string) => {
    const matchesAudience = activeAudience === "all" || activeAudience === category;
    const matchesQuery = !q || textContent.toLowerCase().includes(q);
    return matchesAudience && matchesQuery;
  };

  const isDark = mounted && theme === "dark";

  return (
    <div
      className={styles.pageWrapper}
      data-theme={isDark ? "dark" : "light"}
      suppressHydrationWarning
    >
      {/* --- EN-TÊTE FIXE ÉPURÉ --- */}
      <header className={styles.docHeader}>
        <div className={styles.headerLeft}>
          <Brand />
          <span className={styles.dividerSlash}>/</span>
          <span className={styles.docsTitleBadge}>Documentation Utilisateur</span>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>
              <Icon name="search" />
            </span>
            <input
              type="text"
              placeholder="Rechercher dans le guide (ex: citations, upload, filtres...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Rechercher dans le guide d'utilisation"
            />
            {searchQuery ? (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setSearchQuery("")}
                aria-label="Effacer la recherche"
              >
                <Icon name="close" />
              </button>
            ) : null}
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.themeButton}
            onClick={toggleTheme}
            title={isDark ? "Mode clair" : "Mode sombre"}
            aria-label="Changer de thème"
          >
            <Icon name={isDark ? "sun" : "moon"} />
          </button>

          {userEmail ? (
            <Link href="/" className={styles.backToWorkspaceBtn}>
              <Icon name="sidebar" />
              <span>Workspace</span>
            </Link>
          ) : (
            <Link href="/login" className={styles.backToWorkspaceBtn}>
              <Icon name="user" />
              <span>Connexion</span>
            </Link>
          )}
        </div>
      </header>

      {/* --- BANDEAU NAVIGATION SECONDAIRE & FILTRES RAPIDES --- */}
      <div className={styles.subHeaderBar}>
        <div className={styles.breadcrumbNav}>
          <Link href="/" className={styles.breadcrumbItem}>NexaMind AI</Link>
          <span>/</span>
          <span className={styles.breadcrumbItem}>Guide d&apos;utilisation</span>
          <span>/</span>
          <span className={styles.breadcrumbCurrent}>
            {activeAudience === "beginner"
              ? "Débutant"
              : activeAudience === "intermediate"
              ? "Collaborateur"
              : activeAudience === "pro"
              ? "Utilisateur Pro"
              : activeAudience === "faq"
              ? "FAQ"
              : "Vue Complète"}
          </span>
        </div>

        <div className={styles.audienceTabsGroup} role="tablist">
          <button
            type="button"
            className={`${styles.audienceTab} ${activeAudience === "all" ? styles.audienceTabActive : ""}`}
            onClick={() => setActiveAudience("all")}
            role="tab"
            aria-selected={activeAudience === "all"}
          >
            Tout
          </button>
          <button
            type="button"
            className={`${styles.audienceTab} ${activeAudience === "beginner" ? styles.audienceTabActive : ""}`}
            onClick={() => setActiveAudience("beginner")}
            role="tab"
            aria-selected={activeAudience === "beginner"}
          >
            Débutant
          </button>
          <button
            type="button"
            className={`${styles.audienceTab} ${activeAudience === "intermediate" ? styles.audienceTabActive : ""}`}
            onClick={() => setActiveAudience("intermediate")}
            role="tab"
            aria-selected={activeAudience === "intermediate"}
          >
            Collaborateur
          </button>
          <button
            type="button"
            className={`${styles.audienceTab} ${activeAudience === "pro" ? styles.audienceTabActive : ""}`}
            onClick={() => setActiveAudience("pro")}
            role="tab"
            aria-selected={activeAudience === "pro"}
          >
            Utilisateur Pro
          </button>
          <button
            type="button"
            className={`${styles.audienceTab} ${activeAudience === "faq" ? styles.audienceTabActive : ""}`}
            onClick={() => setActiveAudience("faq")}
            role="tab"
            aria-selected={activeAudience === "faq"}
          >
            Raccourcis & FAQ
          </button>
        </div>
      </div>

      {/* --- STRUCTURE 3 COLONNES --- */}
      <div className={styles.container}>
        {/* COLONNE GAUCHE : NAVIGATION HIÉRARCHIQUE */}
        <aside className={styles.leftSidebar}>
          <div className={styles.navGroup}>
            <div className={styles.navGroupHeader}>1. Premiers pas</div>
            <ul className={styles.navList}>
              <li className={styles.navItem}><a href="#intro" className={styles.navLink}>Qu&apos;est-ce que NexaMind AI ?</a></li>
              <li className={styles.navItem}><a href="#interface" className={styles.navLink}>L&apos;interface en 3 colonnes</a></li>
              <li className={styles.navItem}><a href="#premier-doc" className={styles.navLink}>Importer un document</a></li>
              <li className={styles.navItem}><a href="#premiere-question" className={styles.navLink}>Poser une question & Citations</a></li>
            </ul>
          </div>

          <div className={styles.navGroup}>
            <div className={styles.navGroupHeader}>2. Usages Collaborateur</div>
            <ul className={styles.navList}>
              <li className={styles.navItem}><a href="#categories" className={styles.navLink}>Les 5 catégories métiers</a></li>
              <li className={styles.navItem}><a href="#chunks-reading" className={styles.navLink}>Lecture par sections</a></li>
              <li className={styles.navItem}><a href="#conversations" className={styles.navLink}>Historique des échanges</a></li>
              <li className={styles.navItem}><a href="#prompts-efficaces" className={styles.navLink}>Poser des questions précises</a></li>
            </ul>
          </div>

          <div className={styles.navGroup}>
            <div className={styles.navGroupHeader}>3. Fonctions Avancées Pro</div>
            <ul className={styles.navList}>
              <li className={styles.navItem}><a href="#recherche-experte" className={styles.navLink}>Recherche rapide (Ctrl+K)</a></li>
              <li className={styles.navItem}><a href="#navigation-pro" className={styles.navLink}>Navigation par citations</a></li>
              <li className={styles.navItem}><a href="#bonnes-pratiques" className={styles.navLink}>Bonnes pratiques de dépôt</a></li>
              <li className={styles.navItem}><a href="#syntheses-complexes" className={styles.navLink}>Synthèses & Tableaux</a></li>
              <li className={styles.navItem}><a href="#fiabilite" className={styles.navLink}>Fiabilité & Zéro hallucination</a></li>
            </ul>
          </div>

          <div className={styles.navGroup}>
            <div className={styles.navGroupHeader}>4. Références & Support</div>
            <ul className={styles.navList}>
              <li className={styles.navItem}><a href="#raccourcis" className={styles.navLink}>Raccourcis clavier</a></li>
              <li className={styles.navItem}><a href="#formats" className={styles.navLink}>Formats acceptés</a></li>
              <li className={styles.navItem}><a href="#faq" className={styles.navLink}>Questions fréquentes (FAQ)</a></li>
            </ul>
          </div>
        </aside>

        {/* COLONNE CENTRALE : CONTENU ÉDITORIAL PRINCIPAL */}
        <main className={styles.mainArticle}>
          <header className={styles.articleHeader}>
            <div className={styles.badgePill}>
              <Icon name="book" />
              <span>Guide Officiel d&apos;Utilisation</span>
            </div>
            <h1 className={styles.articleTitle}>Guide Utilisateur NexaMind AI</h1>
            <p className={styles.articleLead}>
              Retrouvez, lisez et exploitez la mémoire documentaire de votre entreprise
              avec un assistant fiable qui source rigoureusement chaque information.
            </p>
          </header>

          {/* =========================================================================
              SECTION 1 : DÉBUTANT
             ========================================================================= */}
          {isVisible("beginner", "introduction débutant interface colonnes importation premier document questions citations") && (
            <section id="intro" className={styles.docSection}>
              <h2 className={styles.sectionHeading}>
                <Icon name="sparkles" />
                1. Prise en Main Rapide
              </h2>
              <p className={styles.paragraph}>
                NexaMind AI est conçu pour vous faire gagner un temps précieux dans la consultation
                des dossiers, chartes, comptes-rendus et procédures d&apos;entreprise.
              </p>

              <h3 className={styles.subHeading}>Qu&apos;est-ce que NexaMind AI ?</h3>
              <p className={styles.paragraph}>
                Contrairement aux chatbots généralistes du marché qui peuvent inventer des faits,
                NexaMind AI répond <strong>exclusivement à partir de vos vrais documents déposés</strong>.
                Chaque réponse est reliée au texte original par une citation cliquable.
              </p>

              <div className={styles.callout}>
                <div className={styles.calloutIcon}>💡</div>
                <div>
                  <div className={styles.calloutTitle}>La garantie de vérification en un clic</div>
                  <p className={styles.calloutText}>
                    Chaque fait énoncé par l&apos;IA est indexé par un numéro <code>[1]</code> ou <code>[2]</code>.
                    Un simple clic sur le repère vous amène directement au paragraphe source dans le lecteur.
                  </p>
                </div>
              </div>

              <h3 id="interface" className={styles.subHeading}>Comprendre l&apos;interface en 3 colonnes</h3>
              <div className={styles.featureGrid}>
                <div className={styles.featureCard}>
                  <span className={styles.stepIndex}>1</span>
                  <div className={styles.featureCardTitle}>Bibliothèque (Gauche)</div>
                  <p className={styles.featureCardDesc}>
                    La liste de tous vos documents et des ressources partagées de l&apos;entreprise. Filtrez par statut et par catégorie.
                  </p>
                </div>

                <div className={styles.featureCard}>
                  <span className={styles.stepIndex}>2</span>
                  <div className={styles.featureCardTitle}>Lecteur (Centre)</div>
                  <p className={styles.featureCardDesc}>
                    Le texte clair et structuré du document sélectionné. Les sections citées par l&apos;assistant s&apos;y surlignent immédiatement.
                  </p>
                </div>

                <div className={styles.featureCard}>
                  <span className={styles.stepIndex}>3</span>
                  <div className={styles.featureCardTitle}>Copilote IA (Droite)</div>
                  <p className={styles.featureCardDesc}>
                    Votre espace de dialogue avec l&apos;IA. Posez vos questions, consultez les sources citées et rouvrez vos sessions passées.
                  </p>
                </div>
              </div>

              <h3 id="premier-doc" className={styles.subHeading}>Importer votre premier document</h3>
              <ol style={{ paddingLeft: "20px", lineHeight: "1.75", fontSize: "0.9rem", color: "var(--doc-text-secondary)" }}>
                <li>Cliquez sur <strong>+ Nouveau document</strong> dans la barre supérieure ou la bibliothèque.</li>
                <li>Sélectionnez votre fichier (<code>.pdf</code>, <code>.docx</code>, <code>.txt</code> ou <code>.md</code> jusqu&apos;à 4 Mo).</li>
                <li>Indiquez un titre descriptif et sélectionnez sa <strong>catégorie</strong> (ex: <em>Procédures</em>, <em>Projets</em>, <em>Ressources</em>).</li>
                <li>Ajoutez des tags pour un classement aisé (ex: <code>rh</code>, <code>budget</code>).</li>
                <li>Validez avec <strong>Déposer et analyser</strong>. L&apos;analyse est finalisée en quelques secondes.</li>
              </ol>

              <h3 id="premiere-question" className={styles.subHeading}>Poser une question à l&apos;assistant</h3>
              <p className={styles.paragraph}>
                Saisissez votre question dans la barre en bas du lecteur ou directement dans le volet Assistant :
              </p>
              <div className={styles.callout}>
                <div className={styles.calloutIcon}>💬</div>
                <div>
                  <div className={styles.calloutTitle}>Exemple de question simple</div>
                  <p className={styles.calloutText}>
                    <em>&laquo; Quels sont les délais pour déclarer un congé d&apos;après le livret interne ? &raquo;</em>
                    <br />
                    L&apos;assistant répond en s&apos;appuyant sur l&apos;extrait et cite le document correspondant.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* =========================================================================
              SECTION 2 : COLLABORATEUR
             ========================================================================= */}
          {isVisible("intermediate", "collaborateur métier catégories organisation chunks lecture historique prompts") && (
            <section id="categories" className={styles.docSection}>
              <h2 className={styles.sectionHeading}>
                <Icon name="folder" />
                2. Organisation & Usages Collaborateur
              </h2>
              <p className={styles.paragraph}>
                Adoptez les bonnes pratiques de classement pour rendre l&apos;information fluide et accessible à l&apos;ensemble de l&apos;équipe.
              </p>

              <h3 className={styles.subHeading}>Les 5 Catégories Métiers de NexaMind</h3>
              <div className={styles.tableWrapper}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Catégorie</th>
                      <th>Usage</th>
                      <th>Exemples concrets</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Ressources</strong></td>
                      <td>Référentiels, grilles, documents statiques</td>
                      <td>Grille tarifaire, Annuaire interne, Glossaire</td>
                    </tr>
                    <tr>
                      <td><strong>Projets</strong></td>
                      <td>Cahiers des charges, plannings, specs</td>
                      <td>Spécification Alpha, Calendrier de déploiement</td>
                    </tr>
                    <tr>
                      <td><strong>Procédures</strong></td>
                      <td>Modes d&apos;emploi, protocoles, chartes RH</td>
                      <td>Charte télétravail, Guide des frais professionnels</td>
                    </tr>
                    <tr>
                      <td><strong>FAQ</strong></td>
                      <td>Questions et réponses récurrentes</td>
                      <td>FAQ Avantages sociaux, Support matériel</td>
                    </tr>
                    <tr>
                      <td><strong>Compte rendu</strong></td>
                      <td>Synthèses d&apos;ateliers, PV de comités</td>
                      <td>CR de réunion de direction, Bilan trimestriel</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 id="chunks-reading" className={styles.subHeading}>Lecture et découpage par sections</h3>
              <p className={styles.paragraph}>
                NexaMind partitionne automatiquement les documents volumineux en sections cohérentes.
                Cela évite de devoir parcourir des dizaines de pages : vous êtes guidé directement vers la section pertinente.
              </p>

              <h3 id="conversations" className={styles.subHeading}>Gestion de l&apos;historique</h3>
              <ul style={{ paddingLeft: "20px", lineHeight: "1.75", fontSize: "0.9rem", color: "var(--doc-text-secondary)" }}>
                <li>Retrouvez vos <strong>30 dernières conversations</strong> dans l&apos;onglet <em>Historique</em> du panneau droit.</li>
                <li>Reprenez une discussion antérieure sans perdre le fil des questions.</li>
                <li>Utilisez <strong>+ Nouvelle conversation</strong> pour repartir sur un sujet neuf.</li>
              </ul>

              <h3 id="prompts-efficaces" className={styles.subHeading}>Poser des questions précises</h3>
              <div className={styles.featureGrid}>
                <div className={styles.featureCard}>
                  <div className={styles.featureCardTitle}>🎯 Contextualisez</div>
                  <p className={styles.featureCardDesc}>
                    <em>&laquo; Selon la procédure de remboursement, quel est le montant forfaitaire pour les déplacements ? &raquo;</em>
                  </p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureCardTitle}>📋 Demandez des listes</div>
                  <p className={styles.featureCardDesc}>
                    <em>&laquo; Liste sous forme de puces les critères d&apos;éligibilité au forfait mobilité. &raquo;</em>
                  </p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureCardTitle}>🔍 Synthétisez</div>
                  <p className={styles.featureCardDesc}>
                    <em>&laquo; Résume les points d&apos;arbitrage du dernier compte-rendu en 3 phrases. &raquo;</em>
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* =========================================================================
              SECTION 3 : UTILISATEUR PRO
             ========================================================================= */}
          {isVisible("pro", "pro utilisateur avancé recherche experte ctrl k citations tableaux matrices filtres gouvernance") && (
            <section id="recherche-experte" className={styles.docSection}>
              <h2 className={styles.sectionHeading}>
                <Icon name="sparkles" />
                3. Fonctions Avancées pour Utilisateur Pro
              </h2>
              <p className={styles.paragraph}>
                Pour les utilisateurs intensifs : naviguez à la vitesse du clavier et réalisez des synthèses documentaires croisées.
              </p>

              <h3 className={styles.subHeading}>La Recherche Universelle (<kbd>Ctrl</kbd> + <kbd>K</kbd>)</h3>
              <p className={styles.paragraph}>
                Appuyez sur <kbd>Ctrl</kbd> + <kbd>K</kbd> (ou <kbd>Cmd</kbd> + <kbd>K</kbd> sur macOS) à tout moment.
                La palette sémantique vous permet de retrouver un document même si vous ne connaissez pas son titre exact.
                Naviguez avec les flèches directionnelles et validez avec <kbd>Entrée</kbd>.
              </p>

              <h3 id="navigation-pro" className={styles.subHeading}>Exploiter les citations chirurgicales</h3>
              <p className={styles.paragraph}>
                Dans les réponses de l&apos;assistant, les badges de citation mentionnent le titre du document ainsi que la section exacte.
                En cliquant sur un badge, le lecteur défile automatiquement et surligne l&apos;extrait pour une vérification immédiate.
              </p>

              <h3 id="bonnes-pratiques" className={styles.subHeading}>Bonnes pratiques de structuration</h3>
              <div className={styles.featureGrid}>
                <div className={styles.featureCard}>
                  <div className={styles.featureCardTitle}>Titres normalisés</div>
                  <p className={styles.featureCardDesc}>
                    Privilégiez les dénominations claires : <em>&laquo; Politique RH 2026 &raquo;</em> plutôt que des noms de fichiers génériques.
                  </p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureCardTitle}>PDF textuels</div>
                  <p className={styles.featureCardDesc}>
                    Vérifiez que vos PDF contiennent du texte sélectionnable et non une simple numérisation photo.
                  </p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureCardTitle}>Tags transverses</div>
                  <p className={styles.featureCardDesc}>
                    Associez des tags d&apos;équipes (<code>direction</code>, <code>finance</code>) pour regrouper les documents clés.
                  </p>
                </div>
              </div>

              <h3 id="syntheses-complexes" className={styles.subHeading}>Synthèses et tableaux comparatifs</h3>
              <div className={styles.callout}>
                <div className={styles.calloutIcon}>📊</div>
                <div>
                  <div className={styles.calloutTitle}>Exemple de prompt pro</div>
                  <p className={styles.calloutText}>
                    <em>&laquo; Compare sous forme de tableau les options de la formule standard et de la formule premium selon la grille 2026. &raquo;</em>
                  </p>
                </div>
              </div>

              <h3 id="fiabilite" className={styles.subHeading}>Fiabilité et Zéro Hallucination</h3>
              <ul style={{ paddingLeft: "20px", lineHeight: "1.75", fontSize: "0.9rem", color: "var(--doc-text-secondary)" }}>
                <li><strong>Abstention transparente :</strong> Si une information n&apos;existe pas dans vos documents, l&apos;IA signale clairement son absence au lieu d&apos;inventer.</li>
                <li><strong>Statuts des documents :</strong>
                  <br />• <strong>Prête :</strong> Document indexé et totalement interrogeable.
                  <br />• <strong>En cours :</strong> Extraction en cours de finalisation (quelques secondes).
                  <br />• <strong>Échec :</strong> Document protégé par mot de passe ou sans texte exploitable.
                </li>
              </ul>
            </section>
          )}

          {/* =========================================================================
              SECTION 4 : RACCOURCIS & FAQ
             ========================================================================= */}
          {isVisible("faq", "faq raccourcis clavier formats questions fréquentes aide support") && (
            <section id="raccourcis" className={styles.docSection}>
              <h2 className={styles.sectionHeading}>
                <Icon name="book" />
                4. Raccourcis Clavier, Formats & FAQ
              </h2>

              <h3 className={styles.subHeading}>Raccourcis Clavier Essentiels</h3>
              <div className={styles.tableWrapper}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Raccourci</th>
                      <th>Action</th>
                      <th>Contexte</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd></td>
                      <td>Ouvrir la recherche globale</td>
                      <td>Partout dans l&apos;application</td>
                    </tr>
                    <tr>
                      <td><kbd>Escape</kbd></td>
                      <td>Fermer une modal (recherche, dépôt)</td>
                      <td>Quand une fenêtre est ouverte</td>
                    </tr>
                    <tr>
                      <td><kbd>Entrée</kbd></td>
                      <td>Envoyer la question à l&apos;assistant</td>
                      <td>Dans la zone de saisie</td>
                    </tr>
                    <tr>
                      <td><kbd>Maj</kbd> + <kbd>Entrée</kbd></td>
                      <td>Insérer un saut de ligne</td>
                      <td>Dans la zone de saisie</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 id="formats" className={styles.subHeading}>Formats de Fichiers Acceptés</h3>
              <div className={styles.tableWrapper}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Format</th>
                      <th>Extension</th>
                      <th>Taille max</th>
                      <th>Usage idéal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Adobe PDF</strong></td>
                      <td><code>.pdf</code></td>
                      <td>4 Mo</td>
                      <td>Chartes, contrats, procédures officielles</td>
                    </tr>
                    <tr>
                      <td><strong>Microsoft Word</strong></td>
                      <td><code>.docx</code></td>
                      <td>4 Mo</td>
                      <td>Comptes-rendus, notes internes, projets</td>
                    </tr>
                    <tr>
                      <td><strong>Texte brut</strong></td>
                      <td><code>.txt</code></td>
                      <td>4 Mo</td>
                      <td>Notes rapides, mémos</td>
                    </tr>
                    <tr>
                      <td><strong>Markdown</strong></td>
                      <td><code>.md</code></td>
                      <td>4 Mo</td>
                      <td>Documentations techniques, listes FAQ</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 id="faq" className={styles.subHeading}>Foire Aux Questions (FAQ)</h3>
              <div className={styles.faqGroup}>
                <div className={styles.faqItem}>
                  <button
                    type="button"
                    className={styles.faqButton}
                    onClick={() => toggleFaq("faq1")}
                    aria-expanded={openFaq.faq1}
                  >
                    <span>Mes documents restent-ils privés et protégés ?</span>
                    <Icon name={openFaq.faq1 ? "chevronDown" : "chevronRight"} />
                  </button>
                  {openFaq.faq1 && (
                    <div className={styles.faqContent}>
                      <strong>Oui, entièrement.</strong> Vos documents demeurent confinés à l&apos;espace privé de votre entreprise.
                      Ils ne sont jamais exposés publiquement ni exploités pour l&apos;entraînement de modèles d&apos;IA tiers.
                    </div>
                  )}
                </div>

                <div className={styles.faqItem}>
                  <button
                    type="button"
                    className={styles.faqButton}
                    onClick={() => toggleFaq("faq2")}
                    aria-expanded={openFaq.faq2}
                  >
                    <span>Pourquoi l&apos;IA répond-elle parfois qu&apos;elle ne trouve pas la réponse ?</span>
                    <Icon name={openFaq.faq2 ? "chevronDown" : "chevronRight"} />
                  </button>
                  {openFaq.faq2 && (
                    <div className={styles.faqContent}>
                      C&apos;est la garantie zéro hallucination. Si l&apos;information n&apos;est pas présente dans les documents de votre base,
                      NexaMind vous avertit honnêtement plutôt que de vous induire en erreur avec une réponse inventée.
                    </div>
                  )}
                </div>

                <div className={styles.faqItem}>
                  <button
                    type="button"
                    className={styles.faqButton}
                    onClick={() => toggleFaq("faq3")}
                    aria-expanded={openFaq.faq3}
                  >
                    <span>Que faire en cas d&apos;échec d&apos;analyse d&apos;un fichier ?</span>
                    <Icon name={openFaq.faq3 ? "chevronDown" : "chevronRight"} />
                  </button>
                  {openFaq.faq3 && (
                    <div className={styles.faqContent}>
                      Vérifiez que le document fait moins de 4 Mo, qu&apos;il n&apos;a pas de mot de passe de protection
                      et qu&apos;il comporte du texte vectorisé (non scanné en tant que simple image).
                    </div>
                  )}
                </div>

                <div className={styles.faqItem}>
                  <button
                    type="button"
                    className={styles.faqButton}
                    onClick={() => toggleFaq("faq4")}
                    aria-expanded={openFaq.faq4}
                  >
                    <span>Comment supprimer un document de la bibliothèque ?</span>
                    <Icon name={openFaq.faq4 ? "chevronDown" : "chevronRight"} />
                  </button>
                  {openFaq.faq4 && (
                    <div className={styles.faqContent}>
                      Survolez le document dans la bibliothèque (colonne gauche), puis cliquez sur l&apos;icône corbeille
                      pour le supprimer définitivement avec l&apos;ensemble de ses indexations.
                    </div>
                  )}
                </div>

                <div className={styles.faqItem}>
                  <button
                    type="button"
                    className={styles.faqButton}
                    onClick={() => toggleFaq("faq5")}
                    aria-expanded={openFaq.faq5}
                  >
                    <span>Peut-on interroger l&apos;IA en plusieurs langues ?</span>
                    <Icon name={openFaq.faq5 ? "chevronDown" : "chevronRight"} />
                  </button>
                  {openFaq.faq5 && (
                    <div className={styles.faqContent}>
                      Oui, vous pouvez formuler votre question en français, anglais ou autre langue,
                      même si le document source est rédigé dans une langue différente.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>

        {/* COLONNE DROITE : SUR CETTE PAGE (ON THIS PAGE) */}
        <aside className={styles.rightSidebar}>
          <div className={styles.tocTitle}>Sur cette page</div>
          <ul className={styles.tocList}>
            <li className={styles.tocItem}><a href="#intro" className={styles.tocLink}>Prise en main</a></li>
            <li className={styles.tocItem}><a href="#interface" className={styles.tocLink}>Interface 3 colonnes</a></li>
            <li className={styles.tocItem}><a href="#premier-doc" className={styles.tocLink}>Importer un document</a></li>
            <li className={styles.tocItem}><a href="#categories" className={styles.tocLink}>Catégories métiers</a></li>
            <li className={styles.tocItem}><a href="#recherche-experte" className={styles.tocLink}>Recherche universelle</a></li>
            <li className={styles.tocItem}><a href="#bonnes-pratiques" className={styles.tocLink}>Bonnes pratiques</a></li>
            <li className={styles.tocItem}><a href="#raccourcis" className={styles.tocLink}>Raccourcis clavier</a></li>
            <li className={styles.tocItem}><a href="#faq" className={styles.tocLink}>FAQ</a></li>
          </ul>
        </aside>
      </div>

      {/* --- FOOTER ÉPURÉ --- */}
      <footer className={styles.docFooter}>
        <div className={styles.docFooterLinks}>
          <Link href="/" className={styles.docFooterLink}>Workspace</Link>
          <a href="#intro" className={styles.docFooterLink}>Haut de page</a>
          <a href="#premier-doc" className={styles.docFooterLink}>Dépôt</a>
          <a href="#recherche-experte" className={styles.docFooterLink}>Fonctions Pro</a>
          <a href="#faq" className={styles.docFooterLink}>FAQ</a>
        </div>
        <div>
          &copy; {new Date().getFullYear()} NexaMind AI — Guide utilisateur officiel.
        </div>
      </footer>
    </div>
  );
}
