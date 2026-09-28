/* Progression du stagiaire : uniquement sur son appareil, sans compte. */
const KEY = "flashover-progress";

function load() {
  try { return Object.assign({ fiches: {}, games: {}, seen: {} }, JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch (e) { return { fiches: {}, games: {}, seen: {} }; }
}
function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }

export const progress = {
  get: load,

  fiche(mod, fid) { return load().fiches[mod + "/" + fid] || {}; },
  markRead(mod, fid) {
    const p = load(), k = mod + "/" + fid;
    p.fiches[k] = Object.assign(p.fiches[k] || {}, { read: true, at: Date.now() });
    save(p);
  },
  saveTest(mod, fid, pct) {
    const p = load(), k = mod + "/" + fid, f = p.fiches[k] || {};
    f.last = pct;
    f.best = Math.max(f.best || 0, pct);
    f.read = true;
    p.fiches[k] = f;
    save(p);
  },

  game(mod, gid) { return load().games[mod + "/" + gid] || {}; },
  saveGame(mod, gid, note) {
    const p = load(), k = mod + "/" + gid, g = p.games[k] || { plays: 0 };
    g.plays++;
    g.last = note;
    g.best = Math.max(g.best || 0, note);
    p.games[k] = g;
    save(p);
  },

  /* Meilleur temps (missions chronométrées réussies) ; renvoie true si c'est un record */
  saveBestTime(mod, gid, ms) {
    const p = load(), k = mod + "/" + gid, g = p.games[k] || { plays: 0 };
    const record = !g.bestTime || ms < g.bestTime;
    if (record) g.bestTime = ms;
    p.games[k] = g;
    save(p);
    return record;
  },

  /* Questions déjà posées (pour proposer d'abord les nouvelles) */
  seenMap(mod) { return load().seen[mod] || {}; },
  markSeen(mod, id) {
    const p = load();
    p.seen[mod] = p.seen[mod] || {};
    p.seen[mod][id] = (p.seen[mod][id] || 0) + 1;
    save(p);
  },

  /* Statistiques d'un module */
  stats(mod) {
    const p = load(), fiches = (mod.fiches || []).filter((f) => !f.hidden);
    let read = 0, tested = 0, sum = 0;
    fiches.forEach((f) => {
      const r = p.fiches[mod.id + "/" + f.id];
      if (r && r.read) read++;
      if (r && r.best != null) { tested++; sum += r.best; }
    });
    const games = Object.keys(p.games).filter((k) => k.indexOf(mod.id + "/") === 0).map((k) => p.games[k]);
    return {
      total: fiches.length, read: read, tested: tested,
      avg: tested ? Math.round(sum / tested) : null,
      pct: fiches.length ? Math.round(read / fiches.length * 100) : 0,
      plays: games.reduce((s, g) => s + g.plays, 0)
    };
  },

  reset(modId) {
    if (!modId) { localStorage.removeItem(KEY); return; }
    const p = load();
    ["fiches", "games"].forEach((part) => {
      Object.keys(p[part]).forEach((k) => { if (k.indexOf(modId + "/") === 0) delete p[part][k]; });
    });
    delete p.seen[modId];
    save(p);
  }
};
