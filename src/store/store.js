/*
 * IDEOLOGY STUDIO — local store
 *
 * Stands in for the whole server: /api/project, /api/clients, /api/content,
 * /api/auth and /api/client-view all resolved to Supabase in the tool this was
 * extracted from. Here there is no backend at all, by design — everything lives
 * in localStorage so the prototype can be opened and clicked through with no
 * infrastructure.
 *
 * The seam is deliberate. Every read and write in the app goes through
 * IdeologyStore, and nothing else touches persistence. When a real backend
 * arrives, this one file is what gets rewritten — the pages above it do not
 * change. That is the opposite of how the source tool was built, where fetch()
 * calls to /api/project were scattered across 49 call sites in app.js.
 *
 * WHAT IS DELIBERATELY DIFFERENT FROM THE SOURCE
 *
 *  - Writes are per-key, not whole-blob. The original POSTed the entire studio
 *    dataset on every change, so two tabs open at once silently overwrote each
 *    other. Here each top-level collection is its own localStorage key, so a
 *    feed edit cannot clobber the client list.
 *
 *  - Cross-tab sync is real. The `storage` event fires in OTHER tabs when one
 *    writes, so a second window updates instead of going stale and then
 *    overwriting. subscribe() surfaces that.
 *
 *  - Quota is handled, not assumed. localStorage is ~5MB and base64 image data
 *    fills it fast. Writes that overflow throw a typed error the UI can show,
 *    rather than failing silently and losing the user's work.
 */

window.IdeologyStore = (function () {
  'use strict';

  const PREFIX  = 'ideology:';
  const VERSION = 1;

  /* Every top-level collection the app persists. Splitting these into separate
     keys is what removes the whole-blob overwrite problem — see header. */
  const COLLECTIONS = {
    clients:   [],   // [{ id, name, slug, color, accounts: [...], ... }]
    feeds:     {},   // { "<accountId>|||<Mese YYYY>": [ item, ... ] }
    stories:   {},   // same key shape as feeds
    pedPlans:  {},   // { "<clientId>": { "<Mese YYYY>": { slots: [...] } } }
    pillars:   {},   // { "<clientId>": [ { id, name, color }, ... ] }
    formats:   {},   // { "<clientId>": [ { id, name, ratio }, ... ] }
    settings:  {},   // { theme, lastClientId, lastTab, ... }
  };

  const listeners = new Set();
  let   cache     = null;   // in-memory mirror; localStorage is the source of truth

  /* ── low level ─────────────────────────────────────────────────────────── */

  function keyFor(name) {
    return PREFIX + name;
  }

  function readKey(name, fallback) {
    try {
      const raw = localStorage.getItem(keyFor(name));
      if (raw === null) return structuredClone(fallback);
      return JSON.parse(raw);
    } catch (e) {
      // A corrupt key must not brick the whole app. Quarantine it under a
      // timestamped name so the data is still recoverable by hand, then carry
      // on with the default — the alternative is a white screen on every load.
      console.error('[store] corrupt key "' + name + '", quarantining:', e.message);
      try {
        const raw = localStorage.getItem(keyFor(name));
        localStorage.setItem(keyFor('_corrupt:' + name + ':' + Date.now()), raw);
        localStorage.removeItem(keyFor(name));
      } catch (_) { /* quarantine is best-effort */ }
      return structuredClone(fallback);
    }
  }

  function writeKey(name, value) {
    const payload = JSON.stringify(value);
    try {
      localStorage.setItem(keyFor(name), payload);
    } catch (e) {
      // QuotaExceededError has different names across browsers; checking for a
      // name match alone misses Firefox and older Safari.
      const isQuota = e && (
        e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 || e.code === 1014
      );
      if (isQuota) {
        const err = new Error(
          'Spazio locale esaurito (' + Math.round(payload.length / 1024) + 'KB in scrittura). ' +
          'Le immagini incorporate riempiono in fretta i ~5MB di localStorage: ' +
          'esporta il progetto e ripulisci, oppure collega un backend reale.'
        );
        err.code = 'QUOTA';
        throw err;
      }
      throw e;
    }
  }

  /* ── boot ──────────────────────────────────────────────────────────────── */

  function load() {
    if (cache) return cache;
    const storedVersion = Number(localStorage.getItem(keyFor('_version')) || 0);
    cache = {};
    for (const [name, fallback] of Object.entries(COLLECTIONS)) {
      cache[name] = readKey(name, fallback);
    }
    if (storedVersion !== VERSION) {
      // No migrations to run yet — this only stamps the version so that a
      // future schema change has something to branch on instead of guessing.
      try { localStorage.setItem(keyFor('_version'), String(VERSION)); } catch (_) {}
    }
    return cache;
  }

  function isEmpty() {
    const d = load();
    return d.clients.length === 0;
  }

  /* ── notify ────────────────────────────────────────────────────────────── */

  function emit(collection, detail) {
    listeners.forEach(fn => {
      try { fn({ collection, detail }); }
      catch (e) { console.error('[store] listener threw:', e); }
    });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);   // caller keeps the unsubscribe handle
  }

  // Another tab wrote. Drop the affected slice of cache so the next read picks
  // up their value, then let the UI re-render. Without this, two open windows
  // diverge and whichever saves last wins — the exact class of bug that made
  // the source tool lose feed edits.
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key.indexOf(PREFIX) !== 0) return;
    const name = e.key.slice(PREFIX.length);
    if (!(name in COLLECTIONS)) return;
    if (cache) cache[name] = readKey(name, COLLECTIONS[name]);
    emit(name, { external: true });
  });

  /* ── generic accessors ─────────────────────────────────────────────────── */

  function get(collection) {
    const d = load();
    if (!(collection in COLLECTIONS)) throw new Error('[store] unknown collection: ' + collection);
    return d[collection];
  }

  function set(collection, value) {
    if (!(collection in COLLECTIONS)) throw new Error('[store] unknown collection: ' + collection);
    const d = load();
    d[collection] = value;
    writeKey(collection, value);
    emit(collection, { external: false });
    return value;
  }

  /* Mutate in place then persist — saves callers a read/modify/write dance and
     guarantees the change and the notification cannot get out of step. */
  function update(collection, mutator) {
    const current = get(collection);
    const next = mutator(current);
    return set(collection, next === undefined ? current : next);
  }

  /* ── domain helpers ────────────────────────────────────────────────────────
     Thin, but they keep the key-shape conventions ("accId|||Mese YYYY") in one
     place instead of spread across the render code, which is how the source
     tool ended up with the same client addressed three different ways. */

  function feedKey(accountId, month) {
    return accountId + '|||' + month;
  }

  function parseFeedKey(key) {
    const i = key.indexOf('|||');
    return i < 0
      ? { accountId: key, month: '' }
      : { accountId: key.slice(0, i), month: key.slice(i + 3) };
  }

  function getClient(clientId) {
    return get('clients').find(c => c.id === clientId) || null;
  }

  function getClientByToken(token) {
    if (!token) return null;
    return get('clients').find(c => c.shareToken === token) || null;
  }

  function getFeed(accountId, month) {
    return get('feeds')[feedKey(accountId, month)] || [];
  }

  function setFeed(accountId, month, items) {
    return update('feeds', feeds => {
      feeds[feedKey(accountId, month)] = items;
      return feeds;
    });
  }

  function getStories(accountId, month) {
    return get('stories')[feedKey(accountId, month)] || [];
  }

  function setStories(accountId, month, items) {
    return update('stories', st => {
      st[feedKey(accountId, month)] = items;
      return st;
    });
  }

  /* Every feed item belonging to a client, across all of its accounts and
     months — what the client portal and the calendar both need. */
  function getClientFeeds(clientId) {
    const client = getClient(clientId);
    if (!client) return {};
    const accountIds = new Set((client.accounts || []).map(a => a.id));
    const out = {};
    for (const [key, items] of Object.entries(get('feeds'))) {
      if (accountIds.has(parseFeedKey(key).accountId)) out[key] = items;
    }
    return out;
  }

  /* ── auto-publish ──────────────────────────────────────────────────────────
     An approved post is scheduled to go out on its date; nobody should have
     to remember to come back and click "Pubblicato" once that day arrives.
     Lives here, not in the studio's core.js, because the client portal is a
     separate page that never loads core.js and needs the exact same sweep —
     whichever surface is opened first on a given day is the one that should
     catch it.

     Only 'approvato' moves — a post still waiting on the client, or one they
     asked changes to, is not something that should silently start reading as
     published just because its date passed. */
  function sweepPublished() {
    const d = new Date();
    const todayIso = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    const isDue = it => it && it.apprStato === 'approvato' && it.date && it.date <= todayIso;

    let any = false;
    for (const coll of ['feeds', 'stories']) {
      const all = get(coll);
      const dueKeys = Object.keys(all).filter(key => (all[key] || []).some(isDue));
      if (!dueKeys.length) continue;
      update(coll, cur => {
        dueKeys.forEach(key => {
          cur[key] = cur[key].map(it => isDue(it) ? { ...it, apprStato: 'pubblicato' } : it);
        });
        return cur;
      });
      any = true;
    }
    return any;
  }

  /* ── settings ──────────────────────────────────────────────────────────── */

  function getSetting(name, fallback) {
    const v = get('settings')[name];
    return v === undefined ? fallback : v;
  }

  function setSetting(name, value) {
    return update('settings', s => { s[name] = value; return s; });
  }

  /* ── import / export ───────────────────────────────────────────────────────
     The only backup that exists without a server, so it is a first-class
     feature rather than a debug hook. */

  function exportAll() {
    const d = load();
    return {
      _app: 'ideology-studio',
      _version: VERSION,
      _exportedAt: new Date().toISOString(),
      ...structuredClone(d),
    };
  }

  function importAll(payload, { merge = false } = {}) {
    if (!payload || payload._app !== 'ideology-studio') {
      throw new Error('File non riconosciuto — non è un export di Ideology Studio.');
    }
    for (const name of Object.keys(COLLECTIONS)) {
      if (!(name in payload)) continue;
      if (merge && Array.isArray(COLLECTIONS[name])) {
        const existing = get(name);
        const byId = new Map(existing.map(x => [x.id, x]));
        payload[name].forEach(x => byId.set(x.id, x));
        set(name, [...byId.values()]);
      } else if (merge && typeof COLLECTIONS[name] === 'object') {
        set(name, { ...get(name), ...payload[name] });
      } else {
        set(name, payload[name]);
      }
    }
    return true;
  }

  function reset() {
    for (const name of Object.keys(COLLECTIONS)) {
      try { localStorage.removeItem(keyFor(name)); } catch (_) {}
    }
    cache = null;
    load();
    emit('*', { reset: true });
  }

  /* Rough footprint, so the UI can warn before the 5MB wall rather than after.
     Counted in UTF-16 code units the way browsers actually charge for it. */
  function usage() {
    let bytes = 0;
    for (const name of Object.keys(COLLECTIONS)) {
      const raw = localStorage.getItem(keyFor(name));
      if (raw) bytes += (raw.length + keyFor(name).length) * 2;
    }
    return { bytes, kb: Math.round(bytes / 1024), pctOfTypicalQuota: Math.round((bytes / (5 * 1024 * 1024)) * 100) };
  }

  return {
    load, isEmpty, reset,
    get, set, update,
    subscribe,
    feedKey, parseFeedKey,
    getClient, getClientByToken, getClientFeeds,
    getFeed, setFeed, getStories, setStories,
    sweepPublished,
    getSetting, setSetting,
    exportAll, importAll, usage,
    COLLECTIONS: Object.keys(COLLECTIONS),
  };
})();
