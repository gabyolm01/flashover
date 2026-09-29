/* Jeu exclusif Établissements : « Établissez ! ». Chef d'agrès du FPT (INC 6) : lire la situation, choisir le dispositif,
   commander les binômes (ordres préparatoire et d'exécution), puis voir la manœuvre et la pression à la lance.
   Interventions générées à partir d'un numéro (1 à 999). Règles : recueil « Fiches écheveaux » SDIS 45, GDO « Incendies de structures »,
   précisions du formateur (15 bar à la pompe, 6 bar à la lance, tuyaux de 20 m, LDT pour les petits feux extérieurs, colonne sèche dès qu'elle est en état). */
import { progress } from "../progress.js";
import { gameBar, bindBar } from "./common.js";

const COLOR = "#138A83";
/* ================= Règles (recueil « Fiches écheveaux » SDIS 45, GDO « Incendies de structures », formateur) ================= */
const J45 = 0.06, J70 = 0.0055, H = 3;   // pertes de charge à 500 L/min (bar/m), hauteur d'un niveau (m)
const PPOMPE = 15, PLANCE = 6;           // pression max de refoulement du FPT, pression visée à la lance
const TUY = 20;                          // longueur d'un tuyau (m)
const ETB = { "3a": "d'une ligne d'attaque épaulée", "3b": "d'une ligne d'attaque préconnectée", ldt: "de la LDT",
  "2b": "d'une division d'attaque épaulée", "2c": "d'une division d'attaque préconnectée" };
const PE = { eng: "prise d'eau : l'engin", alim: "prise d'eau : la division d'alimentation", att: "prise d'eau : la division d'attaque", cs: "prise d'eau : la colonne sèche" };

/* ================= Générateur de scénarios (1 à 999, rejouables) ================= */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const RUES = ["rue Pasteur", "avenue des Acacias", "rue du Faubourg Bannier", "allée des Tilleuls", "rue de la Gare", "boulevard Jean Jaurès", "rue des Carmes", "impasse des Lilas", "rue Victor Hugo", "avenue de la Libération", "rue du Moulin", "place du Martroi", "rue des Vignes", "chemin des Prés", "rue Jeanne d'Arc"];
const VILLES = ["Orléans", "Montargis", "Gien", "Pithiviers", "Olivet", "Saran", "Fleury-les-Aubrais", "Saint-Jean-de-Braye", "Meung-sur-Loire", "Beaugency", "Briare", "Châteauneuf-sur-Loire", "Amilly", "Chécy", "Ingré"];
const EXT = [
  { obj: "poubelle", motif: "Feu de poubelle", pa: "la poubelle", det: "Un conteneur à ordures brûle contre un muret, sur le trottoir.", icon: "🗑️", vl: false },
  { obj: "haie", motif: "Feu de haie", pa: "la haie", det: "Une haie de thuyas brûle en bordure de jardin, loin de la maison.", icon: "🌳", vl: false },
  { obj: "broussailles", motif: "Feu de broussailles", pa: "les broussailles", det: "Un talus de broussailles brûle sur une vingtaine de mètres carrés.", icon: "🌿", vl: false },
  { obj: "detritus", motif: "Feu de détritus", pa: "le tas de détritus", det: "Un tas de détritus brûle sur un terrain vague.", icon: "🗑️", vl: false },
  { obj: "vl", motif: "Feu de véhicule", pa: "le véhicule", det: "Une voiture brûle sur un parking, flammes dans le compartiment moteur.", icon: "🚗", vl: true }
];
const PIECES = ["cuisine", "chambre", "séjour", "salle de bains", "bureau"];
export function scenario(n) {
  const r = rng(n * 7919 + 13), pick = (a) => a[Math.floor(r() * a.length)], between = (a, b) => a + Math.floor(r() * (b - a + 1));
  const num = between(1, 120), adr = num + " " + pick(RUES) + ", " + pick(VILLES), heure = between(6, 23) + " h " + String(between(0, 11) * 5).padStart(2, "0");
  const pi = pick([8, 12, 15, 18, 25, 35, 50, 70]), dEng = pick([10, 15, 20, 25]);
  const u = r();
  let sc;
  if (u < 0.17) { // extérieur
    const e = pick(EXT);
    sc = { kind: "ext", niv: 0, feu: 0, ...e, pa: e.pa, lieu: e.motif.toLowerCase(),
      titre: e.motif, arrivee: e.det + " Le FPT s'arrête à " + dEng + " m. Poteau d'incendie à " + pi + " m de l'engin.", reco: "Aucune victime, aucune habitation menacée. Accès direct." };
  } else if (u < 0.42) { // pavillon
    const r1 = r() < 0.4, feu = r1 && r() < 0.5 ? 1 : 0, piece = pick(PIECES), complexe = r() < 0.3;
    sc = { kind: "struct", type: "pav", niv: r1 ? 1 : 0, feu, jour: false, complexe, cs: null, pa: feu ? "la porte de la " + piece + " à l'étage" : "la porte d'entrée de la maison",
      titre: "Feu de " + piece + (r1 ? " dans un pavillon R+1" : " dans un pavillon de plain-pied"), lieu: r1 ? "pavillon R+1" : "pavillon de plain-pied",
      arrivee: "Pavillon " + (r1 ? "à un étage" : "de plain-pied") + ", fumée à la fenêtre de la " + piece + (feu ? " (à l'étage)" : "") + ". Le FPT s'arrête à " + dEng + " m de l'entrée. Poteau d'incendie à " + pi + " m de l'engin.",
      reco: complexe ? "Accès par un jardin encombré, un portillon étroit et plusieurs marches : cheminement complexe." : "Accès direct par l'allée : cheminement simple. Occupants sortis." };
  } else { // immeuble
    const niv = between(2, 9), feu = between(1, niv), complexe = r() < 0.4, jour = r() < 0.7;
    const cs = niv >= 6 && r() < 0.65 ? (r() < 0.2 ? "hs" : "ok") : null;
    sc = { kind: "struct", type: "imm", niv, feu, jour, complexe, cs, pa: "la porte de l'appartement du " + ord(feu),
      titre: "Feu d'appartement au " + ord(feu), lieu: "immeuble R+" + niv,
      arrivee: "Immeuble R+" + niv + ", une seule cage d'escalier, non encloisonnée. Fumée à une fenêtre du " + ord(feu) + ". " + (cs ? "Une colonne sèche équipe l'immeuble. " : "Pas de colonne sèche. ") + "Le FPT s'arrête à " + dEng + " m de l'entrée. Poteau d'incendie à " + pi + " m de l'engin.",
      reco: (complexe ? "Paliers encombrés et coudés : cheminement complexe. " : "Cheminement simple jusqu'au palier. ") + (jour ? "La cage a un jour d'escalier. " : "Pas de jour d'escalier. ") +
        (cs === "hs" ? "⚠ Les bouchons de la colonne sèche ont été arrachés dans les étages : elle est inutilisable. " : cs ? "Colonne sèche en bon état. " : "") + "Le BAL est équipé d'ARI." };
  }
  sc.n = n; sc.pi = pi; sc.dEng = dEng;
  sc.bip = "FPT 1 — " + (sc.kind === "ext" ? sc.motif : sc.titre) + "\n" + adr + "\nDépart " + heure;
  return sc;
}
function ord(n) { return n === 0 ? "RDC" : n === 1 ? "1er" : n + "e"; }

export function startEtablissezGame(ctx) {
  const { app, mod } = ctx;
  document.documentElement.classList.add("noscroll");
  const cleanup = () => document.documentElement.classList.remove("noscroll");
  const exit = () => { cleanup(); ctx.exit(); };

  /* ================= État et écrans ================= */
  let S;
  const $ = (s) => app.querySelector(s);
  const main = () => app.querySelector(".etz-main");
  function frame(inner, sub) {
    app.innerHTML = '<div class="screen etz">' + gameBar({ badge: "Établissez !", color: COLOR, label: S ? "n° " + S.sc.n + " · " + S.sc.titre + (sub ? " · " + sub : "") : mod.title }) +
      '<div class="etz-main"><div class="wrap">' + inner + "</div></div></div>";
    bindBar(app, exit, S && sub !== "Débriefing" ? "Quitter l'intervention en cours ?" : null);
    main().scrollTop = 0;
  }
  function menu() {
    S = null;
    frame("<h1>Établissez !</h1><p class=\"muted\">Tu es <b>chef d'agrès du FPT</b> (INC 6 : toi, le conducteur, un BAT et un BAL). Lis la situation, choisis ton dispositif, commande tes binômes. Puis l'eau dira la vérité.</p>" +
      '<div class="etz-card"><div class="etz-row"><button class="etz-btn c" id="rand">🎲 Intervention au hasard</button></div><div class="etz-row" style="margin-top:12px"><span class="muted">ou l\'intervention n°</span><input type="number" id="num" min="1" max="999" value="1"><button class="etz-btn g" id="gonum">Jouer</button></div><p class="small muted">999 interventions : feux extérieurs (poubelle, haie, broussailles, détritus, véhicule), pavillons, immeubles du R+2 au R+9, avec ou sans colonne sèche.</p></div>');
    $("#rand").onclick = () => start(1 + Math.floor(Math.random() * 999));
    $("#gonum").onclick = () => start(Math.max(1, Math.min(999, +$("#num").value || 1)));
  }
  function start(n) {
    // undefined = pas encore choisi ; null = « aucune » choisi explicitement
    S = { sc: scenario(n), reco: false, t: 0, c: { alim: undefined, divAlim: undefined, att: undefined, attWho: undefined, attLvl: undefined, attMode: undefined, nb70: undefined, ligne: undefined, nb45: undefined, pe: undefined }, orders: {}, cur: null, line: "prep" };
    brief();
  }

  /* ================= 1. Arrivée ================= */
  function brief() {
    frame('<div class="msg">📟 ' + S.sc.bip + "</div>" + coupe() + '<div class="etz-card">' + S.sc.arrivee +
      (S.reco ? "<p><b>Reconnaissance :</b> " + S.sc.reco + "</p>" : "") + "</div>" +
      '<div class="etz-row end">' + (S.reco ? "" : '<button class="etz-btn g" id="reco">🔎 Faire la reconnaissance (+45 s)</button>') +
      '<button class="etz-btn c" id="go">Choisir mon dispositif →</button></div>', "Arrivée");
    if ($("#reco")) $("#reco").onclick = () => { S.reco = true; S.t += 45; brief(); };
    $("#go").onclick = dispositif;
  }

  /* ================= Coupe (SVG) ================= */
  function geo() {
    const n = S.sc.niv, lh = 34, G = 40 + (n + 1) * lh + 12;
    return { n, lh, G, Ht: G + 26, fy: (i) => G - i * lh };
  }
  function stairs(a, b, mode) {
    const g = geo(), p = [];
    if (mode === "vert") return [[196, g.fy(a) - 3], [196, g.fy(b) - 3]];
    p.push([180, g.fy(a) - 3]);
    for (let i = a; i < b; i++) { p.push([212, g.fy(i) - g.lh / 2]); p.push([180, g.fy(i + 1) - 3]); }
    return p;
  }
  const hasAtt = () => S.c.att === "2b" || S.c.att === "2c";
  function hosePaths() {
    const g = geo(), c = S.c, sc = S.sc, f = sc.feu, P = [];
    const eng = [142, g.G - 8], pi = [14, g.G - 4];
    if (c.alim === "cod" || c.alim === "bal") P.push({ k: "alim", col: "#444", w: 5, pts: [pi, [60, g.G - 4], [62, g.G - 8]] });
    if (sc.kind === "ext") {
      if (c.ligne) P.push({ k: "ligne", col: "#C1121F", w: c.ligne === "ldt" ? 2.5 : 3.5, pts: [eng, [200, g.G - 4], [262, g.G - 6]] });
      return P;
    }
    const dA = c.divAlim === "adresse" ? [162, g.G - 4] : c.divAlim === "fenetre" ? [388, g.G - 4] : c.divAlim === "cs" ? [226, g.G - 4] : null;
    if (dA) P.push({ k: "2a", col: "#1F5FBF", w: 5, pts: [eng, [150, g.G - 3], dA], end: c.divAlim !== "cs" });
    let attPt = null;
    if (hasAtt() && c.attLvl) {
      const from = c.att === "2c" ? eng : (c.divAlim === "adresse" || c.divAlim === "fenetre" ? dA : [162, g.G - 4]);
      const pts = [from, [176, g.G - 3]].concat(stairs(0, c.attLvl, c.attMode === "vert" ? "vert" : "ramp"));
      attPt = pts[pts.length - 1];
      P.push({ k: "att", col: "#E8871E", w: 5, pts, end: true });
    }
    if (c.ligne) {
      let from = eng, lvl0 = 0;
      if (c.pe === "alim" && dA && c.divAlim !== "cs") from = dA;
      else if (c.pe === "att" && attPt) { from = attPt; lvl0 = c.attLvl; }
      else if (c.pe === "cs" && sc.cs) { lvl0 = Math.max(0, f - 1); from = [226, g.fy(lvl0) - 4]; }
      let pts = [from];
      if (lvl0 === 0 && c.pe !== "cs") pts.push([176, g.G - 3]);
      if (f > lvl0) pts = pts.concat(stairs(lvl0, f, "ramp"));
      pts.push([256, g.fy(f) - 4]);
      P.push({ k: "ligne", col: "#C1121F", w: c.ligne === "ldt" ? 2.5 : 3.5, pts, o: c.ligne !== "ldt" ? [272, g.fy(f) - 8] : null });
    }
    return P;
  }
  function coupe(anim) {
    const g = geo(), sc = S.sc;
    let s = '<div class="coupe"><svg viewBox="0 0 400 ' + g.Ht + '" xmlns="http://www.w3.org/2000/svg">';
    s += '<rect width="400" height="' + g.Ht + '" fill="#EAF2F8"/><rect y="' + g.G + '" width="400" height="26" fill="#C9C2B4"/>';
    if (sc.kind === "ext") {
      s += '<text x="248" y="' + (g.G - 6) + '" font-size="30">' + sc.icon + '</text><text x="268" y="' + (g.G - 26) + '" font-size="22">🔥</text>';
    } else {
      const top = g.fy(g.n + 1) + 6;
      s += '<rect x="166" y="' + top + '" width="208" height="' + (g.G - top) + '" fill="#F7F4EE" stroke="#8A8378" stroke-width="2"/>';
      if (sc.type === "pav") s += '<path d="M160 ' + top + " L270 " + (top - 26) + " L380 " + top + '" fill="#B5543A"/>';
      for (let i = 0; i <= g.n; i++) {
        const y = g.fy(i);
        if (i > 0) s += '<line x1="166" y1="' + y + '" x2="374" y2="' + y + '" stroke="#8A8378" stroke-width="2"/>';
        s += '<text x="160" y="' + (y - 11) + '" font-size="10" text-anchor="end" fill="#5A5F66">' + ord(i) + "</text>";
        s += '<rect x="354" y="' + (y - 26) + '" width="14" height="16" fill="' + (i === sc.feu ? "#FF9A3C" : "#BFD9EA") + '" stroke="#8A8378"/>';
        s += '<rect x="248" y="' + (y - 24) + '" width="8" height="22" fill="#9C7A55"/>';
      }
      if (g.n > 0) {
        s += '<rect x="172" y="' + top + '" width="46" height="' + (g.G - top) + '" fill="#E9E4D8" opacity=".7"/>';
        for (let i = 0; i < g.n; i++) s += '<polyline points="' + stairs(i, i + 1, "ramp").map((p) => p.join(",")).join(" ") + '" fill="none" stroke="#B9B2A5" stroke-width="2"/>';
      }
      if (sc.cs) {
        s += '<line x1="226" y1="' + (g.G - 4) + '" x2="226" y2="' + (g.fy(g.n) - 6) + '" stroke="#9AA0A6" stroke-width="5"/>';
        for (let i = 1; i <= g.n; i++) s += '<circle cx="226" cy="' + (g.fy(i) - 6) + '" r="3.5" fill="#6B7076"/>';
        s += '<text x="229" y="' + (g.G - 8) + '" font-size="8" fill="#5A5F66">CS</text>';
      }
      const fy = g.fy(sc.feu);
      s += '<text x="318" y="' + (fy - 6) + '" font-size="22">🔥</text>';
      s += '<path d="M368 ' + (fy - 26) + ' q14 -10 6 -26 q14 8 10 -24" stroke="#555" stroke-width="7" fill="none" opacity=".45" stroke-linecap="round"/>';
    }
    s += '<rect x="62" y="' + (g.G - 26) + '" width="80" height="24" rx="4" fill="#C1121F"/><rect x="118" y="' + (g.G - 22) + '" width="18" height="10" fill="#BFD9EA"/><circle cx="80" cy="' + (g.G - 1) + '" r="6" fill="#222"/><circle cx="126" cy="' + (g.G - 1) + '" r="6" fill="#222"/><text x="72" y="' + (g.G - 10) + '" font-size="10" fill="#fff" font-weight="700">FPT</text>';
    s += '<rect x="9" y="' + (g.G - 18) + '" width="10" height="16" rx="3" fill="#C1121F"/><text x="4" y="' + (g.G + 14) + '" font-size="10">PI ' + sc.pi + " m</text>";
    hosePaths().forEach((h) => {
      s += '<path class="hose" data-k="' + h.k + '" d="M' + h.pts.map((p) => p.join(" ")).join(" L") + '" stroke="' + h.col + '" stroke-width="' + h.w + '" pathLength="1" stroke-dasharray="1" stroke-dashoffset="' + (anim ? 1 : 0) + '"/>';
      if (h.o) s += '<ellipse class="obj" data-k="' + h.k + '" cx="' + h.o[0] + '" cy="' + h.o[1] + '" rx="12" ry="4" fill="none" stroke="#C1121F" stroke-width="3" opacity="' + (anim ? 0 : 1) + '"/>';
      if (h.end) { const e = h.pts[h.pts.length - 1]; s += '<circle class="obj" data-k="' + h.k + '" cx="' + e[0] + '" cy="' + e[1] + '" r="5" fill="#9AA0A6" stroke="#333" opacity="' + (anim ? 0 : 1) + '"/>'; }
    });
    return s + '<g id="water"></g></svg></div>';
  }

  /* ================= 2. Dispositif ================= */
  // Une option est « choisie » quand la valeur stockée correspond ; « aucune » est stockée null et s'affiche comme la valeur "".
  const shown = (v) => v === null ? "" : v === undefined ? undefined : String(v);
  function opt(key, list) {
    return '<div class="opt">' + list.map(([v, t]) => '<button data-k="' + key + '" data-v="' + v + '"' + (shown(S.c[key]) === String(v) ? ' class="on"' : "") + ">" + t + "</button>").join("") + "</div>";
  }
  // Questions applicables à la situation (une question non applicable n'est ni posée ni exigée)
  function questions() {
    const sc = S.sc, c = S.c, Q = [];
    Q.push({ k: "alim", t: "Alimentation de l'engin (poteau à " + sc.pi + " m)", o: [["res", "Sur la réserve de l'engin (3 000 L)"], ["cod", "Sur le poteau, par le conducteur seul"], ["bal", "Sur le poteau, par le BAL au dévidoir"]] });
    const da = [["adresse", sc.kind === "ext" ? "Division d'alimentation vers le feu" : "Devant l'adresse"]];
    if (sc.kind === "struct") da.push(["fenetre", "Sous la fenêtre en feu, au plus près"]);
    if (sc.cs) da.push(["cs", "Alimenter la colonne sèche (raccord en pied d'immeuble)"]);
    da.push(["", "Pas de division d'alimentation"]);
    Q.push({ k: "divAlim", t: "Division d'alimentation", o: da });
    if (sc.niv >= 1 && sc.feu >= 1) {
      Q.push({ k: "att", t: "Division d'attaque", o: [["", "Aucune"], ["2b", "ETB 2b : épaulée"], ["2c", "ETB 2c : préconnectée"]] });
      if (hasAtt()) {
        Q.push({ k: "attWho", t: "Qui établit la division d'attaque ?", sub: true, o: [["BAL", "Le BAL"], ["BAT", "Le BAT"]] });
        const lv = []; for (let i = 1; i <= sc.niv; i++) lv.push([i, "Palier du " + ord(i)]);
        Q.push({ k: "attLvl", t: "Où la poser ?", sub: true, o: lv });
        if (c.att === "2b") Q.push({ k: "nb70", t: "Tuyaux de 70 emportés", sub: true, o: [[3, "3 (dotation : chef 1, équipier 2)"], [4, "4"], [5, "5"], [6, "6"], [7, "7"]] });
        Q.push({ k: "attMode", t: "Comment ?", sub: true, o: sc.jour ? [["ramp", "Par les marches (rampant)"], ["vert", "Dans le jour de l'escalier (vertical)"]] : [["ramp", "Par les marches (rampant)"]] });
      }
    }
    Q.push({ k: "ligne", t: "Ligne d'attaque", o: [["ldt", "La LDT"], ["3b", "ETB 3b : préconnectée (LDV 500)"], ["3a", "ETB 3a : épaulée (LDV 500)"]] });
    if (c.ligne === "3a") Q.push({ k: "nb45", t: "Tuyaux de 45 emportés", sub: true, o: [[3, "3 (2 en Z + 1 en O)"], [4, "4"], [5, "5"], [6, "6"]] });
    if (c.ligne === "3a") {
      const pes = [["eng", "L'engin"]];
      if (c.divAlim === "adresse" || c.divAlim === "fenetre") pes.push(["alim", "La division d'alimentation"]);
      if (hasAtt()) pes.push(["att", "La division d'attaque"]);
      if (sc.cs && c.divAlim === "cs") pes.push(["cs", "La colonne sèche (sortie du " + ord(Math.max(1, sc.feu - 1)) + ")"]);
      Q.push({ k: "pe", t: "Sur quelle prise d'eau ?", sub: true, o: pes });
    }
    return Q;
  }
  function normalise() {
    // retire les choix devenus incohérents après un changement
    const c = S.c, Q = questions();
    ["att", "attWho", "attLvl", "attMode", "nb70", "nb45", "pe"].forEach((k) => {
      const q = Q.find((x) => x.k === k);
      if (!q) { c[k] = k === "att" ? null : undefined; return; }
      if (c[k] !== undefined && !q.o.some(([v]) => shown(c[k]) === String(v))) c[k] = undefined;
    });
    if (c.ligne === "ldt" || c.ligne === "3b") c.pe = "eng";
  }
  function dispositif() {
    normalise();
    const Q = questions();
    let h = coupe() + '<div class="etz-card">' + Q.map((q) => (q.sub ? '<div class="small muted" style="margin-top:8px">' + q.t + "</div>" : '<div class="q">' + q.t + "</div>") + opt(q.k, q.o)).join("") + "</div>";
    const ready = Q.every((q) => S.c[q.k] !== undefined);
    h += '<div class="etz-row end"><button class="etz-btn g" id="back">← Situation</button><button class="etz-btn c" id="go"' + (ready ? "" : " disabled") + ">Donner mes ordres →</button></div>";
    frame(h, "Dispositif");
    app.querySelectorAll(".opt button").forEach((b) => b.onclick = () => {
      const k = b.dataset.k, v = b.dataset.v;
      S.c[k] = v === "" ? null : ["attLvl", "nb70", "nb45"].includes(k) ? +v : v;
      const y = main().scrollTop; dispositif(); main().scrollTop = y;
    });
    $("#back").onclick = brief;
    $("#go").onclick = () => { S.orders = {}; S.cur = null; ordres(); };
  }

  /* ================= 3. Ordres ================= */
  function commandes() {
    const c = S.c, L = [];
    if (hasAtt()) L.push({ id: "att", who: c.attWho, etb: c.att });
    L.push({ id: "ligne", who: "BAT", etb: c.ligne });
    return L;
  }
  function tilesFor() {
    const sc = S.sc, lv = [];
    if (sc.kind === "struct") for (const d of [-2, -1, 0]) { const k = sc.feu + d; if (k >= 1) lv.push("emplacement de la division d'attaque : palier du " + ord(k)); }
    const ex = [["Accès", sc.kind === "ext" ? ["accès : par la voie publique", "accès : par l'escalier"] : ["accès : par l'escalier", "accès : par la façade, à l'échelle"]],
      ["Formule", ["établissez", "ouvrez"]], ["Point d'attaque", ["point d'attaque : " + sc.pa, sc.kind === "ext" ? "point d'attaque : le poteau d'incendie" : "point d'attaque : la fenêtre en feu"]],
      ["Prise d'eau", Object.entries(PE).filter(([k]) => k !== "cs" || sc.cs).map(([, v]) => v)], ["Restriction", ["vous pénétrez sur ordre"]]];
    if (lv.length) ex.splice(1, 0, ["Emplacement", lv]);
    return { prep: [["Binôme", ["BAT", "BAL"]], ["Établissement", Object.values(ETB).map((e) => "pour l'établissement " + e)], ["Matériel", ["avec des tuyaux supplémentaires"]], ["Formule", ["en reconnaissance", "établissez"]]], exec: ex };
  }
  function ordres() {
    const L = commandes();
    if (!S.cur || !L.find((x) => x.id === S.cur)) S.cur = L[0].id;
    L.forEach((x) => S.orders[x.id] = S.orders[x.id] || { prep: [], exec: [] });
    const o = S.orders[S.cur], T = tilesFor();
    let h = '<p class="muted small">' + (S.sc.kind === "struct" ? "Sur un feu de structure, le conducteur établit la <b>division d'alimentation sans ordre</b>. " : "") + "Tu commandes les binômes : touche une ligne (préparatoire ou exécution), puis les étiquettes dans l'ordre. Touche une étiquette placée pour la retirer.</p>";
    if (L.length > 1) h += '<div class="etz-row">' + L.map((x) => '<button class="etz-btn ' + (x.id === S.cur ? "c" : "g") + '" data-o="' + x.id + '">' + (x.id === "att" ? "Division d'attaque" : "Ligne d'attaque") + "</button>").join("") + "</div>";
    h += '<div class="etz-card"><div class="small muted">Ordre préparatoire</div><div class="etz-slot' + (S.line === "prep" ? " on" : "") + '" data-l="prep">' + o.prep.map((t, i) => '<span class="chip" data-r="prep" data-i="' + i + '">' + t + "</span>").join("") + "</div>";
    h += '<div class="small muted" style="margin-top:10px">Ordre d\'exécution</div><div class="etz-slot' + (S.line === "exec" ? " on" : "") + '" data-l="exec">' + o.exec.map((t, i) => '<span class="chip" data-r="exec" data-i="' + i + '">' + t + "</span>").join("") + "</div></div>";
    h += '<div class="etz-card">' + T[S.line].map(([g, list]) => '<div class="grp"><div class="t">' + g + '</div><div class="tiles">' + list.map((t) => '<button class="tile">' + t + "</button>").join("") + "</div></div>").join("") + "</div>";
    const done = L.every((x) => S.orders[x.id].prep.length && S.orders[x.id].exec.length);
    h += '<div class="etz-row end"><button class="etz-btn g" id="back">← Dispositif</button><button class="etz-btn r" id="go"' + (done ? "" : " disabled") + ">Engager les binômes →</button></div>";
    frame(h, "Ordres");
    app.querySelectorAll("[data-o]").forEach((b) => b.onclick = () => { S.cur = b.dataset.o; S.line = "prep"; ordres(); });
    app.querySelectorAll(".etz-slot").forEach((b) => b.onclick = (e) => { if (e.target.classList.contains("chip")) return; S.line = b.dataset.l; ordres(); });
    app.querySelectorAll(".chip").forEach((b) => b.onclick = () => { o[b.dataset.r].splice(+b.dataset.i, 1); ordres(); });
    app.querySelectorAll(".tile").forEach((b) => b.onclick = () => { o[S.line].push(b.textContent); const y = main().scrollTop; ordres(); main().scrollTop = y; });
    $("#back").onclick = dispositif;
    $("#go").onclick = jouer;
  }

  /* ================= Calculs : tuyaux, pression, temps ================= */
  function calcul() {
    const sc = S.sc, c = S.c, f = sc.feu, R = {};
    const dIn = sc.kind === "ext" ? 0 : 10, vert = (k) => H * k + 10, ramp = (k) => 5 + 15 * k;
    const csOK = sc.cs === "ok" && c.divAlim === "cs" && c.pe === "cs";
    let L70 = c.divAlim === "adresse" || c.divAlim === "fenetre" || c.divAlim === "cs" ? TUY : 0, manqueAtt = 0;
    if (hasAtt()) {
      const need = (c.attMode === "vert" ? vert(c.attLvl) : ramp(c.attLvl)) + (c.att === "2c" ? sc.dEng : 0), cap = c.att === "2c" ? 2 * TUY : (c.nb70 || 3) * TUY;
      L70 += need; manqueAtt = Math.max(0, Math.ceil((need - cap) / TUY)); R.attNeed = need; R.attCap = cap;
    }
    let need;
    if (c.pe === "att" && hasAtt()) need = 15 * Math.max(0, f - c.attLvl) + dIn;
    else if (c.pe === "cs" && sc.cs) { need = 15 * (f - Math.max(0, f - 1)) + dIn; L70 += H * Math.max(0, f - 1); }
    else need = (c.pe === "eng" ? sc.dEng : 5) + 15 * f + dIn;
    const cap = c.ligne === "ldt" ? 40 : c.ligne === "3a" ? (c.nb45 || 3) * TUY : 3 * TUY; R.cap = cap;
    R.L45 = need; R.L70 = L70; R.manque = Math.max(0, Math.ceil((need - cap) / TUY)); R.manqueAtt = manqueAtt; R.csPanne = c.pe === "cs" && sc.cs === "hs";
    R.pertes = J45 * need + J70 * L70 + 0.1 * H * f; R.pmax = PPOMPE - R.pertes; R.p = Math.min(PLANCE, R.pmax);
    const tAlim = c.alim === "cod" ? 60 : c.alim === "bal" ? 90 + sc.pi : 0;
    const tCod = (c.alim === "cod" ? tAlim : 0) + (L70 && c.divAlim ? 60 : 0);
    let tAtt = 0;
    if (hasAtt()) tAtt = (c.alim === "bal" && c.attWho === "BAL" ? tAlim : 0) + (c.att === "2b" ? 80 + (c.attMode === "vert" ? 50 + 10 * c.attLvl : 22 * c.attLvl) : 60 + (sc.complexe ? 30 : 12) * c.attLvl) + 60 * manqueAtt + 8 * Math.max(0, (c.nb70 || 3) - 3);
    const tBat = (c.ligne === "ldt" ? 25 : c.ligne === "3b" ? 45 : 50) + 20 * f + 60 * R.manque + 8 * Math.max(0, (c.nb45 || 3) - 3) + (hasAtt() && c.attWho === "BAT" ? tAtt : 0) + (R.csPanne ? 180 : 0);
    const dep = c.pe === "alim" || c.pe === "cs" ? tCod : c.pe === "att" ? Math.max(tAtt, tCod) : 0;
    R.t = S.t + Math.max(tBat, dep) + 10;
    return R;
  }

  /* ================= Évaluation ================= */
  function evaluer() {
    const sc = S.sc, c = S.c, f = sc.feu, R = calcul(), E = [];
    const add = (cat, pts, txt, crit) => E.push({ cat, pts, txt, crit }), ok = (cat, txt) => E.push({ cat, pts: 0, txt, ok: true });
    if (sc.kind === "ext") {
      // --- Feux extérieurs
      if (sc.vl) {
        if (c.ligne === "ldt") add("dis", 30, "LDT sur un feu de véhicule : elle ne sert plus pour les VL. On établit une ligne d'attaque de Ø 45 (et on attaque sous ARI, même en extérieur).");
        else ok("dis", "Feu de véhicule : ligne d'attaque de Ø 45 (attaque sous ARI, même en extérieur).");
        if (c.ligne === "3a") add("dis", 4, "Ligne épaulée : ça marche, mais la préconnectée sur l'engin est plus rapide ici.");
      } else {
        if (c.ligne === "ldt") ok("dis", "Petit feu extérieur (" + sc.obj + ") : la LDT est l'établissement adapté.");
        else add("dis", 8, "Ligne de Ø 45 pour un petit feu extérieur (" + sc.obj + ") : surdimensionné et plus long, la LDT suffit.");
      }
      if (c.divAlim === "adresse") add("dis", 4, "Division d'alimentation superflue : le conducteur l'établit sans ordre sur les feux de structure, pas pour ce feu.");
      if (c.alim === "bal" || c.alim === "cod") { if (!sc.vl) add("eff", 3, "Alimenter l'engin n'était pas nécessaire pour un si petit feu : la réserve suffit."); else ok("dis", "Engin alimenté."); }
      else ok("dis", "Réserve de l'engin suffisante pour ce feu.");
    } else {
      // --- Feux de structure : dispositif (40)
      if (c.ligne === "ldt") add("dis", 40, "LDT sur un feu de structure en volume clos : le moyen usuel est la LDV sur un établissement de Ø 45 (GDO « Incendies de structures »). Le binôme est entré en zone de danger non maîtrisé.", true);
      else if (c.ligne === "3b") {
        if (f === 0 && !sc.complexe) ok("dis", "Plain-pied, cheminement simple : ligne préconnectée (ETB 3b), 500 L/min sur l'engin.");
        else if (f <= 1 && !sc.complexe) ok("dis", "R+1 avec cheminement simple : la préconnectée est admise.");
        else if (f <= 1) add("dis", 8, "Ligne préconnectée alors que le cheminement est complexe : on la réserve aux cheminements simples. Ici, la ligne épaulée.");
        else add("dis", 15, "Ligne préconnectée au " + ord(f) + " : elle est prévue pour le plain-pied ou le R+1 avec cheminement simple. Dans les étages, ligne épaulée.");
      } else if (c.ligne === "3a") {
        if (f === 0 && !sc.complexe) add("dis", 4, "La ligne épaulée fonctionne, mais en plain-pied avec un cheminement simple, la préconnectée (ETB 3b) est plus rapide.");
        else ok("dis", "Ligne d'attaque épaulée (ETB 3a) adaptée.");
      }
      const csDispo = sc.cs === "ok", useCS = c.pe === "cs";
      if (useCS) {
        if (sc.cs === "hs") add("dis", S.reco ? 20 : 5, S.reco ? "Colonne sèche utilisée alors que la reconnaissance l'avait signalée hors service." : "La colonne sèche était hors service (bouchons arrachés) : la reconnaissance te l'aurait montré. Il a fallu tout reprendre.");
        else ok("dis", "Colonne sèche en état : alimentée et utilisée, ligne épaulée sur la sortie du niveau inférieur au feu.");
      }
      if (csDispo && !useCS) add("dis", 15, "Colonne sèche en état non utilisée : dès qu'elle est présente et fonctionnelle, on l'alimente et on l'utilise, même au 2e étage. Elle garde l'escalier libre (portes coupe-feu fermées, pas de fumée dans les étages), fait gagner du temps et limite les pertes de charge.");
      const need = f >= 5 && !csDispo;
      if (need && !hasAtt()) add("dis", 20, "Feu au " + ord(f) + (csDispo ? " : il fallait utiliser la colonne sèche ou une division d'attaque" : " sans colonne sèche : il fallait une division d'attaque") + " pour limiter les tuyaux de Ø 45 (pertes de charge).");
      if (f <= 3 && hasAtt()) add("dis", 8, "Division d'attaque superflue : jusqu'au R+3 / R+4, la ligne épaulée sur la division d'alimentation suffit.");
      if (hasAtt() && f > 3) {
        if (c.att === "2c" && sc.complexe) add("dis", 10, "Division d'attaque préconnectée sur un cheminement complexe" + (S.reco ? "" : " (la reconnaissance te l'aurait montré)") + " : elle est prévue pour les cheminements simples. Ici, l'épaulée (ETB 2b).");
        else ok("dis", "Division d'attaque " + (c.att === "2b" ? "épaulée" : "préconnectée") + " adaptée au cheminement.");
        if (c.attLvl === f - 1) ok("dis", "Division d'attaque au niveau N-1 (" + ord(f - 1) + ").");
        else if (c.attLvl < f - 1) add("dis", 5, "Division d'attaque trop basse (" + ord(c.attLvl) + ") : on la pose au niveau N-1, au plus près du feu en sécurité.");
        if (c.attWho === "BAT") add("dis", 10, "Le BAT établit la division d'attaque puis la ligne : 1 binôme = 1 action, et l'attaque est retardée. Le BAL sous ARI est à privilégier.");
        else ok("dis", "Division d'attaque confiée au BAL sous ARI.");
      }
      if (hasAtt() && c.ligne === "3a" && c.pe !== "att") add("dis", 8, "Division d'attaque posée, mais la ligne n'y est pas branchée.");
      if (c.ligne === "3a" && c.pe === "eng" && (c.divAlim === "adresse" || c.divAlim === "fenetre")) add("dis", 5, "Ligne épaulée sur l'engin alors qu'une division d'alimentation est posée devant l'adresse.");
      if (c.divAlim === null) add("dis", 5, "Pas de division d'alimentation : sur tout feu de structure, le conducteur l'établit sans ordre, en direction du point d'attaque.");
      if (c.divAlim === "cs" && !useCS) add("dis", 5, "Colonne sèche alimentée, mais la ligne d'attaque n'y est pas branchée.");
      if (c.alim === "res") add("dis", 5, "Engin sur sa réserve : environ 6 minutes d'eau à 500 L/min. Pense à alimenter l'engin sur le poteau.");
      else if (c.alim === "cod" && sc.pi > 20) add("dis", 5, "Poteau à " + sc.pi + " m : au-delà de 20 m, le conducteur alimente l'engin avec l'aide du BAL.");
      else if (c.alim === "bal" && sc.pi <= 20) add("dis", 3, "Poteau à " + sc.pi + " m : le conducteur l'alimente seul (moins de 20 m), le BAL reste disponible.");
      else ok("dis", "Alimentation de l'engin adaptée (poteau à " + sc.pi + " m).");
      // --- Sécurité (20)
      if (c.divAlim === "fenetre") add("sec", 10, "Division d'alimentation posée sous la fenêtre en feu : on évite d'établir devant les ouvrants et au droit des façades touchées.");
      else if (c.divAlim === "adresse") ok("sec", "Division d'alimentation devant l'adresse, à distance raisonnable de l'ouvrant.");
      if (hasAtt() && c.attLvl >= f) add("sec", 12, "Division d'attaque posée au niveau du feu ou au-dessus : le moyen hydraulique doit être prêt avant d'entrer en zone d'exclusion, à N-1.");
      if (c.ligne === "ldt") add("sec", 8, "Moyen hydraulique insuffisant pour un feu de structure : zone de danger non maîtrisé.");
    }
    // --- Ordres (25)
    commandes().forEach((x) => {
      const o = S.orders[x.id], nom = x.id === "att" ? "Ordre de la division d'attaque" : "Ordre de la ligne d'attaque", p = o.prep, e = o.exec, F = [];
      if (p[0] !== x.who) F.push("le binôme (« " + x.who + " ») en tête du préparatoire");
      if (!p.includes("pour l'établissement " + ETB[x.etb])) F.push("« pour l'établissement " + ETB[x.etb] + " »");
      if (p[p.length - 1] !== "en reconnaissance") F.push("« en reconnaissance » à la fin du préparatoire");
      if (p.includes("établissez")) F.push("pas de « établissez » dans le préparatoire");
      const plus = (x.id === "att" ? c.nb70 : c.ligne === "3a" ? c.nb45 : 3) > 3;
      if (plus && !p.includes("avec des tuyaux supplémentaires")) F.push("« avec des tuyaux supplémentaires » : le binôme n'emporte que sa dotation si tu ne le demandes pas");
      if (!plus && p.includes("avec des tuyaux supplémentaires")) F.push("pas de « tuyaux supplémentaires » : tu n'en as pas prévu");
      const pe = x.id === "att" ? (x.etb === "2b" ? (c.divAlim === "adresse" || c.divAlim === "fenetre" ? PE.alim : PE.eng) : null) : (c.ligne === "ldt" || c.ligne === "3b") ? (c.ligne === "3b" ? PE.eng : null) : PE[c.pe];
      if (pe && !e.includes(pe)) F.push("la prise d'eau (« " + pe + " »)");
      if (e.some((t) => t.startsWith("prise d'eau") && t !== pe)) F.push("une prise d'eau qui ne correspond pas au dispositif");
      const acc = sc.kind === "ext" ? "accès : par la voie publique" : "accès : par l'escalier";
      if (sc.kind === "struct" && !e.includes(acc)) F.push("l'accès (« " + acc + " »)");
      if (e.some((t) => t.startsWith("accès") && t !== acc)) F.push("un accès cohérent avec la situation");
      if (x.id === "att" && !e.includes("emplacement de la division d'attaque : palier du " + ord(c.attLvl))) F.push("l'emplacement de la division (palier du " + ord(c.attLvl) + ")");
      if (x.id === "ligne" && e.some((t) => t.startsWith("emplacement"))) F.push("pas d'emplacement de division dans l'ordre de la ligne");
      if (x.id === "ligne" && !e.includes("point d'attaque : " + sc.pa)) F.push("le point d'attaque (" + sc.pa + ")");
      if (e[e.length - 1] !== "établissez") F.push("« établissez » à la fin de l'ordre d'exécution");
      const iR = e.indexOf("vous pénétrez sur ordre"), iE = e.indexOf("établissez");
      if (iR >= 0 && iE >= 0 && iR > iE) F.push("la restriction « vous pénétrez sur ordre » se place avant « établissez »");
      if (e.includes("ouvrez")) F.push("pas de « ouvrez » : la mise en eau est commandée par le chef BAT au point d'attaque");
      if (F.length) add("ord", Math.min(12, 3 * F.length), nom + ", à revoir : " + F.join(" ; ") + ".");
      else ok("ord", nom + " complet et dans l'ordre.");
    });
    // --- Efficacité (15)
    if (c.ligne !== "ldt") {
      if (R.csPanne) add("eff", 5, "Colonne sèche hors service : environ 3 minutes perdues à reprendre l'établissement.");
      if (R.p < PLANCE) add("eff", 10, "Pression à la lance : " + R.p.toFixed(1) + " bar au lieu de 6. Trop de Ø 45 et de dénivelé : " + R.pertes.toFixed(1) + " bar de pertes pour 15 bar à la pompe.");
      else ok("eff", "6 bars à la lance (" + R.pertes.toFixed(1) + " bar de pertes, la pompe peut fournir 15).");
    }
    if (R.manque) add("eff", 5, "Il manquait " + R.manque + " tuyau(x) à la ligne d'attaque (" + R.L45 + " m pour " + R.cap + " m) : prolongement, perte de temps. Le chef d'agrès anticipe le nombre de tuyaux.");
    if (c.ligne === "3a" && c.nb45 > 3 && c.nb45 > Math.ceil(R.L45 / TUY) + 1) add("eff", 2, "Trop de tuyaux de 45 portés (" + c.nb45 + " pour " + R.L45 + " m) : effort inutile. Un tuyau de réserve suffit.");
    if (c.att === "2b" && c.nb70 > 3 && c.nb70 > Math.ceil(R.attNeed / TUY) + 1) add("eff", 2, "Trop de tuyaux de 70 portés (" + c.nb70 + " pour " + R.attNeed + " m) : effort inutile.");
    if (R.manqueAtt) add("eff", 4, "Il manquait " + R.manqueAtt + " tuyau(x) de 70 à la division d'attaque (" + R.attNeed + " m pour " + R.attCap + " m)." + (sc.jour && c.attMode !== "vert" ? " En vertical, dans le jour de l'escalier, il en faut beaucoup moins." : ""));
    const cat = sc.kind === "ext" ? { dis: 50, ord: 30, eff: 20 } : { dis: 40, ord: 25, sec: 20, eff: 15 }, res = {};
    Object.keys(cat).forEach((k) => res[k] = Math.max(0, cat[k] - E.filter((x) => x.cat === k).reduce((s, x) => s + x.pts, 0)));
    if (E.some((x) => x.crit)) { res.dis = 0; if (res.sec != null) res.sec = Math.min(res.sec, 5); }
    return { E, R, cat, res, total: Object.values(res).reduce((a, b) => a + b, 0) };
  }

  /* ================= 4. La manœuvre ================= */
  function jouer() {
    const c = S.c, sc = S.sc, R = calcul(), steps = [];
    if (c.alim === "cod") steps.push(["alim", "Le conducteur alimente l'engin sur le poteau."]);
    if (c.alim === "bal") steps.push(["alim", "Le BAL alimente l'engin sur le poteau avec le dévidoir."]);
    if (c.divAlim === "adresse" || c.divAlim === "fenetre") steps.push(["2a", "Le conducteur établit la division d'alimentation, vérifie la fermeture des robinets et l'alimente" + (sc.kind === "struct" ? " (sans ordre)." : ".")]);
    if (c.divAlim === "cs") steps.push(["2a", "Le conducteur alimente la colonne sèche en pied d'immeuble."]);
    if (hasAtt()) steps.push(["att", "Le " + c.attWho + " établit la division d'attaque " + (c.att === "2b" ? "épaulée" : "préconnectée") + " jusqu'au palier du " + ord(c.attLvl) + (c.attMode === "vert" ? ", en vertical dans le jour de l'escalier." : ", par les marches.") + (R.manqueAtt ? " ⚠ Il manque " + R.manqueAtt + " tuyau(x) : il faut prolonger." : " Il pose la division et l'amarre.")]);
    steps.push(["ligne", (R.csPanne ? "⚠ Au " + ord(Math.max(1, sc.feu - 1)) + ", la colonne sèche crache l'eau par les sorties sans bouchon : elle est inutilisable, il faut tout reprendre. " : "") +
      (c.ligne === "ldt" ? "Le BAT déroule la LDT jusqu'à " + sc.pa + "." : "Le BAT établit la ligne " + (c.ligne === "3a" ? "épaulée : le chef avec le tuyau en O et la lance, l'équipier avec les tuyaux en Z" : "préconnectée : le chef avec le O et la lance, l'équipier au 1er raccord, le conducteur fait suivre") + (R.manque ? ". ⚠ Il manque " + R.manque + " tuyau(x) : il faut prolonger." : ".")) ]);
    frame(coupe(true) + '<div class="etz-card log" id="log"></div><div class="etz-row end" id="act"></div>', "La manœuvre");
    let i = 0;
    const next = () => {
      if (i >= steps.length) { $("#act").innerHTML = '<button class="etz-btn r" id="ouvrez">« Ouvrez ! »</button>'; $("#ouvrez").onclick = ouvrez; return; }
      const [k, txt] = steps[i++];
      app.querySelectorAll('[data-k="' + k + '"]').forEach((el) => { if (el.classList.contains("hose")) el.style.strokeDashoffset = 0; else setTimeout(() => el.setAttribute("opacity", 1), 1300); });
      $("#log").insertAdjacentHTML("beforeend", "<div>" + txt + "</div>");
      setTimeout(next, 1600);
    };
    requestAnimationFrame(() => setTimeout(next, 300));
    function ouvrez() {
      const lig = app.querySelector('.hose[data-k="ligne"]'), w = lig.cloneNode();
      w.setAttribute("stroke", "#5EC8FF"); w.setAttribute("stroke-width", 1.6); w.style.strokeDashoffset = 1; $("#water").appendChild(w);
      requestAnimationFrame(() => requestAnimationFrame(() => w.style.strokeDashoffset = 0));
      $("#act").innerHTML = "";
      setTimeout(() => {
        const p = c.ligne === "ldt" ? null : R.p;
        $("#log").insertAdjacentHTML("beforeend", '<div class="gauge">' + gauge(p) + "<div><b>" + (p == null ? "LDT : 80 à 300 L/min" : p.toFixed(1) + " bar à la lance") + '</b><br><span class="small muted">Eau à la lance à T+' + mmss(R.t) + "</span></div></div>");
        $("#act").innerHTML = '<button class="etz-btn c" id="deb">Débriefing →</button>';
        $("#deb").onclick = debrief;
      }, 1600);
    }
  }
  function mmss(t) { return Math.floor(t / 60) + " min " + String(Math.round(t % 60)).padStart(2, "0"); }
  function gauge(p) {
    const v = p == null ? 3 : Math.max(0, Math.min(16, p)), a = (-120 + v / 16 * 240) * Math.PI / 180, col = p == null || p < 6 ? "#C1121F" : "#138A83";
    return '<svg width="96" height="80" viewBox="0 0 96 80"><path d="M14 64 A38 38 0 1 1 82 64" fill="none" stroke="#E3DED3" stroke-width="8"/><line x1="48" y1="48" x2="' + (48 + 32 * Math.sin(a)).toFixed(1) + '" y2="' + (48 - 32 * Math.cos(a)).toFixed(1) + '" stroke="' + col + '" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="48" r="5" fill="#16181D"/><text x="48" y="76" font-size="11" text-anchor="middle">bar</text></svg>';
  }

  /* ================= 5. Débriefing ================= */
  function debrief() {
    const ev = evaluer(), N = { dis: "Dispositif", ord: "Ordres", sec: "Sécurité", eff: "Efficacité" }, R = ev.R;
    let h = '<div class="etz-card" style="text-align:center"><div class="etz-score">' + ev.total + '<span style="font-size:20px">/100</span></div>' + (ev.E.some((x) => x.crit) ? '<div class="item crit">Erreur critique</div>' : "") + "</div>";
    h += '<div class="etz-card">' + Object.keys(ev.cat).map((k) => '<div class="cat"><span>' + N[k] + "</span><b>" + ev.res[k] + " / " + ev.cat[k] + "</b></div>").join("") + "</div>";
    h += '<div class="etz-card">' + ev.E.filter((x) => !x.ok).map((x) => '<div class="item ' + (x.crit ? "crit" : "ko") + '">✖ ' + x.txt + "</div>").join("") + ev.E.filter((x) => x.ok).map((x) => '<div class="item ok">✔ ' + x.txt + "</div>").join("") + "</div>";
    if (S.c.ligne !== "ldt") h += '<details class="etz-card"><summary><b>Voir le calcul de pression</b></summary><p class="small">Pompe : 15 bar maximum. Pertes : Ø 45 sur ' + R.L45 + " m × 0,06 = " + (J45 * R.L45).toFixed(2) + " bar ; Ø 70 sur " + R.L70 + " m × 0,0055 = " + (J70 * R.L70).toFixed(2) + " bar ; dénivelé " + (H * S.sc.feu) + " m ≈ " + (0.1 * H * S.sc.feu).toFixed(1) + " bar. Pression possible à la lance : " + R.pmax.toFixed(1) + " bar (le conducteur régule à 6 bar si possible).</p></details>";
    h += '<div class="etz-row end"><button class="etz-btn g" id="menu">Menu</button><button class="etz-btn g" id="again">Rejouer le n° ' + S.sc.n + '</button><button class="etz-btn c" id="nextsc">Intervention suivante →</button></div>';
    frame(h, "Débriefing");
    progress.saveGame(mod.id, "etablissez", ev.total);
    $("#menu").onclick = menu;
    $("#again").onclick = () => start(S.sc.n);
    $("#nextsc").onclick = () => start(1 + Math.floor(Math.random() * 999));
  }
  menu();
  return cleanup;
}
