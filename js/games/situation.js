/* Jeu : « Mises en situation » — des scénarios illustrés, étape par étape :
   décisions à prendre, calculs d'autonomie, tableau de bord (manomètre, temps écoulé).
   Les valeurs (volume de bouteille, pressions…) sont tirées au hasard à chaque partie. */
import { ic, esc, fmt, shuffle, toast } from "../ui.js";
import { progress } from "../progress.js";
import { SND } from "./engine.js";
import { gameBar, bindBar } from "./common.js";

const COLOR = "#B5179E";

/* ---- Petites expressions de calcul (ex. « floor(p*v/100) ») : nombres, variables, + - * / ( ) et quelques fonctions ---- */
const FN = { floor: Math.floor, round: Math.round, ceil: Math.ceil, min: Math.min, max: Math.max, abs: Math.abs };
export function evalExpr(src, vars) {
  const toks = String(src).match(/\d+(?:[.,]\d+)?|[A-Za-z_]\w*|[-+*/(),]/g) || [];
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  function prim() {
    const t = next();
    if (t === "(") { const v = add(); next(); return v; }
    if (t === "-") return -prim();
    if (/^\d/.test(t)) return parseFloat(t.replace(",", "."));
    if (FN[t] && peek() === "(") {
      next();
      const args = [];
      if (peek() !== ")") { args.push(add()); while (peek() === ",") { next(); args.push(add()); } }
      next();
      return FN[t].apply(null, args);
    }
    if (t in vars) return +vars[t];
    throw new Error("Expression inconnue : " + src);
  }
  function mul() { let v = prim(); while (peek() === "*" || peek() === "/") v = next() === "*" ? v * prim() : v / prim(); return v; }
  function add() { let v = mul(); while (peek() === "+" || peek() === "-") v = next() === "+" ? v + mul() : v - mul(); return v; }
  return add();
}
function pickVar(def, vars) {
  if (Array.isArray(def)) return def[Math.floor(Math.random() * def.length)];
  if (def && typeof def === "object") {
    const step = def.step || 1, n = Math.floor((def.max - def.min) / step);
    return def.min + step * Math.floor(Math.random() * (n + 1));
  }
  if (typeof def === "string") return evalExpr(def, vars);
  return def;
}
const nb = (v) => (Math.round(v * 10) / 10).toLocaleString("fr-FR");
/* Remplace {x} par la valeur de x et {=expr} par le résultat du calcul */
function tpl(s, vars) {
  return String(s == null ? "" : s).replace(/\{=([^}]+)\}/g, (m, e) => nb(evalExpr(e, vars))).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? nb(vars[k]) : m));
}

/* ---- Tableau de bord : manomètre ---- */
function gauge(p, label) {
  const v = Math.max(0, Math.min(300, p)), a = (-120 + v / 300 * 240) * Math.PI / 180;
  const x = 60 + 40 * Math.sin(a), y = 62 - 40 * Math.cos(a);
  const arc = (from, to, col) => {
    const f = (-120 + from / 300 * 240) * Math.PI / 180, t = (-120 + to / 300 * 240) * Math.PI / 180;
    return '<path d="M' + (60 + 46 * Math.sin(f)).toFixed(1) + " " + (62 - 46 * Math.cos(f)).toFixed(1) + " A46 46 0 " + (to - from > 150 ? 1 : 0) + " 1 " +
      (60 + 46 * Math.sin(t)).toFixed(1) + " " + (62 - 46 * Math.cos(t)).toFixed(1) + '" stroke="' + col + '" stroke-width="8" fill="none"/>';
  };
  const col = p < 60 ? "var(--red)" : p < 270 ? "var(--char)" : "var(--ok)";
  return '<div class="sg"><svg viewBox="0 0 120 100" aria-hidden="true"><circle cx="60" cy="62" r="54" fill="#fff" stroke="#2F343D" stroke-width="4"/>' +
    arc(0, 60, "#C1121F") + arc(60, 270, "#C9CDD3") + arc(270, 300, "#23964A") +
    '<line x1="60" y1="62" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#16181D" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="62" r="6" fill="#16181D"/>' +
    '<text x="60" y="96" text-anchor="middle" font-size="11" font-weight="700" fill="#5D646D">bar</text></svg>' +
    '<div class="sgv" style="color:' + col + '"><b>' + Math.round(p) + "</b> bar</div><div class=\"sgl\">" + esc(label) + "</div></div>";
}
function hudHTML(vars) {
  let h = "";
  if ("p" in vars) h += gauge(vars.p, "Ma bouteille");
  if ("p2" in vars) h += gauge(vars.p2, "Mon équipier");
  const facts = [];
  if ("v" in vars) facts.push('<div class="sf"><span>Bouteille</span><b>' + nb(vars.v) + " L</b></div>");
  if ("t" in vars) facts.push('<div class="sf"><span>Temps écoulé</span><b>' + nb(vars.t) + " min</b></div>");
  if (facts.length) h += '<div class="sfacts">' + facts.join("") + "</div>";
  return h ? '<div class="shud">' + h + "</div>" : "";
}

export function startSituationGame(ctx) {
  const { app, mod } = ctx;
  const list = mod.situations || [];
  const $ = (s) => app.querySelector(s);
  let run = null;

  function menu() {
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Mises en situation", color: COLOR, label: mod.title }) +
      '<main><div class="panel" style="border-top-color:' + COLOR + '"><h1>Mises en situation</h1>' +
      '<p class="lead">Vous êtes sur le terrain. À chaque étape : lisez la situation, puis décidez ou calculez. Les erreurs critiques sont signalées et un débriefing conclut chaque scénario.</p>' +
      '<div class="row" style="margin:6px 0 16px"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="rand">' + ic("play") + "Situation au hasard</button></div>" +
      '<div class="sitlist">' + list.map((s, i) => {
        const b = progress.game(mod.id, "situation-" + s.id).best;
        return '<button class="sitcard" data-s="' + i + '">' + (s.img ? '<span class="sitimg" style="background-image:url(\'' + esc(s.img) + '\')"></span>'
          : '<span class="sitimg noimg" style="--mc:' + esc(mod.color || COLOR) + '">' + ic(mod.icon || "flame") + "</span>") +
          '<span class="sitbody"><span class="sittag">' + esc(s.tag || "") + '</span><b>' + esc(s.title) + '</b><span class="small muted">' +
          (s.steps || []).filter((x) => x.type !== "scene").length + " décisions" + (b != null ? " · record " + b + " %" : "") + "</span></span></button>";
      }).join("") + "</div></div></main></div>";
    bindBar(app, ctx.exit);
    app.querySelectorAll("[data-s]").forEach((b) => { b.onclick = () => start(list[+b.dataset.s]); });
    $("#rand").onclick = () => start(list[Math.floor(Math.random() * list.length)]);
  }

  function start(s) {
    const vars = {};
    Object.keys(s.vars || {}).forEach((k) => { vars[k] = pickVar(s.vars[k], vars); });
    run = { s, vars, i: -1, good: 0, total: 0, crit: [], log: [], img: s.img, credit: s.credit };
    intro();
  }

  function frame(inner) {
    const r = run, N = r.s.steps.length;
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Mises en situation", color: COLOR, label: r.s.title,
      stats: '<span class="stat">Étape <b>' + Math.max(1, r.i + 1) + "</b>/" + N + "</span>" }) +
      '<main><div class="qwrap"><div class="progress"><i style="width:' + (Math.max(0, r.i) / N * 100) + '%"></i></div>' + inner + "</div></main></div>";
    bindBar(app, ctx.exit, "Quitter la mise en situation ?");
  }
  const sceneHTML = (img, credit, tag) => img ? '<div class="sscene" style="background-image:url(\'' + esc(img) + '\')">' +
    (tag ? '<span class="sittag">' + esc(tag) + "</span>" : "") + (credit ? '<span class="scredit">' + esc(credit) + "</span>" : "") + "</div>" : "";

  function intro() {
    const s = run.s;
    frame('<div class="sitwrap">' + sceneHTML(s.img, s.credit, s.tag) +
      '<div class="sitpanel"><h1>' + esc(s.title) + '</h1><div class="sittext">' + tpl(s.intro, run.vars).split("\n").map((l) => "<p>" + fmt(l) + "</p>").join("") + "</div>" +
      hudHTML(run.vars) + '<div class="row end"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="go">C\'est parti →</button></div></div></div>');
    SND.steal();
    $("#go").onclick = step;
  }

  function step() {
    const r = run;
    r.i++;
    const st = r.s.steps[r.i];
    if (!st) return end();
    // Le décor suit l'histoire : la dernière image de scène reste affichée
    if (st.img) { r.img = st.img; r.credit = st.credit; }
    const text = st.text ? '<div class="sittext">' + tpl(st.text, r.vars).split("\n").map((l) => "<p>" + fmt(l) + "</p>").join("") + "</div>" : "";
    let body = "";
    if (st.type === "scene") {
      body = '<div class="row end"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="cont">Continuer →</button></div>';
    } else if (st.type === "calc") {
      body = '<div class="qtext">' + fmt(tpl(st.q, r.vars)) + "</div>" +
        '<form class="calcrow" id="cf"><input id="cv" type="text" inputmode="decimal" autocomplete="off" placeholder="Votre réponse" aria-label="Votre réponse">' +
        (st.unit ? '<span class="unit">' + esc(st.unit) + "</span>" : "") + '<button class="btn red big" type="submit">Valider</button></form>' +
        (st.hint ? '<p class="small muted">' + fmt(tpl(st.hint, r.vars)) + "</p>" : "") + '<div class="qfeed"></div>';
    } else {
      const ch = shuffle((st.choices || []).map((t, k) => ({ t: tpl(t, r.vars), ok: k === 0 })));
      st._ch = ch;
      body = '<div class="qtext">' + fmt(tpl(st.q, r.vars)) + '</div><div class="qbody choices">' + ch.map((c, k) =>
        '<button class="choice" data-k="' + k + '"><span class="letter">' + "ABCDEF".charAt(k) + "</span><span>" + fmt(c.t) + "</span></button>").join("") + '</div><div class="qfeed"></div>';
    }
    frame('<div class="sitwrap">' + sceneHTML(r.img, r.credit) +'<div class="sitpanel">' + text + hudHTML(r.vars) + '<div class="qcard sq" id="sq">' + body + '</div><div class="qnext" id="qnext"></div></div></div>');
    if (st.type === "scene") { $("#cont").onclick = () => { apply(st); step(); }; return; }
    if (st.type === "calc") {
      const inp = $("#cv");
      inp.focus();
      $("#cf").onsubmit = (e) => {
        e.preventDefault();
        const v = parseFloat(inp.value.replace(",", ".").replace(/[^\d.-]/g, ""));
        if (isNaN(v)) { toast("Tapez un nombre."); return; }
        const ans = evalExpr(st.answer, r.vars), ok = Math.abs(v - ans) <= (st.tol || 0) + 1e-9;
        inp.disabled = true;
        $("#cf").querySelector("button").disabled = true;
        judge(st, ok, "Bonne réponse : <b>" + nb(ans) + (st.unit ? " " + esc(st.unit) : "") + "</b>");
      };
      return;
    }
    app.querySelectorAll(".choice").forEach((b) => {
      b.onclick = () => {
        const k = +b.dataset.k, ok = st._ch[k].ok;
        app.querySelectorAll(".choice").forEach((x, j) => { x.disabled = true; if (st._ch[j].ok) x.classList.add("ok"); else if (j === k) x.classList.add("ko"); });
        $("#sq").classList.add("locked");
        judge(st, ok, ok ? "" : "Bonne réponse : <b>" + fmt(st._ch.find((c) => c.ok).t) + "</b>");
      };
    });
  }

  function judge(st, ok, answer) {
    const r = run;
    r.total++;
    if (ok) { r.good++; SND.good(); } else { SND.bad(); if (st.critical) r.crit.push(st); }
    r.log.push({ q: tpl(st.q, r.vars), ok });
    const title = ok ? (st.okTitle || "Bonne décision !") : st.critical ? "Erreur critique" : "Pas tout à fait";
    $(".qfeed").innerHTML = '<div class="feed ' + (ok ? "ok" : "ko") + '"><b class="big">' + title + "</b>" +
      (!ok && answer ? "<span>" + answer + "</span>" : "") + (!ok && st.critical && st.risk ? "<span><b>⚠ " + fmt(tpl(st.risk, r.vars)) + "</b></span>" : "") +
      (st.e ? "<span>" + fmt(tpl(st.e, r.vars)) + "</span>" : "") + "</div>";
    apply(st);
    const last = r.i === r.s.steps.length - 1;
    $("#qnext").innerHTML = '<button class="btn red big" id="nx">' + (last ? "Fin de la mission" : "Suite de la mission") + " →</button>";
    $("#nx").onclick = step;
    $("#nx").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  /* La suite de l'histoire (pressions, temps) avance quelle que soit la réponse */
  function apply(st) {
    if (!st.set) return;
    const nv = {};
    Object.keys(st.set).forEach((k) => { nv[k] = evalExpr(st.set[k], run.vars); });
    Object.assign(run.vars, nv);
  }

  function end() {
    const r = run, pct = r.total ? Math.round(r.good / r.total * 100) : 100;
    const win = !r.crit.length && pct >= 70;
    progress.saveGame(mod.id, "situation-" + r.s.id, pct);
    progress.saveGame(mod.id, "situation", pct);
    win ? SND.win() : SND.bad();
    const title = r.crit.length ? "Mission compromise" : win ? "Mission réussie !" : "Mission à retravailler";
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Mises en situation", color: COLOR, label: r.s.title }) +
      '<main><div class="panel result" style="border-top-color:' + (win ? "var(--ok)" : "var(--fire)") + '"><h1>' + title + "</h1>" +
      '<div class="score" style="color:' + (win ? "var(--ok)" : "var(--fire)") + '">' + pct + "<span> %</span></div>" +
      '<div class="verdict">' + r.good + " bonne" + (r.good > 1 ? "s" : "") + " décision" + (r.good > 1 ? "s" : "") + " sur " + r.total + "</div>" +
      (r.crit.length ? '<div class="hard" style="text-align:left"><h3>Erreurs critiques</h3><ol>' + r.crit.map((st) => "<li>" + fmt(tpl(st.risk || st.q, r.vars)) + "</li>").join("") + "</ol></div>" : "") +
      (r.s.debrief ? '<div class="blk blk-key" style="text-align:left"><h3>' + ic("target") + "Débriefing</h3><ul>" + r.s.debrief.map((x) => "<li><span>" + fmt(tpl(x, r.vars)) + "</span></li>").join("") + "</ul></div>" : "") +
      '<div class="row"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="again">' + ic("reset") + "Rejouer (nouvelles valeurs)</button>" +
      '<button class="btn big" id="other">' + ic("list") + 'Autre situation</button><button class="btn big dark" id="home">' + ic("back") + "Retour au module</button></div></div></main></div>";
    bindBar(app, ctx.exit);
    $("#again").onclick = () => start(r.s);
    $("#other").onclick = menu;
    $("#home").onclick = ctx.exit;
  }

  if (!list.length) { toast("Aucune mise en situation dans ce module."); ctx.exit(); return () => {}; }
  menu();
  return () => {};
}
