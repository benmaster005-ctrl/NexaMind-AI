// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Audit statique du socle visuel (story 7.1).
 * Execute avec `npm run test:ui-system` : aucun reseau, aucun navigateur.
 *
 * Chaque assertion repond a un ecart mesure du plan : boilerplate Next.js
 * reste dans globals.css, couleurs de la charte recopiees dans les modules,
 * quatre ecrans sourds au theme sombre, emoji dans la navigation, huit
 * recettes de boutons pour trois roles, markup de navigation duplique.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getNavItems, isNavItemActive } from "../lib/dashboard/helpers.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

/** Tous les fichiers sources de l'interface (app + components). */
function walk(dir, acc = []) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, acc);
    else acc.push(rel);
  }
  return acc;
}
const SOURCES = [...walk("app"), ...walk("components")];
const MODULES = SOURCES.filter((f) => f.endsWith(".module.css"));
const TSX = SOURCES.filter((f) => f.endsWith(".tsx"));

/** Les 7 ecrans qui portaient leur propre copie de la navigation. */
const SHELL_PAGES = [
  "app/page.tsx",
  "app/search/page.tsx",
  "app/chat/page.tsx",
  "app/chat/[id]/page.tsx",
  "app/(dashboard)/history/page.tsx",
  "app/(dashboard)/documents/page.tsx",
  "app/(dashboard)/resources/[id]/page.tsx",
];

/** Tokens de DESIGN.md 1-4 : la charte complete, pas un sous-ensemble. */
const TOKENS = [
  "--bg-page", "--surface", "--surface-sunken", "--bubble-assistant",
  "--border", "--border-strong",
  "--text", "--text-secondary", "--text-muted",
  "--primary", "--primary-hover", "--on-primary", "--accent-text",
  "--primary-subtle", "--primary-subtle-strong", "--primary-subtle-border",
  "--warning-subtle", "--warning-border", "--warning-text",
  "--danger-subtle", "--danger-border", "--danger-text",
  "--highlight", "--focus-ring", "--scrim",
  "--font-sans", "--font-mono",
  "--fs-xs", "--fs-sm", "--fs-base", "--fs-lg", "--fs-xl", "--fs-2xl", "--fs-3xl",
  "--fw-normal", "--fw-medium", "--fw-semibold", "--fw-bold",
  "--space-xs", "--space-sm", "--space-md", "--space-lg", "--space-xl",
  "--space-2xl", "--space-3xl",
  "--radius-sm", "--radius-md", "--radius-lg", "--radius-full",
];

/** En sombre, ces tokens doivent changer : sinon l'ecran reste clair. */
const DARK_SWITCH = [
  "--bg-page", "--surface", "--surface-sunken", "--bubble-assistant",
  "--border", "--border-strong", "--text", "--text-secondary", "--text-muted",
  "--primary", "--accent-text", "--focus-ring", "--scrim",
];

describe("tokens de la charte (app/globals.css)", () => {
  const globals = read("app/globals.css");
  // Les commentaires citent des extraits de CSS (dont « @media (prefers-color-
  // scheme: dark) ») : ils sont retirés avant tout découpage, sans quoi la
  // recherche de la premiere occurrence tronque le bloc :root avant qu'il commence.
  const css = globals.replace(/\/\*[\s\S]*?\*\//g, "");
  const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const darkBlock =
    /@media \(prefers-color-scheme: dark\) \{[\s\S]*?:root\s*\{([\s\S]*?)\n {2}\}/.exec(css)?.[1] ?? "";

  it("declare chaque token de la charte", () => {
    for (const token of TOKENS) {
      assert.match(rootBlock, new RegExp(`${token}\\s*:`), `${token} absent de :root`);
    }
  });

  it("un token n'est declare qu'une fois dans :root (source unique)", () => {
    for (const token of TOKENS) {
      const hits = rootBlock.match(new RegExp(`${token}\\s*:`, "g")) ?? [];
      assert.equal(hits.length, 1, `${token} declare ${hits.length} fois dans :root`);
    }
  });

  it("THEME_DARK : les surfaces, les textes et l'accent basculent", () => {
    assert.ok(darkBlock.length > 0, "aucun bloc prefers-color-scheme: dark");
    for (const token of DARK_SWITCH) {
      assert.match(
        darkBlock,
        new RegExp(`${token}\\s*:`),
        `${token} jamais surcharge en sombre`,
      );
    }
  });

  it("suit l'OS, sans bascule manuelle ni JavaScript", () => {
    assert.match(globals, /color-scheme: light dark;/);
    assert.ok(!/data-theme/.test(globals), "une bascule manuelle est revenue");
    const layout = read("app/layout.tsx");
    assert.ok(
      !/suppressHydrationWarning|data-theme/.test(layout),
      "layout.tsx pilote le theme : le theme doit rester en CSS seul",
    );
  });

  it("a abandonne le boilerplate Next.js", () => {
    assert.ok(!/Arial/i.test(globals), "Arial : la police de la charte est system-ui");
    assert.ok(
      !/--font-geist|--foreground:|--background:/.test(globals),
      "les variables du template Next sont encore la",
    );
    assert.match(globals, /font-family: var\(--font-sans\);/);
    assert.match(globals, /font-size: var\(--fs-base\);/);
  });

  it("anneau de focus unique, selection et mouvement reduit (DESIGN.md 6)", () => {
    assert.equal((globals.match(/:focus-visible/g) ?? []).length, 1);
    assert.match(globals, /outline: 2px solid var\(--focus-ring\);/);
    assert.match(globals, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(globals, /::selection/);
  });
});

describe("source unique des couleurs", () => {
  it(`les ${MODULES.length} modules CSS ignorent toute couleur en dur`, () => {
    assert.ok(MODULES.length >= 10, "audit trop permissif : peu de modules trouves");
    for (const file of MODULES) {
      const css = read(file);
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), `${file} recopie un hexadezimal`);
      assert.ok(!/\brgba?\(|\bhsla?\(/.test(css), `${file} declare une couleur fonctionnelle`);
      const named =
        css.match(
          /(?:background|color|border|outline|fill|stroke|box-shadow)[^;:]*:[^;]*?\b(?:white|black|silver|gray|grey|red|blue|green|yellow)\b/g,
        ) ?? [];
      assert.deepEqual(named, [], `${file} nomme une couleur au lieu d'un token`);
    }
  });

  it("les fonds et les textes viennent d'un token", () => {
    for (const file of MODULES) {
      const css = read(file);
      const decls = css.match(/(?:^|\n)\s*(?:background|background-color|color)\s*:\s*[^;]+;/g) ?? [];
      for (const decl of decls) {
        if (/transparent|inherit|none|currentColor|currentColor/i.test(decl)) continue;
        assert.match(decl, /var\(--/, `${file} : ${decl.trim()} n'est pas un token`);
      }
    }
  });

  it("les tiroirs partagent un seul voile", () => {
    for (const file of [
      "components/chat/chat.module.css",
      "components/resources/summary-sheet.module.css",
      "components/resources/resource-item.module.css",
    ]) {
      assert.match(read(file), /var\(--scrim\)/, `${file} redessine son propre voile`);
    }
    assert.equal(
      (read("app/globals.css").match(/--scrim\s*:/g) ?? []).length,
      2,
      "--scrim : une valeur claire + une sombre, pas davantage",
    );
  });
});


describe("primitives partagees (components/ui)", () => {
  const ui = read("components/ui/ui.module.css");

  it("une seule recette par role de bouton", () => {
    for (const variant of ["Primary", "Secondary", "Danger", "Ghost"]) {
      const hits = ui.match(new RegExp(`[.]button${variant}\\s*\\{`, "g")) ?? [];
      assert.equal(hits.length, 1, `bouton ${variant} : ${hits.length} recette(s)`);
    }
    assert.match(ui, /[.]button\s*\{[\s\S]*?min-height: 44px;/, "cible tactile < 44px");
    assert.match(ui, /[.]button:disabled/, "etat inactive non defini");
  });

  it("aucun ecran ne redessine un bouton hors liste assumee", () => {
    // These four icon-only controls keep their own recipe for now: they already
    // consume the tokens (so the dark theme is correct) but sit on content
    // screens owned by the next lots. Tracked in deferred-work.md.
    const EXCEPTIONS = new Map([
      ["components/chat/chat.module.css", ["sendButton", "closeButton"]],
      ["components/resources/summary-sheet.module.css", ["closeButton"]],
      ["components/search/search-history-list.module.css", ["deleteButton"]],
    ]);
    for (const file of MODULES.filter((f) => !f.endsWith("ui.module.css"))) {
      const found = [...read(file).matchAll(/[.]([\w-]*(?:button|btn)[\w-]*)\s*\{/gi)].map((m) => m[1]);
      const allowed = EXCEPTIONS.get(file) ?? [];
      assert.deepEqual(
        found.filter((name) => !allowed.includes(name)),
        [],
        `${file} introduit une recette de bouton non partagee`,
      );
    }
  });

  it("restent utilisables en composants serveur (aucun etat)", () => {
    const primitives = SOURCES.filter(
      (f) => f.startsWith("components/ui/") && f.endsWith(".tsx"),
    );
    assert.ok(primitives.length >= 5, "primitives manquantes");
    for (const file of primitives) {
      assert.ok(!/"use client"/.test(read(file)), `${file} est devenu client`);
    }
  });

  it("carte et titre partagent une seule definition", () => {
    assert.equal((ui.match(/[.]card\s*\{/g) ?? []).length, 1);
    assert.equal((ui.match(/[.]cardTitle\s*\{/g) ?? []).length, 1);
    assert.match(ui, /[.]card\s*\{[\s\S]*?var\(--surface\)/);
    assert.match(ui, /[.]badge\s*\{[\s\S]*?var\(--surface-sunken\)/, "la pastille doit rester neutre");
    assert.ok(!/[.]badge\s*\{[\s\S]*?var\(--primary\)/.test(ui), "pastille coloree : l'accent est reserve a l'action");
  });
});

describe("navigation unique a icônes sobres", () => {
  const nav = read("components/ui/app-nav.tsx");
  const ui = read("components/ui/ui.module.css");

  it("<AppNav> porte le seul markup de navigation", () => {
    for (const file of TSX) {
      if (file.endsWith("app-nav.tsx")) continue;
      assert.ok(!/<nav\b/.test(read(file)), `${file} recopie la navigation`);
    }
    assert.match(nav, /aria-label="Navigation principale"/);
  });

  it("les 7 ecrans branchent <AppNav> avec les onglets partages", () => {
    for (const file of SHELL_PAGES) {
      const src = read(file);
      assert.match(src, /<AppNav\b/, `${file} n'affiche plus la navigation`);
      // Le tableau de bord prend les quatre onglets de l'en-tete horizontal
      // (« Accueil » y est porte par la marque) ; les ecrans de travail
      // gardent la sidebar et ses cinq entrees.
      assert.match(
        src,
        /getNavItems\(|getTopNavItems\(/,
        `${file} ne branche pas les onglets communs`,
      );
    }
  });

  it("NAV_ACTIVE : l'onglet courant est annonce, pas seulement colore", () => {
    assert.match(nav, /aria-current=\{isActive \? "page" : undefined\}/);
    assert.match(ui, /[.]navItemActive\s*\{[\s\S]*?var\(--accent-text\)/);
  });

  it("NAV_ACTIVE : une vue imbriquee active son onglet", () => {
    assert.equal(isNavItemActive("/chat", "/chat/abc"), true);
    assert.equal(isNavItemActive("/chat", "/chat"), true);
    assert.equal(isNavItemActive("/", "/search"), false, "l'accueil ne doit jamais s'activer ailleurs");
    assert.equal(isNavItemActive("/history", "/chat"), false);
  });

  it("NAV : 5 onglets identiques pour tout utilisateur authentifie", () => {
    // Gestion des roles supprimee : la navigation ne depend plus du compte.
    assert.deepEqual(
      getNavItems().map((i) => i.label),
      ["Accueil", "Recherche", "Assistant", "Historique", "Documents"],
    );
    assert.deepEqual(
      getNavItems().map((i) => i.href),
      ["/", "/search", "/chat", "/history", "/documents"],
    );
  });

  it("barre basse 64px + zone sure, sidebar desktop 260px reservee", () => {
    assert.match(ui, /[.]nav\s*\{[\s\S]*?position: fixed;/);
    assert.match(ui, /[.]navItem\s*\{[\s\S]*?min-height: 64px;/);
    assert.match(ui, /padding-bottom: env\(safe-area-inset-bottom\);/);
    assert.match(ui, /@media \(min-width: 768px\)[\s\S]*?width: 260px;/);
    assert.match(
      read("components/dashboard/dashboard.module.css"),
      /padding-left: 260px;/,
      "le contenu desktop doit laisser la place de la sidebar",
    );
  });
});


describe("icônes SVG au trait (remplacent les emoji)", () => {
  const icon = read("components/ui/icon.tsx");

  it("trait de 1,5px, currentColor, silencieux pour les lecteurs d'ecran", () => {
    assert.match(icon, /stroke="currentColor"/);
    assert.match(icon, /strokeWidth="1\.5"/);
    assert.match(icon, /aria-hidden="true"/);
    assert.ok(!/<img|src=|cdn|http/.test(icon), "les icones restent dessinees, jamais chargees");
  });

  it(" chaque onglet pointe une icone reellement dessinee", () => {
    const drawn = [...icon.matchAll(/^  (\w+):/gm)].map((m) => m[1]);
    assert.ok(drawn.length >= 5, ` jeu réduit : ${drawn.join(", ")}`);
    for (const item of getNavItems()) {
      assert.ok(drawn.includes(item.icon), `icone « ${item.icon} » non dessinee`);
    }
  });

  it("aucun emoji pictographique dans l'interface", () => {
    // Les glyphes typographiques (←, ✕) ne sont pas des emoji : leur passage a
    // une icone SVG est planifie avec l'ecran concerne (deferred-work.md).
    const PICTO = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
    for (const file of TSX) {
      assert.ok(!PICTO.test(read(file)), `${file} affiche un emoji`);
    }
  });
});

describe("hygiene du shell", () => {
  it("aucun style inline sur les 7 ecrans", () => {
    for (const file of SHELL_PAGES) {
      assert.ok(!/style=\{\{/.test(read(file)), `${file} pose du style inline`);
    }
  });

  it("les primitives du socle sont reellement consommees", () => {
    const consumers = (needle) => TSX.filter((f) => read(f).includes(needle)).length;
    assert.ok(consumers("@/components/ui/card") >= 4, "Card presque utilisee");
    assert.ok(consumers("@/components/ui/button") >= 3, "buttonClass presque utilise");
    assert.ok(consumers("@/components/ui/badge") >= 2, "Badge presque utilise");
    assert.ok(consumers("@/components/ui/app-nav") >= 7, "AppNav moins utilise que les 7 ecrans");
  });

  it("aucune classe fantome : toute classe consommée existe dans son module", () => {
    let checked = 0;
    for (const file of TSX) {
      const src = read(file);
      for (const imp of src.matchAll(/import\s+(\w+)\s+from\s+["']([^"']+\.module\.css)["']/g)) {
        const [ , ident, spec ] = imp;
        const rel = spec.startsWith("@/")
          ? spec.slice(2)
          : join(dirname(file), spec).split("/").filter((s) => s && s !== ".").join("/");
        if (!existsSync(join(root, rel))) continue;
        const declared = new Set(
          [...read(rel).matchAll(/[.]([A-Za-z_][\w-]*)/g)].map((m) => m[1]),
        );
        for (const use of src.matchAll(new RegExp(`\\b${ident}[.]([A-Za-z_]\\w*)`, "g"))) {
          checked += 1;
          assert.ok(
            declared.has(use[1]),
            `${file} consomme ${ident}.${use[1]} : classe absente de ${rel}`,
          );
        }
      }
    }
    assert.ok(checked > 100, `audit trop faible : ${checked} references verifiees`);
  });

  it("les modules orphelins ne survivent pas au socle", () => {
    // dashboard.module.css et page.module.css etaient doubles : un seul shell.
    assert.ok(existsSync(join(root, "components/dashboard/dashboard.module.css")));
    assert.ok(
      !existsSync(join(root, "app/page.module.css")),
      "app/page.module.css : seconde copie des styles du shell",
    );
  });
});


describe("tableau de bord refonde (2026-09-29)", () => {
  const home = read("app/page.tsx");
  const homeCss = read("components/dashboard/dashboard-home.module.css");
  const nav = read("components/ui/app-nav.tsx");
  const ui = read("components/ui/ui.module.css");
  /** Code sans commentaires : les commentaires citent les motifs qu'ils
   *  interdisent pour les expliquer — l'audit porte sur le rendu, pas sur la
   *  prose (meme convention que `security.test.ts`). */
  const codeOnly = (file) =>
    read(file)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/(^|[^:])\/\/[^\n]*/, "$1"))
      .join("\n");

  it("entete horizontal : marque, onglets, compte — et aucune sidebar", () => {
    assert.match(home, /variant="topbar"/, "le tableau de bord garde la sidebar");
    assert.match(home, /brand=\{<Brand \/>\}/, "la marque n'est pas dans l'entete");
    assert.match(home, /actions=\{<UserBlock/, "le compte n'est pas dans l'entete");
    // Les quatre sections de travail, sans onglet « Accueil » : la marque
    // ramene deja a `/`, un onglet de plus ferait doublon.
    assert.match(home, /items=\{getTopNavItems\(\)\}/);
    assert.match(ui, /[.]topbar\s*\{[\s\S]*?position: sticky;/);
    assert.ok(
      !/padding-left: 260px/.test(homeCss),
      "le tableau de bord reserve la place d'une sidebar",
    );
  });

  it("structure attendue : titre, grande barre, 4 actions, 3 colonnes", () => {
    const order = [
      home.indexOf("styles.title"),
      home.indexOf("styles.searchBar"),
      home.indexOf("styles.actions"),
      home.indexOf("styles.columns"),
    ];
    assert.ok(order.every((i) => i > -1), "une section du tableau de bord manque");
    assert.deepEqual([...order].sort((a, b) => a - b), order, "sections dans le desordre");

    const actions = /const ACTIONS[\s\S]*?\n\];/.exec(home)?.[0] ?? "";
    assert.equal((actions.match(/title: "/g) ?? []).length, 4, "il faut 4 blocs d'action");
    for (const label of [
      "Assistant",
      "Uploader une ressource",
      "Documents",
      "Historique de recherche",
    ]) {
      assert.ok(actions.includes(`"${label}"`), `action manquante : ${label}`);
    }
    assert.ok(!/title: "Recherche"/.test(actions), "la recherche a deja sa grande barre");
  });

  it("aucune salutation dans le tableau de bord", () => {
    for (const greeting of ["Bonjour", "Bienvenue", "Bon retour"]) {
      assert.ok(
        !new RegExp(greeting, "i").test(home),
        `salutation interdite dans le tableau de bord : ${greeting}`,
      );
    }
  });

  it("la recherche est un GET vers /search, sans element sous la barre", () => {
    assert.match(home, /role="search" action="\/search"/);
    assert.match(home, /placeholder="Rechercher un document, une information ou un sujet\.\.\."/);
    for (const forbidden of ["recherches populaires", "chip", "suggestion"]) {
      assert.ok(!new RegExp(forbidden, "i").test(home), `ajout interdit : ${forbidden}`);
    }
  });

  it("les trois colonnes lisent des donnees reelles, jamais de factice", () => {
    assert.match(home, /from\("resources"\)/, "documents absents");
    assert.match(home, /from\("conversations"\)/, "conversations absentes");
    assert.match(home, /listSearchHistory\(/, "historique de recherche absent");
    assert.match(home, /action="\/chat"/);
    assert.match(home, /href=\{`\/search\?q=\$\{encodeURIComponent\(entry\.query\)\}`\}/);
    assert.ok(!/fetch\(/.test(home), "le tableau de bord ne doit pas appeler d'API");
  });

  it("l'assistant existant recoit la question du tableau de bord", () => {
    const chatPage = read("app/chat/page.tsx");
    assert.match(chatPage, /searchParams\?: Promise<\{ q\?: string \| string\[\] \}>/);
    assert.match(chatPage, /<ChatClient initialQuestion=\{initialQuestion\} \/>/);
    const chatClient = read("components/chat/chat-client.tsx");
    assert.match(chatClient, /initialQuestion\?: string;/);
    assert.match(chatClient, /initialQuestion\.trim\(\)/);
  });

  it("aucun symbole d'intelligence artificielle dans l'interface", () => {
    const FORBIDDEN = [/sparkle/i, /brain|robot|circuit|orbit/i];
    for (const file of TSX) {
      const src = codeOnly(file);
      for (const pattern of FORBIDDEN) {
        assert.ok(!pattern.test(src), `${file} : motif visuel interdit (${pattern})`);
      }
    }
    for (const file of MODULES) {
      assert.ok(
        !/linear-gradient|radial-gradient|conic-gradient/.test(read(file)),
        `${file} : pas de gradient (design enterprise sobre)`,
      );
    }
  });

  it("la marque est abstraite, geometrique et sans image", () => {
    const brand = read("components/dashboard/brand.tsx");
    assert.match(brand, /<rect/g, "le sigle doit rester geometrique");
    assert.match(brand, /aria-hidden="true"/, "le sigle est decoratif");
    assert.match(brand, /NexaMind AI/);
    assert.ok(!/<img|\.png|cdn/.test(brand), "pas d'image externe");
  });

  it("identite enterprise : cartes sobres et grille dense", () => {
    /** Corps d'une regle simple (ce module n'imbrique jamais d'accolade). */
    const block = (selector) =>
      new RegExp(`[.]${selector}\\s*\\{([^}]*)\\}`).exec(homeCss)?.[1] ?? "";

    // Les zones se detachent par un trait fin ; l'ombre reste un signal de
    // survol, jamais un decor (ni verre depoli, ni carte flottante).
    assert.match(block("actionCard"), /border: 1px solid var\(--border\);/);
    assert.ok(!/box-shadow\s*:/.test(block("actionCard")), "carte ombree au repos");
    assert.match(block("actionCard:hover"), /box-shadow: var\(--shadow-card\);/);
    assert.ok(!/box-shadow\s*:/.test(block("panel")), "panneau ombree au repos");
    assert.ok(!/backdrop-filter|blur\(/.test(homeCss), "pas de verre depoli");

    const radii = [...homeCss.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
    assert.ok(
      radii.every((r) => !/px/.test(r) || Number.parseInt(r, 10) <= 12),
      `rayon trop grand : ${radii.join(", ")}`,
    );
    assert.match(homeCss, /repeat\(4, minmax\(0, 1fr\)\)/);
    assert.match(homeCss, /repeat\(3, minmax\(0, 1fr\)\)/);
    // Mobile : une colonne, puis deux a partir de 640px.
    assert.match(homeCss, /[.]actions\s*\{[\s\S]*?grid-template-columns: 1fr;/);
    assert.match(homeCss, /@media \(min-width: 640px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  });

  it("calque la maquette : en-tete 64px, listes a filets, horodatage", () => {
    // En-tete compact sur une ligne, comme la reference.
    assert.match(ui, /[.]topbar\s*\{[\s\S]*?min-height: 64px;/);
    // Les listes sont continues : un filet entre les lignes, aucun contour.
    assert.match(
      homeCss,
      /[.]list > li \+ li\s*\{[\s\S]*?border-top: 1px solid var\(--border\);/,
    );
    assert.ok(!/[.]list > li\s*\{[^}]*border/.test(homeCss), "chaque ligne encadree");
    // Metadonnees reelles : type + categorie + date pour un document,
    // « Aujourd'hui · 09:42 » pour une recherche.
    assert.match(home, /\[type, doc\.category, date && `ajouté le \$\{date\}`\]/);
    assert.match(home, /formatHistoryStamp\(entry\.createdAt\)/);
    // Appel a l'action des blocs : texte + fleche, dans une carte cliquable.
    assert.match(home, /className=\{styles\.actionCard\} href=\{action\.href\}/);
    assert.match(home, /<Icon name="arrow" className=\{styles\.actionArrow\} \/>/);
    // Le compte affiche nom + deconnexion directe (pas de menu a ouvrir).
    assert.match(read("components/dashboard/user-block.tsx"), /<SignOutButton plain/);
  });

  it("accessibilite : labels, statuts et navigation au clavier", () => {
    assert.match(home, /htmlFor="dashboard-search"/);
    assert.match(home, /htmlFor="dashboard-question"/);
    assert.match(homeCss, /[.]visuallyHidden\s*\{/);
    assert.match(home, /aria-label="Documents récents"/);
    assert.match(home, /aria-label="Démarrer une conversation"/);
    assert.match(home, /<ul className=\{styles\.list\}>/);
    assert.match(nav, /aria-current=\{isActive \? "page" : undefined\}/);
  });
});

