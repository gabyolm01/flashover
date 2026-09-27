/* Jeu : Tableau à étiquettes (3 niveaux) */
import { ic, esc, fmt, rich, norm, num, mmss, shuffle, toast, verdict } from "../ui.js";
import { progress } from "../progress.js";
import { gameBar, bindBar } from "./common.js";

export const LEVELS = {
  facile:    { name: "Facile",    color: "#23964A", byRow: true,  aids: true,  hintKind: "elim" },
  moyen:     { name: "Moyen",     color: "#E07800", byRow: false, aids: true,  hintKind: "row" },
  difficile: { name: "Difficile", color: "#C1121F", byRow: false, aids: false, hintKind: "row" }
};
export const LEVEL_KEYS = ["facile", "moyen", "difficile"];
export const DEFAULT_LEVELS = {
  facile:    { penaltyError: 0.25, penaltyHint: 0.25, hints: 3, timeLimitMin: 0,  penaltyMinute: 0 },
  moyen:     { penaltyError: 0.5,  penaltyHint: 0.25, hints: 5, timeLimitMin: 0,  penaltyMinute: 0 },
  difficile: { penaltyError: 0.5,  penaltyHint: 0.25, hints: 0, timeLimitMin: 15, penaltyMinute: 0.5 }
};

export function labelRow(t, r) { while (r > 0 && t.rows[r].label === null) r--; return r; }
export function playableIds(t) {
  const ids = [];
  t.rows.forEach((row, r) => row.cells.forEach((cell, i) => { if (!cell.fixed && cell.t.trim()) ids.push(r + "-" + i); }));
  return ids;
}
export function cellOf(t, id) { const p = id.split("-"); return t.rows[+p[0]].cells[+p[1]]; }
const rowOf = (id) => +id.split("-")[0];

/* Grille du tableau (jeu ou édition) */
export function gridHTML(t, mode, placed) {
  const cols = ["minmax(9.2em,.85fr)"].concat(t.leaves.map((l) => "minmax(0," + l.w + "fr)")).join(" ");
  const ta = (kind, key, value) => '<textarea rows="1" data-k="' + kind + '" data-key="' + key + '">' + esc(value) + "</textarea>";
  let h = '<div class="grid ' + mode + '" style="grid-template-columns:' + cols + '"><div class="corner" style="grid-row:1;grid-column:1"></div>';
  let c = 2;
  t.groups.forEach((g, gi) => {
    h += '<div class="gh" style="grid-row:1;grid-column:' + c + " / span " + g.leaves + '">' + (mode === "edit" ? ta("g", gi, g.title) : rich(g.title)) + "</div>";
    c += g.leaves;
  });
  t.rows.forEach((row, r) => {
    const gr = r + 2;
    if (row.label !== null) {
      let span = 1;
      while (r + span < t.rows.length && t.rows[r + span].label === null) span++;
      h += '<div class="rl rl-' + row.color + '" data-r="' + r + '" style="grid-row:' + gr + " / span " + span + ';grid-column:1">' + (mode === "edit" ? ta("r", r, row.label) : rich(row.label)) + "</div>";
    }
    row.cells.forEach((cell, i) => {
      const id = r + "-" + i, tint = cell.s === 1 ? (t.leaves[cell.c].tint || "") : "", cls = ["cell"];
      if (tint) cls.push("t-" + tint);
      if (cell.fixed) cls.push("fixed");
      let inner;
      if (mode === "edit") inner = ta("c", id, cell.t) + (cell.fixed ? '<span class="tag">Toujours affiché (pas d\'étiquette)</span>' : "");
      else if (cell.fixed) inner = rich(cell.t);
      else if (!cell.t.trim()) { cls.push("void"); inner = ""; }
      else if (placed && placed[id]) { cls.push("placed"); inner = rich(cell.t); }
      else { cls.push("slot"); inner = '<span class="ph"></span>'; }
      h += '<div class="' + cls.join(" ") + '" data-id="' + id + '" style="grid-row:' + gr + ";grid-column:" + (cell.c + 2) + " / span " + cell.s + '">' + inner + "</div>";
    });
  });
  return h + "</div>";
}
function legendHTML(t) {
  return '<div class="legend">' + String(t.legend || "").split("\n").filter((l) => l.trim()).map((l) => "<span>" + fmt(l) + "</span>").join("") + "</div>";
}
export function levelSettings(t, k) { return Object.assign({}, DEFAULT_LEVELS[k], (t.levels || {})[k] || {}); }
function scoreRule(S) {
  const parts = ["−" + num(S.penaltyError) + " par erreur"];
  if (S.hints > 0 && S.penaltyHint > 0) parts.push("−" + num(S.penaltyHint) + " par indice utilisé");
  if (S.timeLimitMin > 0 && S.penaltyMinute > 0) parts.push("−" + num(S.penaltyMinute) + " par minute au-delà de " + num(S.timeLimitMin) + " min");
  else parts.push("sans limite de temps");
  return parts.join(" · ");
}

export function startTableGame(ctx) {
  const { app, mod } = ctx, T = mod.table;
  let state = null, timerId = null;
  const $ = (s) => app.querySelector(s);
  const stopTimer = () => { if (timerId) clearInterval(timerId); timerId = null; };
  const labelText = (r) => String(T.rows[labelRow(T, r)].label).replace(/\s*\n\s*/g, " ");

  function home() {
    stopTimer();
    state = null;
    const n = playableIds(T).length;
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Tableau", color: "#C1121F", label: mod.title }) +
      '<main><div class="panel"><h1>Tableau à étiquettes</h1>' +
      '<p class="lead">Replacez chaque étiquette dans la bonne case du tableau.</p>' +
      '<div class="facts"><span>' + n + " étiquettes</span><span>" + T.groups.length + " colonnes</span><span>Note sur 20</span></div>" +
      '<ol class="rules">' +
        "<li><span>Une étiquette apparaît en bas de l'écran : décidez où elle va.</span></li>" +
        "<li><span>Touchez la case du tableau (ou faites-y glisser l'étiquette).</span></li>" +
        '<li><span><span class="o">Bonne case :</span> l\'étiquette se fixe. <span class="x">Mauvaise case :</span> elle devient rouge et repart dans la pioche.</span></li>' +
        "<li><span>« Passer » remet l'étiquette dans la pioche sans pénalité. <b>Chaque indice utilisé retire des points</b> (le coût est affiché sur le bouton).</span></li>" +
      "</ol>" +
      '<div class="levels">' + LEVEL_KEYS.map((k) => {
        const L = LEVELS[k], S = levelSettings(T, k);
        const items = [L.byRow ? "Ligne par ligne : une seule ligne active à la fois" : "Tout le tableau, étiquettes mélangées"];
        if (L.aids) items.push("Les cases déjà essayées sont signalées");
        if (S.hints > 0) items.push(S.hints + " indice" + (S.hints > 1 ? "s" : "") + " : " + (L.hintKind === "elim" ? "écarte la moitié des mauvaises cases" : "révèle la ligne de l'étiquette"));
        if (!L.aids && !(S.hints > 0)) items.push("Aucune aide");
        return '<button class="level" data-level="' + k + '" style="--lc:' + L.color + '"><h2>' + L.name + "</h2><ul>" + items.map((i) => "<li>" + i + "</li>").join("") + "</ul>" +
          '<div class="note"><b>Note sur 20</b> : ' + scoreRule(S) + '</div><span class="go">' + ic("play") + "Jouer</span></button>";
      }).join("") + "</div></div></main></div>";
    bindBar(app, ctx.exit);
    app.querySelectorAll("[data-level]").forEach((b) => { b.onclick = () => start(b.dataset.level); });
  }

  const elapsed = () => state.acc + (state.running && !state.paused ? performance.now() - state.t0 : 0);
  const cellEl = (id) => $('#board .cell[data-id="' + id + '"]');

  function start(level) {
    const L = LEVELS[level], S = levelSettings(T, level), ids = playableIds(T);
    state = { level, L, S, placed: {}, deck: [], total: ids.length, errors: 0, errLog: {}, tried: {}, elim: {}, revealed: {},
      hintsLeft: Math.max(0, Math.floor(S.hints) || 0), hintsUsed: 0, stages: [], stage: 0, acc: 0, t0: performance.now(), running: true, paused: false, busy: false };
    if (L.byRow) {
      ids.forEach((id) => { const g = labelRow(T, rowOf(id)); if (state.stages.indexOf(g) < 0) state.stages.push(g); });
      state.deck = stageDeck();
    } else state.deck = shuffle(ids);
    const cost = S.penaltyHint > 0 ? " · −" + num(S.penaltyHint) + " pt" : "";
    app.innerHTML = '<div class="screen fixedh tableplay">' +
      gameBar({ badge: L.name, color: L.color, label: mod.title,
        stats: '<span class="stat">' + ic("clock") + '<b id="clock">00:00</b></span><span class="stat err">Erreurs <b id="errs">0</b></span><span class="stat">Placées <b id="done">0</b>/' + state.total + "</span>",
        actions: '<button class="iconbtn" id="pause" title="Pause">' + ic("pause") + "</button>" }) +
      '<main class="board playing" id="board"><div class="board-inner">' + gridHTML(T, "play", state.placed) + legendHTML(T) + "</div></main>" +
      '<footer class="dock" id="dock"><div class="hint" id="dockHint"></div><div class="lcard" id="card"></div>' +
        '<div class="side"><div class="remain"><b id="remain">' + state.total + "</b>restantes</div>" +
        '<button class="btn" id="skip">' + ic("skip") + "Passer</button>" +
        (state.hintsLeft > 0 ? '<button class="btn hintbtn" id="hintBtn" data-cost="' + cost + '"></button>' : "") + "</div></footer></div>";
    bindBar(app, () => { stopTimer(); ctx.exit(); }, "Abandonner la partie en cours ?");
    $("#pause").onclick = pause;
    $("#skip").onclick = skip;
    if ($("#hintBtn")) $("#hintBtn").onclick = useHint;
    $("#board").addEventListener("click", (e) => { const s = e.target.closest(".slot"); if (s) tryPlace(s.dataset.id); });
    setupDrag($("#card"));
    applyStage();
    showCard();
    stopTimer();
    timerId = setInterval(() => { const c = $("#clock"); if (c && state) c.textContent = mmss(elapsed()); }, 250);
  }
  function stageDeck() {
    const g = state.stages[state.stage];
    return shuffle(playableIds(T).filter((id) => labelRow(T, rowOf(id)) === g));
  }
  function applyStage() {
    const hint = $("#dockHint");
    if (!state.L.byRow) { hint.innerHTML = "<b>Où va cette étiquette ?</b>Touchez la case, ou glissez l'étiquette dans le tableau"; return; }
    const g = state.stages[state.stage];
    app.querySelectorAll("#board .cell").forEach((el) => el.classList.toggle("off", labelRow(T, rowOf(el.dataset.id)) !== g));
    app.querySelectorAll("#board .rl").forEach((el) => {
      const on = +el.dataset.r === g;
      el.classList.toggle("off", !on);
      el.classList.toggle("active", on);
      if (on) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    hint.innerHTML = "<b>Ligne " + (state.stage + 1) + "/" + state.stages.length + " · " + esc(labelText(g)) + "</b>Touchez la bonne case dans la ligne en surbrillance";
  }
  const cardKey = () => norm(cellOf(T, state.deck[0]).t);
  function targetRow() {
    const cur = state.deck[0];
    if (!state.placed[cur]) return rowOf(cur);
    const key = cardKey(), ids = playableIds(T);
    for (const id of ids) if (!state.placed[id] && norm(cellOf(T, id).t) === key) return rowOf(id);
    return rowOf(cur);
  }
  function cardHTML() {
    const tag = state.L.aids && state.revealed[cardKey()] ? '<div class="cardtag">Ligne : ' + esc(labelText(targetRow())) + "</div>" : "";
    return tag + rich(cellOf(T, state.deck[0]).t);
  }
  function showCard() {
    const card = $("#card");
    card.className = "lcard enter";
    card.innerHTML = cardHTML();
    void card.offsetWidth;
    card.classList.remove("enter");
    $("#remain").textContent = state.total - Object.keys(state.placed).length;
    applyAids();
    updateHintBtn();
  }
  function applyAids() {
    app.querySelectorAll("#board .cell").forEach((el) => el.classList.remove("tried", "elim", "dimsoft"));
    if (!state.L.byRow) app.querySelectorAll("#board .rl").forEach((el) => el.classList.remove("active"));
    if (!state.running || !state.deck.length || !state.L.aids) return;
    const key = cardKey();
    (state.tried[key] || []).forEach((id) => { const el = cellEl(id); if (el && el.classList.contains("slot")) el.classList.add("tried"); });
    (state.elim[key] || []).forEach((id) => { const el = cellEl(id); if (el && el.classList.contains("slot")) el.classList.add("elim"); });
    if (state.revealed[key] && !state.L.byRow) {
      const g = labelRow(T, targetRow());
      app.querySelectorAll("#board .cell").forEach((el) => { if (labelRow(T, rowOf(el.dataset.id)) !== g) el.classList.add("dimsoft"); });
      app.querySelectorAll("#board .rl").forEach((el) => { if (+el.dataset.r === g) el.classList.add("active"); });
    }
  }
  function updateHintBtn() {
    const b = $("#hintBtn");
    if (!b) return;
    b.innerHTML = ic("bulb") + "Indice <small>(" + state.hintsLeft + " restant" + (state.hintsLeft > 1 ? "s" : "") + b.dataset.cost + ")</small>";
    b.disabled = state.hintsLeft <= 0;
  }
  function useHint() {
    if (!state || !state.running || state.paused || state.busy || !state.deck.length) return;
    if (state.hintsLeft <= 0) { toast("Plus aucun indice disponible."); return; }
    const key = cardKey();
    if (state.L.hintKind === "elim") {
      const tried = state.tried[key] || [], elim = state.elim[key] || [], cand = [];
      app.querySelectorAll("#board .cell.slot:not(.off)").forEach((el) => {
        const id = el.dataset.id;
        if (tried.indexOf(id) < 0 && elim.indexOf(id) < 0 && norm(cellOf(T, id).t) !== key) cand.push(id);
      });
      if (!cand.length) { toast("Il ne reste plus que la bonne case : pas besoin d'indice !"); return; }
      state.elim[key] = elim.concat(shuffle(cand).slice(0, Math.max(1, Math.floor(cand.length / 2))));
    } else {
      if (state.revealed[key]) { toast("La ligne de cette étiquette est déjà affichée."); return; }
      state.revealed[key] = true;
    }
    state.hintsLeft--;
    state.hintsUsed++;
    $("#card").innerHTML = cardHTML();
    applyAids();
    updateHintBtn();
    toast("Indice utilisé" + (state.S.penaltyHint > 0 ? " : −" + num(state.S.penaltyHint) + " point sur la note." : "."));
  }
  function updateStats() {
    $("#errs").textContent = state.errors;
    $("#done").textContent = Object.keys(state.placed).length;
  }
  function reinsert(id) {
    const n = state.deck.length;
    if (n === 0) { state.deck.push(id); return; }
    const min = Math.min(n, 3);
    state.deck.splice(min + Math.floor(Math.random() * (n - min + 1)), 0, id);
  }
  function tryPlace(id) {
    if (!state || !state.running || state.paused || state.busy || !state.deck.length) return;
    const el = cellEl(id);
    if (!el || !el.classList.contains("slot") || ["off", "tried", "elim"].some((c) => el.classList.contains(c))) return;
    const cur = state.deck[0], key = cardKey(), card = $("#card");
    if (key === norm(cellOf(T, id).t)) {
      state.placed[id] = true;
      state.deck.shift();
      el.classList.remove("slot", "hover");
      el.classList.add("placed", "just");
      el.innerHTML = rich(cellOf(T, id).t);
      setTimeout(() => el.classList.remove("just"), 950);
      updateStats();
      if (state.deck.length) { showCard(); return; }
      if (state.L.byRow && state.stage < state.stages.length - 1) {
        state.stage++;
        state.deck = stageDeck();
        toast("Ligne terminée ! Suivante : " + labelText(state.stages[state.stage]));
        applyStage();
        showCard();
      } else finish();
    } else {
      state.errors++;
      const txt = cellOf(T, cur).t;
      state.errLog[txt] = (state.errLog[txt] || 0) + 1;
      if (state.L.aids) (state.tried[key] = state.tried[key] || []).push(id);
      updateStats();
      state.busy = true;
      el.classList.add("miss");
      card.classList.add("wrong");
      setTimeout(() => { el.classList.remove("miss"); card.classList.add("leave"); }, 700);
      setTimeout(() => { reinsert(state.deck.shift()); state.busy = false; showCard(); }, 1050);
    }
  }
  function skip() {
    if (!state || state.busy || state.paused || state.deck.length < 2) return;
    state.busy = true;
    $("#card").classList.add("leave");
    setTimeout(() => { reinsert(state.deck.shift()); state.busy = false; showCard(); }, 300);
  }
  function pause() {
    if (!state || !state.running) return;
    state.acc = elapsed();
    state.paused = true;
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = '<div class="modal"><h2>Partie en pause</h2><p>Le chronomètre est arrêté.</p><div class="row"><button class="btn red big" id="resume">' + ic("play") + "Reprendre</button></div></div>";
    app.querySelector(".screen").appendChild(ov);
    ov.querySelector("#resume").onclick = () => { state.paused = false; state.t0 = performance.now(); ov.remove(); };
  }
  function setupDrag(card) {
    let drag = null;
    const clear = () => {
      if (!drag) return;
      if (drag.ghost) drag.ghost.remove();
      if (drag.hover) drag.hover.classList.remove("hover");
      card.classList.remove("dragging");
      drag = null;
    };
    card.addEventListener("pointerdown", (e) => {
      if (!state || state.busy || state.paused || !state.running) return;
      drag = { x: e.clientX, y: e.clientY, moved: false, ghost: null, hover: null };
      card.setPointerCapture(e.pointerId);
    });
    card.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
        drag.moved = true;
        const g = card.cloneNode(true);
        g.removeAttribute("id");
        g.className = "lcard ghost";
        g.style.width = card.offsetWidth + "px";
        document.body.appendChild(g);
        Object.assign(drag, { ghost: g, w: card.offsetWidth, h: card.offsetHeight });
        card.classList.add("dragging");
      }
      if (!drag.moved) return;
      drag.ghost.style.transform = "translate(" + (e.clientX - drag.w / 2) + "px," + (e.clientY - drag.h / 2) + "px) rotate(-2deg) scale(.9)";
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slot = el && el.closest ? el.closest(".slot") : null;
      if (slot !== drag.hover) {
        if (drag.hover) drag.hover.classList.remove("hover");
        if (slot) slot.classList.add("hover");
        drag.hover = slot;
      }
      const b = $("#board"), r = b.getBoundingClientRect();
      if (e.clientY < r.top + 50) b.scrollTop -= 14; else if (e.clientY > r.bottom - 50) b.scrollTop += 14;
    });
    card.addEventListener("pointerup", () => {
      if (!drag) return;
      const target = drag.moved ? drag.hover : null;
      clear();
      if (target) tryPlace(target.dataset.id);
    });
    card.addEventListener("pointercancel", clear);
  }
  function finish() {
    state.acc = elapsed();
    state.running = false;
    stopTimer();
    applyAids();
    app.querySelectorAll("#board .off, #board .active").forEach((el) => el.classList.remove("off", "active"));
    $("#clock").textContent = mmss(state.acc);
    $("#board").classList.remove("playing");
    const S = state.S, level = state.level;
    const over = S.timeLimitMin > 0 ? Math.max(0, Math.ceil(state.acc / 60000 - S.timeLimitMin)) : 0;
    const note = Math.round(Math.max(0, Math.min(20, 20 - state.errors * S.penaltyError - state.hintsUsed * S.penaltyHint - over * S.penaltyMinute)) * 100) / 100;
    progress.saveGame(mod.id, "tableau-" + level, note);
    const hard = Object.keys(state.errLog).map((k) => [k, state.errLog[k]]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    let kpis = '<div class="kpi"><b>' + mmss(state.acc) + '</b><span>Temps</span></div><div class="kpi"><b>' + state.errors + "</b><span>Erreur" + (state.errors > 1 ? "s" : "") + "</span></div>";
    if (S.hints > 0) kpis += '<div class="kpi"><b>' + state.hintsUsed + "/" + Math.floor(S.hints) + "</b><span>Indices utilisés</span></div>";
    if (S.timeLimitMin > 0) kpis += '<div class="kpi"><b>' + (over ? "+" + over + " min" : "—") + "</b><span>Dépassement</span></div>";
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = '<div class="modal"><span class="lvl-badge" style="background:' + LEVELS[level].color + '">Niveau ' + LEVELS[level].name + "</span>" +
      "<h2>Tableau complété !</h2>" + '<div class="score">' + num(note) + "<span>/20</span></div>" + '<div class="verdict">' + verdict(note) + "</div>" +
      '<div class="kpis">' + kpis + "</div>" +
      (hard.length ? '<div class="hard"><h3>Étiquettes les plus difficiles</h3><ol>' + hard.map((h) => "<li>" + fmt(h[0].replace(/•\s*/g, "").replace(/\n/g, " · ")) + " (" + h[1] + " erreur" + (h[1] > 1 ? "s" : "") + ")</li>").join("") + "</ol></div>" : "") +
      '<div class="row"><button class="btn" id="see">' + ic("table") + 'Voir le tableau</button><button class="btn red" id="again">' + ic("reset") + 'Rejouer</button><button class="btn dark" id="home">' + ic("back") + "Niveaux</button></div></div>";
    app.querySelector(".screen").appendChild(ov);
    const dock = $("#dock");
    dock.className = "dock done";
    dock.innerHTML = "<div><b>Partie terminée</b> — note " + num(note) + "/20 · " + mmss(state.acc) + "</div>" +
      '<div class="row"><button class="btn red" id="again2">' + ic("reset") + 'Rejouer</button><button class="btn" id="home2">' + ic("back") + "Niveaux</button></div>";
    $("#pause").style.display = "none";
    ov.querySelector("#see").onclick = () => ov.remove();
    [ov.querySelector("#again"), $("#again2")].forEach((b) => { b.onclick = () => start(level); });
    [ov.querySelector("#home"), $("#home2")].forEach((b) => { b.onclick = home; });
  }
  home();
  return stopTimer;
}
