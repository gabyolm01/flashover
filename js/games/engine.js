/* Moteur de questions commun : quiz, duel, tests des fiches */
import { esc, fmt, norm, shuffle } from "../ui.js";
import { progress } from "../progress.js";

export const QTYPES = { Q: "QCM", V: "Vrai ou faux", O: "Remettre dans l'ordre", R: "Relier", I: "L'intrus", T: "Texte à trous", S: "Mise en situation" };

/* ---- Sources de questions ---- */
export function activeQuestions(mod) {
  const off = mod.qOff || {};
  return (mod.questions || []).filter((q) => !off[q.id]);
}
function labelRow(t, r) { while (r > 0 && t.rows[r].label === null) r--; return r; }
function inlineText(t) {
  return String(t).split("\n").map((l) => l.replace(/^\s*•\s*/, "").trim()).filter(Boolean).join(" · ");
}
function capFirst(s) { s = String(s).toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
function seeded(seed) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
function seededShuffle(a, rnd) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/* Questions fabriquées à partir du tableau récapitulatif du module (s'il en a un) */
export function autoQuestions(mod) {
  const t = mod.table;
  if (!t || mod.autoQ === false) return [];
  const out = [], leafGroup = [], gNames = [];
  t.groups.forEach((g, gi) => {
    gNames.push(capFirst(String(g.title).split("\n")[0].trim()));
    for (let k = 0; k < g.leaves; k++) leafGroup.push(gi);
  });
  const cells = [];
  t.rows.forEach((row, r) => {
    const lr = labelRow(t, r);
    row.cells.forEach((cell, i) => {
      if (cell.fixed || !cell.t.trim()) return;
      const txt = inlineText(cell.t);
      cells.push({ id: r + "-" + i, lr, crit: capFirst(String(t.rows[lr].label).replace(/\s*\n\s*/g, " ")), g: leafGroup[cell.c],
        text: txt, key: norm(txt), lines: cell.t.split("\n").map((l) => l.replace(/^\s*•\s*/, "").trim()).filter((l) => l.length > 2) });
    });
  });
  cells.forEach((c) => { c.tech = gNames[c.g]; });
  cells.forEach((c) => { c.uniqueTech = !cells.some((o) => o !== c && o.lr === c.lr && o.tech === c.tech); });
  const byRow = {};
  cells.forEach((c) => { (byRow[c.lr] = byRow[c.lr] || []).push(c); });
  const f = "tab";
  cells.forEach((c) => {
    const row = byRow[c.lr];
    if (!row.some((o) => o.key === c.key && o.g !== c.g)) {
      out.push({ id: "auto-t-" + c.id, t: "Q", f, q: "Ligne « " + c.crit + " » du tableau : à quelle technique correspond « " + c.text + " » ?",
        a: [gNames[c.g]].concat(gNames.filter((n, i) => i !== c.g)), e: "" });
    }
    if (!c.uniqueTech) return;
    const others = [];
    row.forEach((o) => { if (o.key !== c.key && others.every((x) => norm(x) !== o.key)) others.push(o.text); });
    if (others.length >= 2) {
      out.push({ id: "auto-c-" + c.id, t: "Q", f, q: "Ligne « " + c.crit + " » du tableau : que trouve-t-on pour « " + c.tech + " » ?",
        a: [c.text].concat(others.slice(0, 3)), e: "" });
    }
    out.push({ id: "auto-vt-" + c.id, t: "V", f, q: "Dans le tableau, ligne « " + c.crit + " », pour « " + c.tech + " » : « " + c.text + " ».", a: ["V"], e: "" });
    const wrong = row.filter((o) => o.uniqueTech && o.key !== c.key && o.tech !== c.tech)[0];
    if (wrong) {
      out.push({ id: "auto-vf-" + c.id, t: "V", f, q: "Dans le tableau, ligne « " + c.crit + " », pour « " + wrong.tech + " » : « " + c.text + " ».",
        a: ["F"], e: "« " + c.text + " » correspond à « " + c.tech + " »." });
    }
  });
  Object.keys(byRow).forEach((lr) => {
    const list = [], keys = {};
    byRow[lr].forEach((c) => { if (c.uniqueTech && !keys[c.key]) { keys[c.key] = 1; list.push(c); } });
    if (list.length >= 3) out.push({ id: "auto-r-" + lr, t: "R", f, q: "Ligne « " + list[0].crit + " » du tableau : reliez chaque technique à son contenu.",
      a: list.slice(0, 4).map((c) => [c.tech, c.text]), e: "" });
  });
  gNames.forEach((name, gi) => {
    const mine = [], mineKeys = {}, other = [];
    cells.forEach((c) => { if (c.g === gi) c.lines.forEach((l) => { const k = norm(l); if (!mineKeys[k]) { mineKeys[k] = 1; mine.push(l); } }); });
    cells.forEach((c) => { if (c.g !== gi) c.lines.forEach((l) => { if (!mineKeys[norm(l)] && other.indexOf(l) < 0) other.push(l); }); });
    if (mine.length < 3 || !other.length) return;
    for (let k = 0; k < 4; k++) {
      const rnd = seeded(gi * 131 + k * 17 + 7);
      out.push({ id: "auto-i-" + gi + "-" + k, t: "I", f, q: "Lequel de ces éléments n'appartient PAS à « " + name + " » dans le tableau ?",
        a: [seededShuffle(other, rnd)[0]].concat(seededShuffle(mine, rnd).slice(0, 3)), e: "Les trois autres éléments figurent dans la colonne « " + name + " »." });
    }
  });
  return out;
}

/* ---- Tirage : priorité aux questions jamais (ou le moins) posées sur cet appareil ---- */
export function pickQuestions(mod, pool, n, exclude) {
  exclude = exclude || {};
  const m = progress.seenMap(mod.id);
  const list = shuffle(pool.filter((q) => !exclude[q.id]));
  list.sort((a, b) => (m[a.id] || 0) - (m[b.id] || 0));
  const out = [], perType = {}, cap = Math.max(2, Math.ceil(n * 0.35));
  list.forEach((q) => {
    if (out.length >= n || (perType[q.t] || 0) >= cap) return;
    out.push(q);
    perType[q.t] = (perType[q.t] || 0) + 1;
  });
  list.forEach((q) => { if (out.length < n && out.indexOf(q) < 0) out.push(q); });
  out.forEach((q) => { exclude[q.id] = true; });
  return out;
}
export function mixedPick(mod, n, filter, exclude) {
  filter = filter || (() => true);
  const autos = autoQuestions(mod).filter(filter);
  const nAuto = autos.length ? Math.round(n * 0.25) : 0;
  let auto = nAuto ? pickQuestions(mod, autos, nAuto, exclude) : [];
  const written = pickQuestions(mod, activeQuestions(mod).filter(filter), n - auto.length, exclude);
  if (written.length + auto.length < n && autos.length) auto = auto.concat(pickQuestions(mod, autos, n - written.length - auto.length, exclude));
  return shuffle(written.concat(auto));
}
export function poolSize(mod) { return activeQuestions(mod).length + autoQuestions(mod).length; }

/* ---- Préparation et affichage ---- */
export function prepare(q) {
  const p = { id: q.id, t: q.t, f: q.f, q: q.q, e: q.e || "" };
  if ("QITS".indexOf(q.t) >= 0) p.choices = shuffle(q.a.map((x, i) => ({ txt: x, ok: i === 0 })));
  else if (q.t === "V") { const v = q.a[0] !== "F"; p.choices = [{ txt: "Vrai", ok: v }, { txt: "Faux", ok: !v }]; }
  else if (q.t === "O") p.items = q.a.slice();
  else if (q.t === "R") p.pairs = q.a.slice();
  return p;
}
export function answerText(p) {
  if (p.choices) return p.choices.filter((c) => c.ok)[0].txt;
  if (p.items) return p.items.join(" → ");
  return p.pairs.map((x) => x[0] + " → " + x[1]).join(" ; ");
}
function qTextHTML(s) { return fmt(s).replace(/_{3,}/g, '<span class="blank"></span>'); }
export function sourceText(mod, p) {
  if (p.f === "tab") return "Source : tableau récapitulatif du module";
  const th = (mod.themes || {})[p.f];
  return "Source : " + (mod.source || "documentation du module") + (th ? ", " + th : "");
}

const PAIR_COLORS = ["#C1121F", "#1F5FBF", "#23964A", "#E07800", "#7A3FB8", "#138A83"];
/* Affiche une question dans host. Le thème n'est pas affiché (il donnerait un indice) ;
   il apparaît dans la correction via sourceText(). */
export function mountQuestion(host, p, onDone, mod) {
  const ctl = { locked: false };
  host.classList.remove("locked");
  host.innerHTML = '<div class="qmeta"><span class="qtype ' + p.t + '">' + QTYPES[p.t] + "</span></div>" +
    '<div class="qtext">' + qTextHTML(p.q) + '</div><div class="qbody"></div><div class="qfeed"></div>';
  const body = host.querySelector(".qbody");
  const done = (ok, info) => { if (!ctl.locked) onDone(ok, info || {}); };

  function build() {
    if (p.choices) {
      body.className = "qbody choices";
      body.innerHTML = p.choices.map((c, i) => '<button class="choice" data-i="' + i + '"><span class="letter">' +
        (p.t === "V" ? c.txt.charAt(0) : "ABCDEF".charAt(i)) + "</span><span>" + fmt(c.txt) + "</span></button>").join("");
      body.querySelectorAll(".choice").forEach((b) => {
        b.onclick = () => { if (ctl.locked || b.disabled) return; const i = +b.dataset.i; done(p.choices[i].ok, { pick: i }); };
      });
    } else if (p.t === "O") {
      const disp = shuffle(p.items.map((x, i) => i));
      if (disp.every((v, i) => v === i)) disp.reverse();
      let seq = [];
      body.className = "qbody";
      body.innerHTML = '<p class="qhint">Touchez les étapes dans le bon ordre. Touchez à nouveau une étape pour l\'annuler.</p><div class="olist">' +
        disp.map((ix) => '<button class="oitem" data-ix="' + ix + '"><span class="num"></span><span>' + fmt(p.items[ix]) + "</span></button>").join("") +
        '</div><div class="qactions"><button class="btn" data-act="clear">Tout effacer</button><button class="btn red" data-act="ok" disabled>Valider l\'ordre</button></div>';
      const paint = () => {
        body.querySelectorAll(".oitem").forEach((b) => {
          const k = seq.indexOf(+b.dataset.ix);
          b.classList.toggle("sel", k >= 0);
          b.querySelector(".num").textContent = k >= 0 ? k + 1 : "";
        });
        body.querySelector('[data-act="ok"]').disabled = seq.length !== p.items.length;
      };
      body.querySelectorAll(".oitem").forEach((b) => {
        b.onclick = () => {
          if (ctl.locked) return;
          const ix = +b.dataset.ix, k = seq.indexOf(ix);
          if (k >= 0) seq.splice(k, 1); else seq.push(ix);
          paint();
        };
      });
      body.querySelector('[data-act="clear"]').onclick = () => { if (!ctl.locked) { seq = []; paint(); } };
      body.querySelector('[data-act="ok"]').onclick = () => done(seq.every((v, i) => v === i), { seq: seq.slice() });
    } else if (p.t === "R") {
      const n = p.pairs.length;
      let link = {}, selL = null;
      const right = shuffle(p.pairs.map((x, i) => i));
      if (right.every((v, i) => v === i)) right.reverse();
      body.className = "qbody";
      body.innerHTML = '<p class="qhint">Touchez un élément à gauche, puis l\'élément qui lui correspond à droite.</p><div class="rgrid"><div class="rcol">' +
        p.pairs.map((pr, i) => '<button class="ritem" data-l="' + i + '"><span class="tagn"></span><span>' + fmt(pr[0]) + "</span></button>").join("") +
        '</div><div class="rcol">' + right.map((j) => '<button class="ritem" data-r="' + j + '"><span class="tagn"></span><span>' + fmt(p.pairs[j][1]) + "</span></button>").join("") +
        '</div></div><div class="qactions"><button class="btn" data-act="clear">Tout effacer</button><button class="btn red" data-act="ok" disabled>Valider</button></div>';
      const leftOf = (j) => { for (const k in link) if (link[k] === j) return +k; return null; };
      const paint = () => {
        body.querySelectorAll("[data-l]").forEach((b) => {
          const i = +b.dataset.l, has = link[i] != null, t = b.querySelector(".tagn");
          b.classList.toggle("sel", selL === i);
          t.style.background = has ? PAIR_COLORS[i % 6] : "";
          t.textContent = has ? i + 1 : "";
        });
        body.querySelectorAll("[data-r]").forEach((b) => {
          const li = leftOf(+b.dataset.r), t = b.querySelector(".tagn");
          t.style.background = li != null ? PAIR_COLORS[li % 6] : "";
          t.textContent = li != null ? li + 1 : "";
        });
        body.querySelector('[data-act="ok"]').disabled = Object.keys(link).length !== n;
      };
      body.querySelectorAll("[data-l]").forEach((b) => {
        b.onclick = () => {
          if (ctl.locked) return;
          const i = +b.dataset.l;
          if (link[i] != null) { delete link[i]; selL = i; } else selL = selL === i ? null : i;
          paint();
        };
      });
      body.querySelectorAll("[data-r]").forEach((b) => {
        b.onclick = () => {
          if (ctl.locked || selL == null) return;
          const j = +b.dataset.r, prev = leftOf(j);
          if (prev != null) delete link[prev];
          link[selL] = j;
          selL = null;
          paint();
        };
      });
      body.querySelector('[data-act="clear"]').onclick = () => { if (!ctl.locked) { link = {}; selL = null; paint(); } };
      body.querySelector('[data-act="ok"]').onclick = () => {
        let ok = true;
        for (let i = 0; i < n; i++) if (link[i] !== i) ok = false;
        done(ok, { link: Object.assign({}, link) });
      };
    }
  }
  build();

  ctl.reset = () => { host.querySelector(".qfeed").innerHTML = ""; if (!p.choices) build(); };
  ctl.lock = () => { ctl.locked = true; host.classList.add("locked"); };
  ctl.unlock = () => { ctl.locked = false; host.classList.remove("locked"); };
  ctl.markWrong = (i) => { const b = body.querySelector('.choice[data-i="' + i + '"]'); if (b) { b.classList.add("ko"); b.disabled = true; } };
  ctl.canFifty = () => !!p.choices && p.t !== "V" && body.querySelectorAll(".choice:not([disabled])").length >= 3;
  ctl.fifty = () => {
    if (!ctl.canFifty()) return false;
    const live = Array.from(body.querySelectorAll(".choice:not([disabled])"));
    shuffle(live.filter((b) => !p.choices[+b.dataset.i].ok)).slice(0, live.length - 2).forEach((b) => { b.classList.add("gone"); b.disabled = true; });
    return true;
  };
  ctl.reveal = (info) => {
    info = info || {};
    if (p.choices) {
      body.querySelectorAll(".choice").forEach((b) => {
        const i = +b.dataset.i;
        if (p.choices[i].ok) { b.classList.add("ok"); b.classList.remove("gone"); }
        else if (info.pick === i) b.classList.add("ko");
        b.disabled = true;
      });
    } else if (p.t === "O") {
      const seq = info.seq || [];
      body.innerHTML = '<p class="qhint">Le bon ordre :</p><div class="olist">' + p.items.map((x, i) =>
        '<div class="oitem ' + (seq[i] === i ? "ok" : "ko") + '"><span class="num">' + (i + 1) + "</span><span>" + fmt(x) + "</span></div>").join("") + "</div>";
    } else if (p.t === "R") {
      const link = info.link || {};
      body.innerHTML = '<p class="qhint">Les bonnes associations :</p><div class="rsol">' + p.pairs.map((pr, i) =>
        '<div class="rsrow ' + (link[i] === i ? "ok" : "ko") + '"><span>' + fmt(pr[0]) + "</span><b>→</b><span>" + fmt(pr[1]) + "</span></div>").join("") + "</div>";
    }
  };
  ctl.feedback = (ok, title, extra) => {
    host.querySelector(".qfeed").innerHTML = '<div class="feed ' + (ok ? "ok" : "ko") + '"><b class="big">' + title + "</b>" +
      (!ok && p.choices ? '<span class="ans">Bonne réponse : ' + fmt(answerText(p)) + "</span>" : "") +
      (p.e ? "<span>" + fmt(p.e) + "</span>" : "") +
      (mod ? '<span class="src">' + esc(sourceText(mod, p)) + "</span>" : "") + (extra || "") + "</div>";
  };
  return ctl;
}

/* ---- Sons (générés par le navigateur) ---- */
let audioCtx = null;
export const sound = { muted: false };
function beep(freqs, dur, type) {
  if (sound.muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    freqs.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * dur);
      g.gain.exponentialRampToValueAtTime(0.22, t + i * dur + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (i + 1) * dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t + i * dur); o.stop(t + (i + 1) * dur + 0.05);
    });
  } catch (e) {}
}
export const SND = {
  good: () => beep([660, 880, 1320], 0.11),
  bad: () => beep([220, 150], 0.22, "sawtooth"),
  tick: () => beep([1000], 0.05, "square"),
  steal: () => beep([440, 554, 659, 880], 0.07, "triangle"),
  win: () => beep([523, 659, 784, 1047, 784, 1047], 0.14, "triangle")
};
