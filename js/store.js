/* Accès aux données : Supabase en ligne, ou fichier local en développement.
   Le contenu est gardé en cache sur l'appareil pour fonctionner hors connexion. */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const LOCAL = !SUPABASE_URL;
const K_CODE = "flashover-code";
const K_ROLE = "flashover-role";
const K_CACHE = "flashover-cache";
const K_FCODE = "flashover-formateur";           // sessionStorage : code formateur de la session
const K_LOCALDB = "flashover-local-db";           // mode local : modifications du formateur
const LOCAL_CODES = { stagiaire: "stagiaire", formateur: "formateur" };

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
function localLogin(code) {
  const codes = lsGet(K_LOCALDB + "-codes") || LOCAL_CODES;
  const c = String(code || "").trim();
  return c === codes.formateur ? "formateur" : c === codes.stagiaire ? "stagiaire" : null;
}

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

  async login(code) {
    const role = LOCAL ? localLogin(code) : await rpc("flashover_login", { p_code: String(code).trim() });
    return role || null;
  },

  /* Charge le contenu (réseau, sinon cache). Renvoie false si le code n'est plus valable. */
  async load(code) {
    try {
      let raw;
      if (LOCAL) {
        if (!localLogin(code)) throw Object.assign(new Error("code invalide"), { auth: true });
        raw = await localAll();
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

  remember(code, role) {
    localStorage.setItem(K_CODE, String(code).trim());
    localStorage.setItem(K_ROLE, role);
  },
  logout() {
    localStorage.removeItem(K_CODE);
    localStorage.removeItem(K_ROLE);
    localStorage.removeItem(K_CACHE);
    sessionStorage.removeItem(K_FCODE);
    this.content = null;
  },

  /* ---- Formateur ---- */
  formateurCode() { return sessionStorage.getItem(K_FCODE); },
  async formateurLogin(code) {
    const role = await this.login(code);
    if (role !== "formateur") return false;
    sessionStorage.setItem(K_FCODE, String(code).trim());
    return true;
  },
  formateurLogout() { sessionStorage.removeItem(K_FCODE); },

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

  async setCode(role, newCode) {
    const code = this.formateurCode();
    if (LOCAL) {
      const codes = lsGet(K_LOCALDB + "-codes") || Object.assign({}, LOCAL_CODES);
      codes[role] = String(newCode).trim();
      lsSet(K_LOCALDB + "-codes", codes);
    } else {
      await rpc("flashover_set_code", { p_code: code, p_role: role, p_new: newCode });
    }
    if (role === "formateur") sessionStorage.setItem(K_FCODE, String(newCode).trim());
    if (role === this.savedRole()) localStorage.setItem(K_CODE, String(newCode).trim());
  },

  /* Mode local uniquement : oublier les modifications faites dans le navigateur */
  resetLocal() { localStorage.removeItem(K_LOCALDB); localStorage.removeItem(K_LOCALDB + "-codes"); }
};
