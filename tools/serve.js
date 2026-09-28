// Petit serveur local pour tester le site : node tools/serve.js puis http://localhost:8765
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  // LOCAL=1 : ignore la base en ligne et utilise seed/content.json (codes « stagiaire » / « formateur »)
  if (process.env.LOCAL && p === "/js/config.js") {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
    return res.end('export const SUPABASE_URL = "";\nexport const SUPABASE_ANON_KEY = "";\n');
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, { "Content-Type": (types[path.extname(file)] || "application/octet-stream") + "; charset=utf-8", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(process.env.PORT || 8765, () => console.log("http://localhost:" + (process.env.PORT || 8765)));
