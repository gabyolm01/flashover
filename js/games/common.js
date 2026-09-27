/* Éléments communs aux écrans de jeu */
import { ic, logoHTML, toggleFullscreen } from "../ui.js";

export function gameBar(opts) {
  return '<header class="bar"><span class="logo">' + logoHTML() + "</span>" +
    (opts.badge ? ' <span class="lvl-badge" style="background:' + (opts.color || "var(--red)") + '">' + opts.badge + "</span>" : "") +
    (opts.label ? ' <span class="phase hide-m">' + opts.label + "</span>" : "") +
    '<span class="spacer"></span>' +
    (opts.stats ? '<div class="stats">' + opts.stats + "</div>" : "") +
    (opts.actions || "") +
    '<button class="iconbtn hide-m" data-act="fs" title="Plein écran">' + ic("expand") + "</button>" +
    '<button class="iconbtn" data-act="quit" title="Quitter">' + ic("x") + "</button></header>";
}
export function bindBar(root, onQuit, confirmMsg) {
  const fs = root.querySelector('[data-act="fs"]');
  if (fs) fs.onclick = toggleFullscreen;
  root.querySelector('[data-act="quit"]').onclick = () => { if (!confirmMsg || confirm(confirmMsg)) onQuit(); };
}
