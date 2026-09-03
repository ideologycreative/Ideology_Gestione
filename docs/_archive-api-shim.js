/*
 * IDEOLOGY STUDIO — API shim
 *
 * The extracted application still calls fetch('/api/...') in about ten places
 * that were not worth rewriting individually: a logout handler, a client
 * re-sync, a status webhook, upload fallbacks. In a local build those requests
 * hit nothing, and each failure surfaced as a console error or a hung spinner.
 *
 * Rather than patch ten call sites — and rather than leave the next person to
 * discover an eleventh — this intercepts /api/* at the fetch boundary and
 * answers from the local store. One seam, and any route that is NOT handled
 * here fails loudly with an explicit message instead of a confusing network
 * error, so a missed call site announces itself.
 *
 * Loaded before app.js. Only same-origin /api/ paths are touched; every other
 * request (the demo imagery, anything else) passes straight through.
 */

(function () {
  'use strict';

  const realFetch = window.fetch.bind(window);

  function json(body, status) {
    return new Response(JSON.stringify(body), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* Resolve a request argument to a pathname, whatever shape it arrived in —
     fetch accepts a string, a URL, or a Request object, and app.js uses more
     than one of those. */
  function pathOf(input) {
    try {
      if (typeof input === 'string') return new URL(input, location.href).pathname;
      if (input instanceof Request)  return new URL(input.url, location.href).pathname;
      if (input instanceof URL)      return input.pathname;
    } catch (_) { /* fall through */ }
    return null;
  }

  const ROUTES = {
    /* The app checks the session on boot and calls DELETE to log out. There is
       no session; report a stable local identity so the avatar and any
       role-gated UI resolve without a round trip. */
    '/api/auth': () => json({
      ok: true,
      username: 'studio',
      role: 'admin',
      profile: { nome: 'Ideology Studio', initials: 'ID', bg: '#F2C700', color: '#101010', avatarUrl: null },
    }),

    /* Pre-login picker. Never reached without auth, but answered anyway so a
       stray call cannot throw. */
    '/api/login-directory': () => json({
      people: [{ username: 'studio', nome: 'Ideology Studio', initials: 'ID', bg: '#F2C700', color: '#101010' }],
    }),

    /* Client list. Served from the store so a caller that re-reads mid-session
       sees the same data the rest of the app is working from, rather than a
       stale copy. */
    '/api/clients': () => {
      const clients = window.IdeologyStore ? window.IdeologyStore.get('clients') : [];
      return json({
        clients,
        total: clients.length,
        active: clients.filter(c => c.active !== false).length,
        updatedAt: null,
      });
    },

    /* Propagated content-status changes to other users' planning blobs. There
       are no other users and no planning app in this build, so this is a
       no-op that reports success — the caller only checks for a non-error. */
    '/api/content-webhook': () => json({ ok: true, updated: 0, reason: 'local build — no planning app' }),

    /* Server-side upload proxy. DROPBOX.upload is already replaced with a
       local FileReader path, so this only catches fallback callers. */
    '/api/dropbox-upload': () => json(
      { error: 'Upload remoto non disponibile in build locale — il file viene letto in locale.' },
      501
    ),
    '/api/dropbox-token': () => json({ token: null, source: 'local' }),
    '/api/dropbox-link':  () => json({ error: 'Non disponibile in build locale.' }, 501),

    /* The main project blob. app.js reaches it through CLOUD, which the
       extractor already rewired to the store — so arriving here means a call
       site was missed. Answer correctly rather than break, and say so. */
    '/api/project': () => {
      console.warn('[api-shim] /api/project was called directly — CLOUD should have handled this.');
      const s = window.IdeologyStore;
      return json({
        data: s ? { clients: s.get('clients'), feeds: s.get('feeds'), stories: s.get('stories') } : null,
        updatedAt: null,
      });
    },
  };

  window.fetch = function (input, init) {
    const path = pathOf(input);
    if (!path || path.indexOf('/api/') !== 0) return realFetch(input, init);

    const handler = ROUTES[path];
    if (handler) {
      const method = (init && init.method) || (input instanceof Request ? input.method : 'GET');
      return Promise.resolve(handler(method, init));
    }

    // Unhandled /api route: fail with something a developer can act on. The
    // alternative — letting it 404 against the static server — produces an
    // HTML error page that then explodes in .json() several frames later,
    // far from the actual cause.
    console.error('[api-shim] unhandled API route:', path,
      '\n  This build has no backend. Add a handler in src/store/api-shim.js.');
    return Promise.resolve(json({ error: 'Route non gestita in build locale: ' + path }, 501));
  };

  console.log('[api-shim] active —', Object.keys(ROUTES).length, 'local routes, no network.');
})();
