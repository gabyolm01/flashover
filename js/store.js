/* Accès aux données : Supabase en ligne, ou fichier local en développement.
   Le contenu est gardé en cache sur l'appareil pour fonctionner hors connexion. */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const LOCAL = !SUPABASE_URL;
const K_CODE = "flashover-code";
const K_ROLE = "flashover-role";
const K_FORM = "flashover-formation-code";         // formation liée au code (« * » = toutes)
const K_FROLE = "flashover-formateur-role";       // sessionStorage : « admin » ou « formateur »
const K_CACHE = "flashover-cache";
const K_FCODE = "flashover-formateur";           // sessionStorage : code formateur de la session
const K_LOCALDB = "flashover-local-db";           // mode local : modifications du formateur
// Mode local : « rôle:formation » → code (formateur = admin, comme l'ancien code formateur)
const LOCAL_CODES = { "stagiaire:*": "stagiaire", "admin:*": "formateur", "stagiaire:ce": "stagiaire-ce", "formateur:ce": "formateur-ce", "stagiaire:sst": "stagiaire-sst", "formateur:sst": "formateur-sst" };

function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

async function rpc(fn, args) {
  const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, {
    method: "POST",
    // Clé « anon » (ancien format, JWT) ou « publishable » (nouveau format sb_publishable_…)
    headers: Object.assign({ "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      SUPABASE_ANON_KEY.indexOf("sb_") === 0 ? {} : { Authorization: "Bearer " + SUPABASE_ANON_KEY }),
    body: JSON.stringify(args)
  });
  const txt = await r.text();
  let j = null;
  try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!r.ok) {
    const err = new Error((j && j.message) || "Erreur " + r.status);
    err.auth = !!(j && j.code === "28000");
    throw err;
  }
  return j;
}

/* ---- Mode local (développement) ---- */
let localSeed = null;
async function localAll() {
  if (!localSeed) localSeed = await (await fetch("seed/content.json", { cache: "no-store" })).json();
  const over = lsGet(K_LOCALDB) || {};
  const out = {};
  Object.keys(localSeed).forEach((k) => { out[k] = { data: localSeed[k], updated_at: "seed" }; });
  Object.keys(over).forEach((k) => { if (over[k] === null) delete out[k]; else out[k] = over[k]; });
  return out;
}
const localCodes = () => Object.assign({}, LOCAL_CODES, lsGet(K_LOCALDB + "-codes2") || {});
function localLogin(code) {
  const c = String(code || "").trim(), codes = localCodes();
  const k = Object.keys(codes).find((x) => codes[x] === c);
  return k ? { role: k.split(":")[0], formation: k.split(":")[1] } : null;
}
/* Même filtre que flashover_get en ligne : la plateforme et les modules de la formation du code */
function filterFor(raw, formation) {
  if (!formation || formation === "*") return raw;
  const plat = raw.platform && raw.platform.data, f = plat && (plat.formations || []).find((x) => x.id === formation);
  if (!f) throw Object.assign(new Error("formation inconnue"), { auth: true });
  const out = { platform: { data: Object.assign({}, plat, { formations: [f] }), updated_at: raw.platform.updated_at } };
  (f.modules || []).forEach((m) => { if (raw["module:" + m]) out["module:" + m] = raw["module:" + m]; });
  return out;
}
// L'ancienne base renvoyait juste le rôle ; la nouvelle renvoie {role, formation}
const access = (r) => (!r ? null : typeof r === "string" ? { role: r === "formateur" ? "admin" : r, formation: "*" } : r);

/* Transforme {clé: {data}} en {platform, modules: {id: module}} */
function shape(raw) {
  const content = { platform: null, modules: {}, updated: {} };
  Object.keys(raw || {}).forEach((k) => {
    content.updated[k] = raw[k].updated_at;
    if (k === "platform") content.platform = raw[k].data;
    else if (k.indexOf("module:") === 0) content.modules[k.slice(7)] = raw[k].data;
  });
  return content;
}

export const store = {
  local: LOCAL,
  content: null,
  offline: false,

  savedCode() { return localStorage.getItem(K_CODE); },
  savedRole() { return localStorage.getItem(K_ROLE); },
  savedFormation() { return localStorage.getItem(K_FORM) || "*"; },

  /* Renvoie {role, formation} ou null */
  async login(code) {
    return access(LOCAL ? localLogin(code) : await rpc("flashover_login", { p_code: String(code).trim() }));
  },

  /* Charge le contenu (réseau, sinon cache). Renvoie false si le code n'est plus valable. */
  async load(code) {
    try {
      let raw;
      if (LOCAL) {
        const a = localLogin(code);
        if (!a) throw Object.assign(new Error("code invalide"), { auth: true });
        raw = filterFor(await localAll(), a.formation);
      } else {
        raw = await rpc("flashover_get", { p_code: code });
      }
      this.content = shape(raw);
      this.offline = false;
      lsSet(K_CACHE, { code: code, raw: raw });
      return true;
    } catch (e) {
      if (e.auth) { this.logout(); return false; }
      const cache = lsGet(K_CACHE);
      if (cache && cache.code === code) {
        this.content = shape(cache.raw);
        this.offline = true;
        return true;
      }
      throw e;
    }
  },

  remember(code, acc) {
    localStorage.setItem(K_CODE, String(code).trim());
    localStorage.setItem(K_ROLE, acc.role);
    localStorage.setItem(K_FORM, acc.formation || "*");
  },
  logout() {
    localStorage.removeItem(K_CODE);
    localStorage.removeItem(K_ROLE);
    localStorage.removeItem(K_FORM);
    sessionStorage.removeItem(K_FROLE);
    localStorage.removeItem(K_CACHE);
    sessionStorage.removeItem(K_FCODE);
    this.content = null;
  },

  /* ---- Formateur ---- */
  formateurCode() { return sessionStorage.getItem(K_FCODE); },
  isAdmin() { return sessionStorage.getItem(K_FROLE) === "admin"; },
  /* Renvoie "ok", "wrong" (code incorrect) ou "other" (code formateur d'une autre formation) */
  async formateurLogin(code) {
    const a = await this.login(code);
    if (!a || (a.role !== "formateur" && a.role !== "admin")) return "wrong";
    if (a.role === "formateur" && a.formation !== this.savedFormation()) return "other";
    sessionStorage.setItem(K_FCODE, String(code).trim());
    sessionStorage.setItem(K_FROLE, a.role);
    return "ok";
  },
  formateurLogout() { sessionStorage.removeItem(K_FCODE); sessionStorage.removeItem(K_FROLE); },
  formateurFormation() { return this.isAdmin() ? "*" : this.savedFormation(); },

  async save(key, data) {
    const code = this.formateurCode();
    if (!code) throw new Error("Mode formateur non ouvert.");
    if (LOCAL) {
      const over = lsGet(K_LOCALDB) || {};
      over[key] = { data: data, updated_at: new Date().toISOString() };
      if (!lsSet(K_LOCALDB, over)) throw new Error("Stockage local plein.");
    } else {
      await rpc("flashover_save", { p_code: code, p_key: key, p_data: data });
    }
    // Mise à jour immédiate du contenu en mémoire et du cache
    const cache = lsGet(K_CACHE);
    if (cache && cache.raw) { cache.raw[key] = { data: data, updated_at: new Date().toISOString() }; lsSet(K_CACHE, cache); this.content = shape(cache.raw); }
  },
  saveModule(mod) { return this.save("module:" + mod.id, mod); },
  savePlatform(p) { return this.save("platform", p); },

  async setCode(role, formation, newCode) {
    const code = this.formateurCode(), nc = String(newCode).trim();
    if (LOCAL) {
      const codes = localCodes(), key = role + ":" + formation;
      if (Object.keys(codes).some((k) => codes[k] === nc && k !== key)) throw new Error("ce code est déjà utilisé ailleurs : choisissez-en un autre");
      const over = lsGet(K_LOCALDB + "-codes2") || {};
      over[key] = nc;
      lsSet(K_LOCALDB + "-codes2", over);
    } else {
      await rpc("flashover_set_code", { p_code: code, p_role: role, p_formation: formation, p_new: nc });
    }
    // Le code qu'on vient de changer est peut-être celui de la session : on le met à jour
    const fr = sessionStorage.getItem(K_FROLE);
    if (role === fr && (role === "admin" || formation === this.savedFormation())) sessionStorage.setItem(K_FCODE, nc);
    if (role === this.savedRole() && formation === this.savedFormation()) localStorage.setItem(K_CODE, nc);
  },
  /* Codes existants [{role, formation}] (jamais les codes eux-mêmes) */
  async codesList() {
    if (LOCAL) { const c = localCodes(); return Object.keys(c).map((k) => ({ role: k.split(":")[0], formation: k.split(":")[1] })); }
    try { return await rpc("flashover_codes_list", { p_code: this.formateurCode() }); } catch (e) { return null; }
  },

  /* Mode local uniquement : oublier les modifications faites dans le navigateur */
  resetLocal() { localStorage.removeItem(K_LOCALDB); localStorage.removeItem(K_LOCALDB + "-codes2"); }
};
