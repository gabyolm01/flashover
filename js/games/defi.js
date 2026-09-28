/* Jeu : « Mission terrain » — une mission à réaliser pour de vrai, chronométrée,
   puis vérifiée point par point avec une correction illustrée. */
import { ic, esc, fmt, mmss, toast } from "../ui.js";
import { progress } from "../progress.js";
import { SND } from "./engine.js";
import { gameBar, bindBar } from "./common.js";

const COLOR = "#23964A";

export function startDefiGame(ctx) {
  const { app, mod } = ctx;
  const defis = mod.defis || [];
  let timerId = null;
  const stop = () => { if (timerId) clearInterval(timerId); timerId = null; };
  const $ = (s) => app.querySelector(s);
  const best = (d) => progress.game(mod.id, "defi-" + d.id).bestTime;

  function list() {
    stop();
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Mission terrain", color: COLOR, label: mod.title }) +
      '<main><div class="panel" style="border-top-color:' + COLOR + '"><h1>Mission terrain</h1>' +
      '<p class="lead">Le jeu vous donne une mission : réalisez-la <b>pour de vrai</b>, chrono en main. Ensuite, un collègue ou le formateur vérifie chaque point avec la liste de contrôle, et la correction illustrée s\'affiche.</p>' +
      '<div class="fiches">' + defis.map((d, i) => {
        const b = best(d);
        return '<button class="fitem" data-d="' + i + '" style="--mc:' + COLOR + ';text-align:left;border:0;width:100%"><span class="st" style="background:' + COLOR + ';color:#fff">' + ic("target") + "</span>" +
          '<span style="flex:1"><div class="ft">' + esc(d.title) + '</div><div class="fm">' + (d.items || []).length + " points de contrôle" +
          (d.objectif ? " · objectif " + mmss(d.objectif * 1000) : "") + (b ? " · record " + mmss(b) : "") + '</div></span><span class="go">' + ic("next") + "</span></button>";
      }).join("") + "</div></div></main></div>";
    bindBar(app, ctx.exit);
    app.querySelectorAll("[data-d]").forEach((b) => { b.onclick = () => mission(defis[+b.dataset.d]); });
  }

  function mission(d) {
    stop();
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Mission terrain", color: COLOR, label: mod.title }) +
      '<main><div class="qwrap"><div class="mission">' +
        '<div class="kicker">Votre mission</div><h1>' + esc(d.title) + "</h1>" +
        '<p class="consigne">' + fmt(d.consigne || "") + "</p>" +
        (d.objectif ? '<p class="muted">Objectif : moins de <b>' + mmss(d.objectif * 1000) + "</b></p>" : "") +
        '<div class="chrono" id="chrono">00:00<small>.0</small></div>' +
        '<div class="row center"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="start">' + ic("play") + "Top départ !</button></div>" +
        '<p class="muted small">Pas de chrono ? Touchez « Top départ » puis directement « Terminé » pour passer à la vérification.</p>' +
      "</div></div></main></div>";
    bindBar(app, () => { stop(); ctx.exit(); }, "Quitter la mission ?");
    $("#start").onclick = () => {
      const t0 = performance.now();
      SND.steal();
      $("#start").outerHTML = '<button class="btn red big" id="done">' + ic("check") + "Terminé !</button>";
      timerId = setInterval(() => {
        const ms = performance.now() - t0, c = $("#chrono");
        if (c) c.innerHTML = mmss(ms) + "<small>." + Math.floor(ms % 1000 / 100) + "</small>";
      }, 100);
      $("#done").onclick = () => { stop(); SND.good(); check(d, performance.now() - t0); };
    };
  }

  function check(d, ms) {
    const state = (d.items || []).map(() => null);
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Mission terrain", color: COLOR, label: mod.title, stats: '<span class="stat">' + ic("clock") + "<b>" + mmss(ms) + "</b></span>" }) +
      '<main><div class="qwrap"><div class="panel" style="border-top-color:' + COLOR + ';margin-top:0"><h1>Vérification</h1>' +
      '<p class="lead">Un collègue ou le formateur contrôle chaque point : <b>OK</b> s\'il est correct, <b>À revoir</b> sinon.</p>' +
      '<div class="checklist">' + (d.items || []).map((it, i) =>
        '<div class="chk" data-i="' + i + '"><span class="chk-t">' + fmt(it.t) + '</span><span class="chk-b"><button class="btn" data-v="1">' + ic("check") + 'OK</button><button class="btn" data-v="0">' + ic("x") + "À revoir</button></span></div>").join("") + "</div>" +
      '<div class="row end" style="margin-top:14px"><button class="btn big red" id="corr" disabled>Voir la correction →</button></div></div></div></main></div>';
    bindBar(app, ctx.exit, "Quitter la mission ?");
    app.querySelectorAll(".chk").forEach((row) => {
      row.querySelectorAll("[data-v]").forEach((b) => {
        b.onclick = () => {
          const i = +row.dataset.i;
          state[i] = b.dataset.v === "1";
          row.classList.toggle("yes", state[i]);
          row.classList.toggle("no", !state[i]);
          $("#corr").disabled = state.some((v) => v === null);
        };
      });
    });
    $("#corr").onclick = () => result(d, ms, state);
  }

  function result(d, ms, state) {
    const items = d.items || [];
    const ok = state.filter(Boolean).length;
    const pct = items.length ? Math.round(ok / items.length * 100) : 0;
    const perfect = ok === items.length;
    progress.saveGame(mod.id, "defi-" + d.id, pct);
    const record = perfect && progress.saveBestTime(mod.id, "defi-" + d.id, ms);
    perfect ? SND.win() : SND.bad();
    const inTime = d.objectif ? ms <= d.objectif * 1000 : null;
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Mission terrain", color: COLOR, label: mod.title }) +
      '<main><div class="qwrap"><div class="panel result" style="border-top-color:' + (perfect ? "var(--ok)" : "var(--fire)") + ';margin-top:0">' +
      "<h1>" + (perfect ? "Mission réussie !" : "Mission à retravailler") + "</h1>" +
      '<div class="kpis"><div class="kpi"><b>' + mmss(ms) + "</b><span>Temps" + (inTime === null ? "" : inTime ? " (objectif tenu)" : " (objectif dépassé)") + '</span></div><div class="kpi"><b>' + ok + "/" + items.length + "</b><span>Points conformes</span></div>" +
      (record ? '<div class="kpi"><b>🏆</b><span>Nouveau record</span></div>' : "") + "</div></div>" +
      '<div class="section-title">La correction</div><div class="corr">' + items.map((it, i) =>
        '<div class="corr-item ' + (state[i] ? "ok" : "ko") + '">' + (it.img ? '<img src="' + esc(it.img) + '" alt="" loading="lazy">' : "") +
        '<div><b>' + (state[i] ? "✔ " : "✖ ") + fmt(it.t) + "</b>" + (it.e ? "<p>" + fmt(it.e) + "</p>" : "") + (it.credit ? '<p class="small muted">' + esc(it.credit) + "</p>" : "") + "</div></div>").join("") + "</div>" +
      '<div class="row center" style="margin:20px 0"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="again">' + ic("reset") + 'Recommencer</button><button class="btn big" id="other">' + ic("list") + 'Autre mission</button><button class="btn big dark" id="home">' + ic("back") + "Retour au module</button></div>" +
      "</div></main></div>";
    bindBar(app, ctx.exit);
    $("#again").onclick = () => mission(d);
    $("#other").onclick = list;
    $("#home").onclick = ctx.exit;
  }

  if (!defis.length) { toast("Aucune mission dans ce module."); ctx.exit(); return () => {}; }
  list();
  return stop;
}
