/* Flashover : application principale (navigation et pages) */
import { ic, esc, fmt, logoHTML, toast, plural } from "./ui.js";
import { store } from "./store.js";
import { progress } from "./progress.js";
import { renderFiche, renderTest, testPool } from "./revision/fiche.js";
import { startQuizGame } from "./games/quiz.js";
import { startDuelGame } from "./games/duel.js";
import { startTableGame } from "./games/tableau.js";
import { startDefiGame } from "./games/defi.js";
import { startClocheGame } from "./games/cloche.js";
import { startSituationGame } from "./games/situation.js";
import { poolSize } from "./games/engine.js";

const app = document.getElementById("app");
let cleanup = null;

export const GAMES = {
  quiz: { name: "Quiz", icon: "help", color: "#E07800", tags: ["Individuel", "En groupe"],
    desc: "Questions variées tirées au hasard : QCM, vrai ou faux, relier, remettre dans l'ordre, l'intrus, mises en situation.",
    start: startQuizGame, ok: (m) => poolSize(m) > 0 },
  duel: { name: "Duel d'équipes", icon: "trophy", color: "#1F5FBF", tags: ["En équipe", "Manœuvre"],
    desc: "Deux équipes s'affrontent comme à la télé : manches, vols, jokers et grande finale. Environ 20 minutes.",
    start: startDuelGame, ok: (m) => poolSize(m) >= 6 },
  tableau: { name: "Tableau à étiquettes", icon: "table", color: "#C1121F", excl: true, tags: ["Individuel", "En groupe"],
    desc: "Replacez chaque étiquette dans la bonne case du tableau récapitulatif. Trois niveaux de difficulté.",
    start: startTableGame, ok: (m) => !!m.table },
  defi: { name: "Mission terrain", icon: "target", color: "#23964A", tags: ["Réel + virtuel", "En binôme", "Manœuvre"],
    desc: "Le jeu lance une mission : réalisez-la pour de vrai, chrono en main, puis vérifiez point par point avec la correction illustrée.",
    start: startDefiGame, ok: (m) => (m.defis || []).length > 0 },
  cloche: { name: "Qu'est-ce qui cloche ?", icon: "zoom", color: "#7A3FB8", excl: true, tags: ["Individuel", "En groupe"],
    desc: "Repérez les erreurs de port de la tenue de feu sur le personnage. De nouvelles erreurs à chaque manche.",
    start: startClocheGame, ok: (m) => !!m.cloche },
  situation: { name: "Mises en situation", icon: "flame", color: "#B5179E", tags: ["Individuel", "En groupe", "Calculs"],
    desc: "Des scénarios illustrés et réalistes, étape par étape : décisions à prendre, calculs d'autonomie, manomètre sous les yeux.",
    start: startSituationGame, ok: (m) => (m.situations || []).length > 0 },
  reserve: { name: "Réserve d'air", icon: "mask", color: "#1F5FBF", excl: true, tags: ["Individuel", "Tour par tour", "Plans infinis"],
    desc: "Engagé sous ARI dans un bâtiment enfumé : trouvez la victime, équipez-la de la cagoule et sortez-la avant la panne d'air. Chaque geste coûte des bars.",
    start: lazyGame(() => import("./games/reserve.js"), "startReserveGame"), ok: () => true }
};
/* Jeux lourds : chargés seulement au lancement */
function lazyGame(load, fn) {
  return (ctx) => {
    let stop = null, dead = false;
    load().then((mod) => { if (!dead) stop = mod[fn](ctx) || null; });
    return () => { dead = true; if (stop) stop(); };
  };
}

/* ---- Données ---- */
export function platform() {
  return Object.assign({ name: "Flashover", tagline: "", quiz: { n: 20 }, duel: {}, modules: [] }, (store.content && store.content.platform) || {});
}
export function modules() {
  const mods = (store.content && store.content.modules) || {};
  const order = platform().modules || [];
  return Object.values(mods).sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}
export function moduleById(id) { return ((store.content && store.content.modules) || {})[id]; }
const luesWord = (n) => (n > 1 ? "fiches lues" : "fiche lue");
const visibleFiches = (m) => (m.fiches || []).filter((f) => !f.hidden);

/* ---- Cadre des pages ---- */
function frame(crumb, color) {
  return '<header class="bar"><a class="logo" href="#/">' + logoHTML() + "</a>" +
    (crumb ? '<span class="crumb hide-m">' + crumb + "</span>" : "") + '<span class="spacer"></span>' +
    '<a class="iconbtn" href="#/progression" title="Ma progression">' + ic("chart") + "</a>" +
    '<a class="iconbtn" href="#/formateur" title="Mode formateur">' + ic("key") + "</a>" +
    "</header>" + (store.offline ? '<div class="offline">Hors connexion : vous consultez la dernière version téléchargée.</div>' : "") +
    '<div class="page" id="page"' + (color ? ' style="--mc:' + color + '"' : "") + "></div>";
}

/* ---- Écran d'accès ---- */
function gate(message) {
  app.innerHTML = '<div class="gate"><div class="card"><div class="logo">' + logoHTML() + "</div>" +
    "<p>Plateforme de révision des futurs chefs d'équipe.</p>" +
    '<form id="gateForm"><input class="codeinput" id="code" type="password" autocomplete="current-password" placeholder="Code d\'accès" aria-label="Code d\'accès" required>' +
    '<div class="err" id="err">' + (message || "") + "</div>" +
    '<button class="btn red big block" type="submit">' + ic("lock") + "Entrer</button></form>" +
    '<p class="small">Le code vous est donné par votre formateur.' + (store.local ? "<br><b>Mode local</b> : codes « stagiaire » ou « formateur »." : "") + "</p></div></div>";
  const f = app.querySelector("#gateForm"), err = app.querySelector("#err");
  app.querySelector("#code").focus();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const code = app.querySelector("#code").value.trim();
    err.textContent = "Vérification…";
    try {
      const role = await store.login(code);
      if (!role) { err.textContent = "Code incorrect."; return; }
      store.remember(code, role);
      await boot();
    } catch (ex) { err.textContent = "Connexion impossible. Vérifiez votre réseau."; }
  };
}

/* ---- Accueil ---- */
function home() {
  const P = platform(), mods = modules();
  app.innerHTML = frame();
  const page = app.querySelector("#page");
  let read = 0, total = 0;
  mods.forEach((m) => { const s = progress.stats(m); read += s.read; total += s.total; });
  page.innerHTML =
    '<section class="hero"><img class="hero-icon" src="icons/logo-icon.webp" alt=""><h1>' + esc(P.name || "Flashover") + "</h1><p>" + fmt(P.tagline || "Révisez tous les modules de chef d'équipe, seul ou en équipe, et passez au niveau supérieur.") + "</p>" +
      '<div class="stats"><span class="pill"><b>' + mods.length + "</b> modules</span><span class=\"pill\"><b>" + read + "/" + total + '</b> ' + luesWord(total) + '</span></div></section>' +
    '<div class="section-title">Modules</div><div class="modules">' + mods.map((m) => {
      const s = progress.stats(m), soon = m.status !== "ready";
      return '<a class="mod' + (soon ? " soon" : "") + '" href="#/m/' + m.id + '" style="--mc:' + m.color + '">' +
        (soon ? '<span class="badge soon">Bientôt</span>' : "") +
        '<span class="micon">' + ic(m.icon) + "</span><h2>" + esc(m.title) + "</h2><p>" + esc(m.short || "") + "</p>" +
        (s.total ? '<span class="proglabel">' + s.read + "/" + s.total + ' ' + luesWord(s.total) + '</span><span class="prog"><i style="width:' + s.pct + '%"></i></span>'
          : '<span class="proglabel">' + plural((m.competences || []).length, "compétence") + "</span>") + "</a>";
    }).join("") + "</div>" +
    '<div class="links"><a class="btn" href="#/progression">' + ic("chart") + 'Ma progression</a><button class="btn" id="logout">' + ic("logout") + "Changer de code</button></div>";
  page.querySelector("#logout").onclick = () => { if (confirm("Se déconnecter ? Il faudra retaper le code d'accès.")) { store.logout(); gate(); } };
}

/* ---- Module ---- */
function modulePage(m, tab) {
  app.innerHTML = frame(esc(m.title), m.color);
  const page = app.querySelector("#page");
  const fiches = visibleFiches(m), s = progress.stats(m);
  const games = (m.games || Object.keys(GAMES)).filter((g) => GAMES[g] && GAMES[g].ok(m))
    .sort((a, b) => (GAMES[b].excl ? 1 : 0) - (GAMES[a].excl ? 1 : 0));
  let body;
  if (tab === "jeux") {
    body = games.length ? '<div class="games">' + games.map((g) => {
      const G = GAMES[g], best = progress.game(m.id, g).best;
      return '<a class="game' + (G.excl ? " excl" : "") + '" href="#/m/' + m.id + "/jeu/" + g + '" style="--gc:' + G.color + '">' +
        (G.excl ? '<span class="exclbadge">★ Exclusif à ce module</span>' : "") + '<span class="gicon">' + ic(G.icon) + "</span><h3>" + G.name + "</h3><p>" + G.desc + "</p>" +
        '<div class="tagrow">' + G.tags.map((t) => '<span class="badge">' + t + "</span>").join("") + (best != null ? '<span class="badge">Record : ' + best + "</span>" : "") + "</div></a>";
    }).join("") + "</div>" : '<div class="empty">Les jeux de ce module arrivent bientôt.</div>';
  } else {
    const comps = m.competences || [];
    const byComp = comps.map((c, i) => ({ c, i, list: fiches.filter((f) => f.competence === c.id) }));
    const orphans = fiches.filter((f) => !comps.some((c) => c.id === f.competence));
    const item = (f) => {
      const r = progress.fiche(m.id, f.id);
      return '<a class="fitem' + (r.read ? " read" : "") + '" href="#/m/' + m.id + "/f/" + f.id + '"><span class="st">' + ic(r.read ? "check" : "book") + "</span>" +
        '<span><div class="ft">' + esc(f.title) + '</div><div class="fm">' + (f.minutes ? f.minutes + " min" : "") +
        (r.best != null ? " · test : " + r.best + " %" : "") + '</div></span><span class="go">' + ic("next") + "</span></a>";
    };
    body = byComp.map((x) => '<div class="comp"><h3><span class="num">' + (x.i + 1) + "</span>" + esc(x.c.title) + "</h3>" +
      (x.list.length ? '<div class="fiches">' + x.list.map(item).join("") + "</div>" : '<div class="empty small">Fiche en préparation.</div>') + "</div>").join("") +
      (orphans.length ? '<div class="comp"><h3>Autres fiches</h3><div class="fiches">' + orphans.map(item).join("") + "</div></div>" : "");
    if (!comps.length && !fiches.length) body = '<div class="empty">Le contenu de ce module est en préparation.</div>';
  }
  page.innerHTML =
    '<div class="modhead"><span class="micon">' + ic(m.icon) + "</span><div><h1>" + esc(m.title) + "</h1><p>" +
      (s.total ? s.read + "/" + s.total + " " + luesWord(s.total) + (s.avg != null ? " · tests : " + s.avg + " % en moyenne" : "") : esc(m.short || "")) + "</p></div></div>" +
    '<nav class="tabs"><a class="tab' + (tab !== "jeux" ? " on" : "") + '" href="#/m/' + m.id + '">' + ic("book") + "Révisions</a>" +
      '<a class="tab' + (tab === "jeux" ? " on" : "") + '" href="#/m/' + m.id + '/jeux">' + ic("gamepad") + "Jeux (" + games.length + ")</a></nav>" + body;
}

function ficheNav(m, f) {
  const list = visibleFiches(m), i = list.indexOf(f);
  const link = (x) => x && { title: x.title, href: "#/m/" + m.id + "/f/" + x.id };
  return { prev: link(list[i - 1]), next: link(list[i + 1]), testHref: "#/m/" + m.id + "/f/" + f.id + "/test", ficheHref: "#/m/" + m.id + "/f/" + f.id };
}

/* ---- Progression ---- */
function progressionPage() {
  app.innerHTML = frame("Ma progression");
  const page = app.querySelector("#page");
  page.classList.add("narrow");
  const mods = modules();
  page.innerHTML = '<h1 class="title">Ma progression</h1><p class="lead">Elle est enregistrée uniquement sur cet appareil.</p>' +
    mods.map((m) => {
      const s = progress.stats(m);
      const games = Object.keys(GAMES).map((g) => ({ g, r: progress.game(m.id, g) })).filter((x) => x.r.plays);
      return '<div class="pmod" style="--mc:' + m.color + '"><h3><span>' + esc(m.title) + '</span><button class="btn" data-reset="' + m.id + '">' + ic("reset") + "Réinitialiser</button></h3>" +
        (s.total ? '<span class="prog"><i style="width:' + s.pct + '%"></i></span>' : "") +
        '<div class="pgrid"><div class="kpi"><b>' + s.read + "/" + s.total + '</b><span>Fiches lues</span></div><div class="kpi"><b>' + (s.avg != null ? s.avg + " %" : "—") +
        '</b><span>Moyenne aux tests</span></div><div class="kpi"><b>' + s.plays + "</b><span>Parties jouées</span></div></div>" +
        (games.length ? '<p class="small muted">' + games.map((x) => GAMES[x.g].name + " : record " + x.r.best).join(" · ") + "</p>" : "") + "</div>";
    }).join("") +
    '<div class="card" style="margin-top:20px"><h3 style="margin-top:0">Tout recommencer</h3><p class="muted">Efface toute votre progression (fiches lues, tests, records et historique des questions) sur cet appareil.</p>' +
    '<button class="btn red" id="resetAll">' + ic("reset") + "Réinitialiser toute ma progression</button></div>";
  page.querySelectorAll("[data-reset]").forEach((b) => {
    b.onclick = () => {
      const m = moduleById(b.dataset.reset);
      if (!confirm("Réinitialiser votre progression pour « " + m.title + " » ?")) return;
      progress.reset(m.id);
      toast("Progression du module réinitialisée.");
      progressionPage();
    };
  });
  page.querySelector("#resetAll").onclick = () => {
    if (!confirm("Effacer TOUTE votre progression sur cet appareil ? Cette action est définitive.")) return;
    progress.reset();
    toast("Progression réinitialisée.");
    progressionPage();
  };
}

/* ---- Navigation ---- */
async function route() {
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  if (!store.content) return;
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  window.scrollTo(0, 0);
  if (!parts.length) return home();
  if (parts[0] === "progression") return progressionPage();
  if (parts[0] === "formateur") {
    const f = await import("./formateur/formateur.js");
    cleanup = f.openFormateur(app, parts.slice(1), { platform, modules, moduleById, GAMES }) || null;
    return;
  }
  if (parts[0] === "m") {
    const m = moduleById(parts[1]);
    if (!m) return home();
    if (!parts[2]) return modulePage(m, "revisions");
    if (parts[2] === "jeux") return modulePage(m, "jeux");
    if (parts[2] === "f") {
      const f = (m.fiches || []).find((x) => x.id === parts[3]);
      if (!f) return modulePage(m, "revisions");
      app.innerHTML = frame(esc(m.title), m.color);
      const page = app.querySelector("#page");
      page.classList.add("narrow");
      if (parts[4] === "test" && testPool(m, f).length) renderTest(page, m, f, ficheNav(m, f));
      else renderFiche(page, m, f, ficheNav(m, f));
      return;
    }
    if (parts[2] === "jeu" && GAMES[parts[3]] && GAMES[parts[3]].ok(m)) {
      cleanup = GAMES[parts[3]].start({ app, mod: m, platform: platform(), exit: () => { location.hash = "#/m/" + m.id + "/jeux"; } }) || null;
      return;
    }
    return modulePage(m, "revisions");
  }
  home();
}

async function boot() {
  const code = store.savedCode();
  if (!code) return gate();
  app.innerHTML = '<div class="gate"><div class="spinner"></div></div>';
  try {
    const ok = await store.load(code);
    if (!ok) return gate("Le code d'accès a changé. Demandez le nouveau code à votre formateur.");
  } catch (e) {
    app.innerHTML = '<div class="gate"><div class="card"><div class="logo">' + logoHTML() + "</div><p>Impossible de charger la plateforme. Vérifiez votre connexion internet.</p>" +
      '<button class="btn red big block" id="retry">' + ic("reset") + "Réessayer</button></div></div>";
    app.querySelector("#retry").onclick = boot;
    return;
  }
  route();
}

window.addEventListener("hashchange", route);
export function refresh() { route(); }
boot();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
