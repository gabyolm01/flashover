/* Jeu : Duel d'équipes façon jeu télévisé */
import { ic, esc, plural, toast } from "../ui.js";
import { progress } from "../progress.js";
import { mixedPick, pickQuestions, activeQuestions, prepare, mountQuestion, SND, sound } from "./engine.js";
import { gameBar, bindBar } from "./common.js";

const COLOR = "#1F5FBF";
const TEAM_COLORS = ["#C1121F", "#1F5FBF"];
/* Questions de démonstration : toujours les mêmes, elles expliquent le jeu lui-même */
const DEMO = [
  { id: "demo-1", t: "Q", f: "", q: "Pendant le duel, qui annonce la réponse de l'équipe au formateur ?",
    a: ["Le capitaine de l'équipe", "Le premier qui crie", "Le formateur choisit seul", "L'équipe adverse"],
    e: "Chaque équipe désigne un capitaine : il annonce la réponse, le formateur clique dessus." },
  { id: "demo-2", t: "V", f: "", q: "Si une équipe vole une question et se trompe, elle perd des points.", a: ["V"],
    e: "Vrai : voler est un pari. Bonne réponse : l'équipe gagne des points. Mauvaise réponse ou temps écoulé : elle en perd davantage." }
];

export function startDuelGame(ctx) {
  const { app, mod, platform } = ctx;
  const D = Object.assign({ q1: 10, q2: 4, tQ: 45, tScen: 60, tSteal: 15, pts: 2, ptsSteal: 1, ptsStealFail: 2, mult: 2 }, platform.duel || {});
  let duel = null, timerId = null, qctl = null;
  const stopTimer = () => { if (timerId) clearInterval(timerId); timerId = null; };
  const $ = (s) => app.querySelector(s);

  function setup(names) {
    names = names || ["Équipe rouge", "Équipe bleue"];
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Duel", color: COLOR, label: mod.title }) +
      '<main><div class="panel" style="border-top-color:' + COLOR + '"><h1>Duel d\'équipes</h1>' +
      '<p class="lead">Deux équipes s\'affrontent comme dans un jeu télévisé. Environ 20 minutes.</p>' +
      '<h3 class="sub">Les règles, étape par étape</h3><ol class="rules">' +
        "<li><span>La salle se divise en <b>deux équipes</b>. Chaque équipe choisit un <b>capitaine</b> : c'est lui qui annonce la réponse.</span></li>" +
        "<li><span>Les équipes jouent <b>chacune à leur tour</b>. L'écran indique quelle équipe doit répondre.</span></li>" +
        "<li><span>L'équipe a <b>" + D.tQ + " secondes</b> pour se mettre d'accord. Le capitaine annonce la réponse et <b>le formateur clique dessus</b>.</span></li>" +
        '<li><span><span class="o">Bonne réponse :</span> ' + plural(D.pts, "point") + ".</span></li>" +
        '<li><span><span class="x">Mauvaise réponse ou temps écoulé :</span> l\'autre équipe peut <b>voler la question</b>. Si elle trouve, elle gagne ' + plural(D.ptsSteal, "point") + ". Si elle se trompe ou dépasse ses <b>" + D.tSteal + " secondes</b>, elle <b>perd " + plural(D.ptsStealFail, "point") + "</b>.</span></li>" +
        "<li><span>Chaque équipe a <b>2 jokers</b>, utilisables une seule fois : <b>50/50</b> (retire des mauvaises réponses) et <b>+20 s</b>.</span></li>" +
        "<li><span>Le duel se joue en <b>3 manches</b> : questions rapides, mises en situation à points doublés, puis une <b>finale</b> où chaque équipe mise des points.</span></li>" +
      "</ol>" +
      '<div class="teamsetup">' +
        '<label class="field">Nom de l\'équipe 1<input id="tn0" maxlength="24" value="' + esc(names[0]) + '" style="border-color:' + TEAM_COLORS[0] + '"></label>' +
        '<label class="field">Nom de l\'équipe 2<input id="tn1" maxlength="24" value="' + esc(names[1]) + '" style="border-color:' + TEAM_COLORS[1] + '"></label>' +
      "</div>" +
      '<label class="check"><input type="checkbox" id="demo" checked> Commencer par 2 questions de démonstration pour bien comprendre les règles (conseillé)</label>' +
      '<button class="btn big" style="background:' + COLOR + ';color:#fff" id="go">' + ic("play") + "Lancer le duel</button></div></main></div>";
    bindBar(app, ctx.exit);
    $("#go").onclick = () => start([$("#tn0").value.trim() || "Équipe 1", $("#tn1").value.trim() || "Équipe 2"], $("#demo").checked);
  }
  function start(names, withDemo) {
    const used = {};
    const sets = {
      m1: mixedPick(mod, D.q1, (q) => q.t !== "S", used).map(prepare),
      m2: pickQuestions(mod, activeQuestions(mod).filter((q) => q.t === "S"), D.q2, used).map(prepare),
      final: pickQuestions(mod, activeQuestions(mod).filter((q) => "QIT".indexOf(q.t) >= 0), 2, used).map(prepare)
    };
    if (sets.final.length < 2) sets.final = sets.final.concat(mixedPick(mod, 2 - sets.final.length, (q) => q.t !== "S", used).map(prepare));
    if (!sets.m1.length) { toast("Pas assez de questions dans ce module pour un duel."); return; }
    if (withDemo) sets.demo = DEMO.map(prepare);
    duel = { names, teams: names.map((n) => ({ name: n, score: 0, j50: true, jt: true })), sets, phase: null, idx: 0, turn: 0, bets: [0, 0], paused: false };
    roundIntro(withDemo ? "demo" : "m1");
  }
  const mult = () => (duel.phase === "m2" ? D.mult : 1);
  function roundInfo(phase) {
    if (phase === "demo") return { kicker: "Avant de commencer", title: "Démonstration", btn: "Lancer la démo", bullets: [
      "2 questions pour découvrir le jeu. <b>Elles ne comptent pas.</b>",
      "Question 1 : <b>" + esc(duel.teams[0].name) + "</b> répond normalement.",
      "Question 2 : <b>" + esc(duel.teams[1].name) + "</b> se trompe exprès, pour découvrir le vol."] };
    if (phase === "m1") return { kicker: "Manche 1", title: "Questions rapides", btn: "C'est parti !", bullets: [
      plural(duel.sets.m1.length, "question") + ", chaque équipe à son tour.",
      "Bonne réponse : <b>" + plural(D.pts, "point") + "</b>. Vol réussi : <b>+" + D.ptsSteal + "</b>, vol raté : <b>−" + D.ptsStealFail + "</b>.",
      D.tQ + " secondes par question. Les jokers sont disponibles."] };
    if (phase === "m2") return { kicker: "Manche 2", title: "Mises en situation", btn: "C'est parti !", bullets: [
      plural(duel.sets.m2.length, "situation") + " d'intervention, chaque équipe à son tour.",
      "<b>Points doublés</b> : " + plural(D.pts * D.mult, "point") + ", vol réussi : +" + D.ptsSteal * D.mult + ", vol raté : −" + D.ptsStealFail * D.mult + ".",
      D.tScen + " secondes pour réfléchir. Les jokers restants sont disponibles."] };
    return { kicker: "Manche 3", title: "La finale", btn: "Faire les mises", bullets: [
      "Chaque équipe <b>mise des points</b> avant de voir sa question : jusqu'à tout son score (2 points si elle n'en a pas).",
      "Une question par équipe, <b>sans vol ni joker</b>.",
      "Bonne réponse : l'équipe gagne sa mise. Mauvaise réponse : elle la perd."] };
  }
  function bar(label, withPause) {
    return gameBar({ badge: "Duel", color: COLOR, label,
      actions: '<button class="iconbtn" id="snd" title="Son">' + ic(sound.muted ? "mute" : "sound") + "</button>" +
        (withPause ? '<button class="iconbtn" id="dpause" title="Pause">' + ic("pause") + "</button>" : "") });
  }
  function bindDuelBar() {
    bindBar(app, () => { stopTimer(); ctx.exit(); }, "Quitter le duel en cours ?");
    $("#snd").onclick = function () { sound.muted = !sound.muted; this.innerHTML = ic(sound.muted ? "mute" : "sound"); };
    if ($("#dpause")) $("#dpause").onclick = pause;
  }
  function scoreboardHTML() {
    const jokersOn = duel.phase === "demo" || duel.phase === "m1" || duel.phase === "m2";
    return '<div class="score-board" id="sboard">' + [0, 1].map((i) => {
      const t = duel.teams[i];
      return '<div class="team t' + i + (duel.live && duel.answering === i ? " active" : "") + '"><div><div class="tname">' + esc(t.name) + "</div>" +
        (jokersOn ? '<div class="jokers"><button class="joker" data-j="50" data-t="' + i + '">50/50</button><button class="joker" data-j="t" data-t="' + i + '">+20 s</button></div>' : "") +
        '</div><div class="tscore">' + t.score + "</div></div>";
    }).join('<div class="vs">VS</div>') + "</div>";
  }
  function updateScoreboard() {
    const el = $("#sboard");
    if (!el) return;
    el.outerHTML = scoreboardHTML();
    app.querySelectorAll(".joker").forEach((b) => {
      const i = +b.dataset.t, t = duel.teams[i], fifty = b.dataset.j === "50";
      b.disabled = !(duel.live && duel.answering === i && (fifty ? t.j50 && qctl && qctl.canFifty() : t.jt));
      if (fifty ? !t.j50 : !t.jt) b.classList.add("used");
      b.onclick = () => {
        if (b.disabled) return;
        if (fifty) { if (qctl.fifty()) { t.j50 = false; toast("Joker 50/50 : des mauvaises réponses ont été retirées."); } }
        else { t.jt = false; duel.tLeft += 20; duel.tTotal += 20; paintTimer(); toast("Joker : +20 secondes !"); }
        updateScoreboard();
      };
    });
  }
  function roundIntro(phase) {
    stopTimer();
    Object.assign(duel, { phase, idx: 0, turn: 0, live: false });
    if (phase === "m1") duel.teams.forEach((t) => Object.assign(t, { score: 0, j50: true, jt: true }));
    const R = roundInfo(phase);
    app.innerHTML = '<div class="screen qscreen">' + bar(R.kicker) + '<main><div class="qwrap">' + scoreboardHTML() +
      '<div class="round"><div class="kicker">' + R.kicker + "</div><h1>" + R.title + "</h1><ul>" + R.bullets.map((b) => "<li>" + b + "</li>").join("") + "</ul>" +
      '<button class="btn big" style="background:' + COLOR + ';color:#fff" id="go">' + ic("play") + R.btn + "</button></div></div></main></div>";
    bindDuelBar();
    $("#go").onclick = phase === "final" ? bets : ask;
  }
  function bets() {
    duel.phase = "final";
    const maxBet = duel.teams.map((t) => Math.max(t.score, 2));
    app.innerHTML = '<div class="screen qscreen">' + bar("Finale") + '<main><div class="qwrap">' + scoreboardHTML() +
      '<div class="round"><div class="kicker">Finale</div><h1>Faites vos mises</h1>' +
      '<p class="lead">Chaque équipe choisit combien de points elle mise. Bonne réponse : elle gagne sa mise. Mauvaise réponse : elle la perd.</p>' +
      '<div class="bets">' + [0, 1].map((i) => '<div class="bet t' + i + '"><div class="tname">' + esc(duel.teams[i].name) + '</div><div class="betrow">' +
        '<button class="btn" data-m="' + i + '" data-d="-1">−</button><input type="number" id="bet' + i + '" min="0" max="' + maxBet[i] + '" value="' + Math.ceil(maxBet[i] / 2) + '">' +
        '<button class="btn" data-m="' + i + '" data-d="1">+</button></div><small>Mise maximum : ' + plural(maxBet[i], "point") + "</small>" +
        '<button class="btn ghost" data-all="' + i + '">Tout miser</button></div>').join("") + "</div>" +
      '<button class="btn big" style="background:' + COLOR + ';color:#fff" id="go">' + ic("play") + "Valider les mises</button></div></div></main></div>";
    bindDuelBar();
    const clamp = (i) => { const el = $("#bet" + i); el.value = Math.max(0, Math.min(maxBet[i], Math.floor(+el.value || 0))); };
    app.querySelectorAll("[data-m]").forEach((b) => { b.onclick = () => { const el = $("#bet" + b.dataset.m); el.value = +el.value + +b.dataset.d; clamp(+b.dataset.m); }; });
    app.querySelectorAll("[data-all]").forEach((b) => { b.onclick = () => { $("#bet" + b.dataset.all).value = maxBet[+b.dataset.all]; }; });
    [0, 1].forEach((i) => { $("#bet" + i).onchange = () => clamp(i); });
    $("#go").onclick = () => { clamp(0); clamp(1); duel.bets = [+$("#bet0").value, +$("#bet1").value]; duel.idx = 0; ask(); };
  }
  function phaseLabel() {
    const set = duel.sets[duel.phase];
    if (duel.phase === "demo") return "Démo · question " + (duel.idx + 1) + "/" + set.length;
    if (duel.phase === "m1") return "Manche 1 · question " + (duel.idx + 1) + "/" + set.length;
    if (duel.phase === "m2") return "Manche 2 · situation " + (duel.idx + 1) + "/" + set.length;
    return "Finale";
  }
  function whoHTML() {
    const i = duel.answering;
    return '<span style="background:' + TEAM_COLORS[i] + '">' + esc(duel.teams[i].name) + "</span>" + (duel.stealing ? " tente de voler la question !" : ", à vous de répondre !");
  }
  function ask() {
    const p = duel.sets[duel.phase][duel.idx];
    if (duel.phase === "final") duel.turn = duel.idx;
    Object.assign(duel, { cur: p, answering: duel.turn, stealing: false, live: false, resolved: false, paused: false });
    const demo = duel.phase === "demo";
    app.innerHTML = '<div class="screen qscreen">' + bar(phaseLabel(), true) + '<main><div class="qwrap">' + scoreboardHTML() +
      '<div id="coach"></div><div class="turn"><div class="who" id="who">' + whoHTML() + '</div><div class="timer" id="timer"><i></i></div><div class="tsec" id="tsec"></div></div>' +
      (duel.phase === "final" ? '<div class="betinfo">Mise : <b>' + plural(duel.bets[duel.turn], "point") + "</b></div>" : "") +
      '<div class="qcard" id="qcard"></div><div class="qnext" id="qnext"></div></div></main></div>';
    bindDuelBar();
    qctl = mountQuestion($("#qcard"), p, answer, demo ? null : mod);
    qctl.lock();
    duel.tLeft = duel.tTotal = p.t === "S" ? D.tScen : D.tQ;
    paintTimer();
    const begin = () => { qctl.unlock(); duel.live = true; updateScoreboard(); startTimer(); };
    if (demo) {
      coach(duel.idx === 0
        ? "<b>Démo 1/2.</b> C'est à <b>" + esc(duel.teams[0].name) + "</b> de répondre : son cadre est entouré de jaune. Lisez la question, discutez, puis le capitaine annonce la réponse et <b>le formateur clique dessus</b>. Vous pouvez essayer un joker sous le nom de l'équipe."
        : "<b>Démo 2/2.</b> Au tour de <b>" + esc(duel.teams[1].name) + "</b>. Pour découvrir le <b>vol</b>, cette équipe va <b>se tromper exprès</b> : le formateur clique sur la mauvaise réponse.",
        "Compris, on lance le chrono", begin);
    } else setTimeout(begin, 500);
  }
  function coach(html, btn, onBtn) {
    const el = $("#coach");
    if (!el) return;
    el.innerHTML = '<div class="coach"><span class="ci">?</span><div>' + html + (btn ? '<div><button class="btn dark" id="coachBtn">' + btn + "</button></div>" : "") + "</div></div>";
    if (btn) $("#coachBtn").onclick = () => { el.innerHTML = ""; onBtn(); };
  }
  function startTimer() {
    stopTimer();
    paintTimer();
    timerId = setInterval(() => {
      if (duel.paused) return;
      const before = Math.ceil(duel.tLeft);
      duel.tLeft = Math.max(0, duel.tLeft - 0.25);
      if (Math.ceil(duel.tLeft) !== before && duel.tLeft > 0 && duel.tLeft <= 5) SND.tick();
      paintTimer();
      if (duel.tLeft <= 0) { stopTimer(); answer(false, { timeout: true }); }
    }, 250);
  }
  function paintTimer() {
    const t = $("#timer"), s = $("#tsec");
    if (!t) return;
    t.firstChild.style.width = Math.max(0, duel.tLeft / duel.tTotal * 100) + "%";
    t.classList.toggle("warn", duel.tLeft <= 10 && duel.tLeft > 5);
    t.classList.toggle("crit", duel.tLeft <= 5);
    s.textContent = Math.ceil(duel.tLeft) + " s";
  }
  function pause() {
    if (!duel.live || duel.paused) return;
    duel.paused = true;
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = '<div class="modal"><h2>Pause</h2><p>Le chronomètre est arrêté.</p><div class="row"><button class="btn red big" id="resume">' + ic("play") + "Reprendre</button></div></div>";
    app.querySelector(".screen").appendChild(ov);
    ov.querySelector("#resume").onclick = () => { duel.paused = false; ov.remove(); };
  }
  function answer(ok, info) {
    if (!duel || duel.resolved || !duel.live) return;
    stopTimer();
    duel.live = false;
    qctl.lock();
    const team = duel.answering, demo = duel.phase === "demo", other = 1 - team;
    if (duel.phase === "final") {
      const bet = duel.bets[team];
      duel.teams[team].score += ok ? bet : -bet;
      duel.resolved = true;
      ok ? SND.good() : SND.bad();
      qctl.reveal(info);
      qctl.feedback(ok, ok ? "Bonne réponse ! +" + plural(bet, "point") : (info.timeout ? "Temps écoulé ! " : "Mauvaise réponse ! ") + "−" + plural(bet, "point"));
      updateScoreboard();
      nextBtn();
      return;
    }
    if (ok) {
      const gain = (duel.stealing ? D.ptsSteal : D.pts) * mult();
      if (!demo) duel.teams[team].score += gain;
      duel.resolved = true;
      SND.good();
      qctl.reveal(info);
      qctl.feedback(true, (duel.stealing ? "Vol réussi ! " : "Bonne réponse ! ") + "+" + plural(gain, "point") + " pour " + duel.teams[team].name + (demo ? " (démo : non comptés)" : ""));
      updateScoreboard();
      if (demo && duel.idx === 0) coach("Bravo ! En vraie partie, une bonne réponse rapporte <b>" + plural(D.pts, "point") + "</b>. Passons à la question 2 pour découvrir le vol.");
      if (demo && duel.idx === 1) coach("Voilà le vol : l'équipe qui vole marque <b>" + plural(D.ptsSteal, "point") + "</b> si elle trouve, mais en perd <b>" + D.ptsStealFail + "</b> si elle se trompe ou si le temps est écoulé.");
      nextBtn();
      return;
    }
    SND.bad();
    if (info.pick != null) qctl.markWrong(info.pick);
    if (!duel.stealing) {
      const stealGain = D.ptsSteal * mult();
      $("#qnext").innerHTML = '<div class="stealbox"><b>' + (info.timeout ? "Temps écoulé !" : "Mauvaise réponse !") + "</b> " +
        '<span style="color:' + TEAM_COLORS[other] + '">' + esc(duel.teams[other].name) + "</span>, voulez-vous <b>voler la question</b> ? " +
        "<b>+" + stealGain + "</b> si vous trouvez, <b>−" + D.ptsStealFail * mult() + "</b> si vous vous trompez ou si les " + D.tSteal + " secondes sont écoulées." +
        '<div class="row"><button class="btn big" style="background:' + TEAM_COLORS[other] + ';color:#fff" id="stealYes">Oui, on vole !</button><button class="btn big" id="stealNo">Non, on passe</button></div></div>';
      if (demo) coach("C'est le <b>vol</b> : quand une équipe se trompe, l'autre peut tenter sa chance. Si elle trouve, elle marque " + plural(D.ptsSteal, "point") + " ; si elle se trompe ou n'a pas répondu en " + D.tSteal + " secondes, elle en perd " + D.ptsStealFail + ". Cliquez sur « Oui, on vole ! ».");
      $("#stealYes").onclick = () => {
        SND.steal();
        Object.assign(duel, { stealing: true, answering: other });
        $("#qnext").innerHTML = "";
        if (demo) $("#coach").innerHTML = "";
        $("#who").innerHTML = whoHTML();
        qctl.reset();
        qctl.unlock();
        duel.tLeft = duel.tTotal = D.tSteal;
        duel.live = true;
        updateScoreboard();
        startTimer();
      };
      $("#stealNo").onclick = () => {
        duel.resolved = true;
        $("#qnext").innerHTML = "";
        qctl.reveal(info);
        qctl.feedback(false, "Personne ne marque de point.");
        nextBtn();
      };
      updateScoreboard();
      return;
    }
    // Vol raté (mauvaise réponse ou temps écoulé) : pénalité
    const loss = D.ptsStealFail * mult();
    if (!demo) duel.teams[team].score -= loss;
    duel.resolved = true;
    qctl.reveal(info);
    qctl.feedback(false, (info.timeout ? "Temps écoulé ! " : "Vol raté ! ") + "−" + plural(loss, "point") + " pour " + duel.teams[team].name + (demo ? " (démo : non comptés)" : ""));
    if (demo) coach("Vol raté : en vraie partie, l'équipe aurait perdu <b>" + plural(loss, "point") + "</b>. Voler, c'est un pari !");
    updateScoreboard();
    nextBtn();
  }
  function nextBtn() {
    const last = duel.idx >= duel.sets[duel.phase].length - 1;
    const label = !last ? "Question suivante" : duel.phase === "demo" ? "Terminer la démo" : duel.phase === "final" ? "Voir le résultat" : "Manche suivante";
    $("#qnext").innerHTML = '<button class="btn big" style="background:' + COLOR + ';color:#fff" id="dnext">' + label + " →</button>";
    $("#dnext").onclick = next;
    $("#dnext").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function next() {
    if (duel.phase !== "demo") progress.markSeen(mod.id, duel.cur.id);
    duel.idx++;
    duel.turn = 1 - duel.turn;
    if (duel.idx < duel.sets[duel.phase].length) { ask(); return; }
    if (duel.phase === "demo") { demoDone(); return; }
    if (duel.phase === "m1") { roundIntro(duel.sets.m2.length ? "m2" : "final"); return; }
    if (duel.phase === "m2") { roundIntro("final"); return; }
    end();
  }
  function demoDone() {
    stopTimer();
    app.innerHTML = '<div class="screen qscreen">' + bar("Démo terminée") + '<main><div class="qwrap"><div class="round"><div class="kicker">Démo terminée</div><h1>Vous connaissez les règles !</h1><ul>' +
      "<li>Chaque équipe répond <b>à son tour</b>, le capitaine annonce la réponse.</li>" +
      "<li>En cas d'erreur, l'autre équipe peut <b>voler</b> la question.</li>" +
      "<li>Les jokers utilisés pendant la démo sont rendus et <b>les scores partent de zéro</b>.</li>" +
      '</ul><button class="btn big" style="background:' + COLOR + ';color:#fff" id="go">' + ic("play") + "Commencer la manche 1</button></div></div></main></div>";
    bindDuelBar();
    $("#go").onclick = () => roundIntro("m1");
  }
  function end() {
    stopTimer();
    duel.live = false;
    const [a, b] = duel.teams, tie = a.score === b.score, win = a.score > b.score ? 0 : 1;
    progress.saveGame(mod.id, "duel", Math.max(a.score, b.score));
    app.innerHTML = '<div class="screen qscreen">' + bar("Résultat") + '<main><div class="qwrap"><div class="round">' +
      '<div class="kicker">Fin du duel</div>' +
      (tie ? "<h1>Égalité parfaite !</h1>" : '<div class="trophy" style="color:' + TEAM_COLORS[win] + '">' + ic("trophy") + '</div><h1><span style="color:' + TEAM_COLORS[win] + '">' + esc(duel.teams[win].name) + "</span> remporte le duel !</h1>") +
      '<div class="finals">' + [0, 1].map((i) => '<div class="bet t' + i + '"><div class="tname">' + esc(duel.teams[i].name) + '</div><div class="fscore">' + duel.teams[i].score + "</div><small>points</small></div>").join("") + "</div>" +
      '<div class="row center"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="again">' + ic("reset") + 'Revanche</button><button class="btn big dark" id="home">' + ic("back") + "Retour au module</button></div>" +
      "</div></div></main></div>";
    bindDuelBar();
    SND.win();
    $("#again").onclick = () => start(duel.names, false);
    $("#home").onclick = ctx.exit;
  }
  setup();
  return stopTimer;
}
