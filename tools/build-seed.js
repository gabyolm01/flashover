// Construit le contenu de départ à partir du dossier seed/ :
//  - seed/content.json : utilisé par le site en mode local (développement)
//  - supabase/seed.sql : contenu complet, à coller dans Supabase pour remplir la base en ligne
//  - supabase/seed-<module>.sql : un fichier par module, pour mettre à jour un seul module
// Usage : node tools/build-seed.js
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const root = path.join(__dirname, "..");
const seed = path.join(root, "seed");

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
/* Questions au format texte : TYPE|thème|question|réponses|explication */
function parseQuestions(file, prefix) {
  const ids = {};
  return fs.readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && l[0] !== "#").map((l) => {
    const p = l.split("|");
    if (p.length !== 5) throw new Error("Ligne invalide : " + l.slice(0, 80));
    const [t, f, q, a] = p;
    const ans = t === "V" ? [a.trim().toUpperCase()[0] === "F" ? "F" : "V"]
      : t === "R" ? a.split(";").map((x) => x.split("=").map((s) => s.trim()))
      : a.split(";").map((s) => s.trim()).filter(Boolean);
    let id = (prefix || "") + t + "-" + hashStr(q);
    while (ids[id]) id += "x";
    ids[id] = 1;
    return { id, t, f, q, a: ans, e: p[4] || "" };
  });
}

/* Schéma légendé de la tenue de feu, construit à partir du personnage du jeu « Qu'est-ce qui cloche ? » */
function tenueSchema(fig) {
  const inner = fig.replace(/^<svg[^>]*>/, '<svg x="320" y="10" width="360" height="660" viewBox="0 0 360 660">');
  const L = [
    ["g", 142, 128, 110, "Cagoule", "rentrée dans la veste"],
    ["g", 165, 160, 196, "Jugulaire", "attachée"],
    ["g", 97, 392, 392, "Gants de feu", "par-dessus les manches"],
    ["g", 150, 470, 492, "Surpantalon de feu", "par-dessus le pantalon TSI"],
    ["g", 150, 628, 640, "Bottes coquées", ""],
    ["d", 200, 60, 62, "Casque F1", "chaleur, chutes d'objets"],
    ["d", 224, 166, 164, "Col montant", "relevé, protège-cou rabattu"],
    ["d", 214, 300, 296, "Veste de feu", "fermée : zip puis velcro"],
    ["d", 200, 394, 404, "Jusqu'à mi-cuisse", "bras couverts jusqu'aux poignets"],
    ["d", 205, 596, 588, "Bas du surpantalon", "sur la botte, jusqu'au talon"]
  ];
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 680" font-family="Segoe UI, Roboto, Arial, sans-serif" role="img" aria-label="La tenue de feu bien portée">' + inner;
  L.forEach(([side, fx, fy, ly, title, sub]) => {
    const px = 320 + fx, py = 10 + fy, left = side === "g";
    const tx = left ? 290 : 710, lx = left ? 300 : 700;
    s += '<path d="M' + lx + " " + ly + " L" + px + " " + py + '" stroke="#5A5F66" stroke-width="2.5" fill="none"/><circle cx="' + px + '" cy="' + py + '" r="6" fill="#C1121F" stroke="#fff" stroke-width="2"/>';
    s += '<text x="' + tx + '" y="' + (sub ? ly - 4 : ly + 8) + '" text-anchor="' + (left ? "end" : "start") + '" font-size="24" font-weight="900" fill="#16181D">' + title + "</text>";
    if (sub) s += '<text x="' + tx + '" y="' + (ly + 22) + '" text-anchor="' + (left ? "end" : "start") + '" font-size="18" fill="#3A3F46">' + sub + "</text>";
  });
  return s + "</svg>";
}

(async () => {
  const { figureSVG } = await import(pathToFileURL(path.join(root, "js", "games", "cloche.js")).href);
  const platform = require(path.join(seed, "platform.js"));
  const lances = require(path.join(seed, "modules", "lances.js"));
  lances.questions = parseQuestions(path.join(seed, "lances-questions.txt"));
  const epi = require(path.join(seed, "modules", "epi.js"));
  epi.questions = parseQuestions(path.join(seed, "epi-questions.txt"), "epi-");
  const ari = require(path.join(seed, "modules", "ari.js"));
  ari.questions = parseQuestions(path.join(seed, "ari-questions.txt"), "ari-");
  const tasss = require(path.join(seed, "modules", "tasss.js"));
  tasss.questions = parseQuestions(path.join(seed, "tasss-questions.txt"), "tasss-");
  const etb = require(path.join(seed, "modules", "etb.js"));
  etb.questions = parseQuestions(path.join(seed, "etb-questions.txt"), "etb-");
  const schema = tenueSchema(figureSVG(new Set()));
  epi.fiches.forEach((f) => (f.blocks || []).forEach((b) => { if (b.svg === "__FIGURE_TENUE__") b.svg = schema; }));
  const modules = [epi, lances, ari, tasss, etb];

  const content = { platform };
  modules.forEach((m) => { content["module:" + m.id] = m; });
  fs.writeFileSync(path.join(seed, "content.json"), JSON.stringify(content));

  const insert = (k) => "insert into public.flashover_content(key, data) values ('" + k + "', $flashover$" + JSON.stringify(content[k]) + "$flashover$::jsonb)\n" +
    "on conflict (key) do update set data = excluded.data, updated_at = now();";
  const head = "-- Contenu Flashover (généré par tools/build-seed.js). À coller dans Supabase > SQL Editor > Run. Ne pas publier ce fichier.\n";
  fs.writeFileSync(path.join(root, "supabase", "seed.sql"), head + Object.keys(content).map(insert).join("\n"));
  modules.forEach((m) => fs.writeFileSync(path.join(root, "supabase", "seed-" + m.id + ".sql"), head + insert("module:" + m.id)));

  console.log("Modules :", modules.map((m) => m.id + " (" + (m.fiches || []).length + " fiches, " + (m.questions || []).length + " questions)").join(", "));
  console.log("seed/content.json :", Math.round(fs.statSync(path.join(seed, "content.json")).size / 1024), "Ko");
})().catch((e) => { console.error(e); process.exit(1); });
