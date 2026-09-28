/* Fiches de révision : affichage des blocs et test de fin de fiche */
import { ic, esc, fmt, paras, youtubeId, shuffle } from "../ui.js";
import { progress } from "../progress.js";
import { activeQuestions, pickQuestions, prepare, mountQuestion, SND } from "../games/engine.js";

export const BLOCK_TYPES = {
  intro: "Introduction", text: "Texte", key: "Points clés", warn: "Attention / sécurité", steps: "Étapes (pas à pas)",
  schema: "Schéma", image: "Image", video: "Vidéo", table: "Tableau"
};

function blockHTML(b, i) {
  switch (b.type) {
    case "intro": return '<div class="blk blk-intro">' + fmt(b.text || "") + "</div>";
    case "text": return '<div class="blk blk-text">' + (b.title ? "<h2>" + esc(b.title) + "</h2>" : "") + paras(b.text) + "</div>";
    case "key": return '<div class="blk blk-key"><h3>' + ic("target") + esc(b.title || "À retenir") + "</h3><ul>" +
      (b.items || []).filter(Boolean).map((x) => "<li><span>" + fmt(x) + "</span></li>").join("") + "</ul></div>";
    case "warn": return '<div class="blk blk-warn"><h3>' + ic("warn") + esc(b.title || "Attention") + "</h3>" + paras(b.text) + "</div>";
    case "steps": return '<div class="blk blk-steps" data-steps="' + i + '"><h3>' + ic("list") + esc(b.title || "Étape par étape") + '</h3><div class="stepper"></div></div>';
    case "schema": return '<div class="blk blk-schema"><button class="btn zoom" data-zoom="' + i + '">' + ic("zoom") + "Agrandir</button>" +
      (b.title ? '<h3 style="margin:0 0 10px">' + esc(b.title) + "</h3>" : "") + '<div class="schema">' + (b.svg || "") + "</div>" +
      (b.caption ? '<div class="caption">' + fmt(b.caption) + "</div>" : "") + "</div>";
    case "image": return '<div class="blk blk-media">' + (b.title ? "<h3>" + esc(b.title) + "</h3>" : "") +
      '<div class="imgwrap"><img src="' + esc(b.src) + '" alt="' + esc(b.caption || b.title || "") + '" loading="lazy"></div>' +
      (b.caption || b.credit ? '<div class="caption">' + fmt(b.caption || "") + (b.credit ? " <i>(" + esc(b.credit) + ")</i>" : "") + "</div>" : "") + "</div>";
    case "video": {
      if (/\.(mp4|webm)(\?|$)/i.test(b.url || "")) {
        return '<div class="blk blk-media">' + (b.title ? "<h3>" + ic("video") + esc(b.title) + "</h3>" : "") +
          '<video controls preload="metadata" playsinline src="' + esc(b.url) + '"' + (b.poster ? ' poster="' + esc(b.poster) + '"' : "") + "></video>" +
          (b.caption || b.credit ? '<div class="caption">' + fmt(b.caption || "") + (b.credit ? " <i>(" + esc(b.credit) + ")</i>" : "") + "</div>" : "") + "</div>";
      }
      // YouTube / Dailymotion : les lecteurs intégrés ne fonctionnent pas sur le site en ligne,
      // on affiche la miniature et un bouton qui ouvre la vidéo sur la plateforme (ou son application)
      const dm = String(b.url || "").match(/(?:dailymotion\.com\/(?:embed\/)?video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
      const id = dm ? null : youtubeId(b.url);
      if (!dm && !id) return '<div class="blk empty">' + ic("video") + " Vidéo à ajouter" + (b.title ? " : " + esc(b.title) : "") + "</div>";
      const site = dm ? "Dailymotion" : "YouTube";
      const href = dm ? "https://www.dailymotion.com/video/" + dm[1] : "https://www.youtube.com/watch?v=" + id;
      const thumb = dm ? "https://www.dailymotion.com/thumbnail/video/" + dm[1] : "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
      return '<div class="blk blk-media">' + (b.title ? "<h3>" + ic("video") + esc(b.title) + "</h3>" : "") +
        '<a class="vlink" href="' + href + '" target="_blank" rel="noopener"><img src="' + thumb + '" alt="" loading="lazy">' +
        '<span class="vplay">' + ic("play") + "</span><span class=\"vbtn\">Voir la vidéo sur " + site + "</span></a>" +
        (b.caption || b.credit ? '<div class="caption">' + fmt(b.caption || "") + (b.credit ? " <i>(" + esc(b.credit) + ")</i>" : "") + "</div>" : "") + "</div>";
    }
    case "table": return '<div class="blk blk-table">' + (b.title ? "<h3>" + esc(b.title) + "</h3>" : "") + '<div class="tablewrap"><table>' +
      (b.head && b.head.length ? "<tr>" + b.head.map((h) => "<th>" + fmt(h) + "</th>").join("") + "</tr>" : "") +
      (b.rows || []).map((r) => "<tr>" + r.map((c) => "<td>" + fmt(c) + "</td>").join("") + "</tr>").join("") + "</table></div></div>";
    default: return "";
  }
}

function mountStepper(host, b) {
  const items = b.items || [];
  let i = 0;
  const paint = () => {
    const s = items[i] || {};
    host.innerHTML = '<div class="stepdots">' + items.map((x, k) => '<button data-k="' + k + '" class="' + (k <= i ? "on" : "") + '" aria-label="Étape ' + (k + 1) + '"></button>').join("") + "</div>" +
      '<div class="stepbody"><div class="stepnum">Étape ' + (i + 1) + " / " + items.length + '</div><div class="steptitle">' + fmt(s.title || "") + "</div>" +
      (s.text ? '<p class="steptext">' + fmt(s.text).replace(/\n/g, "<br>") + "</p>" : "") +
      (s.svg ? '<div class="media schema">' + s.svg + "</div>" : "") +
      (s.image ? '<div class="media imgwrap"><img src="' + esc(s.image) + '" alt="" loading="lazy"></div>' : "") + "</div>" +
      '<div class="stepnav"><button class="btn" data-nav="-1"' + (i === 0 ? " disabled" : "") + ">" + ic("back") + "Précédente</button>" +
      (i < items.length - 1 ? '<button class="btn red" data-nav="1">Suivante' + ic("next") + "</button>" : '<button class="btn dark" data-nav="0">' + ic("reset") + "Revoir depuis le début</button>") + "</div>";
    host.querySelectorAll("[data-k]").forEach((d) => { d.onclick = () => { i = +d.dataset.k; paint(); }; });
    host.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.onclick = () => { const d = +btn.dataset.nav; i = d === 0 ? 0 : Math.max(0, Math.min(items.length - 1, i + d)); paint(); };
    });
  };
  paint();
}

function lightbox(svg) {
  const ov = document.createElement("div");
  ov.className = "lightbox";
  ov.innerHTML = '<button class="close" aria-label="Fermer">' + ic("x") + '</button><div class="inner">' + svg + "</div>";
  ov.onclick = (e) => { if (e.target === ov || e.target.closest(".close")) ov.remove(); };
  document.body.appendChild(ov);
}

/* Questions du test d'une fiche : par thèmes, ou liste explicite */
export function testPool(mod, fiche) {
  const t = fiche.test || {};
  const all = activeQuestions(mod);
  if (t.ids && t.ids.length) return all.filter((q) => t.ids.indexOf(q.id) >= 0);
  if (t.themes && t.themes.length) return all.filter((q) => t.themes.indexOf(q.f) >= 0);
  return [];
}

export function renderFiche(app, mod, fiche, nav) {
  const blocks = fiche.blocks || [];
  const comp = (mod.competences || []).find((c) => c.id === fiche.competence);
  const rec = progress.fiche(mod.id, fiche.id);
  const pool = testPool(mod, fiche);
  const nTest = Math.min((fiche.test && fiche.test.n) || 5, pool.length);
  app.innerHTML =
    '<div class="fiche-head"><div class="kick">' + esc(comp ? comp.title : mod.title) + "</div>" +
      "<h1>" + esc(fiche.title) + "</h1>" +
      '<div class="meta">' + (fiche.minutes ? '<span class="badge">' + fiche.minutes + " min</span>" : "") +
        (rec.read ? '<span class="badge" style="background:var(--ok-bg);color:var(--ok)">Lue</span>' : "") +
        (rec.best != null ? '<span class="badge">Meilleur test : ' + rec.best + " %</span>" : "") + "</div></div>" +
    blocks.map(blockHTML).join("") +
    '<div class="fiche-foot"><div class="txt"><b>' + (nTest ? "Vérifiez que c'est acquis" : "Fiche terminée ?") + "</b>" +
      (nTest ? nTest + " questions sur cette fiche. Visez 80 % ou plus." : "Marquez-la comme lue pour suivre votre progression.") + "</div>" +
      (nTest ? '<a class="btn red big" href="' + nav.testHref + '">' + ic("target") + "Faire le test</a>" : "") +
      '<button class="btn big" id="markRead">' + ic("check") + (rec.read ? "Déjà lue" : "J'ai lu cette fiche") + "</button></div>" +
    '<div class="fiche-nav">' + (nav.prev ? '<a class="btn" href="' + nav.prev.href + '">' + ic("back") + esc(nav.prev.title) + "</a>" : "<span></span>") +
      (nav.next ? '<a class="btn" href="' + nav.next.href + '">' + esc(nav.next.title) + ic("next") + "</a>" : "") + "</div>";
  app.querySelectorAll("[data-steps]").forEach((el) => mountStepper(el.querySelector(".stepper"), blocks[+el.dataset.steps]));
  app.querySelectorAll("[data-zoom]").forEach((b) => { b.onclick = () => lightbox(blocks[+b.dataset.zoom].svg || ""); });
  const mr = app.querySelector("#markRead");
  mr.onclick = () => { progress.markRead(mod.id, fiche.id); mr.innerHTML = ic("check") + "Déjà lue"; };
}

export function renderTest(app, mod, fiche, nav) {
  const pool = testPool(mod, fiche);
  const n = Math.min((fiche.test && fiche.test.n) || 5, pool.length);
  const list = shuffle(pickQuestions(mod, pool, n)).map(prepare);
  let i = 0, good = 0;
  const ask = () => {
    const p = list[i];
    app.innerHTML = '<div class="fiche-head"><div class="kick">Test · ' + esc(fiche.title) + "</div><h1>Question " + (i + 1) + " / " + list.length + "</h1></div>" +
      '<div class="progress"><i style="width:' + (i / list.length * 100) + '%"></i></div><div class="qcard" id="qcard"></div><div class="qnext" id="qnext"></div>';
    const ctl = mountQuestion(app.querySelector("#qcard"), p, (ok, info) => {
      ctl.lock();
      progress.markSeen(mod.id, p.id);
      if (ok) { good++; SND.good(); } else SND.bad();
      ctl.reveal(info);
      ctl.feedback(ok, ok ? "Bonne réponse !" : "Mauvaise réponse");
      const last = i === list.length - 1;
      app.querySelector("#qnext").innerHTML = '<button class="btn red big" id="next">' + (last ? "Voir mon résultat" : "Question suivante") + " →</button>";
      const nx = app.querySelector("#next");
      nx.onclick = () => { if (last) end(); else { i++; ask(); } };
      nx.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, mod);
  };
  const end = () => {
    const pct = Math.round(good / list.length * 100);
    progress.saveTest(mod.id, fiche.id, pct);
    const ok = pct >= 80;
    app.innerHTML = '<div class="panel result" style="border-top-color:' + (ok ? "var(--ok)" : "var(--fire)") + '"><h1>' + (ok ? "Fiche acquise !" : "Encore un effort") + "</h1>" +
      '<div class="score" style="color:' + (ok ? "var(--ok)" : "var(--fire)") + '">' + pct + "<span> %</span></div>" +
      '<div class="verdict">' + good + " bonne" + (good > 1 ? "s" : "") + " réponse" + (good > 1 ? "s" : "") + " sur " + list.length + "</div>" +
      '<p class="lead">' + (ok ? "Vous maîtrisez cette fiche. Passez à la suivante ou entraînez-vous avec les jeux du module." : "Relisez la fiche, puis retentez le test : les questions changent à chaque fois.") + "</p>" +
      '<div class="row"><a class="btn big" href="' + nav.ficheHref + '">' + ic("book") + "Relire la fiche</a>" +
      '<button class="btn big dark" id="retry">' + ic("reset") + "Refaire le test</button>" +
      (nav.next ? '<a class="btn big red" href="' + nav.next.href + '">Fiche suivante' + ic("next") + "</a>" : "") + "</div></div>";
    SND.win();
    app.querySelector("#retry").onclick = () => renderTest(app, mod, fiche, nav);
  };
  if (!list.length) { app.innerHTML = '<div class="empty">Pas encore de questions pour cette fiche.</div>'; return; }
  ask();
}
