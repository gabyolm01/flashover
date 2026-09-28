/* Jeu exclusif TASSS : « Mayday ! ». Piégé sous ARI : faire le point, passer son message de détresse (NELAR)
   à la radio, puis tenir jusqu'aux secours (AAALEERTER). Scénarios générés à partir d'un numéro (1 à 999). */
import { ic, esc, fmt } from "../ui.js";
import { progress } from "../progress.js";
import { SND } from "./engine.js";
import { gameBar, bindBar } from "./common.js";

const COLOR = "#C1121F";
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const R = (a) => a[Math.floor(Math.random() * a.length)];
const fmtT = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- Générateur de scénarios ---------- */
const BAT = [
  { t: "Feu de pavillon", lv: ["rez-de-chaussée", "1er étage"], rooms: [["la cuisine", "carrelage au sol, un plan de travail, une hotte"], ["le séjour", "un canapé, une table basse"], ["une chambre", "un lit, une armoire"], ["la salle de bain", "une baignoire, du carrelage mural"], ["le garage", "un sol en béton, une voiture"]], img: "media/tasss/scene-effondrement.webp" },
  { t: "Feu d'appartement", lv: ["1er étage", "2e étage", "3e étage", "4e étage"], rooms: [["le séjour", "un canapé, un meuble télé"], ["une chambre", "un lit, une commode"], ["la cuisine", "carrelage, un évier, une hotte"], ["le couloir de l'appartement", "un couloir étroit, plusieurs portes"], ["l'entrée", "un portemanteau, la porte palière"]], img: "media/ari/scene-porte.webp" },
  { t: "Feu de caves", lv: ["sous-sol"], rooms: [["le couloir des caves", "des portes grillagées de chaque côté"], ["la chaufferie", "le ronflement d'une chaudière, une porte métallique"], ["le local vélos", "des cadres de vélos sous tes mains"], ["le local poubelles", "des conteneurs en plastique"]], img: "media/tasss/scene-fumee.webp" },
  { t: "Feu d'entrepôt", lv: ["rez-de-chaussée"], rooms: [["l'allée des racks", "des montants métalliques de racks"], ["la zone du quai de chargement", "une porte sectionnelle, un sol en béton lisse"], ["la zone de préparation", "des palettes filmées"], ["le bureau de l'entrepôt", "un bureau, une vitre"]], img: "media/ari/scene-genoux.webp" },
  { t: "Feu d'établissement industriel", lv: ["rez-de-chaussée", "la mezzanine"], rooms: [["l'atelier de production", "des machines, un sol gras"], ["le local compresseur", "le bruit d'un compresseur"], ["les vestiaires", "des casiers métalliques"], ["la zone de stockage des matières", "des fûts et des sacs"]], img: "media/tasss/scene-embrasement.webp" },
  { t: "Feu de bureaux", lv: ["rez-de-chaussée", "1er étage", "2e étage"], rooms: [["l'open space", "des bureaux alignés, des chaises à roulettes"], ["le bureau du fond", "un bureau, une fenêtre"], ["la salle de réunion", "une grande table, des chaises"], ["le local archives", "des étagères chargées de cartons"]], img: "media/tasss/scene-projecteur.webp" },
  { t: "Feu dans un hôtel", lv: ["1er étage", "2e étage", "3e étage"], rooms: [["la chambre 12", "un lit, une salle d'eau"], ["la chambre 27", "deux lits, un bureau"], ["le couloir des chambres", "une moquette, des portes numérotées"], ["la lingerie", "des étagères de draps"]], img: "media/ari/scene-fenetre.webp" },
  { t: "Feu dans une maison de retraite", lv: ["rez-de-chaussée", "1er étage"], rooms: [["une chambre de résident", "un lit médicalisé, une barre d'appui"], ["la salle à manger", "des tables, des chaises"], ["le couloir", "une main courante le long du mur"]], img: "media/ari/scene-chef.webp" },
  { t: "Feu de parking souterrain", lv: ["niveau -1", "niveau -2"], rooms: [["l'allée centrale", "des voitures garées de chaque côté"], ["le bas de la rampe", "une pente en béton"], ["le local technique", "des armoires électriques"]], img: "media/tasss/scene-fumee.webp" }
];
// Chaque incident : blessure (probabilité), coincé, ligne de vie possible, équipier, texte
const INC = [
  { id: "plancher", t: "Chute à travers un plancher", hurt: 0.8, stuck: 0, life: [null], mate: "resté au niveau supérieur", fall: true,
    txt: "Le plancher cède sous toi : tu chutes au niveau inférieur. Ton équipier est resté en haut, tu ne l'entends plus.", env: "Des gravats autour de toi. Au-dessus, le trou dans le plancher : ça peut encore tomber." },
  { id: "plafond", t: "Effondrement d'un faux plafond", hurt: 0.3, stuck: 0, life: [null, "tuyau"], mate: "de l'autre côté des gravats",
    txt: "Un faux plafond s'effondre entre ton équipier et toi. Vous êtes séparés par un amas de gravats et de câbles.", env: "Des câbles pendent autour de toi. Le reste du plafond craque." },
  { id: "desorient", t: "Désorienté dans la fumée", hurt: 0, stuck: 0, life: [null], mate: "introuvable",
    txt: "Ta liaison personnelle s'est décrochée dans un passage encombré. Tu as tourné plusieurs fois : tu ne sais plus d'où tu viens, et ton équipier ne répond plus.", env: "Fumée dense, mais pas de flammes visibles autour de toi." },
  { id: "ligne", t: "Ligne guide perdue", hurt: 0, stuck: 0, life: [null], mate: "introuvable", only: ["Feu d'entrepôt", "Feu d'établissement industriel", "Feu de parking souterrain", "Feu de bureaux"],
    txt: "En contournant un obstacle, tu as lâché la ligne guide. En la cherchant, tu t'es éloigné de ton équipier.", env: "Fumée dense. Le volume est grand, tu ne touches aucun mur." },
  { id: "porte", t: "Porte refermée derrière toi", hurt: 0, stuck: 0, life: [null, "tuyau"], mate: "de l'autre côté de la porte",
    txt: "Un courant d'air a claqué la porte derrière toi. La poignée ne répond plus, ton équipier est resté de l'autre côté.", env: "La chaleur monte doucement. La porte est brûlante." },
  { id: "coince", t: "Jambe coincée", hurt: 1, stuck: 1, life: [null], mate: "parti chercher de l'aide",
    txt: "Une étagère lourdement chargée s'est renversée : ta jambe est coincée dessous. Impossible de te dégager seul.", env: "Des objets continuent de tomber autour de toi." },
  { id: "escalier", t: "Chute dans l'escalier", hurt: 0.9, stuck: 0, life: [null, "ligne"], mate: "introuvable", fall: true, room: ["le bas de l'escalier", "des marches derrière toi, une rampe"],
    txt: "Tu as raté une marche en descendant : tu as dévalé l'escalier. Ton équipier ne répond plus.", env: "Tu es en bas des marches. La fumée descend par la cage d'escalier." },
  { id: "separe", t: "Séparé de ton équipier", hurt: 0, stuck: 0, life: ["tuyau", "tuyau", "ligne"], mate: "introuvable",
    txt: "Une explosion de fumée vous a désorientés : ton équipier et toi avez été séparés.", env: "La chaleur monte, mais le chemin derrière toi n'est pas en feu." }
];
const NOMS = ["Martin", "Bernard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefèvre", "Michel", "Garcia", "Roux", "Fournier", "Girard", "Bonnet", "Dupont", "Lambert", "Fontaine", "Rousseau", "Blanc", "Guérin", "Muller", "Henry", "Perrin", "Morel"];
const GRADES = ["Sapeur", "Caporal", "Caporal-chef", "Sergent", "Sergent-chef"];
const CIS = ["Olivet", "Orléans-Centre", "Orléans-Nord", "Orléans-Sud", "Montargis", "Gien", "Pithiviers", "Saran", "Fleury-les-Aubrais", "Meung-sur-Loire", "Beaugency", "Briare", "Châteauneuf-sur-Loire", "Jargeau", "Sully-sur-Loire", "Malesherbes", "Neuville-aux-Bois", "Courtenay"];
const PARTS = ["à la cheville", "au genou", "au poignet", "à l'épaule"];
const FACES = ["A", "B", "C", "D"];
const au = (lv) => (lv.startsWith("la ") ? "sur " : "au ") + lv;

export function scenario(n, shown) {
  const r = rng(n * 104729 + 7), pick = (a) => a[Math.floor(r() * a.length)];
  const B = pick(BAT);
  let I = pick(INC);
  while (I.only && !I.only.includes(B.t)) I = pick(INC);
  let lvI = Math.floor(r() * B.lv.length);
  if (I.fall && B.lv.length < 2) return scenario(n + 1000, shown || n);
  if (I.fall && lvI === 0) lvI = 1;
  const from = B.lv[lvI], lvl = I.fall ? B.lv[lvI - 1] : from;
  const [room, clue] = I.room || pick(B.rooms), F = pick(FACES);
  const hurt = r() < I.hurt, part = pick(PARTS), stuck = !!I.stuck, life = pick(I.life);
  const grade = pick(GRADES), nom = grade + " " + pick(NOMS), chef = grade.startsWith("S") && grade !== "Sapeur";
  const role = (chef ? "chef" : "équipier") + " du binôme " + pick(["d'attaque", "de reconnaissance"]);
  const cis = pick(CIS), engin = "FPT " + cis, others = CIS.filter((c) => c !== cis);
  const p = 5 * Math.round((90 + r() * 135) / 5), eta = 240 + Math.floor(r() * 240);
  const decision = !hurt && !stuck && life && p >= 150 ? "evacuer" : "attendre";
  const lifeTxt = life === "tuyau" ? "le tuyau" : "la ligne guide";
  const faceKO = FACES.filter((f) => f !== F);
  const lieuOK = [lvl + ", face " + F + ", " + room.replace(/^(la |le |les |une |un |l')/, ""), lvl + " face " + F + ", dans " + room];
  const lieuKO = [lvl + ", face " + pick(faceKO) + ", " + room.replace(/^(la |le |les |une |un |l')/, ""), (I.fall ? from : B.lv.find((x) => x !== lvl) || "rez-de-chaussée") + ", face " + F, "dans le bâtiment", "quelque part " + au(lvl)];
  const mateTxt = "ton équipier est " + I.mate;
  const infoOK = [hurt ? "je suis blessé " + part : "je suis indemne", stuck ? "j'ai la jambe coincée" : "j'ai perdu mon équipier", life ? (life === "tuyau" ? "j'ai la lance en main" : "je tiens la ligne guide") : "je n'ai ni tuyau ni ligne guide"];
  const infoKO = [hurt ? "je suis indemne" : "je suis blessé " + part, "mon équipier est avec moi", "le feu est éteint", life ? "je n'ai aucune ligne de vie" : "je tiens la ligne guide"];
  const Rok = decision === "evacuer"
    ? ["je m'évacue en suivant " + lifeTxt + ", envoyez un binôme à ma rencontre", "je tente une évacuation par " + lifeTxt + ", demande un binôme de sécurité avec réserve d'air"]
    : ["je demande le binôme de sécurité avec une réserve d'air", stuck ? "je demande un binôme de sauvetage avec des outils de dégagement" : "je demande un binôme de sauvetage avec une sangle d'extraction", "demande assistance respiratoire et moyen d'extraction"];
  const Rko = decision === "evacuer" ? ["je reste sur place, j'attends", "pas besoin de renfort", "envoyez une échelle aérienne face " + pick(faceKO)] : ["pas besoin de renfort", "je m'évacue seul", "envoyez une échelle aérienne face " + pick(faceKO)];
  const reasons = [];
  if (hurt) reasons.push("tu es blessé " + part); if (stuck) reasons.push("tu es coincé"); if (!life) reasons.push("tu n'as ni tuyau ni ligne guide pour te guider"); if (p < 150) reasons.push("ton air est limité (" + p + " bars)");
  const why = decision === "evacuer"
    ? "Pas de blessure, " + lifeTxt + " pour te guider vers l'extérieur et " + p + " bars : tu peux t'évacuer en suivant " + lifeTxt + ", en alertant quand même."
    : "Ici, " + reasons.join(", ") + " : tenter de sortir seul serait un effort intense et risqué. Tu alertes, tu te signales et tu économises l'air en attendant les secours.";
  return {
    n: shown || n, img: B.img, titre: B.t + " · " + I.t, nom, role, engin, enginKO: ["VSAV " + cis, "FPT " + pick(others), "EPA " + cis],
    intro: (I.fall ? "Engagé " + au(from) + ". " : "Engagé " + au(lvl) + ". ") + I.txt + " Fumée épaisse, visibilité nulle.",
    lieuOK, lieuKO, infoOK, infoKO, Rok, Rko, p, eta, decision, why,
    eval: [
      { q: "Suis-je blessé ?", r: stuck ? "Ta jambe est coincée et te fait mal : impossible de te dégager seul." : hurt ? "Une douleur violente " + part + " : tu as du mal à bouger." : "Non, rien de cassé." },
      { q: "L'environnement ?", r: I.env },
      { q: "Mon air ?", r: "Ton manomètre affiche {p} bars." },
      { q: "Un contact ?", r: "Ta radio fonctionne. " + (life === "tuyau" ? "Tu tiens toujours la lance : le tuyau te ramène vers l'extérieur." : life === "ligne" ? "Tu as la main sur la ligne guide : elle mène au point de pénétration." : "Aucun tuyau, aucune ligne guide à portée de main.") + " " + mateTxt.charAt(0).toUpperCase() + mateTxt.slice(1) + "." },
      { q: "Où suis-je ?", r: "Autour de toi : " + clue + ". Tu es dans " + room + ", " + au(lvl) + ", côté façade " + F + "." }
    ]
  };
}

/* ---------- Choix détaillés des actions (qualité : 2 bon, 1 moyen, 0 erreur) ---------- */
const CH = {
  eclairer: { t: "🔦 Éclairer", q: "Comment utilises-tu ton projecteur ?", o: [
    ["L'allumer et l'orienter vers l'arrivée probable des secours", 2, "Le faisceau guide le binôme de sauvetage vers toi."],
    ["L'allumer, faisceau vers la porte par laquelle tu es entré", 2, "Les secours viendront sans doute par là."],
    ["L'allumer, posé au sol, faisceau vers le plafond", 1, "Visible, mais le faisceau se perd dans la fumée épaisse en hauteur."],
    ["L'allumer et le pointer vers ton visage pour qu'on te voie", 0, "Tu t'éblouis et le faisceau ne porte pas."],
    ["Le laisser éteint pour économiser la batterie", 0, "Éclairer, c'est se signaler : on l'allume."]] },
  sol: { t: "⬇️ Rester près du sol", q: "Quelle position adoptes-tu ?", o: [
    ["Allongé sur le flanc, le corps perpendiculaire au mur", 2, "Position basse, air plus frais, et les secours qui longent le mur te trouvent."],
    ["Semi-allongé au pied du mur", 2, "Position de récupération économe en oxygène, contre un mur."],
    ["Assis au sol contre le mur, jambes sur les côtés", 2, "Position de récupération économe, au contact d'un mur."],
    ["Accroupi, prêt à bouger", 1, "Plus bas, mais position fatigante : tu consommes davantage."],
    ["À plat ventre au milieu de la pièce", 0, "Loin des murs : les secours qui longent les murs risquent de te manquer."],
    ["Debout, dos au mur", 0, "Debout, tu es dans la fumée la plus chaude et la plus dense."]] },
  taper: { t: "🔨 Taper", q: "Comment te signales-tu par le bruit ?", o: [
    ["Frapper une canalisation métallique avec ton outil, par séries, puis écouter", 2, "Le métal porte loin, et les pauses permettent d'entendre une réponse."],
    ["Frapper un radiateur ou une structure métallique avec la Halligan", 2, "Bruit fort et reconnaissable."],
    ["Taper le sol avec la main", 1, "Peu de bruit : ça porte mal."],
    ["Taper sans arrêt, le plus fort possible", 0, "Tu t'épuises et tu consommes beaucoup d'air."],
    ["Frapper le robinet de ta bouteille avec l'outil", 0, "Tu risques d'endommager ton robinet… ou de le fermer."]] },
  air: { t: "🫁 Économiser l'air", q: "Quelle technique de respiration ?", o: [
    ["Méthode 2/4 : inspirer 2 s, expirer 4 s", 2, "Expiration plus longue que l'inspiration : la consommation baisse."],
    ["Intervalle : inspirer 5 s, retenir 5 s, expirer 5 s, retenir 5 s", 2, "Rythme lent et régulier."],
    ["Méthode Reilly : expirer lentement en bourdonnant", 2, "Le bourdonnement ralentit l'expiration."],
    ["Sauter une respiration : inspirer, retenir jusqu'au seuil, expirer lentement", 2, "Technique d'économie d'air du GTO."],
    ["Inspirer 4 s, expirer 2 s", 0, "C'est l'inverse de la méthode 2/4 : l'expiration doit être la plus longue."],
    ["Retenir sa respiration le plus longtemps possible, puis reprendre de grandes inspirations", 0, "Les grandes inspirations qui suivent annulent le gain et essoufflent."],
    ["Respirer par petites inspirations rapides", 0, "Respiration rapide : la consommation augmente."]] },
  explorer: { t: "✋ Explorer", q: "Comment explores-tu autour de toi ?", o: [
    ["Balayer le sol autour de toi à la recherche d'un tuyau", 2, "Un tuyau est une ligne de vie vers l'extérieur."],
    ["Longer le mur à portée de main pour trouver un ouvrant", 2, "Une fenêtre peut devenir un itinéraire de secours."],
    ["Partir explorer les pièces voisines", 0, "Tu quittes la position que tu as annoncée à la radio : les secours te cherchent au mauvais endroit."],
    ["Te relever pour tâter le plafond", 0, "Debout, tu es dans la fumée la plus chaude."]] },
  balise: { t: "🔔 Balise", q: "Que fais-tu avec ta balise sonore de localisation ?", o: [
    ["Déclencher l'alarme manuelle", 2, "L'alarme complète retentit tout de suite."],
    ["Rester immobile pour qu'elle se déclenche seule", 1, "Elle finira par sonner (pré-alarme après 25 s), mais tu perds du temps."],
    ["L'éteindre pour mieux entendre la radio", 0, "Sans balise, les secours ne peuvent pas te localiser au son."]] },
  robinet: { t: "🔧 Robinet", q: "Que fais-tu avec le robinet de ta bouteille ?", o: [
    ["Ouvrir ¼ de tour et inspirer, fermer et retenir, expirer lentement, recommencer", 2, "Technique de gestion de fuite (et de fin d'autonomie, pour éviter le débit du sifflet)."],
    ["Le fermer complètement pour garder l'air", 0, "Plus aucun air n'arrive au masque."],
    ["L'ouvrir en grand et appuyer sur le by-pass", 0, "Tu vides la bouteille."]] }
};
const TILES = [["balise", "🔔 Balise", "Alarme sonore de localisation"], ["sol", "⬇️ Rester près du sol", "Choisir une position"], ["eclairer", "🔦 Éclairer", "Utiliser le projecteur"], ["taper", "🔨 Taper", "Se signaler par le bruit"],
  ["air", "🫁 Économiser l'air", "Technique de respiration"], ["explorer", "✋ Explorer", "Autour de toi"], ["robinet", "🔧 Robinet", "Agir sur le robinet"], ["pack", "🎒 Auto-packaging", "Sangle ventrale sous la cuisse"],
  ["cagoule", "🎭 Remonter la cagoule", "Retirer la SAD"], ["radio", "📻 Radio", "Passer un point de situation"], ["bypass", "💨 By-pass", "Appuyer sur le by-pass"], ["crier", "📢 Appeler à l'aide", "Crier pour qu'on t'entende"]];
// Rubriques de la radio, par ordre alphabétique : aucun indice sur l'ordre du NELAR
const GROUPS = [["Demandes", ["R"]], ["Identification", ["N", "E"]], ["Infos complémentaires", ["info"]], ["Localisation", ["L"]], ["Pression restante", ["A"]], ["Procédure radio", ["open", "radio"]]];

export function startMaydayGame(ctx) {
  const { app, mod } = ctx;
  let G = null, modalOpen = false, lastTick = Date.now();
  const $ = (s) => app.querySelector(s);
  document.documentElement.classList.add("noscroll");
  const timer = setInterval(tick, 250);
  const cleanup = () => { clearInterval(timer); closeModal(); document.documentElement.classList.remove("noscroll"); };
  const exit = () => { cleanup(); ctx.exit(); };
  const H = {}; // actions des boutons (data-a / data-v)
  const bind = (root) => root.querySelectorAll("[data-a]").forEach((b) => { b.onclick = () => H[b.dataset.a](b.dataset.v); });

  function start(n) {
    const s = scenario(n || 1 + Math.floor(Math.random() * 999));
    G = { s, p: s.p, v: R([6, 7]), t: 0, eta: s.eta, phase: "brief", log: [], on: {}, seenEval: {}, noAns: 0, cosOK: false, waiting: false,
      sos: false, sosOn: false, sosT: 0, balise: false, cagoule: false, sif: false, fuite: false, ev: [], errors: [], good: [], stress: 0, nextEv: 90 + Math.random() * 90 };
    closeModal(); brief();
  }
  const speed = () => { if (!G) return 0; if (modalOpen) return G.phase === "survie" || G.phase === "radio" ? 1 : 0; return { radio: 2, survie: 6 }[G.phase] || 0; };
  function conso() {
    if (!G || (G.cagoule && G.p <= 0)) return 0;
    let c = 90 + G.stress * 15;
    if (G.phase === "survie") {
      const q = (k) => (G.on[k] ? G.on[k].q : -1);
      if (q("sol") === 2) c *= 0.85; else if (q("sol") === 1) c *= 0.95;
      if (q("air") === 2) c *= 0.45; else if (q("air") === 0) c *= 1.2;
      if (q("taper") === 0) c *= 1.2;
    }
    const rob = G.on.robinet && G.on.robinet.q === 2;
    if (G.sif && !rob) c += 6;
    if (G.fuite) c += rob ? 8 : 70;
    return c;
  }
  function tick() {
    const now = Date.now(), dt = Math.min(1, (now - lastTick) / 1000); lastTick = now;
    const sp = speed(); if (!sp) return;
    const sec = sp * dt;
    G.p -= conso() * sec / 60 / G.v; G.t += sec;
    if (G.sosOn) {
      G.sosT = (now - G.sosStart) / 1000;
      if (G.sosT >= 5) { G.sosOn = false; G.sos = true; G.good.push("Touche SOS déclenchée (appui de 5 s)."); radioScreen("SOS émis. Sonnerie…<br><b>« De CODIS, identifiez-vous et parlez. »</b>"); } else renderRadio();
    }
    if (G.phase === "survie" && !modalOpen) {
      const aid = (k) => (G.on[k] ? [0, 0.5, 1][G.on[k].q] : 0);
      G.eta -= sec * (1 + 0.3 * (aid("balise") + aid("eclairer") + aid("taper") + aid("sol") * 0.5));
      if (G.t >= G.nextEv) imprevu();
    }
    if (!G.sif && G.p <= 55) { G.sif = true; SND.bad(); logm("🔔 Ton sifflet de fin de charge retentit : il consomme de l'air en continu."); }
    if (G.p <= 0 && !G.cagoule) { G.p = 0; return lastAir(); }
    if (G.cagoule && G.p <= 0) { G.intox = (G.intox || 0) + sec; if (G.intox > 150) return end("intox"); }
    if (G.phase === "survie" && G.eta <= 0) return end("sauve");
    paintHud();
  }
  function hudHTML() {
    if (!G || G.phase === "fin") return "";
    const col = G.p <= 55 ? "var(--red)" : G.p < 100 ? "#E07800" : "var(--ok)";
    const sp = speed(), vit = sp ? (sp === 1 ? " · ralenti" : " × " + sp) : "";
    return '<div><span>Manomètre</span><b style="color:' + col + '">' + Math.max(0, Math.round(G.p)) + ' bar</b></div><div><span>Conso</span><b>' + Math.round(conso()) + ' L/min</b></div><div><span>Temps' + vit + "</span><b>" + fmtT(G.t) + "</b></div><div><span>Secours</span><b>" + (G.cosOK || G.sos ? "~ " + Math.max(0, Math.ceil(G.eta / 60)) + " min" : "non alertés") + "</b></div>";
  }
  function paintHud() { const h = $("#mhud"); if (h) h.innerHTML = hudHTML(); }
  function frame(inner) {
    app.innerHTML = '<div class="screen mdy">' + gameBar({ badge: "Mayday !", color: COLOR, label: G ? G.s.titre : mod.title }) +
      '<div class="mdy-hud" id="mhud">' + hudHTML() + '</div><div class="mdy-main">' + inner + "</div></div>";
    bindBar(app, () => (G && G.phase !== "brief" && G.phase !== "fin" ? modal("Quitter ?", "<p>La partie en cours sera perdue.</p>", [["Quitter", exit, "red"], ["Continuer", () => { if (G.phase === "survie") renderSurvie(); }]]) : exit()));
    bind(app);
  }
  function logm(t) { G.log.push("[" + fmtT(G.t) + "] " + t); const l = $("#mlog"); if (l) l.innerHTML = G.log.slice(-10).reverse().map((x) => "<div>" + x + "</div>").join(""); }

  /* ----- 1. Briefing ----- */
  function brief() {
    const s = G.s;
    frame('<div class="mdy-scene" style="background-image:url(\'' + esc(s.img) + '\')"><span>Scénario n° ' + s.n + "</span></div><h1>" + esc(s.titre) + '</h1><div class="mdy-card"><p>' + esc(s.intro) + "</p><p>Tu es <b>" + esc(s.nom) + "</b>, " + esc(s.role) + " du <b>" + esc(s.engin) + "</b>. Bouteille de " + G.v + " L.</p></div>" +
      "<p>Réagis comme en intervention : <b>faire le point, alerter, tenir</b> jusqu'à l'arrivée du binôme de sauvetage.</p>" +
      '<details class="rsv-rules"><summary>' + ic("help") + " Comment jouer</summary><ul>" +
        "<li><b>Faire le point</b> : touche les questions (5 s chacune), puis décide.</li>" +
        "<li><b>Radio</b> : « Appuyer sur l'alternat », compose ton message avec les étiquettes, puis « Relâcher ». Le COS répond… ou pas. Balise et touche SOS sont toujours disponibles.</li>" +
        "<li><b>Tenir</b> : le temps défile (× 6). Chaque action ouvre un choix, pendant lequel le temps ralentit. Plusieurs réponses peuvent être justes.</li>" +
        "<li>Des <b>imprévus</b> arrivent. Si la bouteille est vide : dernier recours.</li></ul></details>" +
      '<div class="row" style="margin-top:14px"><button class="btn big red" data-a="eval">' + ic("play") + 'C\'est parti</button><button class="btn big" data-a="other">' + ic("reset") + "Autre scénario</button></div>");
  }
  H.other = () => start();
  /* ----- 2. Faire le point ----- */
  H.eval = () => {
    G.phase = "eval"; const s = G.s;
    frame('<h2 class="mdy-h">① Faire le point</h2><p>Touche chaque question pour évaluer ta situation (5 secondes chacune).</p>' +
      s.eval.map((e, i) => '<button class="mdy-choice' + (G.seenEval[i] ? " seen" : "") + '" data-a="ask" data-v="' + i + '"><b>' + e.q + "</b>" + (G.seenEval[i] ? "<span>" + esc(e.r.replace("{p}", Math.round(G.p))) + "</span>" : "") + "</button>").join("") +
      '<h2 class="mdy-h">Ta décision</h2><div class="mdy-col"><button class="btn big" data-a="decide" data-v="attendre">Alerter et attendre les secours</button><button class="btn big" data-a="decide" data-v="evacuer">Alerter et tenter de m\'évacuer</button><button class="btn big" data-a="decide" data-v="seul">Sortir seul, sans alerter</button></div>');
  };
  H.ask = (i) => { if (G.seenEval[i]) return; G.seenEval[i] = 1; G.p -= 90 * 5 / 60 / G.v; G.t += 5; H.eval(); };
  H.decide = (d) => {
    const s = G.s, n = Object.keys(G.seenEval).length;
    if (n < 3) G.errors.push("Décision prise sans vraiment évaluer la situation (" + n + " question" + (n > 1 ? "s" : "") + " sur 5).");
    if (d === "seul") { G.errors.push("Tenter de sortir seul sans alerter : personne ne saurait où te chercher si ça tourne mal."); d = s.decision; }
    else if (d === s.decision) G.good.push("Bonne décision : " + (d === "attendre" ? "alerter et attendre." : "alerter et s'évacuer."));
    else G.errors.push("Décision discutable. " + s.why);
    G.evac = d;
    modal(d === s.decision ? "Décision juste" : "Réfléchis…", "<p>" + esc(s.why) + "</p>", [["Passer mon message radio", radioPhase, "red"]]);
  };
  /* ----- 3. Radio ----- */
  function labels() {
    const s = G.s, p = Math.round(G.p / 5) * 5, sh = (t) => t.replace(/^(Sapeur|Caporal-chef|Caporal|Sergent-chef|Sergent) /, "");
    const L = [["URGENT, URGENT, URGENT", "open", 1], ["ÉVACUATION, ÉVACUATION, ÉVACUATION", "open", 0], ["MAYDAY, MAYDAY, MAYDAY", "open", 0], ["Allô, allô, ici…", "open", 0], ["URGENT", "open", 0],
      ["Ici " + s.nom, "N", 1], [s.nom + ", " + s.role, "N", 1], ["Ici le chef d'agrès", "N", 0], ["Ici un sapeur-pompier", "N", 0], ["Ici " + sh(s.nom), "N", 0],
      [s.engin, "E", 1], ...s.enginKO.map((e) => [e, "E", 0]),
      ...s.lieuOK.map((l) => [l, "L", 1]), ...s.lieuKO.map((l) => [l, "L", 0]),
      ["il me reste " + p + " bars", "A", 1], ["pression " + p + " bars, bouteille de " + G.v + " litres", "A", 1], ["il me reste " + (p + 60) + " bars", "A", 0], ["j'ai encore de l'autonomie", "A", 0], ["ma bouteille est à moitié", "A", 0], ["il me reste " + Math.round(p * G.v / 100) + " bars", "A", 0]];
    // Demandes : adaptées à la décision prise par le joueur (même si ce n'était pas la meilleure)
    const same = G.evac === s.decision, ev = G.evac === "evacuer";
    const Rok = same ? s.Rok : ev ? ["je m'évacue, envoyez un binôme à ma rencontre", "je tente une évacuation, demande un binôme de sécurité avec réserve d'air"] : ["je demande le binôme de sécurité avec une réserve d'air", "je demande un binôme de sauvetage avec une sangle d'extraction"];
    const Rko = same ? s.Rko : ev ? ["je reste sur place, j'attends", "pas besoin de renfort"] : ["pas besoin de renfort", "je m'évacue seul"];
    Rok.forEach((x) => L.push([x, "R", 1])); Rko.forEach((x) => L.push([x, "R", 0]));
    s.infoOK.forEach((x) => L.push([x, "info", 1])); s.infoKO.forEach((x) => L.push([x, "info", 0]));
    L.push(["à vous", "radio", 1], ["fin de message, terminé", "radio", 1], ["répondez vite", "radio", 0], ["parlez", "radio", 0]);
    return shuffle(L);
  }
  function radioPhase() { G.phase = "radio"; G.msg = []; G.ptt = false; G.lab = labels(); G.screen = "Terminal ANTARES · canal GRP<br>Appuie sur l'alternat pour parler."; renderRadio(); }
  function radioScreen(html) { G.screen = html; renderRadio(); }
  function renderRadio() {
    if (!G || G.phase !== "radio") return;
    const hint = G.noAns >= 2 && !G.sos ? '<span class="hint">💡 Toujours pas de réponse… Un appui de 5 s sur la touche SOS ouvre une communication prioritaire vers le CODIS.</span>' : "";
    const tag = (l, i) => '<button class="mdy-tag' + (G.msg.includes(i) ? " on" : "") + '" ' + (G.msg.includes(i) ? "disabled" : "") + ' data-a="tag" data-v="' + i + '">' + esc(l[0]) + "</button>";
    frame('<h2 class="mdy-h">② Alerter : message de détresse</h2><div class="mdy-radio"><div class="mdy-screen">' + (G.ptt ? '<b>● ÉMISSION</b><br>' + (esc(G.msg.map((i) => G.lab[i][0]).join(" · ")) || "…") : G.screen) + hint + "</div>" +
      '<button class="btn big ' + (G.ptt ? "mdy-y" : "red") + ' mdy-ptt" ' + (G.waiting || G.sosOn ? "disabled" : "") + ' data-a="ptt">' + (G.ptt ? "🎙 Relâcher l'alternat (fin du message)" : "🎙 Appuyer sur l'alternat") + "</button>" +
      (G.ptt ? GROUPS.map(([t, ks]) => '<div class="mdy-grp">' + t + '</div><div class="mdy-tags">' + G.lab.map((l, i) => (ks.includes(l[1]) ? tag(l, i) : "")).join("") + "</div>").join("") +
        (G.msg.length ? '<div class="row"><button class="btn" data-a="undo">↶ Effacer le dernier élément</button></div>' : "") : "") + "</div>" +
      '<div class="row"><button class="btn ' + (G.sosOn ? "mdy-y" : "dark") + '" ' + (G.ptt || G.waiting || G.sos ? "disabled" : "") + ' data-a="sos">' + (G.sosOn ? "🆘 Relâcher la touche SOS (" + Math.floor(G.sosT) + " s)" : "🆘 Appuyer sur la touche SOS") + "</button>" +
      '<button class="btn dark" ' + (G.balise ? "disabled" : "") + ' data-a="baliseRadio">🔔 Déclencher la balise</button>' +
      (G.cosOK ? '<button class="btn" style="background:var(--ok);color:#fff" data-a="survie">➜ Passer en attente des secours</button>' : "") + "</div>" +
      '<p class="small muted">Le temps s\'écoule pendant la radio. Construis ton message comme tu le dirais.</p>');
  }
  H.tag = (i) => { G.msg.push(+i); renderRadio(); };
  H.undo = () => { G.msg.pop(); renderRadio(); };
  H.ptt = () => {
    if (!G.ptt) { G.ptt = true; G.msg = []; G.lab = labels(); renderRadio(); return; }
    G.ptt = false; G.waiting = true; radioScreen("Message émis. En attente de réponse…");
    const res = judge(G.msg.map((i) => G.lab[i])), answers = G.sos || Math.random() < 0.6;
    setTimeout(() => {
      if (!G || G.phase !== "radio") return;
      G.waiting = false;
      if (!answers) {
        G.noAns++;
        if (G.noAns >= 3 && !G.sos && !G.errNoSos) { G.errNoSos = 1; G.errors.push("Plusieurs messages sans réponse, sans penser à la touche SOS."); }
        radioScreen("… pas de réponse.<br>Tu peux repasser un message."); return;
      }
      G.noAns = 0;
      if (res.major.length) { G.errors.push("Message NELAR : " + res.major.concat(res.minor).join(" ")); SND.bad(); radioScreen("<b>« Message incompris. " + res.ask + " »</b>"); return; }
      if (res.minor.length) G.errors.push("Message NELAR : " + res.minor.join(" ")); else G.good.push("Message NELAR complet et exact.");
      G.cosOK = true; if (res.minor.length) G.eta += 45; SND.good();
      radioScreen("<b>« " + esc(G.s.nom) + ", de COS : reçu, " + esc(res.L) + ", " + esc(res.A) + ". Binôme de sauvetage engagé vers vous. »</b>");
    }, 3000);
  };
  function judge(m) {
    const lab = { open: "l'ouverture « URGENT, URGENT, URGENT »", N: "ton nom", E: "ton engin", L: "ta localisation", A: "ton air restant", R: "le renfort demandé" }, major = [], minor = [];
    if (!m.length) return { major: ["Message vide."], minor, ask: "Répétez." };
    if (m[0][1] !== "open" || !m[0][2]) minor.push("Un message de détresse commence par « URGENT, URGENT, URGENT ».");
    for (const k of ["open", "N", "E", "L", "A", "R"]) {
      const got = m.filter((x) => x[1] === k), bad = got.filter((x) => !x[2]);
      if (!got.length) (k === "L" || k === "A" || k === "N" ? major : minor).push("Il manque " + lab[k] + ".");
      bad.forEach((x) => (k === "L" || k === "A" ? major : minor).push("Erreur sur " + lab[k] + " : « " + x[0] + " »."));
    }
    m.filter((x) => (x[1] === "info" || x[1] === "radio") && !x[2]).forEach((x) => minor.push("Information fausse ou inutile : « " + x[0] + " »."));
    const order = m.filter((x) => x[1] !== "info" && x[1] !== "radio" && x[2]).map((x) => ["open", "N", "E", "L", "A", "R"].indexOf(x[1]));
    if (!order.every((v, i) => !i || v >= order[i - 1])) minor.push("Éléments dans le désordre : suis N-E-L-A-R.");
    const okL = m.find((x) => x[1] === "L" && x[2]), okA = m.find((x) => x[1] === "A" && x[2]);
    return { major, minor, ask: !okL ? "Précisez votre localisation." : !okA ? "Précisez votre air restant." : "Répétez votre message.", L: okL ? okL[0] : "", A: okA ? okA[0].replace("il me reste ", "") : "" };
  }
  H.sos = () => {
    if (!G.sosOn) { G.sosOn = true; G.sosT = 0; G.sosStart = Date.now(); renderRadio(); return; }
    G.sosOn = false; if (G.sosT < 5) radioScreen("Appui trop court : il faut maintenir au moins 5 secondes.");
  };
  H.baliseRadio = () => {
    G.balise = true; G.on.balise = { q: 2, txt: "Alarme manuelle" };
    if (!G.cosOK) { G.errors.push("Balise déclenchée avant que le COS ait reçu ton message : elle couvre ta voix."); G.eta += 60; logm("⚠ La balise hurle pendant la radio."); radioScreen("🔔 La balise hurle : ta voix est couverte, on t'entendra mal."); }
    else { G.good.push("Balise déclenchée après le message radio."); radioScreen("🔔 Balise déclenchée. Les secours pourront te localiser au son."); }
  };
  /* ----- 4. Tenir ----- */
  H.survie = () => { G.phase = "survie"; closeModal(); G.tiles = G.tiles || shuffle(TILES); renderSurvie(); logm("Tu te mets en condition d'attente."); };
  function renderSurvie() {
    if (!G || G.phase !== "survie") return;
    frame('<h2 class="mdy-h">③ Tenir jusqu\'aux secours</h2><p class="small muted" style="margin-top:0">Le temps défile (× 6). Chaque action ouvre un choix, pendant lequel le temps ralentit.</p>' +
      '<div class="mdy-acts">' + G.tiles.map(([id, n, d]) => '<button class="mdy-act' + (G.on[id] ? (G.on[id].q === 2 ? " on" : " warn") : "") + '" data-a="act" data-v="' + id + '"><b>' + n + "</b>" + esc(G.on[id] ? G.on[id].txt : d) + "</button>").join("") + "</div>" +
      '<div class="mdy-log" id="mlog">' + G.log.slice(-10).reverse().map((x) => "<div>" + x + "</div>").join("") + "</div>");
  }
  function choose(id, after) {
    const c = CH[id];
    modal(c.t, '<p class="mdy-slow">⏸ Le temps est ralenti pendant ton choix.</p><p><b>' + c.q + "</b></p>", shuffle(c.o).map((o) => [o[0], () => {
      G.on[id] = { q: o[1], txt: o[0] };
      if (o[1] === 2) G.good.push(c.t.replace(/^\S+ /, "") + " : " + o[0].charAt(0).toLowerCase() + o[0].slice(1) + ".");
      else G.errors.push(c.t.replace(/^\S+ /, "") + " : « " + o[0] + " ». " + o[2]);
      logm((o[1] === 2 ? "✔ " : o[1] === 1 ? "≈ " : "✖ ") + o[0] + " — " + o[2]);
      if (after) after(o);
      renderSurvie();
    }]));
  }
  H.act = (id) => {
    if (CH[id]) {
      if (id === "balise" && G.on.balise) { logm("La balise est déjà déclenchée."); return; }
      if (id === "robinet" && !G.fuite && G.p > 55) { G.errors.push("Robinet manipulé sans fuite ni fin d'autonomie : inutile et risqué."); logm("✖ Pas de fuite : pas de raison de toucher au robinet."); return; }
      if (id === "explorer") return choose(id, (o) => { if (o[1] === 2) { G.eta -= 40; logm(R(["Tu trouves un tuyau au sol : tu le signales à la radio.", "Tu touches l'encadrement d'une fenêtre : tu le signales à la radio."])); } else if (o[1] === 0) G.eta += 60; });
      return choose(id);
    }
    if (id === "pack") { if (G.on.pack) return; G.on.pack = { q: G.p < 70 ? 2 : 1, txt: "Sangle passée sous la cuisse" }; if (G.p < 70) G.good.push("Auto-packaging fait avant de risquer l'inconscience."); logm(G.p < 70 ? "✔ Auto-packaging : tu fais gagner du temps aux sauveteurs." : "≈ Auto-packaging un peu tôt, mais pas faux."); return renderSurvie(); }
    if (id === "cagoule") { if (G.p > 0 && !G.on.cagoule) { G.errors.push("Cagoule remontée alors qu'il restait de l'air : on respire les fumées pour rien."); logm("✖ Il te reste de l'air : ne remonte la cagoule qu'en tout dernier recours !"); G.on.cagoule = { q: 0, txt: "Remontée trop tôt" }; G.stress = 1; return renderSurvie(); } return; }
    if (id === "radio") {
      return modal("📻 Point de situation", '<p class="mdy-slow">⏸ Le temps est ralenti.</p><p><b>Tu reprends la radio. Que dis-tu ?</b></p>', shuffle([
        ["« " + G.s.nom + " : toujours même position, il me reste " + Math.round(G.p / 5) * 5 + " bars. »", () => { G.good.push("Point de situation radio précis."); G.eta -= 20; logm("✔ Le COS : « Reçu, le binôme arrive. »"); renderSurvie(); }],
        ["« Je bouge pour chercher la sortie. »", () => { G.errors.push("Annoncer qu'on quitte sa position complique la recherche."); G.eta += 60; logm("✖ Le COS : « Restez en place ! »"); renderSurvie(); }],
        ["Parler longuement pour garder le contact", () => { G.errors.push("Parler longuement consomme de l'air et encombre la radio."); G.stress = 1; logm("✖ Tu parles trop : tu consommes et tu encombres le canal."); renderSurvie(); }]]));
    }
    if (id === "bypass") { G.errors.push("By-pass appuyé : l'air sort en continu, la bouteille se vide."); G.p -= 20; logm("✖ By-pass : tu perds 20 bars d'un coup !"); return renderSurvie(); }
    if (id === "crier") { G.errors.push("Crier sous le masque s'entend mal et fait exploser la consommation."); G.stress = 1; logm("✖ Tu cries : ta respiration s'emballe."); return renderSurvie(); }
  };
  /* ----- Imprévus ----- */
  const EV = [
    { id: "fuite", f: () => { G.fuite = true; SND.bad(); modal("💨 Fuite d'air !", '<p class="mdy-slow">⏸ Temps ralenti.</p><p>Un gravat a touché ton flexible : l\'air fuit en continu. Ton manomètre descend vite.</p><p><b>Que fais-tu ?</b></p>', shuffle([
      ["Maîtriser la fuite avec le robinet : ouvrir ¼ de tour pour inspirer, fermer, expirer", () => { G.on.robinet = { q: 2, txt: "Fuite maîtrisée au robinet" }; G.good.push("Fuite maîtrisée avec la technique du robinet."); logm("✔ Fuite maîtrisée."); renderSurvie(); }],
      ["Fermer complètement le robinet", () => { G.errors.push("Robinet fermé : plus d'air au masque."); G.stress = 1; logm("✖ Plus d'air au masque ! Tu rouvres en paniquant."); renderSurvie(); }],
      ["Appuyer sur la fuite avec la main et ne rien changer", () => { G.errors.push("Fuite non maîtrisée : la bouteille se vide."); logm("✖ La fuite continue."); renderSurvie(); }],
      ["Le signaler à la radio et maîtriser la fuite au robinet", () => { G.on.robinet = { q: 2, txt: "Fuite maîtrisée au robinet" }; G.good.push("Fuite signalée et maîtrisée."); G.eta -= 15; logm("✔ Fuite signalée et maîtrisée."); renderSurvie(); }]])); } },
    { id: "coups", f: () => modal("🔊 Des coups au loin", '<p class="mdy-slow">⏸ Temps ralenti.</p><p>Tu entends frapper, quelque part sur ta gauche.</p><p><b>Que fais-tu ?</b></p>', shuffle([
      ["Répondre en frappant une structure métallique", () => { G.eta -= 40; G.good.push("Tu as répondu aux coups des sauveteurs."); logm("✔ Les sauveteurs t'ont entendu."); renderSurvie(); }],
      ["Te lever et aller vers le bruit", () => { G.errors.push("Quitter sa position pour aller vers le bruit : risque de chute, d'égarement."); G.eta += 30; G.stress = 1; logm("✖ Tu trébuches dans les gravats."); renderSurvie(); }],
      ["Crier « ici ! » de toutes tes forces", () => { G.stress = 1; logm("≈ Ta voix porte mal sous le masque, et tu t'essouffles."); renderSurvie(); }]])) },
    { id: "chaleur", f: () => modal("🌡 La chaleur augmente", '<p class="mdy-slow">⏸ Temps ralenti.</p><p>La fumée devient plus chaude, le plafond de fumée descend.</p><p><b>Que fais-tu ?</b></p>', shuffle([
      ["Rester au plus bas, au pied du mur, et le signaler à la radio", () => { if (!(G.on.sol && G.on.sol.q === 2)) G.on.sol = { q: 2, txt: "Au ras du sol, contre le mur" }; G.good.push("Réaction juste à la montée de chaleur."); logm("✔ Au ras du sol, tu restes sous la chaleur."); renderSurvie(); }],
      ["Te lever pour fuir vers une autre pièce", () => { G.errors.push("Se lever dans une fumée qui descend : exposition directe à la chaleur."); G.stress = 1; G.p -= 10; logm("✖ Brûlure de chaleur, tu te remets au sol."); renderSurvie(); }],
      ["Retirer ta cagoule pour avoir moins chaud", () => { G.errors.push("Retirer sa cagoule : peau exposée à la chaleur."); logm("✖ Tes oreilles brûlent. Tu remets ta cagoule."); renderSurvie(); }]])) },
    { id: "batterie", f: () => modal("🪫 Batterie radio faible", '<p class="mdy-slow">⏸ Temps ralenti.</p><p>Ton terminal émet un bip : batterie faible.</p><p><b>Que fais-tu ?</b></p>', shuffle([
      ["Passer un dernier point de situation bref, puis limiter les appels", () => { G.good.push("Radio gérée malgré la batterie faible."); G.eta -= 10; logm("✔ Point de situation passé."); renderSurvie(); }],
      ["Éteindre la radio tout de suite pour la préserver", () => { G.errors.push("Radio éteinte : les secours ne peuvent plus te guider."); G.eta += 60; logm("✖ Plus de contact radio."); renderSurvie(); }],
      ["Enchaîner les messages tant qu'elle marche", () => { G.errors.push("Messages en rafale : batterie vidée, canal encombré."); logm("✖ La radio s'éteint."); renderSurvie(); }]])) }
  ];
  function imprevu() {
    const left = EV.filter((e) => !G.ev.includes(e.id));
    G.nextEv = G.t + 80 + Math.random() * 100; if (!left.length) return;
    const e = R(left); G.ev.push(e.id); e.f();
  }
  function lastAir() {
    closeModal(); G.phase = "survie";
    modal("Plus d'air !", "<p>Ta bouteille est vide. Le masque se colle à ton visage.</p><p><b>Que fais-tu ?</b></p>", shuffle([
      ["Retirer la SAD et remonter le bas de la cagoule sur le masque, respirer au ras du sol", () => { G.cagoule = true; G.on.cagoule = { q: 2, txt: "Remontée en dernier recours" }; G.good.push("Cagoule remontée au bon moment : bouteille vide."); renderSurvie(); }],
      ["Retirer complètement le masque", () => { G.errors.push("Masque retiré dans les fumées."); end("intox"); }],
      ["Ouvrir le by-pass", () => { G.errors.push("By-pass sur une bouteille vide : rien ne vient."); G.cagoule = true; G.on.cagoule = { q: 1, txt: "Remontée en retard" }; renderSurvie(); }]]));
  }
  /* ----- Fin ----- */
  function end(kind) {
    if (G.phase === "fin") return;
    G.phase = "fin"; closeModal();
    const saved = kind === "sauve";
    let score = (saved ? 45 : 0) + (G.cosOK ? 15 : G.sos ? 10 : 0) + Math.min(30, G.good.length * 3) - G.errors.length * 4 + (saved && G.p > 0 ? 10 : 0);
    score = Math.max(0, Math.min(100, Math.round(score)));
    progress.saveGame(mod.id, "mayday", score);
    saved ? SND.win() : SND.bad();
    frame('<div class="panel result" style="margin:0 auto;border-top-color:' + (saved && G.p > 0 ? "var(--ok)" : "var(--fire)") + '"><h1>' + (saved ? (G.p > 0 ? "Les secours t'ont trouvé !" : "Sauvé… de justesse") : "Intoxiqué…") + "</h1>" +
      '<div class="score">' + score + "<span>/100</span></div>" +
      '<div class="verdict">' + (saved ? "Le binôme de sauvetage t'atteint avec " + Math.max(0, Math.round(G.p)) + " bars restants, après " + fmtT(G.t) + "." : "Tu as respiré les fumées.") + "</div>" +
      (G.good.length ? '<div class="blk blk-key" style="text-align:left"><h3>' + ic("check") + "Bien joué</h3><ul>" + G.good.map((x) => "<li><span>" + esc(x) + "</span></li>").join("") + "</ul></div>" : "") +
      (G.errors.length ? '<div class="blk blk-warn" style="text-align:left"><h3>' + ic("warn") + "À corriger</h3>" + G.errors.map((x) => "<p>" + esc(x) + "</p>").join("") + "</div>" : "") +
      '<div class="blk blk-key" style="text-align:left"><h3>' + ic("target") + "À retenir</h3><ul><li><span>" + fmt("**Air** et **alerte** (NELAR) d'abord, puis la **balise**.") + "</span></li><li><span>" + fmt("En attendant : **éclairer, économiser l'air, rester près du sol, taper, explorer**, tout en même temps.") + "</span></li><li><span>" + fmt("**Remonter la cagoule** seulement s'il n'y a plus d'air.") + "</span></li></ul></div>" +
      '<p class="small muted">Scénario n° ' + G.s.n + "</p>" +
      '<div class="row"><button class="btn big red" data-a="again">' + ic("reset") + 'Rejouer ce scénario</button><button class="btn big" data-a="other">' + ic("play") + 'Autre scénario</button><button class="btn big dark" data-a="home">' + ic("back") + "Retour au module</button></div></div>");
  }
  H.again = () => start(G.s.n);
  H.home = exit;
  /* ----- Fenêtre modale ----- */
  function modal(title, html, btns) {
    closeModal(); modalOpen = true;
    const d = document.createElement("div"); d.className = "mdy-modal";
    d.innerHTML = '<div class="mdy-box"><h2>' + title + "</h2>" + html + btns.map((b, i) => '<button class="btn ' + (b[2] || "") + '" data-i="' + i + '">' + esc(b[0]) + "</button>").join("") + "</div>";
    document.body.appendChild(d);
    d.querySelectorAll("[data-i]").forEach((b) => { b.onclick = () => { const f = btns[+b.dataset.i][1]; closeModal(); if (f) f(); }; });
  }
  function closeModal() { document.querySelectorAll(".mdy-modal").forEach((m) => m.remove()); modalOpen = false; }

  start();
  return cleanup;
}
