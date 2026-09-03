/*
 * IDEOLOGY STUDIO — core
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * State, routing, selectors, platform rules and DOM helpers. No rendering
 * lives here — sections and views import from this, and nothing in this file
 * knows what the UI looks like.
 *
 * ─── STRUCTURE ─────────────────────────────────────────────────────────────
 * The app is a set of SECTIONS reached from a permanent left menu:
 *
 *     #/                    home        studio at a glance
 *     #/clients             clients     manage the roster
 *     #/clients/:id         client      add / edit one client
 *     #/content             content     pick a client
 *     #/content/:id         workspace   plan that client's month
 *     #/preview             preview     pick a client to open their portal
 *     #/settings            settings
 *
 * Routing is hash-based on purpose: every screen gets a real URL, the browser
 * back button works, and a link to a specific client's workspace can be
 * pasted into a message. A single-screen app with hidden state has none of
 * that.
 *
 * ─── THE CONTENT MODEL ─────────────────────────────────────────────────────
 * Inside the content workspace the unit of work is one CLIENT · ACCOUNT ·
 * MONTH, and view/kind are lenses on that triple:
 *
 *     view  — board (pipeline) | grid (profile order) | calendar
 *     kind  — feed | story     (a FILTER, not a page)
 */

window.App = (function () {
  'use strict';

  var S = window.IdeologyStore;

  var MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

  /* The pipeline. The token is a fixed-width marker that lets a column of
     these scan like a log; the WORD is what makes it readable to anyone who
     has not learned the tokens yet. Both, everywhere — a symbol-only status
     is fast for the person who built it and opaque to everyone else. */
  var STATUSES = [
    { id: 'bozza',      token: '[··]', label: 'Bozza',      short: 'Bozza',
      hint: 'In lavorazione, non ancora inviato al cliente' },
    { id: 'approvare',  token: '[??]', label: 'Da approvare', short: 'Attesa',
      hint: 'Inviato al cliente, in attesa di risposta' },
    { id: 'revisione',  token: '[!!]', label: 'In revisione', short: 'Revisione',
      hint: 'Il cliente ha chiesto una modifica' },
    { id: 'approvato',  token: '[OK]', label: 'Approvato',  short: 'Approvato',
      hint: 'Approvato dal cliente, pronto a uscire' },
    { id: 'pubblicato', token: '[>>]', label: 'Pubblicato', short: 'Online',
      hint: 'Uscito online' },
  ];

  var TYPES = [
    { id: 'photo',    label: 'Foto',         color: '#2DA7A7' },
    { id: 'carousel', label: 'Carosello',    color: '#8B7BD8' },
    { id: 'reel',     label: 'Video / Reel', color: '#e40e49' },
  ];
  /* Stories are a kind, not a type, but they need their own mark on the
     coverage calendar for the same reason the types do. */
  var STORY_COLOR = '#f37c7b';

  function typeOf(id) {
    return TYPES.find(function (t) { return t.id === id; }) || TYPES[0];
  }

  /* Colour of the dot for one calendar entry. Sponsorship wins over type:
     a paid post is the thing you must not miss, whatever it is made of. */
  function entryColor(e) {
    if (e.sponsored) return '#F2C700';
    if (e.kind === 'story') return STORY_COLOR;
    return typeOf(e.type).color;
  }

  /* ── Platform rules ──────────────────────────────────────────────────────
     Drives the aspect ratio of every frame, in the studio grid AND in the
     client portal, so what you approve is the shape that gets published.
     `feed` is the in-grid ratio; `story` is always 9:16 because every
     platform's full-screen format is.

     NOTE ON FACEBOOK: its FEED is 1:1 / 4:5 — 9:16 is Stories and Reels,
     which this app already handles via the story kind and the reel type. Set
     to 1:1 for that reason; change `feed` below if you want it otherwise. */
  var PLATFORMS = {
    Instagram: { label: 'Instagram', feed: '4/5',  cols: 3, url: 'https://instagram.com/' },
    Facebook:  { label: 'Facebook',  feed: '1/1',  cols: 3, url: 'https://facebook.com/' },
    TikTok:    { label: 'TikTok',    feed: '9/16', cols: 4, url: 'https://tiktok.com/@' },
    LinkedIn:  { label: 'LinkedIn',  feed: '1/1',  cols: 3, url: 'https://linkedin.com/company/' },
    YouTube:   { label: 'YouTube',   feed: '16/9', cols: 2, url: 'https://youtube.com/@' },
    Pinterest: { label: 'Pinterest', feed: '2/3',  cols: 4, url: 'https://pinterest.com/' },
    Threads:   { label: 'Threads',   feed: '4/5',  cols: 3, url: 'https://threads.net/@' },
  };
  var STORY_RATIO = '9/16';

  function platform(name) { return PLATFORMS[name] || PLATFORMS.Instagram; }

  /* The ratio a frame is drawn at, which depends on WHERE it is drawn.
   *
   *   'grid'   every cell takes the account's feed ratio, whatever the item
   *            is. This is not a simplification — it is what the platforms
   *            do: a 9:16 reel appears in a profile grid cropped to the grid,
   *            and only plays full-height when opened.
   *   'detail' the item's own shape — a reel or story is 9:16.
   *
   * Getting this wrong is what broke the grid: drawing each cell at its own
   * ratio put a 9:16 reel beside a 4:5 photo, and no row could align. */
  function ratioFor(item, acc, context) {
    var feed = platform((acc || account() || {}).platform).feed;
    if (context === 'grid' || !item) return feed;
    if (item._kind === 'story' || item.type === 'reel') return STORY_RATIO;
    return feed;
  }

  /* ── State ─────────────────────────────────────────────────────────────── */

  var state = {
    section: 'home',
    routeId: null,        // client id when a section is scoped to one
    clientId: null,
    accountId: null,
    month: null,
    view: 'board',
    kind: 'feed',
    selectedId: null,
    query: '',
  };

  var listeners = [];
  function subscribe(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }
  function emit(reason) {
    listeners.forEach(function (fn) {
      try { fn(reason); } catch (e) { console.error('[app] listener threw', e); }
    });
  }

  function set(patch, reason) {
    var changed = false;
    Object.keys(patch).forEach(function (k) {
      if (state[k] !== patch[k]) { state[k] = patch[k]; changed = true; }
    });
    if (!changed) return;
    persist();
    emit(reason || 'set');
  }

  function persist() {
    try {
      S.setSetting('ui', {
        clientId: state.clientId, accountId: state.accountId,
        month: state.month, view: state.view, kind: state.kind,
      });
    } catch (e) { /* quota — never interrupt the user over UI state */ }
  }

  /* ── Routing ─────────────────────────────────────────────────────────────
     The hash is the source of truth for which section is showing. go() writes
     it; the shell listens for hashchange and calls readRoute(). That one
     direction keeps the URL and the screen from ever disagreeing. */

  function go(path) {
    if (location.hash === '#' + path) { readRoute(); return; }
    location.hash = path;
  }

  function readRoute() {
    var raw = (location.hash || '#/').replace(/^#/, '');
    var parts = raw.split('/').filter(Boolean);
    var section = parts[0] || 'home';
    var id = parts[1] || null;

    if (['home', 'clients', 'content', 'calendar', 'preview', 'settings'].indexOf(section) < 0) {
      section = 'home';
    }

    var patch = { section: section, routeId: id };

    /* The Calendario section is a read-only overview across ALL of a client's
       accounts, so it binds the client and the month but deliberately not an
       account — picking one would narrow the very thing it is there to show. */
    if (section === 'calendar' && id) {
      var cal = clients().find(function (x) { return x.id === id; });
      if (cal) {
        patch.clientId = cal.id;
        if (!state.month) patch.month = thisMonth();
      }
    }

    /* Entering a client's workspace binds the content state to that client
       and picks a sane account/month, so a pasted link lands somewhere real. */
    if (section === 'content' && id) {
      var c = clients().find(function (x) { return x.id === id; });
      if (c) {
        patch.clientId = c.id;
        var stillValid = (c.accounts || []).some(function (a) { return a.id === state.accountId; });
        if (!stillValid) patch.accountId = (c.accounts || [])[0] && c.accounts[0].id;
        if (!state.month) patch.month = thisMonth();
        patch.selectedId = null;
      }
    }
    set(patch, 'route');
    emit('route');
  }

  /* ── Clients ─────────────────────────────────────────────────────────── */

  function clients() { return S.get('clients') || []; }

  function client(id) {
    var all = clients();
    return all.find(function (c) { return c.id === (id || state.clientId); }) || null;
  }

  function accounts() {
    var c = client();
    return c ? (c.accounts || []) : [];
  }

  function account() {
    var accs = accounts();
    return accs.find(function (a) { return a.id === state.accountId; }) || accs[0] || null;
  }

  function newId(prefix) { return prefix + Math.random().toString(36).slice(2, 9); }

  /* A share token is minted once and never regenerated: it is baked into a
     link the client may have bookmarked, and rotating it silently would break
     their access with no message. Revocation belongs to a real backend. */
  function newToken() {
    var s = '';
    var bytes = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    bytes.forEach(function (b) { s += b.toString(16).padStart(2, '0'); });
    return s;
  }

  function createClient(patch) {
    var c = Object.assign({
      id: newId('c_'),
      name: 'Nuovo cliente',
      color: '#F2C700',
      /* Portal background. 'dark' matches the studio's own identity and is
         the default; 'light' is there for a brand whose own work reads
         better on white -- a gallery, an architecture studio, anything where
         a black ground would fight the client's own aesthetic rather than
         frame it. Set per client, never global: the studio stays one
         identity, the portals are allowed to be several. */
      theme: 'dark',
      logo: '',
      note: '',
      shareToken: newToken(),
      accounts: [],
      referente: { nome: '', email: '', tel: '' },
      active: true,
    }, patch || {});
    S.set('clients', clients().concat([c]));
    emit('clients');
    return c.id;
  }

  function updateClient(id, patch) {
    S.set('clients', clients().map(function (c) {
      return c.id === id ? Object.assign({}, c, patch) : c;
    }));
    emit('clients');
  }

  /* Removing a client takes its content with it. Leaving orphaned feeds keyed
     to dead account ids is how the source tool accumulated invisible data
     nobody could find or clear. */
  function removeClient(id) {
    var c = client(id);
    if (!c) return;
    var accIds = (c.accounts || []).map(function (a) { return a.id; });

    ['feeds', 'stories'].forEach(function (coll) {
      var next = {};
      Object.keys(S.get(coll) || {}).forEach(function (k) {
        if (accIds.indexOf(S.parseFeedKey(k).accountId) < 0) next[k] = S.get(coll)[k];
      });
      S.set(coll, next);
    });
    ['pillars', 'formats', 'pedPlans'].forEach(function (coll) {
      var cur = Object.assign({}, S.get(coll) || {});
      delete cur[id];
      S.set(coll, cur);
    });

    S.set('clients', clients().filter(function (x) { return x.id !== id; }));
    if (state.clientId === id) state.clientId = null;
    emit('clients');
  }

  function addAccount(clientId, platformName) {
    var c = client(clientId);
    if (!c) return null;
    var acc = { id: newId('a_'), platform: platformName || 'Instagram', name: '', handle: '' };
    updateClient(clientId, { accounts: (c.accounts || []).concat([acc]) });
    return acc.id;
  }

  function updateAccount(clientId, accId, patch) {
    var c = client(clientId);
    if (!c) return;
    updateClient(clientId, {
      accounts: (c.accounts || []).map(function (a) {
        return a.id === accId ? Object.assign({}, a, patch) : a;
      }),
    });
  }

  function removeAccount(clientId, accId) {
    var c = client(clientId);
    if (!c) return;
    ['feeds', 'stories'].forEach(function (coll) {
      var next = {};
      Object.keys(S.get(coll) || {}).forEach(function (k) {
        if (S.parseFeedKey(k).accountId !== accId) next[k] = S.get(coll)[k];
      });
      S.set(coll, next);
    });
    updateClient(clientId, {
      accounts: (c.accounts || []).filter(function (a) { return a.id !== accId; }),
    });
  }

  function portalUrl(c) {
    return location.origin + '/client?t=' + (c && c.shareToken ? c.shareToken : '');
  }

  /* ── Months ──────────────────────────────────────────────────────────── */

  function thisMonth() {
    var d = new Date();
    return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function shiftMonth(delta) {
    var parts = (state.month || thisMonth()).split(' ');
    var i = MONTHS.indexOf(parts[0]);
    var y = parseInt(parts[1], 10);
    i += delta;
    while (i < 0)  { i += 12; y -= 1; }
    while (i > 11) { i -= 12; y += 1; }
    return MONTHS[i] + ' ' + y;
  }

  /* ── Items ───────────────────────────────────────────────────────────── */

  function readKind(kind) {
    var acc = account();
    if (!acc) return [];
    var list = kind === 'story'
      ? S.getStories(acc.id, state.month)
      : S.getFeed(acc.id, state.month);
    return (list || []).map(function (it) { return Object.assign({ _kind: kind }, it); });
  }

  function writeKind(kind, items) {
    var acc = account();
    if (!acc) return;
    var clean = items.map(function (it) {
      var o = Object.assign({}, it);
      delete o._kind;
      return o;
    });
    if (kind === 'story') S.setStories(acc.id, state.month, clean);
    else                  S.setFeed(acc.id, state.month, clean);
  }

  function items(opts) {
    opts = opts || {};
    var kinds = opts.allKinds ? ['feed', 'story'] : [state.kind];
    var out = [];
    kinds.forEach(function (k) { out = out.concat(readKind(k)); });
    if (state.query) {
      var q = state.query.toLowerCase();
      out = out.filter(function (it) {
        return (it.copy || '').toLowerCase().indexOf(q) >= 0 ||
               (it.pilastro || '').toLowerCase().indexOf(q) >= 0 ||
               (it.note || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    return out;
  }

  function itemById(id) {
    var found = null;
    ['feed', 'story'].forEach(function (k) {
      if (found) return;
      var hit = readKind(k).find(function (it) { return it.id === id; });
      if (hit) found = hit;
    });
    return found;
  }

  /* ── Cross-account access ───────────────────────────────────────────────
     readKind/writeKind above are scoped to the ACTIVE account, which is right
     for the views. Group operations need to reach an item sitting in a
     sibling account, so these take the account explicitly. */

  function readAcc(accId, kind) {
    var list = kind === 'story'
      ? S.getStories(accId, state.month)
      : S.getFeed(accId, state.month);
    return (list || []).slice();
  }

  function writeAcc(accId, kind, items) {
    if (kind === 'story') S.setStories(accId, state.month, items);
    else                  S.setFeed(accId, state.month, items);
  }

  /* Every copy of a piece of content across this client's accounts, for the
     current month. One post targeting Instagram and Facebook is stored as two
     records sharing a groupId — each platform keeps its own feed position and
     its own approval state, because a client can approve on one channel and
     ask for changes on the other. */
  function groupSiblings(groupId) {
    var c = client();
    if (!c || !groupId) return [];
    var out = [];
    (c.accounts || []).forEach(function (a) {
      ['feed', 'story'].forEach(function (kind) {
        readAcc(a.id, kind).forEach(function (it) {
          if (it.groupId === groupId) out.push({ accountId: a.id, kind: kind, item: it });
        });
      });
    });
    return out;
  }

  /* Which accounts this content currently goes out on. */
  function targetsOf(item) {
    if (!item) return [];
    if (!item.groupId) {
      var acc = account();
      return acc ? [acc.id] : [];
    }
    return groupSiblings(item.groupId).map(function (r) { return r.accountId; });
  }

  /* Fields that describe the CONTENT, so they stay identical across every
     channel it goes out on. Everything else — approval state, the client's
     note, revision count, feed position — is per-channel on purpose. */
  var SHARED_FIELDS = ['url', 'externalUrl', 'videoUrl', 'slides',
                       'copy', 'note', 'date', 'pilastro', 'formato',
                       'type', 'sponsored'];

  /* Add or remove channels for a piece of content. Adding clones the content
     into that account's feed; removing deletes that channel's copy. The copy
     you are editing is never removed by this. */
  function setTargets(id, accountIds) {
    var item = itemById(id);
    if (!item) return;

    // Give it a group the first time it needs one.
    var gid = item.groupId;
    if (!gid) {
      gid = newId('g_');
      patchItem(id, { groupId: gid });
      item = itemById(id) || item;
    }

    var current = groupSiblings(gid);
    var have = current.map(function (r) { return r.accountId; });
    var self = current.find(function (r) { return r.item.id === id; });
    var selfAcc = self ? self.accountId : (account() || {}).id;
    var kind = item._kind || 'feed';

    // Additions
    accountIds.forEach(function (accId) {
      if (have.indexOf(accId) >= 0) return;
      var clone = Object.assign({}, item, {
        id: newId('i_'),
        groupId: gid,
        /* A new channel starts as a draft of its own. Carrying the source's
           approval across would mean a client had "approved" a post on a
           platform they were never shown. */
        apprStato: 'bozza',
        apprRevisions: 0,
        clientNote: '', apprNote: '', clientName: '',
      });
      delete clone._kind;
      writeAcc(accId, kind, [clone].concat(readAcc(accId, kind)));
    });

    /* Removals, INCLUDING the channel currently being viewed.
     *
     * This used to skip the copy under the cursor — the intent was "do not
     * delete the thing being edited", but the effect was that the channel you
     * were on could never be unticked: the click registered, the box cleared,
     * and nothing happened. Deselecting the current channel is a legitimate
     * thing to want (this post belongs on Facebook, not Instagram), so it is
     * allowed, and the caller is told where to move the selection. */
    var droppedSelf = false;
    current.forEach(function (r) {
      if (accountIds.indexOf(r.accountId) >= 0) return;
      if (r.item.id === id) droppedSelf = true;
      writeAcc(r.accountId, r.kind,
        readAcc(r.accountId, r.kind).filter(function (x) { return x.id !== r.item.id; }));
    });

    emit('targets');

    /* Where the inspector should go next. When the viewed copy is gone, the
       surviving sibling is the sensible target — and it lives under a
       different account, so the workspace has to switch to it or the user is
       left looking at a panel for something not on screen. */
    if (!droppedSelf) return { removedSelf: false };
    var remaining = groupSiblings(gid)[0];
    return {
      removedSelf: true,
      nextId: remaining ? remaining.item.id : null,
      nextAccountId: remaining ? remaining.accountId : null,
    };
  }

  function patchItem(id, patch) {
    var target = itemById(id);
    if (!target) return null;
    var kind = target._kind;
    writeKind(kind, readKind(kind).map(function (it) {
      return it.id === id ? Object.assign({}, it, patch) : it;
    }));

    /* Content edits reach every channel this post goes out on; approval state
       does not. Doing it here rather than at the call sites means every
       existing edit path gets it without knowing groups exist. */
    if (target.groupId) {
      var shared = {};
      SHARED_FIELDS.forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) shared[k] = patch[k];
      });
      if (Object.keys(shared).length) {
        groupSiblings(target.groupId).forEach(function (r) {
          if (r.item.id === id) return;
          writeAcc(r.accountId, r.kind, readAcc(r.accountId, r.kind).map(function (x) {
            return x.id === r.item.id ? Object.assign({}, x, shared) : x;
          }));
        });
      }
    }

    emit('item');
    return itemById(id);
  }

  function createItem(patch) {
    var kind = (patch && patch._kind) || state.kind;
    var item = Object.assign({
      id: newId('i_'),
      /* Every post belongs to a group, even when it starts on one channel —
         so adding a second channel later is a toggle, not a migration. */
      groupId: newId('g_'),
      type: 'photo',
      url: '', externalUrl: '',
      date: defaultDate(),
      copy: '', note: '', pilastro: '', formato: '',
      apprStato: 'bozza',
      apprRevisions: 0,
      /* Paid placement. Flagged rather than inferred: a sponsored post has
         legal disclosure requirements and a different budget line, so it has
         to be an explicit decision someone made, never a guess from content. */
      sponsored: false,
      /* A reel is a video with a still frame. `url` stays the poster — it is
         what the grid shows, exactly as the platforms do — and videoUrl is
         what actually plays when the post is opened. Keeping them separate
         means a reel can be planned and reviewed before the edit exists. */
      videoUrl: '',
    }, patch || {});
    delete item._kind;
    writeKind(kind, [item].concat(readKind(kind)));
    emit('create');
    return item.id;
  }

  function removeItem(id) {
    var target = itemById(id);
    if (!target) return;
    var kind = target._kind;
    writeKind(kind, readKind(kind).filter(function (it) { return it.id !== id; }));
    if (state.selectedId === id) state.selectedId = null;
    emit('remove');
  }

  function moveItem(id, index) {
    var target = itemById(id);
    if (!target) return;
    var kind = target._kind;
    var list = readKind(kind);
    var from = list.findIndex(function (it) { return it.id === id; });
    if (from < 0) return;
    var moved = list.splice(from, 1)[0];
    list.splice(Math.max(0, Math.min(list.length, index)), 0, moved);
    writeKind(kind, list);
    emit('move');
  }

  function defaultDate() {
    var parts = (state.month || thisMonth()).split(' ');
    var m = MONTHS.indexOf(parts[0]) + 1;
    var y = parts[1];
    var d = new Date();
    var day = (MONTHS[d.getMonth()] + ' ' + d.getFullYear()) === state.month ? d.getDate() : 1;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  /* ── Progress ────────────────────────────────────────────────────────── */

  function progress(list) {
    var all = list || items();
    var done = all.filter(function (i) { return i.apprStato === 'approvato'; }).length;
    return { done: done, total: all.length, pct: all.length ? done / all.length : 0 };
  }

  function clientProgress(c, monthStr) {
    var mo = monthStr || state.month || thisMonth();
    var done = 0, total = 0, pending = 0;
    (c.accounts || []).forEach(function (a) {
      (S.getFeed(a.id, mo) || []).forEach(function (it) {
        total++;
        if (it.apprStato === 'approvato') done++;
        if (it.apprStato === 'approvare' || it.apprStato === 'revisione') pending++;
      });
    });
    return { done: done, total: total, pending: pending, pct: total ? done / total : 0 };
  }

  function studioStats() {
    var mo = thisMonth();
    var cs = clients();
    var t = { clients: cs.length, accounts: 0, posts: 0, done: 0,
              pending: 0, revision: 0, sponsored: 0 };
    cs.forEach(function (c) {
      t.accounts += (c.accounts || []).length;
      (c.accounts || []).forEach(function (a) {
        (S.getFeed(a.id, mo) || []).forEach(function (it) {
          t.posts++;
          if (it.apprStato === 'approvato') t.done++;
          if (it.apprStato === 'approvare') t.pending++;
          if (it.apprStato === 'revisione') t.revision++;
          if (it.sponsored) t.sponsored++;
        });
      });
    });
    return t;
  }

  /* ── Month overview ──────────────────────────────────────────────────────
     Everything a client publishes in a month, across EVERY account and both
     kinds, grouped by day. Feeds the Calendario section, which answers one
     question — which days are covered and which are empty — so it must not be
     narrowed to a single account the way the workspace views are. */

  function clientMonthDays(clientId, monthStr) {
    var c = client(clientId);
    var mo = monthStr || state.month || thisMonth();
    var byDay = {};
    if (!c) return byDay;

    (c.accounts || []).forEach(function (a) {
      [['feed', S.getFeed(a.id, mo)], ['story', S.getStories(a.id, mo)]]
        .forEach(function (pair) {
          (pair[1] || []).forEach(function (it) {
            var d = dayOf(it.date);
            if (!d) return;
            (byDay[d] = byDay[d] || []).push({
              id: it.id,
              kind: pair[0],
              type: it.type || 'photo',
              platform: a.platform,
              stato: it.apprStato || 'bozza',
              sponsored: !!it.sponsored,
            });
          });
        });
    });
    return byDay;
  }

  function studioLogo() { return S.getSetting('studioLogo', '') || ''; }
  function setStudioLogo(v) { return S.setSetting('studioLogo', v || ''); }

  function pillars(id) { return (S.get('pillars') || {})[id || state.clientId] || []; }
  function formats(id) { return (S.get('formats') || {})[id || state.clientId] || []; }
  function statusOf(id) {
    return STATUSES.find(function (s) { return s.id === id; }) || STATUSES[0];
  }

  /* ── Formatting ──────────────────────────────────────────────────────── */

  function fmtDay(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? p[2] + '.' + p[1] : '—';
  }
  function dayOf(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? parseInt(p[2], 10) : null;
  }
  function monthMeta(monthStr) {
    var parts = (monthStr || thisMonth()).split(' ');
    var m = MONTHS.indexOf(parts[0]);
    var y = parseInt(parts[1], 10);
    var first = new Date(y, m, 1);
    return { month: m, year: y, days: new Date(y, m + 1, 0).getDate(), lead: (first.getDay() + 6) % 7 };
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  /* Only http(s) and data:image URLs may reach a src. Without this a stored
     "javascript:" URL becomes script execution when the browser resolves it. */
  function safeUrl(u) {
    var s = String(u || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,/i.test(s)) return s;
    return '';
  }

  /* Same gate for video sources, with the video MIME types instead. */
  function safeVideoUrl(u) {
    var s = String(u || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^data:video\/(mp4|webm|ogg|quicktime);base64,/i.test(s)) return s;
    if (/^blob:/i.test(s)) return s;
    return '';
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    /* Fallback for non-secure origins, where the async clipboard API is
       unavailable — a local prototype is often served over plain http. */
    return new Promise(function (res, rej) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        res();
      } catch (e) { rej(e); }
    });
  }

  /* ── DOM ─────────────────────────────────────────────────────────────────
     Everything user-supplied enters through textContent, so no render path in
     this app can interpolate content into markup. */

  function h(tag, opts, kids) {
    var e = document.createElement(tag);
    opts = opts || {};
    if (opts.cls) e.className = opts.cls;
    if (opts.text != null) e.textContent = opts.text;
    if (opts.attrs) Object.keys(opts.attrs).forEach(function (k) {
      if (opts.attrs[k] != null) e.setAttribute(k, opts.attrs[k]);
    });
    if (opts.style) e.style.cssText = opts.style;
    if (opts.on) Object.keys(opts.on).forEach(function (k) { e.addEventListener(k, opts.on[k]); });
    (kids || []).forEach(function (k) {
      if (k == null || k === false) return;
      e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    });
    return e;
  }

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }
  function $(sel, root) { return (root || document).querySelector(sel); }

  var ICONS = {
    home:     '<path d="M3 11l9-8 9 8M6 10v10h12V10"/>',
    users:    '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0114 0M17 5.5a3.5 3.5 0 010 7M18 20a6 6 0 00-2-4.5"/>',
    layers:   '<path d="M12 3l9 5-9 5-9-5 9-5M3 13l9 5 9-5M3 17l9 5 9-5"/>',
    eye:      '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
    cog:      '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
    board:    '<path d="M3 3h5v18H3zM10 3h5v12h-5zM17 3h4v7h-4"/>',
    grid:     '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7"/>',
    calendar: '<path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    close:    '<path d="M6 6l12 12M18 6L6 18"/>',
    left:     '<path d="M15 5l-7 7 7 7"/>',
    right:    '<path d="M9 5l7 7-7 7"/>',
    search:   '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    trash:    '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    link:     '<path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>',
    copy:     '<path d="M9 9h11v11H9zM5 15H4V4h11v1"/>',
    image:    '<path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6"/><circle cx="8.5" cy="8.5" r="1.5"/>',
    check:    '<path d="M4 12l5 5L20 6"/>',
    external: '<path d="M14 4h6v6M20 4l-8 8M18 14v6H4V6h6"/>',
    edit:     '<path d="M4 20h4L20 8l-4-4L4 16v4z"/>',
    megaphone: '<path d="M3 10v4h3l7 4V6l-7 4H3zM17 9a4 4 0 010 6"/>',
  };

  function icon(name, size) {
    var s = size || 14;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', s); svg.setAttribute('height', s);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'square');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name] || '';
    return svg;
  }

  return {
    MONTHS: MONTHS, STATUSES: STATUSES, TYPES: TYPES,
    STORY_COLOR: STORY_COLOR, typeOf: typeOf, entryColor: entryColor,
    PLATFORMS: PLATFORMS, STORY_RATIO: STORY_RATIO, platform: platform, ratioFor: ratioFor,
    state: state, set: set, subscribe: subscribe, emit: emit,
    go: go, readRoute: readRoute,
    clients: clients, client: client, accounts: accounts, account: account,
    createClient: createClient, updateClient: updateClient, removeClient: removeClient,
    addAccount: addAccount, updateAccount: updateAccount, removeAccount: removeAccount,
    portalUrl: portalUrl, newToken: newToken,
    thisMonth: thisMonth, shiftMonth: shiftMonth,
    items: items, itemById: itemById, patchItem: patchItem,
    createItem: createItem, removeItem: removeItem, moveItem: moveItem,
    readKind: readKind, writeKind: writeKind,
    groupSiblings: groupSiblings, targetsOf: targetsOf, setTargets: setTargets,
    SHARED_FIELDS: SHARED_FIELDS,
    progress: progress, clientProgress: clientProgress, studioStats: studioStats,
    clientMonthDays: clientMonthDays,
    pillars: pillars, formats: formats, statusOf: statusOf,
    studioLogo: studioLogo, setStudioLogo: setStudioLogo,
    fmtDay: fmtDay, dayOf: dayOf, monthMeta: monthMeta, initials: initials,
    safeUrl: safeUrl, safeVideoUrl: safeVideoUrl, copy: copy,
    h: h, clear: clear, $: $, icon: icon,
  };
})();
