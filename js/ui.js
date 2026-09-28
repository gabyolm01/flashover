/* Outils d'affichage communs */

export const ICONS = {
  flame: '<path fill="currentColor" stroke="none" d="M12 2c.9 3.4 5.2 5.8 5.2 11.1A5.2 5.2 0 0 1 6.8 13c0-2.6 1.3-4.3 2.7-5.8.2 1.9 1 3.1 2.3 3.6C11 8.3 11.2 5 12 2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  play: '<path fill="currentColor" d="M7 4l13 8-13 8z"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  skip: '<path fill="currentColor" d="M5 5l9 7-9 7z"/><path d="M18 5v14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>',
  home: '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7M8 11h7"/>',
  gamepad: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 13h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  logout: '<path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M11 8v6M8 11h6"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down2: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  // Modules
  helmet: '<path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 6v5M9 8.5h6"/><path d="M4 17v2h16v-2"/>',
  nozzle: '<path d="M3 14h7l3-2h4l4-2v6l-4-2h-4l-3-2"/><path d="M5 14v4M8 14v4"/>',
  mask: '<path d="M6 8c0-2 3-4 6-4s6 2 6 4v5c0 3-3 7-6 7s-6-4-6-7z"/><circle cx="12" cy="15" r="2"/><path d="M9 9h6"/>',
  rescue: '<circle cx="8" cy="5" r="2"/><path d="M8 7v6l-3 6M8 13l3 6M5 10h6"/><path d="M14 13h7M17 10l3 3-3 3"/>',
  hose: '<path d="M3 18c4 0 4-6 8-6s4 6 8 6"/><circle cx="3" cy="18" r="1.5"/><path d="M19 18h2v-3"/><path d="M11 12V5h4"/>'
};
export function ic(n) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || ICONS.help) + "</svg>";
}
export function logoHTML() {
  return '<img class="logo-full" src="icons/logo-h.webp" alt="Flashover"><img class="logo-mini" src="icons/logo-icon.webp" alt="Flashover">';
}

export function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
/* Texte simple : ↘ en pastille rouge, **gras**, guillemets insécables */
export function fmt(line) {
  return esc(line).replace(/« /g, "« ").replace(/ »/g, " »")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/↘/g, '<span class="down" aria-label="diminution">↘</span>');
}
/* Texte multiligne du tableau : « • » = puce, « ou »/« et » seuls = petit */
export function rich(t) {
  return String(t).split("\n").map((l) => {
    const bullet = /^\s*•\s*/.test(l);
    const txt = l.replace(/^\s*•\s*/, "");
    const small = /^\s*(ou|et)\s*$/i.test(l);
    return '<div class="ln' + (bullet ? " bl" : "") + (small ? " sm" : "") + '">' + (fmt(txt) || "&nbsp;") + "</div>";
  }).join("");
}
/* Paragraphes : lignes vides = nouveaux paragraphes */
export function paras(t) {
  return String(t || "").split(/\n\s*\n/).map((p) => "<p>" + fmt(p.trim()).replace(/\n/g, "<br>") + "</p>").join("");
}
export function norm(t) { return String(t).replace(/\s+/g, " ").trim().toLowerCase(); }
export function num(n) { return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 }); }
export function mmss(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function plural(n, w) { return n + " " + w + (n > 1 ? "s" : ""); }
export function clone(o) { return JSON.parse(JSON.stringify(o)); }
export function $(sel, root) { return (root || document).querySelector(sel); }
export function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

let toastTimer;
export function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3600);
}
export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
}
export function verdict(sc) {
  if (sc >= 18) return "Excellent !";
  if (sc >= 14) return "Bien joué, quelques points à revoir.";
  if (sc >= 10) return "Correct, à consolider.";
  return "À retravailler.";
}
/* Identifiant YouTube à partir d'un lien (watch, youtu.be, shorts, embed) */
export function youtubeId(url) {
  const m = String(url || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(String(url || "").trim()) ? String(url).trim() : null;
}
