// Construit le contenu de départ à partir du dossier seed/ :
//  - seed/content.json : utilisé par le site en mode local (développement)
//  - supabase/seed.sql : à coller une fois dans Supabase pour remplir la base en ligne
// Usage : node tools/build-seed.js
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const seed = path.join(root, "seed");

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
/* Questions au format texte : TYPE|thème|question|réponses|explication */
function parseQuestions(file) {
  const ids = {};
  return fs.readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && l[0] !== "#").map((l) => {
    const p = l.split("|");
    if (p.length !== 5) throw new Error("Ligne invalide : " + l.slice(0, 80));
    const [t, f, q, a] = p;
    const ans = t === "V" ? [a.trim().toUpperCase()[0] === "F" ? "F" : "V"]
      : t === "R" ? a.split(";").map((x) => x.split("=").map((s) => s.trim()))
      : a.split(";").map((s) => s.trim()).filter(Boolean);
    let id = t + "-" + hashStr(q);
    while (ids[id]) id += "x";
    ids[id] = 1;
    return { id, t, f, q, a: ans, e: p[4] || "" };
  });
}

const platform = require(path.join(seed, "platform.js"));
const lances = require(path.join(seed, "modules", "lances.js"));
lances.questions = parseQuestions(path.join(seed, "lances-questions.txt"));
const modules = [lances].concat(require(path.join(seed, "modules", "autres.js")));

const content = { platform };
modules.forEach((m) => { content["module:" + m.id] = m; });
fs.writeFileSync(path.join(seed, "content.json"), JSON.stringify(content));

const sql = ["-- Contenu de départ de Flashover (généré par tools/build-seed.js).",
  "-- À coller dans Supabase > SQL Editor > Run, APRÈS setup.sql. Ne pas publier ce fichier.", ""]
  .concat(Object.keys(content).map((k) =>
    "insert into public.flashover_content(key, data) values ('" + k + "', $flashover$" + JSON.stringify(content[k]) + "$flashover$::jsonb)\n" +
    "on conflict (key) do update set data = excluded.data, updated_at = now();"))
  .join("\n");
fs.writeFileSync(path.join(root, "supabase", "seed.sql"), sql);

console.log("Modules :", modules.map((m) => m.id + " (" + (m.fiches || []).length + " fiches, " + (m.questions || []).length + " questions)").join(", "));
console.log("seed/content.json :", Math.round(fs.statSync(path.join(seed, "content.json")).size / 1024), "Ko");
