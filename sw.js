/* Service worker : garde l'application disponible hors connexion.
   Le contenu (fiches, questions) est gardé à part par l'application, après saisie du code. */
const VERSION = "flashover-v18";
const SHELL = [
  "./", "index.html", "css/app.css", "manifest.webmanifest", "icons/favicon.png", "icons/logo-h.webp", "icons/logo-icon.webp",
  "js/app.js", "js/config.js", "js/ui.js", "js/store.js", "js/progress.js",
  "js/games/engine.js", "js/games/common.js", "js/games/quiz.js", "js/games/duel.js", "js/games/tableau.js", "js/games/defi.js", "js/games/cloche.js", "js/games/situation.js", "js/games/reserve.js", "js/games/mayday.js", "js/games/etablissez.js", "js/games/victime.js",
  "js/revision/fiche.js", "js/formateur/formateur.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Réseau d'abord, en revalidant toujours auprès du serveur (sinon le navigateur garde
   jusqu'à 10 minutes l'ancienne version après une mise à jour), cache si hors connexion */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Vidéos : lues directement par le navigateur (lecture par morceaux), jamais gardées en cache
  if (e.request.headers.has("range") || /\.(mp4|webm)$/i.test(url.pathname)) return;
  e.respondWith(
    fetch(new Request(e.request, { cache: "no-cache" })).then((r) => {
      const copy = r.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
