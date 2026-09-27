/* Jeu : Quiz (individuel ou en groupe) */
import { ic, fmt, num, verdict, toast } from "../ui.js";
import { progress } from "../progress.js";
import { mixedPick, prepare, mountQuestion, answerText, poolSize, SND } from "./engine.js";
import { gameBar, bindBar } from "./common.js";

const COLOR = "#E07800";

export function startQuizGame(ctx) {
  const { app, mod, platform } = ctx;
  const n = (platform.quiz && platform.quiz.n) || 20;
  let quiz = null;

  function intro() {
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Quiz", color: COLOR, label: mod.title }) +
      '<main><div class="panel" style="border-top-color:' + COLOR + '"><h1>Quiz</h1>' +
      '<p class="lead">' + Math.min(n, poolSize(mod)) + " questions tirées au hasard parmi " + poolSize(mod) + ". Les questions jamais posées sur cet appareil passent en priorité.</p>" +
      '<div class="facts">' + ["QCM", "Vrai ou faux", "Relier", "Remettre dans l'ordre", "L'intrus", "Texte à trous", "Mises en situation"].map((t) => "<span>" + t + "</span>").join("") + "</div>" +
      '<ol class="rules">' +
        "<li><span>Lisez la question (en groupe : mettez-vous d'accord).</span></li>" +
        "<li><span>Touchez la réponse. Pour « relier » ou « remettre dans l'ordre », faites vos choix puis touchez « Valider ».</span></li>" +
        "<li><span>La correction s'affiche aussitôt, avec une explication.</span></li>" +
        "<li><span>À la fin : une note sur 20 et la liste des questions à revoir.</span></li>" +
      "</ol>" +
      '<button class="btn big" style="background:' + COLOR + ';color:#fff" id="go">' + ic("play") + "Commencer le quiz</button></div></main></div>";
    bindBar(app, ctx.exit);
    app.querySelector("#go").onclick = start;
  }
  function start() {
    const list = mixedPick(mod, n);
    if (!list.length) { toast("Aucune question disponible pour ce module."); return; }
    quiz = { list: list.map(prepare), i: 0, good: 0, missed: [] };
    ask();
  }
  function ask() {
    const p = quiz.list[quiz.i], N = quiz.list.length;
    app.innerHTML = '<div class="screen qscreen">' +
      gameBar({ badge: "Quiz", color: COLOR, label: mod.title,
        stats: '<span class="stat">Question <b>' + (quiz.i + 1) + "</b>/" + N + '</span><span class="stat">Bonnes <b id="qgood">' + quiz.good + "</b></span>" }) +
      '<main><div class="qwrap"><div class="progress"><i style="width:' + (quiz.i / N * 100) + '%"></i></div><div class="qcard" id="qcard"></div><div class="qnext" id="qnext"></div></div></main></div>';
    bindBar(app, ctx.exit, "Quitter le quiz en cours ?");
    const ctl = mountQuestion(app.querySelector("#qcard"), p, (ok, info) => {
      ctl.lock();
      progress.markSeen(mod.id, p.id);
      if (ok) { quiz.good++; SND.good(); } else { quiz.missed.push(p); SND.bad(); }
      ctl.reveal(info);
      ctl.feedback(ok, ok ? "Bonne réponse !" : "Mauvaise réponse");
      app.querySelector("#qgood").textContent = quiz.good;
      const last = quiz.i === N - 1;
      app.querySelector("#qnext").innerHTML = '<button class="btn red big" id="next">' + (last ? "Voir le résultat" : "Question suivante") + " →</button>";
      const nx = app.querySelector("#next");
      nx.onclick = () => { if (last) finish(); else { quiz.i++; ask(); } };
      nx.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, mod);
  }
  function finish() {
    const N = quiz.list.length, note = Math.round(quiz.good / N * 20 * 4) / 4;
    progress.saveGame(mod.id, "quiz", note);
    const missed = quiz.missed.length ? '<div class="hard"><h3>À revoir</h3><ol>' + quiz.missed.map((p) =>
      "<li>" + fmt(p.q.replace(/_{3,}/g, "…")) + "<br><em>→ " + fmt(answerText(p)) + "</em></li>").join("") + "</ol></div>" : "";
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Quiz", color: COLOR, label: mod.title }) +
      '<main><div class="panel result" style="border-top-color:' + COLOR + '"><h1>Quiz terminé !</h1>' +
      '<div class="score">' + num(note) + "<span>/20</span></div>" +
      '<div class="verdict">' + verdict(note) + "</div>" +
      '<div class="kpis"><div class="kpi"><b>' + quiz.good + "/" + N + '</b><span>Bonnes réponses</span></div><div class="kpi"><b>' + quiz.missed.length + "</b><span>À revoir</span></div></div>" +
      missed +
      '<div class="row"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="again">' + ic("reset") + 'Nouveau quiz</button><button class="btn big dark" id="home">' + ic("back") + "Retour au module</button></div></div></main></div>";
    SND.win();
    bindBar(app, ctx.exit);
    app.querySelector("#home").onclick = ctx.exit;
    app.querySelector("#again").onclick = start;
  }
  intro();
  return () => {};
}
