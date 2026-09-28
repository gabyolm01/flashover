/* Jeu : « Qu'est-ce qui cloche ? » — repérer les erreurs de port de la tenue de feu */
import { ic, esc, fmt, num, shuffle, verdict } from "../ui.js";
import { progress } from "../progress.js";
import { SND } from "./engine.js";
import { gameBar, bindBar } from "./common.js";

const COLOR = "#7A3FB8";
export const CLOCHE_ZONES = ["jugulaire", "bavolet", "col", "veste", "gants", "bas"];

/* Zones cliquables (x, y, largeur, hauteur) dans le repère 0 0 360 660 */
const HIT = {
  jugulaire: [[122, 88, 116, 72]],
  col: [[128, 160, 104, 52]],
  bavolet: [[86, 150, 42, 62], [232, 150, 42, 62]],
  veste: [[146, 214, 68, 190]],
  gants: [[62, 352, 60, 104], [238, 352, 60, 104]],
  bas: [[118, 506, 124, 146]]
};

/* Personnage en tenue de feu. err = ensemble des zones en erreur. */
export function figureSVG(err, opts) {
  err = err || new Set();
  opts = opts || {};
  const E = (z) => err.has(z);
  const navy = "#1E2A3A", navy2 = "#2A3A50", red = "#C1121F", skin = "#E9B996", glove = "#3A3F46", boot = "#111418";
  const band = (x, y, w) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="5" fill="#D9E021"/><rect x="' + x + '" y="' + (y + 5) + '" width="' + w + '" height="5" fill="#C9CED6"/><rect x="' + x + '" y="' + (y + 10) + '" width="' + w + '" height="5" fill="#D9E021"/>';
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 660" class="figure" role="img" aria-label="Sapeur-pompier en tenue de feu">';
  // Bottes (dessinées avant le pantalon quand il est bien porté par-dessus)
  const boots = '<path d="M128 588h48v42h8v18h-62v-18h6z" fill="' + boot + '"/><path d="M184 588h48v42h6v18h-62v-18h8z" fill="' + boot + '"/>';
  const bootsHigh = '<path d="M126 520h52v110h8v18h-66v-18h6z" fill="' + boot + '"/><path d="M182 520h52v110h6v18h-66v-18h8z" fill="' + boot + '"/>' +
    '<path d="M126 520h52v10h-52zM182 520h52v10h-52z" fill="#2b2f36"/>';
  if (!E("bas")) s += boots;
  // Jambes du pantalon
  const legBottom = E("bas") ? 530 : 606;
  s += '<path d="M132 396h46l2 ' + (legBottom - 396) + 'h-50z" fill="' + navy + '"/><path d="M182 396h46l2 ' + (legBottom - 396) + 'h-50z" fill="' + navy + '"/>';
  s += band(131, 462, 48) + band(181, 462, 48);
  if (!E("bas")) s += band(130, 566, 50) + band(180, 566, 50);
  if (E("bas")) {
    s += '<path d="M130 508q25 14 50 0l-2 22h-46zM180 508q25 14 50 0l-2 22h-46z" fill="' + navy2 + '"/>';
    s += bootsHigh;
  }
  // Bras / manches et gants
  const sleeve = (x, flip) => {
    const pts = flip ? "M" + x + " 176l34 -6 10 206h-34z" : "M" + x + " 170l34 6 -10 206h-34z";
    return '<path d="' + pts + '" fill="' + navy + '"/>';
  };
  const gloveShape = (cx, top) => '<path d="M' + (cx - 24) + " " + top + "h48l4 " + (top < 380 ? 40 : 28) + "q0 38 -28 38q-28 0 -28 -38z" + '" fill="' + glove + '"/><path d="M' + (cx - 24) + " " + (top + 6) + "h48" + '" stroke="#5a6068" stroke-width="3"/>';
  s += sleeve(92, false) + sleeve(234, true);
  if (E("gants")) {
    s += gloveShape(97, 384) + gloveShape(263, 384);
    s += '<path d="M78 350h40l0 46h-40z" fill="' + navy + '"/><path d="M242 350h40l0 46h-40z" fill="' + navy + '"/>';
    s += band(78, 378, 40) + band(242, 378, 40);
  } else {
    // Gant bien porté : la manchette longue recouvre le bas de la manche
    s += band(84, 296, 36) + band(240, 296, 36);
    s += '<path d="M72 330h50l-2 30h-46z" fill="' + glove + '"/><path d="M238 330h50l-2 30h-46z" fill="' + glove + '"/>';
    s += gloveShape(97, 356) + gloveShape(263, 356);
  }
  // Veste
  s += '<path d="M126 176q54 -14 108 0l8 226h-124z" fill="' + navy + '"/>';
  s += band(119, 250, 122) + band(118, 360, 124);
  if (E("veste")) {
    s += '<path d="M180 188l-16 214h32z" fill="#9AA0A6"/><path d="M180 188l-16 214" stroke="#0f1620" stroke-width="3"/><path d="M180 188l16 214" stroke="#0f1620" stroke-width="3"/>';
  } else {
    s += '<rect x="175" y="188" width="10" height="214" fill="' + navy2 + '"/><line x1="180" y1="188" x2="180" y2="402" stroke="#0f1620" stroke-width="2"/>';
  }
  // Bavolet sous le col (erreur) : dessiné avant le col, presque caché
  const bavolet = '<path d="M136 118l-38 70 34 8 14 -46z" fill="#C9CED6" stroke="#8f959d" stroke-width="2"/><path d="M224 118l38 70 -34 8 -14 -46z" fill="#C9CED6" stroke="#8f959d" stroke-width="2"/>';
  if (E("bavolet")) s += '<path d="M138 120l-12 50 18 0 8 -40z" fill="#C9CED6"/><path d="M222 120l12 50 -18 0 -8 -40z" fill="#C9CED6"/>';
  // Cagoule autour du visage
  s += '<ellipse cx="180" cy="126" rx="42" ry="50" fill="' + red + '"/>';
  if (E("col")) s += '<path d="M132 150q48 30 96 0l14 42q-62 24 -124 0z" fill="' + red + '"/>';
  // Col de la veste
  if (E("col")) {
    s += '<path d="M146 168l-24 28 30 4 18 -24z" fill="' + navy2 + '"/><path d="M214 168l24 28 -30 4 -18 -24z" fill="' + navy2 + '"/>';
  } else {
    s += '<path d="M140 156q40 14 80 0l6 38q-46 12 -92 0z" fill="' + navy2 + '"/><rect x="175" y="160" width="10" height="34" fill="#0f1620"/>';
  }
  if (!E("bavolet")) s += bavolet;
  // Visage
  s += '<ellipse cx="180" cy="126" rx="25" ry="31" fill="' + skin + '"/>';
  s += '<circle cx="171" cy="120" r="2.6" fill="#2b2f36"/><circle cx="189" cy="120" r="2.6" fill="#2b2f36"/><path d="M172 142q8 5 16 0" stroke="#8a5a44" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
  // Casque F1
  s += '<path d="M126 104q2 -64 54 -66q52 2 54 66q-54 -12 -108 0z" fill="#C8CDD3" stroke="#8f959d" stroke-width="3"/>';
  s += '<path d="M180 40v58" stroke="#9aa1a9" stroke-width="7" stroke-linecap="round"/>';
  s += '<path d="M134 100q46 -10 92 0l-4 12q-42 -8 -84 0z" fill="#D9A441" opacity=".9"/>';
  // Jugulaire
  if (E("jugulaire")) s += '<path d="M138 108l-6 44M222 108l8 44" stroke="#16181D" stroke-width="4" stroke-linecap="round" fill="none"/>';
  else s += '<path d="M138 108q4 56 42 56q38 0 42 -56" stroke="#16181D" stroke-width="4" fill="none" stroke-linecap="round"/>';
  // Zones cliquables
  if (opts.zones) {
    Object.keys(HIT).forEach((z) => {
      HIT[z].forEach((r) => {
        s += '<rect class="hit" data-zone="' + z + '" x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" rx="10"/>';
      });
    });
  }
  return s + "</svg>";
}

export function startClocheGame(ctx) {
  const { app, mod } = ctx;
  const Z = mod.cloche || {};
  const ids = CLOCHE_ZONES.filter((z) => Z[z]);
  const N = 6;
  let round = 0, score = 0, max = 0, found = [], rounds = [];
  const $ = (s) => app.querySelector(s);

  function intro() {
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Qu'est-ce qui cloche ?", color: COLOR, label: mod.title }) +
      '<main><div class="panel" style="border-top-color:' + COLOR + '"><h1>Qu\'est-ce qui cloche ?</h1>' +
      '<p class="lead">Ce sapeur-pompier s\'est équipé un peu vite… Repérez les erreurs de port de sa tenue de feu.</p>' +
      '<ol class="rules">' +
        "<li><span>À chaque manche, le personnage a <b>1 à 3 erreurs</b>.</span></li>" +
        "<li><span>Touchez les zones qui vous semblent mal portées (touchez à nouveau pour annuler), puis <b>Valider</b>.</span></li>" +
        '<li><span><span class="o">Erreur trouvée :</span> +1 point. <span class="x">Fausse alerte</span> (zone correcte signalée) : −1 point.</span></li>' +
        "<li><span>" + N + " manches. La correction explique chaque règle de port.</span></li>" +
      "</ol>" +
      '<button class="btn big" style="background:' + COLOR + ';color:#fff" id="go">' + ic("play") + "Commencer</button></div></main></div>";
    bindBar(app, ctx.exit);
    $("#go").onclick = () => { round = 0; score = 0; max = 0; rounds = []; next(); };
  }
  function next() {
    const k = 1 + Math.floor(Math.random() * Math.min(3, ids.length));
    const err = new Set(shuffle(ids.slice()).slice(0, k));
    const sel = new Set();
    rounds.push(err);
    max += err.size;
    app.innerHTML = '<div class="screen qscreen">' +
      gameBar({ badge: "Qu'est-ce qui cloche ?", color: COLOR, label: mod.title,
        stats: '<span class="stat">Manche <b>' + (round + 1) + "</b>/" + N + '</span><span class="stat">Points <b>' + score + "</b></span>" }) +
      '<main><div class="qwrap cloche"><div class="figwrap" id="fig">' + figureSVG(err, { zones: true }) + "</div>" +
      '<div class="clochepanel"><h2>Manche ' + (round + 1) + "</h2><p>Touchez les zones mal portées. <b>Il y a entre 1 et 3 erreurs.</b></p>" +
      '<div id="sel" class="sellist"></div><div class="row"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="ok">' + ic("check") + "Valider</button></div>" +
      '<div id="res"></div></div></div></main></div>';
    bindBar(app, ctx.exit, "Quitter la partie ?");
    const paintSel = () => {
      app.querySelectorAll(".hit").forEach((h) => h.classList.toggle("on", sel.has(h.dataset.zone)));
      $("#sel").innerHTML = sel.size ? Array.from(sel).map((z) => '<span class="badge">' + esc(Z[z].label) + "</span>").join(" ") : '<span class="muted small">Aucune zone signalée pour l\'instant.</span>';
    };
    app.querySelectorAll(".hit").forEach((h) => {
      h.addEventListener("click", () => {
        if ($("#ok").disabled) return;
        const z = h.dataset.zone;
        if (sel.has(z)) sel.delete(z); else sel.add(z);
        paintSel();
      });
    });
    paintSel();
    $("#ok").onclick = () => {
      $("#ok").disabled = true;
      let pts = 0;
      const lines = [];
      err.forEach((z) => {
        const ok = sel.has(z);
        if (ok) pts++;
        lines.push('<div class="feed ' + (ok ? "ok" : "ko") + '"><b class="big">' + (ok ? "Trouvé : " : "Manqué : ") + esc(Z[z].ko) + "</b><span>" + fmt(Z[z].e) + "</span></div>");
      });
      sel.forEach((z) => {
        if (err.has(z)) return;
        pts--;
        lines.push('<div class="feed ko"><b class="big">Fausse alerte : ' + esc(Z[z].label) + "</b><span>Cette zone était correcte : " + fmt(Z[z].ok) + ".</span></div>");
      });
      pts = Math.max(0, pts);
      score += pts;
      pts === err.size && sel.size === err.size ? SND.good() : SND.bad();
      app.querySelectorAll(".hit").forEach((h) => {
        const z = h.dataset.zone;
        h.classList.toggle("bad", err.has(z));
        h.classList.toggle("fp", sel.has(z) && !err.has(z));
      });
      const last = round === N - 1;
      $("#res").innerHTML = '<div class="clocheres">' + lines.join("") + '</div><div class="row end"><button class="btn red big" id="nx">' + (last ? "Voir le résultat" : "Manche suivante") + " →</button></div>";
      $("#nx").onclick = () => { round++; if (last) finish(); else next(); };
      $("#nx").scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
  }
  function finish() {
    const note = max ? Math.round(score / max * 20 * 4) / 4 : 0;
    progress.saveGame(mod.id, "cloche", note);
    SND.win();
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Qu'est-ce qui cloche ?", color: COLOR, label: mod.title }) +
      '<main><div class="panel result" style="border-top-color:' + COLOR + '"><h1>Partie terminée</h1>' +
      '<div class="score" style="color:' + COLOR + '">' + num(note) + "<span>/20</span></div>" +
      '<div class="verdict">' + verdict(note) + "</div><p class=\"lead\">" + score + " erreur" + (score > 1 ? "s" : "") + " repérée" + (score > 1 ? "s" : "") + " sur " + max + ".</p>" +
      '<div class="hard" style="text-align:left"><h3>Les règles à retenir</h3><ol>' + ids.map((z) => "<li><b>" + esc(Z[z].label) + "</b> : " + fmt(Z[z].e) + "</li>").join("") + "</ol></div>" +
      '<div class="row"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="again">' + ic("reset") + 'Rejouer</button><button class="btn big dark" id="home">' + ic("back") + "Retour au module</button></div></div></main></div>";
    bindBar(app, ctx.exit);
    $("#again").onclick = () => { round = 0; score = 0; max = 0; rounds = []; next(); };
    $("#home").onclick = ctx.exit;
  }
  intro();
  return () => {};
}
