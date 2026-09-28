/* Jeu exclusif ARI : « Réserve d'air ». Le binôme progresse au tour par tour dans un bâtiment enfumé,
   généré à partir d'un numéro de plan. Chaque geste coûte du temps, donc de l'air : trouver la victime,
   l'équiper de la cagoule, la sortir… et ressortir avant la panne d'air. */
import { ic, esc, fmt } from "../ui.js";
import { progress } from "../progress.js";
import { SND } from "./engine.js";
import { gameBar, bindBar } from "./common.js";

const COLOR = "#1F5FBF";
const WALL = 0, FLOOR = 1, DOOR = 2, CLOSED = 3, BLOCKED = 4, FIRE = 5, OBST = 6, EXIT = 7;
const WALK = new Set([FLOOR, DOOR, EXIT]);
const SMOKE = { dense: { r: 1, st: 6, label: "très épaisses, visibilité nulle" }, moyenne: { r: 2, st: 5, label: "épaisses, visibilité réduite" } };

/* ---------- Hasard reproductible : un numéro de plan donne toujours le même bâtiment ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- Types d'intervention ---------- */
const TYPES = [
  { id: "appart", layout: "corridor", W: 17, H: 11, min: 3, smoke: "dense", v: [6, 7],
    titre: "Feu d'appartement", lieu: ["un immeuble d'habitation de quatre étages", "une résidence de six étages", "un petit immeuble ancien du centre-ville"],
    ou: ["au 2e étage", "au 3e étage", "au 1er étage"], rens: ["Une voisine affirme que la locataire, âgée, n'est pas sortie.", "Le gardien signale qu'un homme dort souvent l'après-midi dans cet appartement.", "Des voisins ont entendu appeler à l'aide avant que la fumée n'envahisse le palier."] },
  { id: "pavillon", layout: "bsp", W: 15, H: 12, min: 3, smoke: "dense", v: [6, 7],
    titre: "Feu de pavillon", lieu: ["un pavillon de plain-pied", "une maison individuelle en lotissement", "une longère rénovée"],
    ou: ["en rez-de-chaussée"], rens: ["La propriétaire, sortie seule, indique que son fils est resté dans sa chambre.", "Le requérant pense que son voisin âgé est encore à l'intérieur.", "Une adolescente aurait tenté de récupérer son chien."] },
  { id: "bureaux", layout: "corridor", W: 19, H: 12, min: 3, smoke: "moyenne", v: [6, 7],
    titre: "Feu de bureaux", lieu: ["un immeuble de bureaux", "les locaux d'une agence bancaire", "un centre administratif"],
    ou: ["au 1er étage", "au 2e étage"], rens: ["L'agent de sécurité ne retrouve pas un employé resté tard.", "Un salarié manque à l'appel au point de rassemblement.", "La responsable pense qu'une personne s'est réfugiée dans un bureau."] },
  { id: "cave", layout: "bsp", W: 17, H: 12, min: 2, smoke: "dense", v: [6, 7],
    titre: "Feu de caves", lieu: ["un grand ensemble", "une résidence de huit étages", "un immeuble ancien"],
    ou: ["dans les caves", "au sous-sol, dans les caves voûtées"], rens: ["Un habitant serait descendu chercher un vélo.", "Des jeunes ont été vus entrer dans les caves peu avant.", "Un agent d'entretien ne répond plus à son téléphone."] },
  { id: "entrepot", layout: "hall", W: 19, H: 13, min: 3, smoke: "moyenne", v: [7, 8],
    titre: "Feu d'entrepôt", lieu: ["un entrepôt de stockage de meubles", "une plateforme logistique", "un entrepôt de produits d'entretien"],
    ou: ["dans la cellule de stockage"], rens: ["Un cariste n'a pas rejoint le point de rassemblement.", "Le chef d'équipe signale un intérimaire manquant.", "Un chauffeur-livreur est entré chercher un bon de livraison."] },
  { id: "industriel", layout: "hall", W: 19, H: 13, min: 3, smoke: "dense", v: [7, 8],
    titre: "Feu d'établissement industriel", lieu: ["une usine de plasturgie", "une menuiserie industrielle", "un atelier de mécanique"],
    ou: ["dans l'atelier de production"], rens: ["Un opérateur de maintenance manque à l'appel.", "Le responsable de site pense qu'un ouvrier est resté près des machines.", "Un technicien a été vu retourner vers les bureaux de l'atelier."] },
  { id: "erp", layout: "corridor", W: 19, H: 12, min: 3, smoke: "moyenne", v: [6, 7],
    titre: "Feu dans un établissement recevant du public", lieu: ["un hôtel de trois étages", "un collège", "une maison de retraite"],
    ou: ["au 1er étage", "au 2e étage"], rens: ["Le veilleur de nuit n'a pas pu vérifier toutes les chambres.", "Le directeur signale qu'un élève manque à l'appel.", "Une aide-soignante indique qu'un résident n'est pas dans sa chambre."] }
];

/* ---------- Générateur de bâtiment ---------- */
export function generate(seed) {
  const r = rng(seed * 7919 + 13);
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (a) => a[Math.floor(r() * a.length)];
  const T = TYPES[Math.floor(r() * TYPES.length)];
  for (let attempt = 0; attempt < 12; attempt++) {
    const m = build(T, r, ri, pick);
    if (m) {
      m.seed = seed;
      m.type = T;
      m.v = pick(T.v);
      m.p0 = [ri(56, 60) * 5, ri(55, 60) * 5];
      m.fac = [1, [0.95, 1, 1.1, 1.15, 1.2][ri(0, 4)]];
      m.thr = [ri(50, 60), ri(50, 60)];
      m.hour = pick(["6 h 40", "9 h 15", "11 h 50", "14 h 25", "16 h 10", "19 h 05", "21 h 30", "23 h 45", "2 h 20", "4 h 55"]);
      m.lieu = pick(T.lieu); m.ou = pick(T.ou); m.rens = pick(T.rens);
      if (placeVictims(m, r, ri)) return m;
    }
  }
  return generate(seed + 10007);
}

function build(T, r, ri, pick) {
  const W = T.W, H = T.H, c = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? WALL : c[y * W + x]);
  const set = (x, y, v) => { c[y * W + x] = v; };
  const rooms = [];
  const doorType = () => { const u = r(); return u < 0.5 ? DOOR : u < 0.88 ? CLOSED : BLOCKED; };
  function bsp(x0, y0, x1, y1, min, onlyV) {
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const canV = w >= min * 2 + 1, canH = !onlyV && h >= min * 2 + 1;
    if ((!canV && !canH) || (w <= min * 2 + 3 && h <= min * 2 + 3 && r() < 0.3)) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, FLOOR);
      rooms.push({ x0, y0, x1, y1 });
      return;
    }
    if (canV && (!canH || w > h || (w === h && r() < 0.5))) {
      const sx = ri(x0 + min, x1 - min);
      bsp(x0, y0, sx - 1, y1, min, onlyV); bsp(sx + 1, y0, x1, y1, min, onlyV);
      const cand = []; for (let y = y0; y <= y1; y++) if (at(sx - 1, y) === FLOOR && at(sx + 1, y) === FLOOR) cand.push(y);
      if (cand.length) set(sx, pick(cand), doorType());
    } else {
      const sy = ri(y0 + min, y1 - min);
      bsp(x0, y0, x1, sy - 1, min, onlyV); bsp(x0, sy + 1, x1, y1, min, onlyV);
      const cand = []; for (let x = x0; x <= x1; x++) if (at(x, sy - 1) === FLOOR && at(x, sy + 1) === FLOOR) cand.push(x);
      if (cand.length) set(pick(cand), sy, doorType());
    }
  }
  let entry;
  if (T.layout === "corridor") {
    const yc = Math.floor(H / 2) - (r() < 0.5 ? 1 : 0);
    for (let x = 1; x < W - 1; x++) set(x, yc, FLOOR);
    bsp(1, 1, W - 2, yc - 2, T.min, true);
    bsp(1, yc + 2, W - 2, H - 2, T.min, true);
    rooms.forEach((rm) => {
      const up = rm.y1 === yc - 2, wy = up ? yc - 1 : yc + 1;
      const cand = []; for (let x = rm.x0; x <= rm.x1; x++) if (at(x, wy) === WALL) cand.push(x);
      if (cand.length && r() < 0.85) set(pick(cand), wy, r() < 0.55 ? CLOSED : DOOR);
    });
    const left = r() < 0.5;
    entry = { x: left ? 0 : W - 1, y: yc };
  } else if (T.layout === "hall") {
    const top = ri(3, 4);
    bsp(1, 1, W - 2, top - 1, 2, true);
    const hy0 = top + 1;
    for (let y = hy0; y < H - 1; y++) for (let x = 1; x < W - 1; x++) set(x, y, FLOOR);
    rooms.forEach((rm) => {
      const cand = []; for (let x = rm.x0; x <= rm.x1; x++) cand.push(x);
      if (cand.length) set(pick(cand), top, r() < 0.6 ? CLOSED : DOOR);
    });
    for (let y = hy0 + 2; y < H - 3; y += 3) {
      for (let x = 3; x < W - 3; x++) set(x, y, OBST);
      let x = 3 + ri(1, 4);
      while (x < W - 3) { set(x, y, FLOOR); set(x + 1, y, FLOOR); x += ri(5, 7); }
    }
    entry = { x: ri(3, W - 4), y: H - 1 };
    rooms.push({ x0: 1, y0: hy0, x1: W - 2, y1: H - 2, hall: true });
  } else {
    bsp(1, 1, W - 2, H - 2, T.min, false);
    const cand = []; for (let x = 1; x < W - 1; x++) if (at(x, H - 2) === FLOOR) cand.push(x);
    entry = { x: pick(cand), y: H - 1 };
  }
  // Quelques passages supplémentaires pour créer des boucles
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (at(x, y) !== WALL || r() > 0.05) continue;
    if ((at(x - 1, y) === FLOOR && at(x + 1, y) === FLOOR && at(x, y - 1) === WALL && at(x, y + 1) === WALL) ||
        (at(x, y - 1) === FLOOR && at(x, y + 1) === FLOOR && at(x - 1, y) === WALL && at(x + 1, y) === WALL)) set(x, y, CLOSED);
  }
  set(entry.x, entry.y, EXIT);
  const m = { W, H, c, heat: new Uint8Array(W * H), entry, rooms };
  // Le feu : 2 à 4 cases, loin de l'entrée
  const d = dist(m, entry, true);
  let far = []; for (let i = 0; i < W * H; i++) if (c[i] === FLOOR && d[i] > 0) far.push(i);
  far.sort((a, b) => d[b] - d[a]);
  far = far.slice(0, Math.max(3, Math.floor(far.length * 0.3)));
  const f0 = far[Math.floor(r() * far.length)];
  let fires = [f0];
  for (let k = 0; k < ri(1, 3); k++) {
    const b = fires[Math.floor(r() * fires.length)], nb = [b - 1, b + 1, b - W, b + W].filter((j) => c[j] === FLOOR);
    if (nb.length) fires.push(nb[Math.floor(r() * nb.length)]);
  }
  fires = [...new Set(fires)];
  for (const f of fires) { const before = reachCount(m); c[f] = FIRE; if (reachCount(m) !== before - 1) c[f] = FLOOR; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (c[y * W + x] === FIRE)
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) m.heat[Y * W + X] = 1; }
  // Mobilier, gravats : sans jamais couper un chemin
  const n = Math.floor(W * H / (T.layout === "hall" ? 60 : 30));
  for (let k = 0; k < n; k++) {
    const x = ri(1, W - 2), y = ri(1, H - 2), i = y * W + x;
    if (c[i] !== FLOOR || Math.abs(x - entry.x) + Math.abs(y - entry.y) < 3) continue;
    if ([i - 1, i + 1, i - W, i + W].some((j) => c[j] === DOOR || c[j] === CLOSED || c[j] === BLOCKED)) continue;
    const before = reachCount(m);
    c[i] = OBST;
    if (reachCount(m) !== before - 1) c[i] = FLOOR;
  }
  return reachCount(m) > W * H * 0.3 ? m : null;
}
const passable = (v, forceDoors) => WALK.has(v) || v === CLOSED || (forceDoors && v === BLOCKED);
function reachCount(m) { const d = dist(m, m.entry, true); let n = 0; for (let i = 0; i < d.length; i++) if (d[i] >= 0) n++; return n; }
/* Distances (en cases) depuis un point, à travers les portes (bloquées comprises si forceDoors) */
function dist(m, from, forceDoors) {
  const { W, H, c } = m, d = new Int16Array(W * H).fill(-1), q = [from.y * W + from.x];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const j = Y * W + X; if (d[j] >= 0 || !passable(c[j], forceDoors)) continue;
      d[j] = d[i] + 1; q.push(j);
    }
  }
  return d;
}
/* Coût réel (en litres d'air) d'un trajet optimal : sert à garantir que chaque plan est faisable */
function airCost(m, a, b, carry) {
  const { W, H, c } = m, st = SMOKE[m.type.smoke].st + (carry ? 4 : 0), rate = carry ? 130 : 100;
  const cost = new Float64Array(W * H).fill(Infinity), done = new Uint8Array(W * H), s = a.y * W + a.x;
  cost[s] = 0;
  for (;;) {
    let i = -1, best = Infinity;
    for (let k = 0; k < cost.length; k++) if (!done[k] && cost[k] < best) { best = cost[k]; i = k; }
    if (i < 0) return Infinity;
    if (i === b.y * W + b.x) return best;
    done[i] = 1;
    const x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const j = Y * W + X, v = c[j]; if (!passable(v, true)) continue;
      let L = st / 60 * rate * (m.heat[j] ? 1.2 : 1);
      if (v === CLOSED) L += 3 / 60 * 100;
      if (v === BLOCKED) L += 25 / 60 * 135;
      if (best + L < cost[j]) cost[j] = best + L;
    }
  }
}
function placeVictims(m, r, ri) {
  const { W, c, entry } = m, d = dist(m, entry, true);
  let max = 0; for (let i = 0; i < d.length; i++) if (d[i] > max) max = d[i];
  const cand = []; for (let i = 0; i < d.length; i++) if (c[i] === FLOOR && d[i] >= max * 0.45 && !m.heat[i]) cand.push(i);
  for (let k = cand.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [cand[k], cand[j]] = [cand[j], cand[k]]; }
  const want = r() < 0.25 ? 2 : 1, victims = [];
  let used = [0, 0];
  const usable = m.p0.map((p, i) => (p - m.thr[i] - 25) * m.v);
  for (const i of cand) {
    if (victims.length >= want) break;
    const pos = { x: i % W, y: Math.floor(i / W) };
    const go = airCost(m, entry, pos, false) * 1.7, back = airCost(m, pos, entry, true);
    if (!isFinite(go) || !isFinite(back)) continue;
    const bearer = [go + 30 + back * 170 / 130, go + 30 + back];
    const need = [bearer[0] * m.fac[0], bearer[1] * m.fac[1]];
    if (used[0] + need[0] <= usable[0] && used[1] + need[1] <= usable[1]) {
      used = [used[0] + need[0], used[1] + need[1]];
      victims.push({ x: pos.x, y: pos.y, conscious: r() < 0.35 });
    }
  }
  if (!victims.length) return false;
  m.victims = victims;
  return true;
}

/* ---------- Le jeu ---------- */
export function startReserveGame(ctx) {
  const { app, mod } = ctx;
  let S = null, walkTimer = null, ro = null, keyH = null;
  const $ = (s) => app.querySelector(s);
  document.documentElement.classList.add("noscroll");
  const stopWalk = () => { if (walkTimer) clearTimeout(walkTimer); walkTimer = null; };
  const cleanup = () => { stopWalk(); if (ro) ro.disconnect(); if (keyH) window.removeEventListener("keydown", keyH); document.documentElement.classList.remove("noscroll"); };
  const exit = () => { cleanup(); ctx.exit(); };
  const randomPlan = () => 1 + Math.floor(Math.random() * 9999);

  /* ----- Briefing ----- */
  function briefing(seed) {
    stopWalk();
    const m = generate(seed), T = m.type, nV = m.victims.length;
    const vtxt = nV > 1 ? "Deux personnes seraient encore à l'intérieur." : "Une personne serait encore à l'intérieur.";
    app.innerHTML = '<div class="screen qscreen rsv-brief">' + gameBar({ badge: "Réserve d'air", color: COLOR, label: mod.title }) +
      '<main><div class="panel" style="border-top-color:' + COLOR + '">' +
        '<div class="rsv-kick">' + ic("clock") + " " + esc(m.hour) + " · Plan n° " + seed + "</div>" +
        "<h1>" + esc(T.titre) + "</h1>" +
        '<div class="rsv-story"><p>Départ pour ' + esc(m.lieu) + ", feu " + esc(m.ou) + ". À votre arrivée, des fumées " + esc(SMOKE[T.smoke].label.split(",")[0]) + " s'échappent des ouvrants.</p>" +
          "<p>" + esc(m.rens) + " " + vtxt + "</p>" +
          "<p>Ton chef d'agrès vous engage, <b>toi et ton équipier</b>, en binôme sous ARI : <b>reconnaissance et recherche de victime" + (nV > 1 ? "s" : "") + "</b>. Contrôle croisé RAPACE fait, vous êtes au point de pénétration.</p></div>" +
        '<div class="rsv-facts"><div><span>Bouteilles</span><b>' + m.v + " L</b></div><div><span>Ta pression</span><b>" + m.p0[0] + " bars</b></div><div><span>Ton équipier</span><b>" + m.p0[1] + " bars</b></div><div><span>Fumées</span><b>" + (T.smoke === "dense" ? "Très épaisses" : "Épaisses") + "</b></div></div>" +
        '<details class="rsv-rules"><summary>' + ic("help") + " Comment jouer</summary><ul>" +
          "<li><b>Se déplacer</b> : touche une case (ou glisse le doigt). Sur ordinateur : les flèches du clavier.</li>" +
          "<li>Chaque pas, chaque geste <b>coûte du temps, donc de l'air</b>. Porter une victime ou forcer une porte coûte beaucoup.</li>" +
          "<li>Dans la fumée, tu ne vois que les cases autour de toi. La <b>caméra thermique</b> voit plus loin (et repère les victimes), mais elle prend quelques secondes.</li>" +
          "<li>Une victime trouvée : <b>équipe-la de la cagoule d'évacuation</b> (sur l'ARI qui a le plus d'air !), puis <b>sors-la</b> par l'entrée.</li>" +
          "<li><b>Sifflet de fin de charge</b> : retour immédiat. Si une bouteille tombe à 0 : panne d'air, mission ratée.</li>" +
          "<li>L'essoufflement augmente la consommation : une <b>pause</b> fait récupérer.</li></ul></details>" +
        '<div class="row" style="margin-top:16px"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="go">' + ic("play") + "Engager le binôme</button>" +
        '<button class="btn big" id="other">' + ic("reset") + "Autre intervention</button></div>" +
        '<form class="rsv-plan" id="pf"><label>Jouer un plan précis (n° 1 à 9999) : <input id="pn" type="number" min="1" max="9999" inputmode="numeric" value="' + seed + '"></label><button class="btn">OK</button></form>' +
      "</div></main></div>";
    bindBar(app, exit);
    $("#go").onclick = () => play(m);
    $("#other").onclick = () => briefing(randomPlan());
    $("#pf").onsubmit = (e) => { e.preventDefault(); const n = Math.max(1, Math.min(9999, parseInt($("#pn").value, 10) || 1)); briefing(n); };
  }

  /* ----- Partie ----- */
  function play(m) {
    const W = m.W, H = m.H;
    S = { m, c: new Uint8Array(m.c), t: 0, p: m.p0.slice(), fac: m.fac.slice(), ess: false, fat: 0, pos: { ...m.entry }, prev: { ...m.entry },
      seen: new Uint8Array(W * H), vis: new Uint8Array(W * H), carry: -1, cag: -1, whistled: [false, false], sifflet: false,
      victims: m.victims.map((v) => ({ ...v, found: false, out: false, cagoule: false, intox: 0 })),
      ignored: 0, wrongCag: 0, noCag: 0, bonus: 0, events: 0, lastEv: 0, modal: false, over: false, log: [] };
    S.dExit = dist({ ...m, c: S.c }, m.entry, true);
    app.innerHTML = '<div class="screen rsv">' + gameBar({ badge: "Réserve d'air", color: COLOR, label: m.type.titre + " · plan " + m.seed,
      actions: '<button class="iconbtn" data-act="help" title="Aide">' + ic("help") + "</button>" }) +
      '<div class="rsv-hud" id="hud"></div><div class="rsv-stage" id="stage"><canvas id="cv"></canvas><div class="rsv-msg" id="msg"></div></div>' +
      '<div class="rsv-bar" id="bar"></div><div class="rsv-modal" id="modal" hidden></div></div>';
    bindBar(app, () => modal("Quitter l'intervention ?", "<p>La partie en cours sera perdue.</p>", [{ t: "Quitter", cls: "red", f: exit }, { t: "Continuer", f: null }]));
    $('[data-act="help"]').onclick = help;
    reveal(SMOKE[m.type.smoke].r);
    const stage = $("#stage");
    ro = new ResizeObserver(draw); ro.observe(stage);
    let p0 = null;
    stage.addEventListener("pointerdown", (e) => { p0 = { x: e.clientX, y: e.clientY }; });
    stage.addEventListener("pointerup", (e) => {
      if (!p0 || S.modal || S.over) return;
      const dx = e.clientX - p0.x, dy = e.clientY - p0.y; p0 = null;
      if (Math.hypot(dx, dy) > 28) { stopWalk(); let a = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; if (geo && geo.tr) a = [a[1], a[0]]; step(a[0], a[1]); return; }
      const cell = cellAt(e.clientX, e.clientY); if (cell) walkTo(cell);
    });
    keyH = (e) => {
      if (S.over) return;
      if (S.modal) { if (e.key === "Enter" || e.key === "Escape") { const b = $("#modal button"); if (b) b.click(); } return; }
      const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], q: [-1, 0], d: [1, 0], z: [0, -1], s: [0, 1] }[e.key];
      if (k) { e.preventDefault(); stopWalk(); geo && geo.tr ? step(k[1], k[0]) : step(k[0], k[1]); return; }
      const a = { c: camera, p: pause, f: force, e: cagoule, v: take }[e.key.toLowerCase()];
      if (a) { e.preventDefault(); a(); }
    };
    window.addEventListener("keydown", keyH);
    say("Vous entrez. " + (m.type.smoke === "dense" ? "Visibilité nulle : vous progressez à genoux." : "Visibilité réduite."), 3500);
    update();
  }

  /* ----- Règles de consommation ----- */
  function consume(sec, rate) {
    const k = 1 + S.fat / 200;
    for (let i = 0; i < 2; i++) {
      let L = sec / 60 * rate * S.fac[i] * k;
      if (S.cag === i) L += sec / 60 * 40;
      S.p[i] -= L / S.m.v;
    }
    S.t += sec;
    const v = S.victims[S.carry]; if (v && !v.cagoule) v.intox += sec;
  }
  const cellOf = (x, y) => S.c[y * S.m.W + x];
  function reveal(R) {
    const { W, H } = S.m;
    S.vis.fill(0);
    const q = [[S.pos.x, S.pos.y, 0]], seenQ = new Set([S.pos.y * W + S.pos.x]);
    while (q.length) {
      const [x, y, d] = q.shift(), i = y * W + x;
      S.vis[i] = 1; S.seen[i] = 1;
      const v = S.c[i];
      if (d >= R || (d > 0 && (v === WALL || v === CLOSED || v === BLOCKED || v === FIRE))) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X; if (seenQ.has(j)) continue;
        if (dx && dy && (S.c[y * W + X] === WALL && S.c[Y * W + x] === WALL)) continue;
        seenQ.add(j); q.push([X, Y, d + 1]);
      }
    }
    let found = false;
    S.victims.forEach((v) => { if (!v.found && S.vis[v.y * W + v.x]) { v.found = true; found = true; } });
    if (found) { stopWalk(); SND.steal(); say("Victime découverte ! Approche-toi d'elle.", 3000); }
  }

  function step(dx, dy) {
    if (S.modal || S.over) return false;
    const x = S.pos.x + dx, y = S.pos.y + dy, { W, H } = S.m;
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const v = cellOf(x, y);
    if (v === BLOCKED) { say("Porte bloquée : il faut la forcer (Halligan)."); return false; }
    if (v === FIRE) { say("Les flammes ! Impossible de passer."); return false; }
    if (v === WALL || v === OBST) { return false; }
    let sec = SMOKE[S.m.type.smoke].st, rate = 100;
    if (v === CLOSED) { S.c[y * W + x] = DOOR; sec += 3; }
    const vc = S.victims[S.carry];
    if (vc) { sec += vc.conscious ? 2 : 4; rate = vc.conscious ? 100 : 130; }
    if (S.m.heat[y * W + x]) { sec += 2; rate *= 1.2; }
    if (S.sifflet && S.dExit[y * W + x] > S.dExit[S.pos.y * W + S.pos.x]) S.ignored++;
    S.prev = { ...S.pos }; S.pos = { x, y };
    if (vc) { vc.x = x; vc.y = y; }
    S.fat = Math.min(100, S.fat + (vc ? (vc.conscious ? 2 : 5) : 1.2));
    consume(sec, rate);
    reveal(SMOKE[S.m.type.smoke].r);
    if (v === EXIT && vc) {
      vc.out = true; S.carry = -1; S.cag = -1;
      SND.good(); say("Victime mise en sécurité à l'extérieur !", 3000);
      if (S.victims.every((u) => u.out)) { update(); return end("ok"); }
    }
    if (!checkAir()) return false;
    maybeEvent();
    update();
    return true;
  }
  function walkTo(target) {
    stopWalk();
    const { W, H } = S.m, s = S.pos.y * W + S.pos.x, g = target.y * W + target.x;
    if (s === g) return;
    const prev = new Int32Array(W * H).fill(-1), q = [s]; prev[s] = s;
    for (let h = 0; h < q.length && prev[g] < 0; h++) {
      const i = q[h], x = i % W, y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X; if (prev[j] >= 0 || !S.seen[j] || !(WALK.has(S.c[j]) || S.c[j] === CLOSED)) continue;
        prev[j] = i; q.push(j);
      }
    }
    if (prev[g] < 0) { say("Chemin inconnu : avance case par case."); return; }
    const path = []; for (let i = g; i !== s; i = prev[i]) path.unshift(i);
    const go = () => {
      const i = path.shift(); if (i === undefined) return;
      const ok = step(i % W - S.pos.x, Math.floor(i / W) - S.pos.y);
      if (ok && path.length && !S.modal && !S.over) walkTimer = setTimeout(go, 110);
    };
    go();
  }

  /* ----- Actions ----- */
  const here = () => S.victims.findIndex((v) => !v.out && v.x === S.pos.x && v.y === S.pos.y && S.carry !== S.victims.indexOf(v));
  const adjBlocked = () => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: S.pos.x + dx, y: S.pos.y + dy })).find((p) => p.x >= 0 && p.y >= 0 && p.x < S.m.W && p.y < S.m.H && cellOf(p.x, p.y) === BLOCKED);
  function camera() {
    if (S.modal || S.over) return;
    stopWalk(); consume(5, 60); reveal(4); reveal(SMOKE[S.m.type.smoke].r); say("Caméra thermique : tu vois plus loin à travers la fumée.", 2200);
    if (checkAir()) update();
  }
  function pause() {
    if (S.modal || S.over) return;
    stopWalk(); consume(30, 30); S.fat = Math.max(0, S.fat - 45);
    if (S.ess) { S.ess = false; S.fac[1] /= 1.4; say("Ton équipier a retrouvé une respiration calme.", 2500); } else say("Pause : vous récupérez (30 s, respiration calme).", 2200);
    if (checkAir()) update();
  }
  function force() {
    const b = adjBlocked(); if (!b || S.modal || S.over) return;
    stopWalk(); consume(25, 135); S.fat = Math.min(100, S.fat + 15); S.c[b.y * S.m.W + b.x] = DOOR; SND.tick(); say("Porte forcée à la Halligan.", 2000);
    if (checkAir()) { reveal(SMOKE[S.m.type.smoke].r); update(); }
  }
  function cagoule() {
    const i = here(); if (i < 0 || S.victims[i].cagoule || S.modal || S.over) return;
    stopWalk();
    modal("Cagoule d'évacuation", "<p>Sur quel ARI branches-tu la cagoule ? Elle consomme <b>40 L/min en continu</b>.</p>", [
      { t: "Mon ARI (" + Math.round(S.p[0]) + " bars)", f: () => doCag(i, 0) },
      { t: "ARI de mon équipier (" + Math.round(S.p[1]) + " bars)", f: () => doCag(i, 1) }
    ]);
  }
  function doCag(i, k) {
    if (S.p[k] < S.p[1 - k] - 0.5) S.wrongCag++;
    consume(30, 60); S.victims[i].cagoule = true; S.cag = k;
    say("Cagoule en place, branchée sur " + (k ? "l'ARI de ton équipier" : "ton ARI") + ".", 2500);
    if (checkAir()) update();
  }
  function take() {
    const i = here(); if (i < 0 || S.carry >= 0 || S.modal || S.over) return;
    stopWalk();
    const v = S.victims[i];
    if (!v.cagoule) S.noCag++;
    S.carry = i; consume(10, v.conscious ? 60 : 130);
    say(v.conscious ? "La victime vous suit, guidée entre vous deux. Direction la sortie !" : "Victime inconsciente : vous la tractez. Direction la sortie !", 3000);
    if (checkAir()) update();
  }
  function finish() {
    if (S.modal || S.over) return;
    const left = S.victims.filter((v) => !v.out).length;
    if (!left) return end("ok");
    modal("Ressortir ?", "<p>" + (left > 1 ? left + " victimes n'ont pas" : "Une victime n'a pas") + " été sorties. Tu termines l'engagement ?</p>", [
      { t: "Oui, on ressort", cls: "red", f: () => end("ok") }, { t: "Non, on continue", f: null }]);
  }

  /* ----- Air, sifflet, imprévus ----- */
  function checkAir() {
    for (let i = 0; i < 2; i++) {
      if (S.p[i] <= 0) { S.p[i] = 0; update(); end("panne", i); return false; }
      if (!S.whistled[i] && S.p[i] <= S.m.thr[i]) {
        S.whistled[i] = true; S.sifflet = true; stopWalk(); SND.bad();
        modal("🔔 Sifflet de fin de charge !", "<p>Le sifflet de " + (i ? "ton équipier" : "ton ARI") + " retentit (" + Math.round(S.p[i]) + " bars).</p><p><b>Retour immédiat et systématique</b> du binôme vers la sortie.</p>", [{ t: "Compris, on ressort", cls: "red", f: null }]);
      }
    }
    return true;
  }
  function maybeEvent() {
    if (S.events >= 2 || S.t - S.lastEv < 90 || S.t < 60 || Math.random() > 0.05 || S.modal) return;
    S.events++; S.lastEv = S.t; stopWalk();
    const list = ["ess", "fuite", "cos", "effondrement"].filter((e) => !(e === "ess" && S.ess));
    const e = list[Math.floor(Math.random() * list.length)];
    if (e === "ess") {
      S.ess = true; S.fac[1] *= 1.4;
      modal("Ton équipier s'essouffle", "<p>Il respire vite et fort, il a du mal à suivre. Sa consommation d'air grimpe.</p><p>Une <b>pause</b> et une respiration calme l'aideront à récupérer.</p>", [{ t: "Compris", f: null }]);
    } else if (e === "fuite") {
      const k = Math.random() < 0.5 ? 0 : 1, loss = 12 + Math.floor(Math.random() * 10);
      S.p[k] -= loss;
      modal("Fuite d'air !", "<p>Le flexible de " + (k ? "ton équipier" : "ton ARI") + " a été endommagé. Il perd <b>" + loss + " bars</b> avant que vous ne maîtrisiez la fuite.</p><p>Faites le point : avez-vous assez d'air pour continuer ?</p>", [{ t: "Compris", f: null }]);
      checkAir();
    } else if (e === "cos") {
      const k = S.p[0] <= S.p[1] ? 0 : 1, ans = Math.floor(S.p[k] * S.m.v / 100);
      const opts = [...new Set([ans, ans + 5, Math.max(1, ans - 4), ans * 2])].slice(0, 3).sort(() => Math.random() - 0.5);
      modal("Point de situation", "<p>Le chef d'agrès vous demande un point. " + (k ? "Ton équipier" : "Tu") + " a " + Math.round(S.p[k]) + " bars, bouteille de " + S.m.v + " L.</p><p><b>Combien de minutes d'air lui reste-t-il à 100 L/min ?</b></p>",
        opts.map((o) => ({ t: "≈ " + o + " min", f: () => { if (o === ans) { S.bonus = 5; SND.good(); say("Exact : " + Math.round(S.p[k]) + " × " + S.m.v + " ÷ 100 ≈ " + ans + " min. Bonus !", 3500); } else { SND.bad(); say("Non : " + Math.round(S.p[k]) + " × " + S.m.v + " ÷ 100 ≈ " + ans + " min.", 3500); } } })));
    } else {
      const { W } = S.m, d = dist({ ...S.m, c: S.c }, S.m.entry, true);
      let cur = S.pos.y * W + S.pos.x, cell = -1;
      for (let n = 0; n < 6 && d[cur] > 1; n++) {
        const x = cur % W, y = (cur - x) / W;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => (y + b) * W + x + a).find((j) => d[j] === d[cur] - 1);
        if (nb === undefined) break;
        cur = nb;
        if (n >= 1 && S.c[cur] === FLOOR) {
          S.c[cur] = OBST;
          const d2 = dist({ ...S.m, c: S.c }, S.m.entry, true);
          if (d2[S.pos.y * W + S.pos.x] >= 0 && S.victims.every((v) => v.out || d2[v.y * W + v.x] >= 0)) { cell = cur; break; }
          S.c[cur] = FLOOR;
        }
      }
      if (cell >= 0) {
        S.seen[cell] = 1; S.dExit = dist({ ...S.m, c: S.c }, S.m.entry, true);
        modal("Effondrement !", "<p>Un pan de faux plafond s'effondre sur votre chemin de retour. Il faudra trouver un autre passage.</p>", [{ t: "Compris", f: null }]);
      } else { S.events--; }
    }
  }

  /* ----- Affichage ----- */
  let msgT = null;
  function say(t, ms) {
    const el = $("#msg"); if (!el) return;
    el.textContent = t; el.classList.add("on");
    clearTimeout(msgT); msgT = setTimeout(() => el.classList.remove("on"), ms || 1800);
  }
  function modal(title, html, buttons) {
    stopWalk();
    const el = $("#modal"); S && (S.modal = true);
    el.innerHTML = '<div class="rsv-box"><h2>' + title + "</h2>" + html + '<div class="row center">' + buttons.map((b, i) => '<button class="btn big ' + (b.cls || "") + '" data-i="' + i + '">' + esc(b.t) + "</button>").join("") + "</div></div>";
    el.hidden = false;
    el.querySelectorAll("[data-i]").forEach((b) => {
      b.onclick = () => { el.hidden = true; if (S) S.modal = false; const f = buttons[+b.dataset.i].f; if (f) f(); else update(); };
    });
  }
  function help() {
    modal("Comment jouer", "<ul class=\"rsv-ul\"><li>Touche une case pour y aller (ou glisse le doigt). Clavier : flèches.</li><li>📷 <b>Caméra</b> (C) : voir plus loin, repérer les victimes. 5 s.</li><li>⏸ <b>Pause</b> (P) : 30 s de récupération, l'essoufflement baisse.</li><li>🪓 <b>Forcer</b> (F) : ouvrir une porte bloquée. 25 s, gros effort.</li><li>🎭 <b>Cagoule</b> (E) puis 🧍 <b>Évacuer</b> (V) sur la case de la victime.</li><li>Ressors par la case verte <b>Entrée</b>.</li></ul>", [{ t: "Reprendre", f: null }]);
  }
  function update() {
    if (!S) return;
    const g = (i, label) => {
      const p = Math.max(0, S.p[i]), pct = Math.min(100, p / 3), col = p <= S.m.thr[i] ? "var(--red)" : p < 150 ? "#E07800" : "var(--ok)";
      return '<div class="rsv-g"><span>' + label + '</span><div class="rsv-gbar"><i style="width:' + pct + "%;background:" + col + '"></i><em style="left:' + (S.m.thr[i] / 3) + '%"></em></div><b style="color:' + col + '">' + Math.round(p) + " bar</b></div>";
    };
    const mm = Math.floor(S.t / 60), ss = Math.floor(S.t % 60);
    const out = S.victims.filter((v) => v.out).length, found = S.victims.filter((v) => v.found).length;
    $("#hud").innerHTML = g(0, "Toi") + g(1, "Équipier") +
      '<div class="rsv-kpi"><span>Temps</span><b>' + mm + ":" + String(ss).padStart(2, "0") + '</b></div><div class="rsv-kpi"><span>Victimes</span><b>' + out + "/" + S.victims.length + (found > out ? " (" + (found - out) + " trouvée" + (found - out > 1 ? "s" : "") + ")" : "") + "</b></div>" +
      '<div class="rsv-kpi rsv-fat"><span>Essoufflement</span><div class="rsv-gbar"><i style="width:' + S.fat + "%;background:" + (S.fat > 60 ? "var(--red)" : "#E07800") + '"></i></div></div>';
    const i = here(), v = S.victims[i], b = adjBlocked(), onExit = cellOf(S.pos.x, S.pos.y) === EXIT;
    const btn = (id, icon, label, on) => '<button class="btn' + (on ? " hot" : "") + '" data-a="' + id + '">' + icon + " " + label + "</button>";
    let h = btn("camera", "📷", "Caméra", false) + btn("pause", "⏸", "Pause", S.fat > 50 || S.ess);
    if (b) h += btn("force", "🪓", "Forcer la porte", true);
    if (v && !v.cagoule) h += btn("cagoule", "🎭", "Cagoule", true);
    if (v && S.carry < 0) h += btn("take", "🧍", v.conscious ? "Guider la victime" : "Évacuer la victime", !!v.cagoule);
    if (onExit && S.carry < 0 && S.t > 0) h += btn("finish", "🚪", "Terminer l'engagement", S.sifflet);
    $("#bar").innerHTML = h;
    const acts = { camera, pause, force, cagoule, take, finish };
    $("#bar").querySelectorAll("[data-a]").forEach((x) => { x.onclick = () => acts[x.dataset.a](); });
    draw();
  }
  let geo = null;
  function cellAt(cx, cy) {
    if (!geo) return null;
    const a = Math.floor((cx - geo.left - geo.ox) / geo.cs), b = Math.floor((cy - geo.top - geo.oy) / geo.cs);
    const x = geo.tr ? b : a, y = geo.tr ? a : b;
    return x >= 0 && y >= 0 && x < S.m.W && y < S.m.H ? { x, y } : null;
  }
  function draw() {
    const cv = $("#cv"), stage = $("#stage"); if (!cv || !stage || !S) return;
    const { W, H } = S.m, rect = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    // Écran en portrait et plan en largeur : on affiche le plan pivoté pour qu'il remplisse l'écran
    const tr = W > H && rect.height > rect.width * 1.15, DW = tr ? H : W, DH = tr ? W : H;
    const cs = Math.max(8, Math.floor(Math.min(rect.width / DW, rect.height / DH)));
    const ox = Math.floor((rect.width - cs * DW) / 2), oy = Math.floor((rect.height - cs * DH) / 2);
    const PX = (x, y) => ox + (tr ? y : x) * cs, PY = (x, y) => oy + (tr ? x : y) * cs;
    geo = { left: rect.left, top: rect.top, cs, ox, oy, tr };
    cv.width = rect.width * dpr; cv.height = rect.height * dpr; cv.style.width = rect.width + "px"; cv.style.height = rect.height + "px";
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0B0D10"; g.fillRect(0, 0, rect.width, rect.height);
    // Emprise du bâtiment : quadrillage discret sur les zones encore inconnues
    g.fillStyle = "#15181E"; g.fillRect(ox, oy, cs * DW, cs * DH);
    g.strokeStyle = "rgba(255,255,255,.05)"; g.lineWidth = 1;
    for (let x = 0; x <= DW; x++) { g.beginPath(); g.moveTo(ox + x * cs + .5, oy); g.lineTo(ox + x * cs + .5, oy + cs * DH); g.stroke(); }
    for (let y = 0; y <= DH; y++) { g.beginPath(); g.moveTo(ox, oy + y * cs + .5); g.lineTo(ox + cs * DW, oy + y * cs + .5); g.stroke(); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!S.seen[i]) continue;
      const v = S.c[i], vis = S.vis[i], X = PX(x, y), Y = PY(x, y);
      const base = { [WALL]: "#3A3F46", [FLOOR]: "#C9C2B3", [DOOR]: "#C9C2B3", [CLOSED]: "#8B5A2B", [BLOCKED]: "#6B1F1F", [FIRE]: "#E85D04", [OBST]: "#7A6A55", [EXIT]: "#23964A" }[v];
      g.fillStyle = base; g.fillRect(X, Y, cs, cs);
      if (v === DOOR) { g.fillStyle = "#8B5A2B"; const hor = S.c[i - 1] === WALL || S.c[i + 1] === WALL; if (hor !== tr) g.fillRect(X, Y, cs * 0.18, cs); else g.fillRect(X, Y, cs, cs * 0.18); }
      if (v === BLOCKED) { g.strokeStyle = "#FFC400"; g.lineWidth = 2; g.beginPath(); g.moveTo(X + cs * .25, Y + cs * .25); g.lineTo(X + cs * .75, Y + cs * .75); g.moveTo(X + cs * .75, Y + cs * .25); g.lineTo(X + cs * .25, Y + cs * .75); g.stroke(); }
      if (v === OBST) { g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1; for (let k = -cs; k < cs; k += cs / 3) { g.beginPath(); g.moveTo(X + k, Y + cs); g.lineTo(X + k + cs, Y); g.stroke(); } }
      if (v === FIRE) { g.font = Math.floor(cs * .8) + "px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("🔥", X + cs / 2, Y + cs / 2 + 1); }
      if (v === EXIT) { g.fillStyle = "#fff"; g.font = "bold " + Math.floor(cs * .45) + "px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("⇲", X + cs / 2, Y + cs / 2); }
      if (S.m.heat[i] && v !== FIRE && v !== WALL) { g.fillStyle = "rgba(232,93,4,.22)"; g.fillRect(X, Y, cs, cs); }
      if (!vis) { g.fillStyle = "rgba(20,22,26,.55)"; g.fillRect(X, Y, cs, cs); }
      g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 1; g.strokeRect(X + .5, Y + .5, cs - 1, cs - 1);
    }
    const dot = (x, y, r, fill, stroke) => { g.beginPath(); g.arc(PX(x, y) + cs / 2, PY(x, y) + cs / 2, r, 0, 7); g.fillStyle = fill; g.fill(); if (stroke) { g.lineWidth = 2; g.strokeStyle = stroke; g.stroke(); } };
    S.victims.forEach((v, k) => {
      if (!v.found || v.out || k === S.carry) return;
      dot(v.x, v.y, cs * .32, v.cagoule ? "#FF8C1A" : "#FFC400", "#16181D");
      g.fillStyle = "#16181D"; g.font = "bold " + Math.floor(cs * .4) + "px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", PX(v.x, v.y) + cs / 2, PY(v.x, v.y) + cs / 2 + 1);
    });
    if (S.prev.x !== S.pos.x || S.prev.y !== S.pos.y) dot(S.prev.x, S.prev.y, cs * .24, "#1F5FBF", "#fff");
    dot(S.pos.x, S.pos.y, cs * .34, "#C1121F", "#fff");
    if (S.carry >= 0) dot(S.pos.x + .28, S.pos.y - .28, cs * .18, S.victims[S.carry].cagoule ? "#FF8C1A" : "#FFC400", "#16181D");
  }

  /* ----- Fin de partie ----- */
  function end(kind, who) {
    if (S.over) return;
    S.over = true; stopWalk();
    const saved = S.victims.filter((v) => v.out).length, total = S.victims.length, carried = S.victims.filter((v) => v.out || S.victims.indexOf(v) === S.carry);
    let score = 0;
    const L = [];
    if (kind === "panne") {
      L.push("**Panne d'air** : " + (who ? "ton équipier n'avait" : "tu n'avais") + " plus d'air. Il fallait engager le retour bien plus tôt : aller, mission… **et retour**.");
    } else {
      score += Math.round(50 * saved / total);
      score += Math.max(0, 20 - S.ignored * 4);
      if (carried.length) score += Math.max(0, 15 - S.wrongCag * 8 - S.noCag * 8);
      const minP = Math.min(S.p[0] - S.m.thr[0], S.p[1] - S.m.thr[1]);
      score += minP >= 0 ? 15 : 5;
      score = Math.min(100, score + S.bonus);
      if (saved === total) L.push("Toutes les victimes ont été mises en sécurité. Bravo !");
      else if (saved) L.push(saved + " victime sur " + total + " sortie. Il fallait peut-être mieux gérer l'air ou demander un autre binôme.");
      else L.push("Aucune victime sortie, mais le binôme est ressorti vivant : **mieux vaut ressortir que tomber en panne d'air**. Un autre binôme prendra le relais.");
      if (S.ignored) L.push("Après le sifflet, vous vous êtes encore **éloignés de la sortie** (" + S.ignored + " pas). Le sifflet impose un **retour immédiat**.");
      if (minP < 0) L.push("Vous êtes ressortis **après le sifflet**. Anticipez le retour : la phase de retour peut commencer avant le sifflet.");
    }
    if (S.wrongCag) L.push("La cagoule était branchée sur l'ARI qui avait **le moins d'air**. Elle se met sur l'ARI qui a **la plus grande autonomie**.");
    if (S.noCag) L.push("Victime évacuée **sans cagoule d'évacuation** : elle a respiré les fumées pendant tout le trajet.");
    if (S.bonus) L.push("Calcul d'autonomie juste au point de situation : +5.");
    progress.saveGame(mod.id, "reserve", score);
    kind === "panne" ? SND.bad() : SND.win();
    const mm = Math.floor(S.t / 60), ss = Math.floor(S.t % 60);
    app.innerHTML = '<div class="screen qscreen">' + gameBar({ badge: "Réserve d'air", color: COLOR, label: S.m.type.titre }) +
      '<main><div class="panel result" style="border-top-color:' + (kind === "panne" ? "var(--red)" : score >= 70 ? "var(--ok)" : "var(--fire)") + '">' +
      "<h1>" + (kind === "panne" ? "Panne d'air…" : saved === total ? "Mission réussie !" : "Binôme ressorti") + "</h1>" +
      '<div class="score">' + score + "<span>/100</span></div>" +
      '<div class="kpis"><div class="kpi"><b>' + saved + "/" + total + '</b><span>Victimes sorties</span></div><div class="kpi"><b>' + Math.max(0, Math.round(S.p[0])) + " / " + Math.max(0, Math.round(S.p[1])) + '</b><span>Bars restants (toi / équipier)</span></div><div class="kpi"><b>' + mm + " min " + String(ss).padStart(2, "0") + '</b><span>Durée</span></div></div>' +
      '<div class="blk blk-key" style="text-align:left"><h3>' + ic("target") + "Débriefing</h3><ul>" + L.map((x) => "<li><span>" + fmt(x) + "</span></li>").join("") + "</ul></div>" +
      '<p class="muted small">Plan n° ' + S.m.seed + " : donnez ce numéro aux autres pour jouer le même bâtiment.</p>" +
      '<div class="row"><button class="btn big" style="background:' + COLOR + ';color:#fff" id="again">' + ic("reset") + "Rejouer ce plan</button>" +
      '<button class="btn big" id="new">' + ic("play") + 'Nouvelle intervention</button><button class="btn big dark" id="home">' + ic("back") + "Retour au module</button></div></div></main></div>";
    bindBar(app, exit);
    const seed = S.m.seed;
    $("#again").onclick = () => briefing(seed);
    $("#new").onclick = () => briefing(randomPlan());
    $("#home").onclick = exit;
  }

  briefing(randomPlan());
  return cleanup;
}
