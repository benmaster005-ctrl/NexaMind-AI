"use client";

import { useState } from "react";
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

  return (
    <div className={styles.pageWrapper} data-theme={theme}>
      {/* --- EN-TÊTE PRINCIPAL DE LA DOCUMENTATION --- */}
      <header className={styles.docHeader}>
        <div className={styles.headerLeft}>
          <Brand />
          <span className={styles.versionBadge}>
            <Icon name="book" />
            <span>Guide d&apos;utilisation</span>
          </span>
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
            title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
            aria-label="Changer de thème"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>

          {userEmail ? (
            <Link href="/" className={styles.primaryActionLink}>
              <Icon name="sidebar" />
              <span>Retour au Workspace</span>
            </Link>
          ) : (
            <Link href="/login" className={styles.primaryActionLink}>
              <Icon name="user" />
              <span>Connexion</span>
            </Link>
          )}
        </div>
      </header>

      {/* --- HERO BANNER --- */}
      <section className={styles.heroSection}>
        <div className={styles.heroContainer}>
          <div className={styles.heroTag}>
            <Icon name="sparkles" />
            <span>Guide d&apos;utilisation officiel</span>
          </div>
          <h1 className={styles.heroTitle}>
            Guide Complet d&apos;Utilisation de NexaMind AI
          </h1>
          <p className={styles.heroSubtitle}>
            Apprenez à tirer le meilleur parti de votre copilote documentaire :
            de la découverte des fonctionnalités de base jusqu&apos;aux usages avancés pour les professionnels.
          </p>

          {/* Filtres par audience */}
          <div className={styles.audienceFilterBar} role="tablist">
            <button
              type="button"
              className={`${styles.audienceTab} ${activeAudience === "all" ? styles.audienceTabActive : ""}`}
              onClick={() => setActiveAudience("all")}
              role="tab"
              aria-selected={activeAudience === "all"}
            >
              🌟 Tout le guide
            </button>
            <button
              type="button"
              className={`${styles.audienceTab} ${activeAudience === "beginner" ? styles.audienceTabActive : ""}`}
              onClick={() => setActiveAudience("beginner")}
              role="tab"
              aria-selected={activeAudience === "beginner"}
            >
              🌱 Débutant (Premiers pas)
            </button>
            <button
              type="button"
              className={`${styles.audienceTab} ${activeAudience === "intermediate" ? styles.audienceTabActive : ""}`}
              onClick={() => setActiveAudience("intermediate")}
              role="tab"
              aria-selected={activeAudience === "intermediate"}
            >
              💼 Collaborateur (Usage quotidien)
            </button>
            <button
              type="button"
              className={`${styles.audienceTab} ${activeAudience === "pro" ? styles.audienceTabActive : ""}`}
              onClick={() => setActiveAudience("pro")}
              role="tab"
              aria-selected={activeAudience === "pro"}
            >
              ⚡ Utilisateur Pro (Fonctions avancées)
            </button>
            <button
              type="button"
              className={`${styles.audienceTab} ${activeAudience === "faq" ? styles.audienceTabActive : ""}`}
              onClick={() => setActiveAudience("faq")}
              role="tab"
              aria-selected={activeAudience === "faq"}
            >
              ⌨️ Raccourcis & FAQ
            </button>
          </div>
        </div>
      </section>

      {/* --- MAIN LAYOUT : SOMMAIRE STICKY + CONTENU DU GUIDE --- */}
      <div className={styles.mainLayout}>
        {/* Table des matières latérale (desktop) */}
        <aside className={styles.docSidebar}>
          <nav className={styles.stickyNav} aria-label="Sommaire du guide">
            <div className={styles.navCategoryTitle}>1. Débutant</div>
            <ul className={styles.navLinkList}>
              <li><a href="#intro" className={styles.navLinkItem}>Qu&apos;est-ce que NexaMind AI ?</a></li>
              <li><a href="#interface" className={styles.navLinkItem}>L&apos;interface en 3 colonnes</a></li>
              <li><a href="#premier-doc" className={styles.navLinkItem}>Importer un document</a></li>
              <li><a href="#premiere-question" className={styles.navLinkItem}>Poser une question & Citations</a></li>
            </ul>

            <div className={styles.navCategoryTitle}>2. Collaborateur</div>
            <ul className={styles.navLinkList}>
              <li><a href="#categories" className={styles.navLinkItem}>Les 5 catégories métiers</a></li>
              <li><a href="#chunks-reading" className={styles.navLinkItem}>Lire et naviguer dans les documents</a></li>
              <li><a href="#conversations" className={styles.navLinkItem}>Historique des échanges</a></li>
              <li><a href="#prompts-efficaces" className={styles.navLinkItem}>Formuler des questions efficaces</a></li>
            </ul>

            <div className={styles.navCategoryTitle}>3. Utilisateur Pro</div>
            <ul className={styles.navLinkList}>
              <li><a href="#recherche-experte" className={styles.navLinkItem}>Recherche experte (Ctrl+K)</a></li>
              <li><a href="#navigation-pro" className={styles.navLinkItem}>Exploiter les citations chirurgicales</a></li>
              <li><a href="#bonnes-pratiques" className={styles.navLinkItem}>Structurer son corpus documentaire</a></li>
              <li><a href="#syntheses-complexes" className={styles.navLinkItem}>Tableaux et synthèses croisées</a></li>
              <li><a href="#fiabilite" className={styles.navLinkItem}>Fiabilité & Zéro hallucination</a></li>
            </ul>

            <div className={styles.navCategoryTitle}>4. Références</div>
            <ul className={styles.navLinkList}>
              <li><a href="#raccourcis" className={styles.navLinkItem}>Raccourcis Clavier</a></li>
              <li><a href="#formats" className={styles.navLinkItem}>Formats de fichiers acceptés</a></li>
              <li><a href="#faq" className={styles.navLinkItem}>Questions Fréquentes (FAQ)</a></li>
            </ul>
          </nav>
        </aside>

        {/* Contenu textuel et tutoriels */}
        <main className={styles.docContent}>
          {/* =========================================================================
              SECTION DÉBUTANT
             ========================================================================= */}
          {isVisible("beginner", "introduction débutant interface colonnes importation premier document questions citations") && (
            <section id="intro" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <span className={`${styles.badgeCategory} ${styles.badgeBeginner}`}>Guide Débutant</span>
                <h2 className={styles.sectionTitle}>
                  <Icon name="sparkles" />
                  Prise en Main Rapide
                </h2>
                <p className={styles.sectionLead}>
                  Tout ce qu&apos;il faut savoir pour commencer à interroger et consulter vos documents en toute simplicité.
                </p>
              </div>

              <h3>Qu&apos;est-ce que NexaMind AI ?</h3>
              <p>
                NexaMind AI est votre <strong>espace de travail documentaire intelligent</strong>.
                Contrairement à des outils publics qui inventent parfois des faits (hallucinations),
                NexaMind ne répond <strong>qu&apos;à partir des documents réels de votre entreprise</strong>.
                Chaque réponse est accompagnée de la preuve exacte d&apos;où provient l&apos;information.
              </p>

              <div className={styles.callout + " " + styles.calloutTip}>
                <div className={styles.calloutIcon}>💡</div>
                <div className={styles.calloutBody}>
                  <div className={styles.calloutTitle}>La garantie de vérification</div>
                  Lorsque l&apos;IA vous répond, elle insère des repères cliquables <code>[1]</code>, <code>[2]</code>.
                  En cliquant dessus, le document s&apos;ouvre automatiquement au paragraphe exact d&apos;où provient l&apos;extrait.
                </div>
              </div>

              <h3 id="interface">Comprendre l&apos;interface en 3 colonnes</h3>
              <p>
                L&apos;application est organisée en 3 zones pour naviguer facilement sans changer de page :
              </p>

              <div className={styles.gridSteps}>
                <div className={styles.stepCard}>
                  <span className={styles.stepNumber}>1</span>
                  <h4 className={styles.stepTitle}>Bibliothèque (Gauche)</h4>
                  <p className={styles.stepDesc}>
                    La liste de tous vos documents et de ceux de l&apos;entreprise.
                    Vous pouvez filtrer par catégorie et voir le statut de chaque fichier en un coup d&apos;œil.
                  </p>
                </div>

                <div className={styles.stepCard}>
                  <span className={styles.stepNumber}>2</span>
                  <h4 className={styles.stepTitle}>Lecteur de Document (Centre)</h4>
                  <p className={styles.stepDesc}>
                    Affiche le texte complet du document sélectionné. Les sections citées par l&apos;assistant
                    s&apos;y affichent en surbrillance pour une lecture immédiate.
                  </p>
                </div>

                <div className={styles.stepCard}>
                  <span className={styles.stepNumber}>3</span>
                  <h4 className={styles.stepTitle}>Copilote IA (Droite)</h4>
                  <p className={styles.stepDesc}>
                    Votre assistant conversationnel. Posez vos questions, lisez ses réponses sourcées,
                    et retrouvez vos échanges passés dans l&apos;historique.
                  </p>
                </div>
              </div>

              <h3 id="premier-doc">Importer votre premier document</h3>
              <p>
                Pour ajouter un document à votre base de connaissances :
              </p>
              <ol style={{ paddingLeft: "20px", lineHeight: "1.7", fontSize: "var(--fs-sm)" }}>
                <li>Cliquez sur le bouton <strong>+ Nouveau document</strong> (dans la barre de catégories en haut ou dans la bibliothèque).</li>
                <li>Glissez-déposez ou sélectionnez votre fichier (formats <code>.pdf</code>, <code>.docx</code>, <code>.txt</code>, <code>.md</code> jusqu&apos;à 4 Mo).</li>
                <li>Donnez-lui un <strong>titre explicite</strong> et choisissez sa <strong>catégorie</strong> (ex: <em>Procédures</em>, <em>Projets</em>, <em>Ressources</em>).</li>
                <li>Ajoutez des mots-clés (tags) pour le retrouver plus rapidement plus tard.</li>
                <li>Cliquez sur <strong>Déposer et analyser</strong>. Le document est prêt en quelques secondes !</li>
              </ol>

              <h3 id="premiere-question">Poser une question à l&apos;assistant</h3>
              <p>
                Tapez votre question dans la barre de saisie en bas du lecteur ou dans le volet Assistant :
              </p>
              <div className={styles.callout + " " + styles.calloutSuccess}>
                <div className={styles.calloutIcon}>💬</div>
                <div className={styles.calloutBody}>
                  <div className={styles.calloutTitle}>Exemple de question simple</div>
                  <em>&laquo; Quels sont les horaires d&apos;ouverture du support selon le livret d&apos;accueil ? &raquo;</em>
                  <br />
                  L&apos;assistant formule sa réponse avec la citation <code>[1]</code> qui pointe vers la bonne page.
                </div>
              </div>
            </section>
          )}

          {/* =========================================================================
              SECTION COLLABORATEUR / MÉTIER
             ========================================================================= */}
          {isVisible("intermediate", "collaborateur métier catégories organisation chunks lecture historique prompts") && (
            <section id="categories" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <span className={`${styles.badgeCategory} ${styles.badgeIntermediate}`}>Guide Collaborateur & Métier</span>
                <h2 className={styles.sectionTitle}>
                  <Icon name="folder" />
                  Organisation Documentaire & Usages du Quotidien
                </h2>
                <p className={styles.sectionLead}>
                  Organisez vos fichiers efficacement et découvrez comment gagner du temps sur vos tâches courantes.
                </p>
              </div>

              <h3>Les 5 Catégories Métiers de NexaMind</h3>
              <p>
                Pour garder une bibliothèque propre et lisible pour toute l&apos;équipe, les documents sont classés ainsi :
              </p>
              <div className={styles.tableResponsive}>
                <table className={styles.tableSpec}>
                  <thead>
                    <tr>
                      <th>Catégorie</th>
                      <th>À quoi ça sert ?</th>
                      <th>Exemples concrets</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Ressources</strong></td>
                      <td>Fiches de référence, grilles tarifaires, listes utiles</td>
                      <td>Grille tarifaire 2026, Annuaire d&apos;équipe</td>
                    </tr>
                    <tr>
                      <td><strong>Projets</strong></td>
                      <td>Dossiers de cadrage, spécifications, plannings</td>
                      <td>Cahier des charges Alpha, Roadmap Q4</td>
                    </tr>
                    <tr>
                      <td><strong>Procédures</strong></td>
                      <td>Guides opérationnels, protocoles RH, marches à suivre</td>
                      <td>Charte télétravail, Guide de remboursement des frais</td>
                    </tr>
                    <tr>
                      <td><strong>FAQ</strong></td>
                      <td>Questions-réponses récurrentes pour les collaborateurs</td>
                      <td>FAQ Mutuelle & Prévoyance, Support informatique</td>
                    </tr>
                    <tr>
                      <td><strong>Compte rendu</strong></td>
                      <td>Synthèses de réunions, bilans périodiques, comptes-rendus</td>
                      <td>CR de réunion de rentrée, Bilan trimestriel</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 id="chunks-reading">Lire et naviguer dans les documents longs</h3>
              <p>
                NexaMind découpe automatiquement chaque document en sections cohérentes.
                Cela apporte plusieurs avantages :
              </p>
              <ul style={{ paddingLeft: "20px", lineHeight: "1.7", fontSize: "var(--fs-sm)" }}>
                <li><strong>Retrouver l&apos;essentiel :</strong> Pas besoin de lire 50 pages : l&apos;IA vous amène directement à la section pertinente.</li>
                <li><strong>Navigation visuelle :</strong> Vous pouvez scroller de section en section tout en gardant l&apos;assistant ouvert sur le côté.</li>
                <li><strong>Copier un extrait :</strong> Vous pouvez facilement sélectionner et copier un passage précis du texte.</li>
              </ul>

              <h3 id="conversations">Gestion de l&apos;Historique & Reprise de Travail</h3>
              <p>
                Toutes vos questions sont mémorisées dans votre session de travail :
              </p>
              <ul>
                <li>Retrouvez vos <strong>30 dernières conversations</strong> dans l&apos;onglet <em>Historique</em> du panneau droit.</li>
                <li>Reprenez une discussion là où vous l&apos;aviez laissée pour approfondir un sujet.</li>
                <li>Cliquez sur <strong>+ Nouvelle conversation</strong> pour poser une question sur un sujet complètement différent sans mélanger les contextes.</li>
              </ul>

              <h3 id="prompts-efficaces">Formuler des questions efficaces</h3>
              <div className={styles.gridSteps}>
                <div className={styles.stepCard}>
                  <h4 className={styles.stepTitle}>🎯 Posez des questions ciblées</h4>
                  <p className={styles.stepDesc}>
                    Indiquez le document ou le domaine souhaité : <em>&laquo; Selon la procédure de note de frais, quel est le plafond pour les repas ? &raquo;</em>
                  </p>
                </div>
                <div className={styles.stepCard}>
                  <h4 className={styles.stepTitle}>📑 Demandez des listes</h4>
                  <p className={styles.stepDesc}>
                    <em>&laquo; Liste sous forme de puces les 4 étapes à suivre pour déclarer un arrêt maladie. &raquo;</em>
                  </p>
                </div>
                <div className={styles.stepCard}>
                  <h4 className={styles.stepTitle}>🔍 Demandez des synthèses</h4>
                  <p className={styles.stepDesc}>
                    <em>&laquo; Fais-moi un résumé en 3 phrases des conclusions du compte rendu de vendredi dernier. &raquo;</em>
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* =========================================================================
              SECTION UTILISATEUR PRO (FONCTIONS AVANCÉES)
             ========================================================================= */}
          {isVisible("pro", "pro utilisateur avancé recherche experte ctrl k citations tableaux matrices filtres gouvernance") && (
            <section id="recherche-experte" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <span className={`${styles.badgeCategory} ${styles.badgePro}`}>Guide Utilisateur Pro & Avancé</span>
                <h2 className={styles.sectionTitle}>
                  <Icon name="sparkles" />
                  Fonctionnalités Avancées & Maîtrise Experte
                </h2>
                <p className={styles.sectionLead}>
                  Optimisez votre productivité au quotidien avec la palette de commande,
                  les citations croisées et les synthèses analytiques multi-documents.
                </p>
              </div>

              <h3>La Recherche Universelle avec <kbd>Ctrl</kbd> + <kbd>K</kbd></h3>
              <p>
                Le moyen le plus rapide d&apos;explorer vos documents sans lever les mains du clavier :
              </p>
              <ul>
                <li>Pressez <kbd>Ctrl</kbd> + <kbd>K</kbd> (ou <kbd>Cmd</kbd> + <kbd>K</kbd> sur Mac) depuis n&apos;importe quel écran.</li>
                <li>Tapez quelques lettres d&apos;un titre, d&apos;une catégorie ou d&apos;un mot-clé contenu dans vos fichiers.</li>
                <li>La recherche sémantique trouve le document le plus proche, même si vous n&apos;avez pas tapé le mot exact.</li>
                <li>Utilisez les flèches du clavier puis <kbd>Entrée</kbd> pour ouvrir immédiatement le résultat.</li>
              </ul>

              <h3 id="navigation-pro">Exploiter les Citations Chirurgicales</h3>
              <p>
                Pour les documents contractuels, financiers ou réglementaires où chaque détail compte :
              </p>
              <div className={styles.callout + " " + styles.calloutTip}>
                <div className={styles.calloutIcon}>🔎</div>
                <div className={styles.calloutBody}>
                  <div className={styles.calloutTitle}>Vérification croisée immédiate</div>
                  Dans chaque réponse de l&apos;assistant, les bulles de sources vous affichent le nom du document
                  et la fraction de texte exacte. En survolant ou en cliquant sur le badge, le document se positionne
                  automatiquement sur la phrase exacte citée.
                </div>
              </div>

              <h3 id="bonnes-pratiques">Bonnes pratiques de structuration documentaire</h3>
              <p>
                Pour obtenir des réponses parfaites de l&apos;IA, voici quelques règles simples pour déposer vos fichiers :
              </p>
              <div className={styles.gridSteps}>
                <div className={styles.stepCard}>
                  <h4 className={styles.stepTitle}>📝 Titres précis</h4>
                  <p className={styles.stepDesc}>
                    Nommez vos documents clairement : préférez <em>&laquo; Charte Télétravail 2026 &raquo;</em> à <em>&laquo; document_final_v2.pdf &raquo;</em>.
                  </p>
                </div>
                <div className={styles.stepCard}>
                  <h4 className={styles.stepTitle}>📄 Privilégiez les PDF textuels</h4>
                  <p className={styles.stepDesc}>
                    Assurez-vous que le texte peut être sélectionné dans vos fichiers PDF. Évitez les simples photos scannées sans couche de texte.
                  </p>
                </div>
                <div className={styles.stepCard}>
                  <h4 className={styles.stepTitle}>🏷️ Utilisez les tags</h4>
                  <p className={styles.stepDesc}>
                    Les tags comme <code>rh</code>, <code>direction</code> ou <code>finance</code> permettent de retrouver des séries de documents d&apos;un seul clic.
                  </p>
                </div>
              </div>

              <h3 id="syntheses-complexes">Tableaux comparatifs et synthèses croisées</h3>
              <p>
                Vous pouvez demander à NexaMind d&apos;analyser plusieurs documents en même temps pour produire des tableaux clairs :
              </p>
              <div className={styles.callout + " " + styles.calloutSuccess}>
                <div className={styles.calloutIcon}>📊</div>
                <div className={styles.calloutBody}>
                  <div className={styles.calloutTitle}>Exemple de prompt avancé pour utilisateur Pro</div>
                  <em>&laquo; Dresse un tableau comparatif entre les garanties de la mutuelle formule standard et la formule renforcée, avec les montants de prise en charge pour les soins dentaires et optiques. &raquo;</em>
                </div>
              </div>

              <h3 id="fiabilite">Comprendre la Fiabilité de l&apos;IA (Pourquoi elle ne devine jamais)</h3>
              <p>
                NexaMind a été conçu selon une règle de conformité stricte :
              </p>
              <ul style={{ paddingLeft: "20px", lineHeight: "1.7", fontSize: "var(--fs-sm)" }}>
                <li><strong>Abstention honnête :</strong> Si une question ne trouve aucune réponse dans les documents déposés, l&apos;assistant indique clairement qu&apos;il ne possède pas l&apos;information, plutôt que d&apos;extrapoler.</li>
                <li><strong>Documents de suggestion :</strong> Lorsqu&apos;un sujet est proche mais incomplet, l&apos;assistant vous suggère les documents qui pourraient vous intéresser pour compléter votre recherche.</li>
                <li><strong>Statut des documents :</strong>
                  <br />• <span style={{ color: "var(--success-text)", fontWeight: "bold" }}>Prête :</span> Le document est totalement analysé et opérationnel.
                  <br />• <span style={{ color: "var(--warning-text)", fontWeight: "bold" }}>En cours :</span> L&apos;analyse est en train de s&apos;effectuer (quelques secondes).
                  <br />• <span style={{ color: "var(--danger-text)", fontWeight: "bold" }}>Échec :</span> Le fichier est protégé par mot de passe ou illisible.
                </li>
              </ul>
            </section>
          )}

          {/* =========================================================================
              SECTION RACCOURCIS & FAQ
             ========================================================================= */}
          {isVisible("faq", "faq raccourcis clavier formats questions fréquentes aide support") && (
            <section id="raccourcis" className={styles.docSection}>
              <div className={styles.sectionHeader}>
                <span className={`${styles.badgeCategory} ${styles.badgeTech}`}>Référence Rapide & FAQ</span>
                <h2 className={styles.sectionTitle}>
                  <Icon name="book" />
                  Raccourcis Clavier, Formats & FAQ
                </h2>
                <p className={styles.sectionLead}>
                  Gagnez du temps au quotidien avec les raccourcis essentiels et les réponses aux questions les plus courantes.
                </p>
              </div>

              <h3>Raccourcis Clavier Essentiels</h3>
              <div className={styles.tableResponsive}>
                <table className={styles.tableSpec}>
                  <thead>
                    <tr>
                      <th>Raccourci</th>
                      <th>Action</th>
                      <th>Où l&apos;utiliser ?</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><kbd>Ctrl</kbd> + <kbd>K</kbd> ou <kbd>Cmd</kbd> + <kbd>K</kbd></td>
                      <td>Ouvrir la palette de recherche universelle</td>
                      <td>Partout dans l&apos;application</td>
                    </tr>
                    <tr>
                      <td><kbd>Escape</kbd></td>
                      <td>Fermer la fenêtre de recherche ou la fenêtre de dépôt</td>
                      <td>Quand une fenêtre pop-up est ouverte</td>
                    </tr>
                    <tr>
                      <td><kbd>Entrée</kbd></td>
                      <td>Envoyer la question à l&apos;assistant</td>
                      <td>Dans le champ de question</td>
                    </tr>
                    <tr>
                      <td><kbd>Maj</kbd> + <kbd>Entrée</kbd></td>
                      <td>Aller à la ligne sans envoyer le message</td>
                      <td>Dans le champ de question</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 id="formats">Formats de Fichiers Acceptés</h3>
              <div className={styles.tableResponsive}>
                <table className={styles.tableSpec}>
                  <thead>
                    <tr>
                      <th>Format</th>
                      <th>Extension</th>
                      <th>Taille maximale</th>
                      <th>Recommandation</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Adobe PDF</strong></td>
                      <td><code>.pdf</code></td>
                      <td>4 Mo</td>
                      <td>Idéal pour les contrats, chartes, procédures officielles</td>
                    </tr>
                    <tr>
                      <td><strong>Microsoft Word</strong></td>
                      <td><code>.docx</code></td>
                      <td>4 Mo</td>
                      <td>Idéal pour les comptes-rendus, notes de service, projets</td>
                    </tr>
                    <tr>
                      <td><strong>Texte brut</strong></td>
                      <td><code>.txt</code></td>
                      <td>4 Mo</td>
                      <td>Idéal pour les notes rapides, mémos</td>
                    </tr>
                    <tr>
                      <td><strong>Markdown</strong></td>
                      <td><code>.md</code></td>
                      <td>4 Mo</td>
                      <td>Idéal pour les documentations techniques et fiches FAQ</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 id="faq">Questions Fréquentes (FAQ)</h3>
              <div className={styles.faqList}>
                <div className={styles.faqItem}>
                  <button
                    type="button"
                    className={styles.faqTrigger}
                    onClick={() => toggleFaq("faq1")}
                    aria-expanded={openFaq.faq1}
                  >
                    <span>Mes documents sont-ils protégés et confidentiels ?</span>
                    <Icon name={openFaq.faq1 ? "chevronDown" : "chevronRight"} />
                  </button>
                  {openFaq.faq1 && (
                    <div className={styles.faqAnswer}>
                      <strong>Oui, totalement.</strong> Vos documents sont isolés au sein de votre espace d&apos;entreprise privé et chiffré.
                      Ils ne sont jamais partagés publiquement et ne sont jamais utilisés pour entraîner des modèles publics d&apos;intelligence artificielle.
                    </div>
                  )}
                </div>

                <div className={styles.faqItem}>
                  <button
                    type="button"
                    className={styles.faqTrigger}
                    onClick={() => toggleFaq("faq2")}
                    aria-expanded={openFaq.faq2}
                  >
                    <span>Pourquoi l&apos;IA me dit-elle parfois qu&apos;elle ne trouve pas l&apos;information ?</span>
                    <Icon name={openFaq.faq2 ? "chevronDown" : "chevronRight"} />
                  </button>
                  {openFaq.faq2 && (
                    <div className={styles.faqAnswer}>
                      C&apos;est la garantie zéro hallucination de NexaMind. Si l&apos;information demandée ne figure pas explicitement
                      dans les documents déposés sur la plateforme, l&apos;assistant préfère vous avertir plutôt que de vous donner une réponse erronée.
                    </div>
                  )}
                </div>

                <div className={styles.faqItem}>
                  <button
                    type="button"
                    className={styles.faqTrigger}
                    onClick={() => toggleFaq("faq3")}
                    aria-expanded={openFaq.faq3}
                  >
                    <span>Que faire si mon document est au statut &laquo; Échec &raquo; ?</span>
                    <Icon name={openFaq.faq3 ? "chevronDown" : "chevronRight"} />
                  </button>
                  {openFaq.faq3 && (
                    <div className={styles.faqAnswer}>
                      Vérifiez que votre fichier n&apos;est pas protégé par un mot de passe, qu&apos;il ne dépasse pas 4 Mo,
                      et qu&apos;il contient bien du texte sélectionnable (et non une simple photographie sans texte).
                    </div>
                  )}
                </div>

                <div className={styles.faqItem}>
                  <button
                    type="button"
                    className={styles.faqTrigger}
                    onClick={() => toggleFaq("faq4")}
                    aria-expanded={openFaq.faq4}
                  >
                    <span>Comment supprimer un document de la bibliothèque ?</span>
                    <Icon name={openFaq.faq4 ? "chevronDown" : "chevronRight"} />
                  </button>
                  {openFaq.faq4 && (
                    <div className={styles.faqAnswer}>
                      Dans la colonne de gauche (Bibliothèque), survolez le document que vous souhaitez retirer,
                      puis cliquez sur l&apos;icône corbeille pour le supprimer définitivement.
                    </div>
                  )}
                </div>

                <div className={styles.faqItem}>
                  <button
                    type="button"
                    className={styles.faqTrigger}
                    onClick={() => toggleFaq("faq5")}
                    aria-expanded={openFaq.faq5}
                  >
                    <span>Puis-je poser des questions en plusieurs langues ?</span>
                    <Icon name={openFaq.faq5 ? "chevronDown" : "chevronRight"} />
                  </button>
                  {openFaq.faq5 && (
                    <div className={styles.faqAnswer}>
                      Oui ! Même si votre document est en anglais ou en français, vous pouvez poser votre question
                      dans la langue de votre choix. L&apos;assistant comprend le sens et traduit la réponse si nécessaire.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* --- FOOTER DU GUIDE --- */}
      <footer className={styles.docFooter}>
        <div className={styles.docFooterLinks}>
          <Link href="/" className={styles.docFooterLink}>Accéder au Workspace</Link>
          <a href="#intro" className={styles.docFooterLink}>Haut de page</a>
          <a href="#premier-doc" className={styles.docFooterLink}>Importer un document</a>
          <a href="#recherche-experte" className={styles.docFooterLink}>Fonctions Pro</a>
          <a href="#faq" className={styles.docFooterLink}>FAQ</a>
        </div>
        <div>
          &copy; {new Date().getFullYear()} NexaWorks — NexaMind AI. Guide d&apos;utilisation utilisateur.
        </div>
      </footer>
    </div>
  );
}
