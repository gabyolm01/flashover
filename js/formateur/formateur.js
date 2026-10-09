/* Mode formateur : modification du contenu, protégé par le code formateur */
import { ic, esc, fmt, clone, toast, logoHTML, norm, youtubeId, plural } from "../ui.js";
import { store } from "../store.js";
import { QTYPES } from "../games/engine.js";
import { BLOCK_TYPES } from "../revision/fiche.js";
import { gridHTML, LEVELS, LEVEL_KEYS, levelSettings } from "../games/tableau.js";

const drafts = {};        // copies de travail des modules, par id
let platDraft = null;
let qf = { theme: "", type: "", search: "" };
const ICON_CHOICES = ["helmet", "nozzle", "mask", "rescue", "hose", "flame", "book", "target", "warn"];
const MODULE_TABS = [["infos", "Infos"], ["fiches", "Fiches"], ["questions", "Questions"], ["tableau", "Tableau"]];

export function openFormateur(app, parts, api) {
  if (!store.formateurCode()) { loginScreen(app); return; }
  // Formateur d'une formation : pas de modification du contenu (commun à tous), seulement ses codes
  if (!store.isAdmin()) return trainerDashboard(app, api);
  if (parts[0] === "m" && api.moduleById(parts[1])) {
    const m = draftOf(api.moduleById(parts[1]));
    if (parts[2] === "f" && parts[3]) return ficheEditor(app, m, parts[3]);
    return moduleEditor(app, m, parts[2] || "infos", api);
  }
  return dashboard(app, api);
}

/* ---- Outils ---- */
function draftOf(mod) { if (!drafts[mod.id]) drafts[mod.id] = clone(mod); return drafts[mod.id]; }
function dirty(m) { return JSON.stringify(m) !== JSON.stringify(store.content.modules[m.id]); }
function slug(s) { return norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "x"; }
function uniqueId(base, list) { let id = base, k = 2; while (list.some((x) => x.id === id)) id = base + "-" + k++; return id; }
function shell(app, crumb, inner) {
  app.innerHTML = '<header class="bar fbar"><a class="logo" href="#/formateur">' + logoHTML() + '</a><span class="lvl-badge" style="background:var(--char)">Mode formateur</span>' +
    (crumb ? '<span class="crumb hide-m">' + crumb + "</span>" : "") + '<span class="spacer"></span>' +
    '<a class="btn ghost" href="#/">' + ic("home") + '<span class="hide-m">Site</span></a>' +
    '<button class="btn ghost" id="flogout">' + ic("logout") + '<span class="hide-m">Quitter</span></button></header>' +
    (store.local ? '<div class="offline">Mode local : les modifications restent dans ce navigateur.</div>' : "") +
    '<div class="page" id="fpage">' + inner + "</div>";
  app.querySelector("#flogout").onclick = () => {
    if (Object.keys(drafts).some((k) => dirty(drafts[k])) && !confirm("Des modifications ne sont pas enregistrées. Quitter quand même ?")) return;
    Object.keys(drafts).forEach((k) => delete drafts[k]);
    store.formateurLogout();
    location.hash = "#/";
  };
  return app.querySelector("#fpage");
}
async function saveModule(m, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Enregistrement…"; }
  try {
    await store.saveModule(clone(m));
    drafts[m.id] = clone(store.content.modules[m.id]);
    toast("Enregistré : visible par tous les stagiaires.");
    return true;
  } catch (e) {
    toast("Échec de l'enregistrement : " + e.message);
    return false;
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = ic("save") + "Enregistrer"; }
  }
}
function saveBar(m) {
  return '<div class="row" style="justify-content:space-between;margin-bottom:14px"><span class="muted small" id="dirtyInfo"></span>' +
    '<div class="row"><button class="btn" id="discard">' + ic("reset") + 'Annuler les modifications</button><button class="btn red" id="saveMod">' + ic("save") + "Enregistrer</button></div></div>";
}
function bindSaveBar(app, m, rerender) {
  const info = app.querySelector("#dirtyInfo");
  const upd = () => { info.textContent = dirty(m) ? "Modifications non enregistrées" : "Tout est enregistré"; info.style.color = dirty(m) ? "var(--fire)" : ""; };
  upd();
  app.addEventListener("input", upd);
  app.addEventListener("change", upd);
  app.querySelector("#saveMod").onclick = async (e) => { if (await saveModule(m, e.currentTarget)) { upd(); if (rerender) rerender(); } };
  app.querySelector("#discard").onclick = () => {
    if (!confirm("Revenir à la dernière version enregistrée ?")) return;
    drafts[m.id] = clone(store.content.modules[m.id]);
    location.reload();
  };
}

/* ---- Connexion formateur ---- */
function loginScreen(app) {
  app.innerHTML = '<div class="gate"><div class="card"><div class="logo">' + logoHTML() + "</div><h2>Mode formateur</h2>" +
    '<form id="fform"><input class="codeinput" id="fcode" type="password" placeholder="Code formateur" required><div class="err" id="ferr"></div>' +
    '<button class="btn red big block">' + ic("key") + 'Ouvrir</button></form><p><a href="#/">← Retour au site</a></p></div></div>';
  app.querySelector("#fcode").focus();
  app.querySelector("#fform").onsubmit = async (e) => {
    e.preventDefault();
    const err = app.querySelector("#ferr");
    err.textContent = "Vérification…";
    try {
      const r = await store.formateurLogin(app.querySelector("#fcode").value);
      if (r === "ok") location.reload();
      else err.textContent = r === "other" ? "Ce code ne correspond pas à cette formation." : "Code formateur incorrect.";
    } catch (ex) { err.textContent = "Connexion impossible."; }
  };
}

/* ---- Codes d'accès : l'admin gère tous les codes, un formateur ceux de sa formation ---- */
async function codesBox(box, api) {
  const admin = store.isAdmin(), mine = store.formateurFormation();
  const F = (api.platform().formations || []).filter((f) => admin || f.id === mine);
  const rows = (admin ? [["admin", "*", "Administrateur", "voit et modifie tout, gère tous les codes"], ["stagiaire", "*", "Stagiaire, toutes formations", "choisit sa formation à l'accueil"]] : [])
    .concat(...F.map((f) => [["stagiaire", f.id, "Stagiaire · " + f.title, "voit uniquement cette formation"], ["formateur", f.id, "Formateur · " + f.title, "gère les codes de cette formation, ne modifie pas le contenu"]]));
  const intro = '<p class="muted small" style="margin-top:0">Les codes ne sont jamais affichés : vous pouvez seulement les créer ou les remplacer. Après un changement, les personnes concernées devront saisir le nouveau code.</p>';
  box.innerHTML = '<div class="box">' + intro + '<p class="muted small">Chargement…</p></div>';
  const list = await store.codesList();
  const has = (r, f) => list && list.some((x) => x.role === r && x.formation === f);
  box.innerHTML = '<div class="box">' + intro +
    rows.map(([r, f, label, hint], i) => '<label class="field">' + esc(label) + ' <span class="muted small">(' + esc(hint) + " · " +
      (list ? (has(r, f) ? "code en place" : "<b>pas encore créé</b>") : "état inconnu") + ')</span><input data-code="' + i + '" type="text" autocomplete="off" placeholder="Nouveau code"></label>').join("") +
    '<div class="row end"><button class="btn dark" id="saveCodes">' + ic("key") + "Enregistrer les codes remplis</button></div></div>";
  box.querySelector("#saveCodes").onclick = async () => {
    const todo = [...box.querySelectorAll("[data-code]")].map((inp) => [rows[+inp.dataset.code], inp.value.trim()]).filter((x) => x[1]);
    if (!todo.length) { toast("Remplissez au moins un nouveau code."); return; }
    if (todo.some((x) => x[1].length < 4)) { toast("Un code doit faire au moins 4 caractères."); return; }
    if (new Set(todo.map((x) => x[1])).size < todo.length) { toast("Chaque code doit être différent."); return; }
    if (!confirm("Confirmer le changement de " + plural(todo.length, "code") + " ?")) return;
    try {
      for (const [row, code] of todo) await store.setCode(row[0], row[1], code);
      toast("Code(s) enregistré(s). Notez-les bien !");
      codesBox(box, api);
    } catch (e) { toast("Échec : " + e.message); }
  };
}

/* ---- Tableau de bord d'un formateur : une formation, contenu en lecture seule ---- */
function trainerDashboard(app, api) {
  const f = (api.platform().formations || [])[0];
  const page = shell(app, "", '<h1 class="title">Mode formateur</h1>' +
    '<p class="lead">' + (f ? "Formation <b>" + esc(f.title) + "</b>. " : "") + "Le contenu (fiches, questions, jeux) est commun à tous les formateurs : il est tenu à jour par les administrateurs. Vous pouvez le consulter sur le site et gérer ici les codes de votre formation.</p>" +
    '<div class="section-title">Codes d\'accès</div><div id="codesBox"></div>');
  codesBox(page.querySelector("#codesBox"), api);
}

/* ---- Tableau de bord ---- */
function dashboard(app, api) {
  platDraft = clone(api.platform());
  const P = platDraft, D = Object.assign({ q1: 10, q2: 4, tQ: 45, tScen: 60, tSteal: 15, pts: 2, ptsSteal: 1, ptsStealFail: 2, mult: 2 }, P.duel || {});
  P.duel = D; P.quiz = Object.assign({ n: 20 }, P.quiz || {});
  const num = (obj, key, label) => '<label class="inl">' + label + ' <input type="number" min="0" data-o="' + obj + '" data-k="' + key + '" value="' + P[obj][key] + '"></label>';
  const page = shell(app, "",
    '<h1 class="title">Mode formateur</h1><p class="lead">Choisissez un module à modifier. Chaque enregistrement est aussitôt visible par tous.</p>' +
    '<div class="section-title">Modules</div><div class="fiches">' + api.modules().map((m) =>
      '<a class="fitem" href="#/formateur/m/' + m.id + '" style="--mc:' + m.color + '"><span class="st" style="background:' + m.color + ';color:#fff">' + ic(m.icon) + "</span>" +
      '<span><div class="ft">' + esc(m.title) + '</div><div class="fm">' + plural((m.fiches || []).length, "fiche") + " · " + plural((m.questions || []).length, "question") + " · " +
      (m.status === "ready" ? "publié" : "« bientôt »") + '</div></span><span class="go">' + ic("edit") + "</span></a>").join("") + "</div>" +
    '<div class="row" style="margin-top:12px"><button class="btn" id="addMod">' + ic("plus") + "Ajouter un module</button></div>" +
    '<div class="section-title">Plateforme</div>' +
    '<div class="box"><h3>Accueil</h3><label class="field">Nom<input id="pName" value="' + esc(P.name || "Flashover") + '"></label>' +
      '<label class="field">Phrase d\'accueil<textarea id="pTag" rows="2">' + esc(P.tagline || "") + "</textarea></label></div>" +
    '<div class="frow"><div class="box"><h3>Quiz</h3>' + num("quiz", "n", "Questions par partie") + "</div>" +
    '<div class="box"><h3>Duel d\'équipes</h3>' + num("duel", "q1", "Questions de la manche 1") + num("duel", "q2", "Mises en situation (manche 2)") +
      num("duel", "tQ", "Secondes par question") + num("duel", "tScen", "Secondes par mise en situation") + num("duel", "tSteal", "Secondes pour un vol") +
      num("duel", "pts", "Points bonne réponse") + num("duel", "ptsSteal", "Points vol réussi") + num("duel", "ptsStealFail", "Points perdus si vol raté") + num("duel", "mult", "Multiplicateur manche 2") + "</div></div>" +
    '<div class="row end"><button class="btn red" id="savePlat">' + ic("save") + "Enregistrer la plateforme</button></div>" +
    '<div class="section-title">Codes d\'accès</div>' +
    '<div id="codesBox"></div>');
  codesBox(page.querySelector("#codesBox"), api);
  page.querySelectorAll("[data-o]").forEach((inp) => { inp.oninput = () => { P[inp.dataset.o][inp.dataset.k] = Math.max(0, Math.floor(+inp.value || 0)); }; });
  page.querySelector("#pName").oninput = (e) => { P.name = e.target.value; };
  page.querySelector("#pTag").oninput = (e) => { P.tagline = e.target.value; };
  page.querySelector("#savePlat").onclick = async () => {
    try { await store.savePlatform(clone(P)); toast("Plateforme enregistrée."); } catch (e) { toast("Échec : " + e.message); }
  };
  page.querySelector("#addMod").onclick = async () => {
    const title = prompt("Titre du nouveau module ?");
    if (!title) return;
    const id = uniqueId(slug(title), api.modules());
    const m = { id, title, short: "", color: "#555B66", icon: "book", status: "soon", competences: [], themes: {}, questions: [], qOff: {}, fiches: [], games: ["quiz", "duel"], table: null };
    try {
      await store.saveModule(m);
      const order = (api.platform().modules || []).concat(id);
      // Le nouveau module rejoint la formation choisie sur cet appareil (sinon il resterait invisible pour les stagiaires)
      const cur = api.currentFormation && api.currentFormation();
      const formations = (api.platform().formations || []).map((x) => cur && x.id === cur.id ? Object.assign({}, x, { modules: (x.modules || []).concat(id) }) : x);
      await store.savePlatform(Object.assign(clone(api.platform()), { modules: order, formations }));
      location.hash = "#/formateur/m/" + id;
    } catch (e) { toast("Échec : " + e.message); }
  };
}

/* ---- Éditeur de module ---- */
function moduleEditor(app, m, tab, api) {
  if (tab === "tableau" && !m.table) tab = "infos";
  const tabs = MODULE_TABS.filter((t) => t[0] !== "tableau" || m.table);
  const page = shell(app, esc(m.title),
    '<p><a href="#/formateur">← Tous les modules</a></p><h1 class="title">' + esc(m.title) + "</h1>" + saveBar(m) +
    '<nav class="tabs" style="--mc:' + m.color + '">' + tabs.map((t) => '<a class="tab' + (tab === t[0] ? " on" : "") + '" href="#/formateur/m/' + m.id + "/" + t[0] + '">' + t[1] + "</a>").join("") + "</nav>" +
    '<div id="tabBody"></div>');
  const body = page.querySelector("#tabBody");
  const rerender = () => moduleEditor(app, drafts[m.id], tab, api);
  if (tab === "infos") infosTab(body, m, api);
  else if (tab === "fiches") fichesTab(body, m);
  else if (tab === "questions") questionsTab(body, m);
  else if (tab === "tableau") tableTab(body, m);
  bindSaveBar(page, m, rerender);
}

function infosTab(body, m, api) {
  const themes = Object.keys(m.themes || {}).map((k) => k + " = " + m.themes[k]).join("\n");
  body.innerHTML =
    '<div class="box"><div class="frow"><label class="field">Titre<input id="mTitle" value="' + esc(m.title) + '"></label>' +
      '<label class="field">Statut<select id="mStatus"><option value="ready"' + (m.status === "ready" ? " selected" : "") + '>Publié</option><option value="soon"' + (m.status !== "ready" ? " selected" : "") + ">Bientôt (grisé)</option></select></label></div>" +
      '<label class="field">Description courte<input id="mShort" value="' + esc(m.short || "") + '"></label>' +
      '<div class="frow"><label class="field">Couleur<input id="mColor" type="color" value="' + esc(m.color || "#555B66") + '"></label>' +
      '<label class="field">Icône<select id="mIcon">' + ICON_CHOICES.map((i) => '<option value="' + i + '"' + (m.icon === i ? " selected" : "") + ">" + i + "</option>").join("") + "</select></label></div>" +
      '<label class="field">Source citée dans les corrections<input id="mSource" value="' + esc(m.source || "") + '" placeholder="ex. guide de techniques opérationnelles"></label></div>' +
    '<div class="box"><h3>Compétences (une par ligne)</h3><textarea id="mComp" rows="' + Math.max(4, (m.competences || []).length + 1) + '" style="width:100%;font:inherit;padding:10px;border:2px solid var(--border);border-radius:10px">' +
      esc((m.competences || []).map((c) => c.title).join("\n")) + '</textarea><p class="muted small">Chaque fiche est rattachée à une compétence. Modifier le texte d\'une ligne garde le lien avec ses fiches.</p></div>' +
    '<div class="box"><h3>Thèmes des questions</h3><textarea id="mThemes" rows="6" style="width:100%;font:inherit;padding:10px;border:2px solid var(--border);border-radius:10px">' + esc(themes) +
      '</textarea><p class="muted small">Une ligne par thème : <b>code = nom</b> (ex. <b>gc = Refroidissement des fumées</b>). Les tests des fiches piochent dans ces thèmes.</p></div>' +
    '<div class="box"><h3>Jeux proposés</h3>' + Object.keys(api.GAMES).map((g) =>
      '<label class="check small"><input type="checkbox" data-game="' + g + '"' + ((m.games || []).indexOf(g) >= 0 ? " checked" : "") + "> " + api.GAMES[g].name + "</label>").join("") +
      '<p class="muted small">Le tableau à étiquettes n\'apparaît que si le module a un tableau. Le duel demande au moins 6 questions.</p></div>';
  const $ = (s) => body.querySelector(s);
  $("#mTitle").oninput = (e) => { m.title = e.target.value; };
  $("#mStatus").onchange = (e) => { m.status = e.target.value; };
  $("#mShort").oninput = (e) => { m.short = e.target.value; };
  $("#mColor").oninput = (e) => { m.color = e.target.value; };
  $("#mIcon").onchange = (e) => { m.icon = e.target.value; };
  $("#mSource").oninput = (e) => { m.source = e.target.value; };
  $("#mComp").oninput = (e) => {
    const lines = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean), old = m.competences || [];
    m.competences = lines.map((title, i) => ({ id: old[i] ? old[i].id : uniqueId(slug(title), old.slice(0, i)), title }));
  };
  $("#mThemes").oninput = (e) => {
    const th = {};
    e.target.value.split("\n").forEach((l) => { const p = l.split("="); if (p.length >= 2 && p[0].trim()) th[slug(p[0])] = p.slice(1).join("=").trim(); });
    m.themes = th;
  };
  body.querySelectorAll("[data-game]").forEach((c) => {
    c.onchange = () => { m.games = Array.from(body.querySelectorAll("[data-game]:checked")).map((x) => x.dataset.game); };
  });
}

function fichesTab(body, m) {
  const paint = () => {
    const comps = m.competences || [];
    body.innerHTML = '<div class="help">Les fiches s\'affichent dans cet ordre, regroupées par compétence. Cliquez sur une fiche pour modifier son contenu.</div>' +
      '<div class="fiches">' + (m.fiches || []).map((f, i) => {
        const c = comps.find((x) => x.id === f.competence);
        return '<div class="fitem"' + (f.hidden ? ' style="opacity:.5"' : "") + '><span class="st">' + ic("book") + "</span>" +
          '<span style="flex:1"><div class="ft">' + esc(f.title) + '</div><div class="fm">' + esc(c ? c.title : "Sans compétence") + " · " + (f.blocks || []).length + " blocs" + (f.hidden ? " · masquée" : "") + "</div></span>" +
          '<button class="iconbtn" style="color:var(--char)" data-up="' + i + '" title="Monter">' + ic("up") + "</button>" +
          '<button class="iconbtn" style="color:var(--char)" data-down="' + i + '" title="Descendre">' + ic("down2") + "</button>" +
          '<a class="btn" href="#/formateur/m/' + m.id + "/f/" + f.id + '">' + ic("edit") + "Modifier</a></div>";
      }).join("") + "</div>" +
      '<div class="row" style="margin-top:14px"><button class="btn red" id="addFiche">' + ic("plus") + "Nouvelle fiche</button></div>";
    body.querySelectorAll("[data-up],[data-down]").forEach((b) => {
      b.onclick = () => {
        const i = +(b.dataset.up != null ? b.dataset.up : b.dataset.down), j = b.dataset.up != null ? i - 1 : i + 1;
        if (j < 0 || j >= m.fiches.length) return;
        [m.fiches[i], m.fiches[j]] = [m.fiches[j], m.fiches[i]];
        paint();
        body.dispatchEvent(new Event("change", { bubbles: true }));
      };
    });
    body.querySelector("#addFiche").onclick = () => {
      const title = prompt("Titre de la nouvelle fiche ?");
      if (!title) return;
      m.fiches = m.fiches || [];
      const f = { id: uniqueId(slug(title), m.fiches), title, competence: (comps[0] || {}).id || "", minutes: 5, blocks: [{ type: "intro", text: "" }], test: { themes: [], n: 5 } };
      m.fiches.push(f);
      location.hash = "#/formateur/m/" + m.id + "/f/" + f.id;
    };
  };
  paint();
}

/* ---- Éditeur de fiche ---- */
function ficheEditor(app, m, fid) {
  const f = (m.fiches || []).find((x) => x.id === fid);
  if (!f) { location.hash = "#/formateur/m/" + m.id + "/fiches"; return; }
  f.blocks = f.blocks || [];
  f.test = f.test || { themes: [], n: 5 };
  const page = shell(app, esc(m.title) + " · " + esc(f.title),
    '<p><a href="#/formateur/m/' + m.id + '/fiches">← Fiches du module</a> · <a href="#/m/' + m.id + "/f/" + f.id + '" target="_blank">Voir la fiche enregistrée</a></p>' +
    '<h1 class="title">Fiche : ' + esc(f.title) + "</h1>" + saveBar(m) +
    '<div class="box"><div class="frow"><label class="field">Titre<input id="fTitle" value="' + esc(f.title) + '"></label>' +
      '<label class="field">Compétence<select id="fComp">' + (m.competences || []).map((c) => '<option value="' + c.id + '"' + (f.competence === c.id ? " selected" : "") + ">" + esc(c.title) + "</option>").join("") + '<option value=""' + (!f.competence ? " selected" : "") + ">(aucune)</option></select></label></div>" +
      '<div class="frow"><label class="field">Durée de lecture (min)<input id="fMin" type="number" min="1" value="' + (f.minutes || 5) + '"></label>' +
      '<label class="field">Questions du test<input id="fN" type="number" min="0" value="' + (f.test.n || 5) + '"></label></div>' +
      '<div class="field">Thèmes utilisés pour le test<div class="row">' + Object.keys(m.themes || {}).map((k) =>
        '<label class="check small" style="margin:0 12px 0 0"><input type="checkbox" data-th="' + k + '"' + ((f.test.themes || []).indexOf(k) >= 0 ? " checked" : "") + "> " + esc(m.themes[k]) + "</label>").join("") + "</div></div>" +
      '<label class="check small"><input type="checkbox" id="fHidden"' + (f.hidden ? " checked" : "") + "> Masquer cette fiche aux stagiaires (brouillon)</label>" +
      '<div class="row end"><button class="btn" id="delFiche">' + ic("trash") + "Supprimer la fiche</button></div></div>" +
    '<div class="section-title">Contenu</div><div class="blocks" id="blocks"></div>' +
    '<div class="box" style="margin-top:12px"><div class="row"><select id="newType" style="font:inherit;padding:9px;border-radius:8px">' +
      Object.keys(BLOCK_TYPES).map((k) => '<option value="' + k + '">' + BLOCK_TYPES[k] + "</option>").join("") + '</select><button class="btn red" id="addBlock">' + ic("plus") + "Ajouter ce bloc à la fin</button></div></div>");
  const $ = (s) => page.querySelector(s);
  $("#fTitle").oninput = (e) => { f.title = e.target.value; };
  $("#fComp").onchange = (e) => { f.competence = e.target.value; };
  $("#fMin").oninput = (e) => { f.minutes = Math.max(1, +e.target.value || 1); };
  $("#fN").oninput = (e) => { f.test.n = Math.max(0, Math.floor(+e.target.value || 0)); };
  $("#fHidden").onchange = (e) => { f.hidden = e.target.checked; };
  page.querySelectorAll("[data-th]").forEach((c) => { c.onchange = () => { f.test.themes = Array.from(page.querySelectorAll("[data-th]:checked")).map((x) => x.dataset.th); }; });
  $("#delFiche").onclick = () => {
    if (!confirm("Supprimer la fiche « " + f.title + " » ? (effectif après « Enregistrer »)")) return;
    m.fiches = m.fiches.filter((x) => x !== f);
    location.hash = "#/formateur/m/" + m.id + "/fiches";
  };
  const paint = () => {
    $("#blocks").innerHTML = f.blocks.map((b, i) => '<div class="bedit"><div class="bedit-head"><b>' + (BLOCK_TYPES[b.type] || b.type) + "</b>" +
      '<button class="iconbtn" data-bup="' + i + '" title="Monter">' + ic("up") + '</button><button class="iconbtn" data-bdown="' + i + '" title="Descendre">' + ic("down2") + "</button>" +
      '<button class="iconbtn" data-bdel="' + i + '" title="Supprimer">' + ic("trash") + '</button></div><div class="bedit-body">' + blockForm(b, i) + "</div></div>").join("");
    bindBlocks();
  };
  const changed = () => page.dispatchEvent(new Event("change", { bubbles: true }));
  function bindBlocks() {
    page.querySelectorAll("[data-bf]").forEach((el) => {
      el.oninput = () => {
        const [i, key] = el.dataset.bf.split(":"), b = f.blocks[+i];
        if (key === "items") b.items = el.value.split("\n").map((l) => l.trim()).filter(Boolean);
        else if (key === "head") b.head = el.value.split("|").map((x) => x.trim());
        else if (key === "rows") b.rows = el.value.split("\n").filter((l) => l.trim()).map((l) => l.split("|").map((x) => x.trim()));
        else b[key] = el.value;
      };
    });
    page.querySelectorAll("[data-sf]").forEach((el) => {
      el.oninput = () => { const [i, k, key] = el.dataset.sf.split(":"); f.blocks[+i].items[+k][key] = el.value; };
    });
    page.querySelectorAll("[data-bup],[data-bdown]").forEach((b) => {
      b.onclick = () => {
        const i = +(b.dataset.bup != null ? b.dataset.bup : b.dataset.bdown), j = b.dataset.bup != null ? i - 1 : i + 1;
        if (j < 0 || j >= f.blocks.length) return;
        [f.blocks[i], f.blocks[j]] = [f.blocks[j], f.blocks[i]];
        paint(); changed();
      };
    });
    page.querySelectorAll("[data-bdel]").forEach((b) => {
      b.onclick = () => { if (confirm("Supprimer ce bloc ?")) { f.blocks.splice(+b.dataset.bdel, 1); paint(); changed(); } };
    });
    page.querySelectorAll("[data-addstep]").forEach((b) => {
      b.onclick = () => { const bl = f.blocks[+b.dataset.addstep]; bl.items = bl.items || []; bl.items.push({ title: "", text: "" }); paint(); changed(); };
    });
    page.querySelectorAll("[data-delstep]").forEach((b) => {
      b.onclick = () => { const [i, k] = b.dataset.delstep.split(":"); f.blocks[+i].items.splice(+k, 1); paint(); changed(); };
    });
    page.querySelectorAll("[data-delsvg]").forEach((b) => {
      b.onclick = () => { const [i, k] = b.dataset.delsvg.split(":"); delete f.blocks[+i].items[+k].svg; paint(); changed(); };
    });
  }
  $("#addBlock").onclick = () => {
    const type = $("#newType").value;
    const b = { type };
    if (type === "key") b.items = [];
    if (type === "steps") b.items = [{ title: "", text: "" }];
    if (type === "table") { b.head = ["", ""]; b.rows = [["", ""]]; }
    f.blocks.push(b);
    paint(); changed();
    page.querySelector(".bedit:last-child").scrollIntoView({ behavior: "smooth" });
  };
  paint();
  bindSaveBar(page, m);
}
function blockForm(b, i) {
  const ta = (key, label, val, rows, hint) => '<label class="field">' + label + '<textarea data-bf="' + i + ":" + key + '" rows="' + (rows || 3) + '">' + esc(val || "") + "</textarea>" + (hint ? '<span class="hint2">' + hint + "</span>" : "") + "</label>";
  const inp = (key, label, val, hint) => '<label class="field">' + label + '<input data-bf="' + i + ":" + key + '" value="' + esc(val || "") + '">' + (hint ? '<span class="hint2">' + hint + "</span>" : "") + "</label>";
  const tip = "Astuce : **texte** met en gras, ↘ s'affiche en pastille « diminution ».";
  switch (b.type) {
    case "intro": return ta("text", "Texte d'introduction", b.text, 3, tip);
    case "text": return inp("title", "Titre (facultatif)", b.title) + ta("text", "Texte", b.text, 6, "Laissez une ligne vide pour changer de paragraphe. " + tip);
    case "key": return inp("title", "Titre", b.title || "À retenir") + ta("items", "Points clés (un par ligne)", (b.items || []).join("\n"), 6, tip);
    case "warn": return inp("title", "Titre", b.title || "Attention") + ta("text", "Texte", b.text, 3, tip);
    case "steps": return inp("title", "Titre", b.title || "Étape par étape") + (b.items || []).map((s, k) =>
      '<div class="box" style="background:var(--soft)"><div class="row" style="justify-content:space-between"><b>Étape ' + (k + 1) + '</b><button class="btn" data-delstep="' + i + ":" + k + '">' + ic("trash") + "</button></div>" +
      '<label class="field">Titre<input data-sf="' + i + ":" + k + ':title" value="' + esc(s.title || "") + '"></label>' +
      '<label class="field">Explication<textarea data-sf="' + i + ":" + k + ':text" rows="3">' + esc(s.text || "") + "</textarea></label>" +
      '<label class="field">Image (adresse web, facultatif)<input data-sf="' + i + ":" + k + ':image" value="' + esc(s.image || "") + '"></label>' +
      (s.svg ? '<div class="row"><span class="badge">Schéma intégré</span><button class="btn" data-delsvg="' + i + ":" + k + '">Retirer le schéma</button></div>' : "") + "</div>").join("") +
      '<button class="btn" data-addstep="' + i + '">' + ic("plus") + "Ajouter une étape</button>";
    case "schema": return inp("title", "Titre (facultatif)", b.title) + ta("caption", "Légende", b.caption, 2) +
      '<div class="schema" style="max-width:420px;border:1px solid var(--border);border-radius:8px;padding:6px;margin-bottom:10px">' + (b.svg || "") + "</div>" +
      '<details><summary class="small muted">Code du schéma (réservé aux modifications avancées)</summary>' + ta("svg", "Code SVG", b.svg, 6) + "</details>";
    case "image": return inp("src", "Adresse de l'image (lien web)", b.src, "Clic droit sur une image en ligne > « Copier l'adresse de l'image ».") +
      (b.src ? '<img src="' + esc(b.src) + '" style="max-height:160px;border-radius:8px;margin-bottom:10px" alt="">' : "") +
      inp("caption", "Légende", b.caption) + inp("credit", "Source / crédit", b.credit, "Indiquez d'où vient l'image.");
    case "video": return inp("url", "Lien YouTube ou Dailymotion (ou adresse d'un fichier vidéo .mp4)", b.url, youtubeId(b.url) || /\.(mp4|webm)(\?|$)|dailymotion\.com\/(embed\/)?video\/|dai\.ly\//i.test(b.url || "") ? "Vidéo reconnue ✔" : "Collez le lien de la vidéo YouTube ou Dailymotion.") +
      inp("title", "Titre", b.title) + inp("caption", "Légende", b.caption) + inp("credit", "Source / crédit", b.credit);
    case "table": return inp("title", "Titre", b.title) + inp("head", "En-têtes (séparés par |)", (b.head || []).join(" | ")) +
      ta("rows", "Lignes (une par ligne, cellules séparées par |)", (b.rows || []).map((r) => r.join(" | ")).join("\n"), 5);
    default: return "";
  }
}

/* ---- Questions ---- */
const ANSWER_HELP = {
  Q: "1re ligne : la bonne réponse. Lignes suivantes : les mauvaises réponses (2 à 5).",
  S: "Décrivez la situation dans la question. 1re ligne : la bonne réponse. Lignes suivantes : les mauvaises.",
  I: "1re ligne : l'intrus (c'est la bonne réponse). Lignes suivantes : les éléments qui vont ensemble.",
  T: "Dans la question, mettez ___ (3 tirets bas) à la place du mot manquant. 1re ligne : le bon mot. Lignes suivantes : les mauvais.",
  O: "Une étape par ligne, dans le BON ordre (3 minimum). Le jeu les mélangera.",
  R: "Une paire par ligne : élément de gauche = élément de droite (3 paires minimum)."
};
function questionsTab(body, m) {
  m.qOff = m.qOff || {};
  m.questions = m.questions || [];
  const themes = m.themes || {};
  body.innerHTML = '<div class="help"><b>' + m.questions.length + " questions</b> dans ce module. Décochez une question pour ne plus la poser. « Modifier » permet de la corriger.</div>" +
    '<div class="qfilters"><select id="fth"><option value="">Tous les thèmes</option>' + Object.keys(themes).map((k) => '<option value="' + k + '"' + (qf.theme === k ? " selected" : "") + ">" + esc(themes[k]) + "</option>").join("") + "</select>" +
    '<select id="fty"><option value="">Tous les types</option>' + Object.keys(QTYPES).map((k) => '<option value="' + k + '"' + (qf.type === k ? " selected" : "") + ">" + QTYPES[k] + "</option>").join("") + "</select>" +
    '<input id="fq" type="search" placeholder="Rechercher…" value="' + esc(qf.search) + '"><span class="sep"></span><span class="small muted" id="qcount"></span>' +
    '<button class="btn red" id="qadd">' + ic("plus") + 'Nouvelle question</button></div><div class="qlist" id="qlist"></div>';
  const paint = () => {
    const s = norm(qf.search);
    const list = m.questions.filter((q) => (!qf.theme || q.f === qf.theme) && (!qf.type || q.t === qf.type) && (!s || norm(q.q + " " + JSON.stringify(q.a)).indexOf(s) >= 0));
    body.querySelector("#qcount").textContent = list.length + " affichée" + (list.length > 1 ? "s" : "");
    const el = body.querySelector("#qlist");
    el.innerHTML = list.map((q) => '<div class="qrow' + (m.qOff[q.id] ? " off" : "") + '"><input type="checkbox" data-on="' + q.id + '"' + (m.qOff[q.id] ? "" : " checked") + ">" +
      '<span class="qtype ' + q.t + '">' + QTYPES[q.t] + '</span><span class="qf">' + esc(themes[q.f] || q.f || "") + "</span><span>" + esc(q.q) + "</span>" +
      '<button class="btn" data-ed="' + q.id + '">Modifier</button></div>').join("") || '<div class="empty">Aucune question.</div>';
    el.querySelectorAll("[data-on]").forEach((c) => {
      c.onchange = () => { if (c.checked) delete m.qOff[c.dataset.on]; else m.qOff[c.dataset.on] = true; c.parentNode.classList.toggle("off", !c.checked); };
    });
    el.querySelectorAll("[data-ed]").forEach((b) => { b.onclick = () => editQuestion(m, b.dataset.ed, paint); });
  };
  body.querySelector("#fth").onchange = (e) => { qf.theme = e.target.value; paint(); };
  body.querySelector("#fty").onchange = (e) => { qf.type = e.target.value; paint(); };
  body.querySelector("#fq").oninput = (e) => { qf.search = e.target.value; paint(); };
  body.querySelector("#qadd").onclick = () => editQuestion(m, null, paint);
  paint();
}
function editQuestion(m, id, onDone) {
  const themes = m.themes || {};
  const q = id ? m.questions.find((x) => x.id === id) : { t: "Q", f: Object.keys(themes)[0] || "", q: "", a: [], e: "" };
  const toText = (x) => x.t === "R" ? x.a.map((p) => p[0] + " = " + p[1]).join("\n") : x.a.join("\n");
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = '<div class="modal form"><h2>' + (id ? "Modifier la question" : "Nouvelle question") + "</h2>" +
    '<div class="frow"><label class="field">Type<select id="eqT">' + Object.keys(QTYPES).map((k) => '<option value="' + k + '"' + (q.t === k ? " selected" : "") + ">" + QTYPES[k] + "</option>").join("") + "</select></label>" +
    '<label class="field">Thème<select id="eqF">' + Object.keys(themes).map((k) => '<option value="' + k + '"' + (q.f === k ? " selected" : "") + ">" + esc(themes[k]) + "</option>").join("") + "</select></label></div>" +
    '<label class="field">Question<textarea id="eqQ" rows="3">' + esc(q.q) + '</textarea></label><div id="eqAw"></div>' +
    '<label class="field">Explication après la réponse (facultatif)<textarea id="eqE" rows="2">' + esc(q.e || "") + "</textarea></label>" +
    '<div class="row"><button class="btn red" id="eqSave">' + ic("save") + 'Valider</button><button class="btn" id="eqCancel">Annuler</button>' +
    (id ? '<button class="btn" id="eqDel">' + ic("trash") + "Supprimer</button>" : "") + "</div></div>";
  document.body.appendChild(ov);
  const $ = (s) => ov.querySelector(s);
  const paintA = (t, text) => {
    $("#eqAw").innerHTML = t === "V"
      ? '<label class="field">Bonne réponse<select id="eqA"><option value="V"' + (text === "F" ? "" : " selected") + '>Vrai</option><option value="F"' + (text === "F" ? " selected" : "") + ">Faux</option></select></label>"
      : '<label class="field">Réponses<textarea id="eqA" rows="5">' + esc(text) + '</textarea><span class="hint2">' + ANSWER_HELP[t] + "</span></label>";
  };
  paintA(q.t, q.t === "V" ? q.a[0] : toText(q));
  $("#eqT").onchange = (e) => { const cur = $("#eqA").value; paintA(e.target.value, e.target.value === "V" ? "V" : (cur === "V" || cur === "F" ? "" : cur)); };
  $("#eqCancel").onclick = () => ov.remove();
  if (id) $("#eqDel").onclick = () => {
    if (!confirm("Supprimer définitivement cette question ? (effectif après « Enregistrer »)")) return;
    m.questions = m.questions.filter((x) => x.id !== id);
    delete m.qOff[id];
    ov.remove(); onDone(); document.querySelector("#fpage").dispatchEvent(new Event("change", { bubbles: true }));
  };
  $("#eqSave").onclick = () => {
    const t = $("#eqT").value, text = $("#eqQ").value.trim(), raw = $("#eqA").value;
    const a = t === "V" ? [raw] : t === "R"
      ? raw.split("\n").map((l) => l.split("=").map((s) => s.trim())).filter((p) => p.length === 2 && p[0] && p[1])
      : raw.split("\n").map((s) => s.trim()).filter(Boolean);
    const err = !text ? "Écrivez la question."
      : (t === "O" || t === "R") && a.length < 3 ? "Il faut au moins 3 " + (t === "O" ? "étapes." : "paires « gauche = droite ».")
      : "QITS".indexOf(t) >= 0 && a.length < 2 ? "Il faut une bonne réponse et au moins une mauvaise."
      : t === "T" && !/_{3,}/.test(text) ? "Mettez ___ dans la question à la place du mot manquant." : "";
    if (err) { toast(err); return; }
    const obj = { t, f: $("#eqF").value, q: text, a, e: $("#eqE").value.trim() };
    if (id) Object.assign(q, obj);
    else { obj.id = "q-" + Date.now().toString(36); m.questions.push(obj); }
    ov.remove();
    onDone();
    document.querySelector("#fpage").dispatchEvent(new Event("change", { bubbles: true }));
    toast("Question modifiée. Pensez à « Enregistrer ».");
  };
}

/* ---- Tableau récapitulatif ---- */
function tableTab(body, m) {
  const t = m.table;
  t.levels = t.levels || {};
  const fields = [["penaltyError", "Points retirés par erreur", 0.25], ["hints", "Nombre d'indices", 1], ["penaltyHint", "Points retirés par indice", 0.25],
    ["timeLimitMin", "Temps de référence (min)", 1], ["penaltyMinute", "Points retirés par minute de dépassement", 0.25]];
  body.innerHTML = '<div class="help"><b>Chaque case = une étiquette.</b> Une ligne commençant par <b>•</b> devient une puce. Une case vide ne donne pas d\'étiquette. Deux cases au texte identique sont interchangeables.</div>' +
    '<div style="overflow-x:auto"><div class="board-inner">' + gridHTML(t, "edit") + "</div></div>" +
    '<div class="frow" style="margin-top:16px"><div class="box"><h3>Légende</h3><textarea id="tLegend" rows="3" style="width:100%;font:inherit">' + esc(t.legend || "") + "</textarea></div>" +
    '<div class="box"><h3>Notation par niveau</h3><table class="set"><tr><th></th>' + LEVEL_KEYS.map((k) => '<th style="color:' + LEVELS[k].color + '">' + LEVELS[k].name + "</th>").join("") + "</tr>" +
      fields.map((fl) => "<tr><td>" + fl[1] + "</td>" + LEVEL_KEYS.map((k) => '<td><input type="number" min="0" step="' + fl[2] + '" data-lvl="' + k + '" data-set="' + fl[0] + '" value="' + levelSettings(t, k)[fl[0]] + '"></td>').join("") + "</tr>").join("") +
      "</table></div></div>";
  body.querySelectorAll(".grid textarea").forEach((ta) => {
    const size = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };
    size();
    ta.oninput = () => {
      size();
      const k = ta.dataset.k, key = ta.dataset.key;
      if (k === "g") t.groups[+key].title = ta.value;
      else if (k === "r") t.rows[+key].label = ta.value;
      else { const p = key.split("-"); t.rows[+p[0]].cells[+p[1]].t = ta.value; }
    };
  });
  body.querySelector("#tLegend").oninput = (e) => { t.legend = e.target.value; };
  body.querySelectorAll("[data-lvl]").forEach((inp) => {
    inp.oninput = () => {
      let v = parseFloat(String(inp.value).replace(",", "."));
      v = isFinite(v) && v >= 0 ? v : 0;
      if (inp.dataset.set === "hints") v = Math.floor(v);
      t.levels[inp.dataset.lvl] = Object.assign(levelSettings(t, inp.dataset.lvl), t.levels[inp.dataset.lvl] || {}, { [inp.dataset.set]: v });
    };
  });
}
