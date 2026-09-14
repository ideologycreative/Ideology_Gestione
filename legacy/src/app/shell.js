/*
 * IDEOLOGY STUDIO — shell
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The frame: section menu, contextual header, section mount, inspector,
 * command palette, toasts. Owns routing and is the only thing that decides
 * what is on screen.
 *
 * ─── NAVIGATION ────────────────────────────────────────────────────────────
 * The left menu holds SECTIONS, not clients:
 *
 *     Home · Clienti · Contenuti · Calendario · Anteprima · Impostazioni
 *
 * Every section is reachable from every other one at all times, which is why
 * the menu is permanent rather than a page you return to. Content and
 * Anteprima each open on a client picker.
 *
 * The one deliberate dead end is the client portal: it opens in a new tab and
 * carries no link back into the studio. A client should never be one misclick
 * from the admin, and a screen-share of the portal should show them nothing
 * but their own content.
 *
 * ─── HEADER ────────────────────────────────────────────────────────────────
 * Contextual. Empty on Home and Settings; on the content workspace it carries
 * the account switch, month stepper, filter, type filter and view switch —
 * one line, replacing the two stacked toolbars and ~20 controls of the tool
 * this grew out of.
 */

window.Shell = (function () {
  'use strict';

  var A = window.App;
  var S = window.IdeologyStore;
  var h = A.h, icon = A.icon;

  var els = {};

  var MENU = [
    { id: 'home',     path: '/',         label: 'Home',         ic: 'home'  },
    { id: 'clients',  path: '/clients',  label: 'Clienti',      ic: 'users' },
    { id: 'content',  path: '/content',  label: 'Contenuti',    ic: 'layers'},
    { id: 'ugc',      path: '/ugc',      label: 'UGC',          ic: 'clapper' },
    { id: 'calendar', path: '/calendar', label: 'Calendario',   ic: 'calendar' },
    { id: 'preview',  path: '/preview',  label: 'Anteprima',    ic: 'eye'   },
    /* Connessioni is deliberately NOT here: the rail footer already carries it,
       with the connected account's name and its status. Two links to the same
       page in one rail is noise. It stays routable at #/connections and stays
       in the command palette below. */
    { id: 'settings', path: '/settings', label: 'Impostazioni', ic: 'cog'   },
  ];

  /* ══ MENU ═══════════════════════════════════════════════════════════════ */

  function renderMenu() {
    var rail = A.clear(els.rail);

    rail.appendChild(h('button', {
      cls: 'rail-hd', attrs: { title: 'Home' },
      on: { click: function () { A.go('/'); } },
    }, [
      h('span', { cls: 'mark', text: '!d', attrs: { 'aria-hidden': 'true' } }),
      h('span', { cls: 'wordmark', text: 'Ideology' }),
    ]));

    var nav = h('nav', { cls: 'menu', attrs: { 'aria-label': 'Sezioni' } });
    MENU.forEach(function (m) {
      var on = A.state.section === m.id;
      nav.appendChild(h('button', {
        cls: 'menu-item' + (on ? ' is-on' : ''),
        attrs: { 'aria-current': on ? 'page' : null },
        on: { click: function () { A.go(m.path); } },
      }, [icon(m.ic, 15), h('span', { text: m.label })]));
    });
    rail.appendChild(nav);

    rail.appendChild(h('div', { style: 'flex:1' }));

    var isLight = A.state.theme === 'light';
    rail.appendChild(h('div', { cls: 'rail-ft' }, [
      metaLink(),
      h('button', {
        cls: 'rail-link', attrs: { title: isLight ? 'Passa al tema scuro' : 'Passa al tema chiaro' },
        on: { click: function () { A.setTheme(isLight ? 'dark' : 'light'); } },
      }, [icon(isLight ? 'moon' : 'sun', 12), isLight ? 'Scuro' : 'Chiaro']),
      /* No search button here: the palette is a ⌘K thing. The shortcut and
         Shell.openPalette() both still work — this only drops the visual
         affordance for it. */
    ]));
  }

  /* Meta connection, parked in the rail so it is on screen from every section.
     It carries the connected account's name — but the reason it lives here
     rather than only on the Connessioni page is the failure case: an expired
     token or a binding pointing at a page we lost means posts quietly stop
     going out, and that cannot be something you only discover by visiting the
     right page. A problem shows as a dot here, everywhere, all the time. */
  function metaLink() {
    var conns = A.connections();

    if (!conns.length) {
      return h('button', {
        cls: 'rail-link rail-conn', attrs: { title: 'Collega un account Meta' },
        on: { click: function () { A.go('/connections'); } },
      }, [
        icon('link', 12),
        h('span', { cls: 'rail-conn-label', text: 'Collega Meta' }),
      ]);
    }

    var worst = 'active';
    conns.forEach(function (c) {
      var s = A.connectionStatus(c);
      if (s === 'expired') worst = 'expired';
      else if (s === 'expiring' && worst !== 'expired') worst = 'expiring';
    });
    var brokenCount = 0;
    A.clients().forEach(function (c) { brokenCount += A.clientBindingIssues(c).length; });
    if (brokenCount && worst === 'active') worst = 'broken';

    var label = conns.length === 1
      ? (conns[0].accountName || 'Account Meta')
      : conns.length + ' account Meta';

    var title = worst === 'expired' ? 'Connessione Meta scaduta — riconnetti'
      : worst === 'expiring' ? 'Il token Meta sta per scadere'
      : brokenCount ? brokenCount + ' collegamenti da sistemare'
      : 'Account Meta collegato';

    return h('button', {
      cls: 'rail-link rail-conn', attrs: { title: title, 'data-s': worst },
      on: { click: function () { A.go('/connections'); } },
    }, [
      icon('link', 12),
      h('span', { cls: 'rail-conn-label', text: label }),
      worst === 'active' ? null : h('i', { cls: 'rail-conn-dot' }),
    ]);
  }

  /* ══ HEADER ═════════════════════════════════════════════════════════════ */

  function renderHeader() {
    var hd = A.clear(els.header);
    var inWorkspace = A.state.section === 'content' && A.state.routeId && A.client();

    if (!inWorkspace) {
      els.header.classList.add('is-bare');
      return;
    }
    els.header.classList.remove('is-bare');

    var c = A.client();

    hd.appendChild(h('button', {
      cls: 'back back--inline', attrs: { title: 'Tutti i clienti' },
      on: { click: function () { A.go('/content'); } },
    }, [icon('left', 12)]));

    var logo = A.safeUrl(c.logo);
    hd.appendChild(h('div', { cls: 'hd-id' }, [
      logo
        ? h('img', { cls: 'hd-logo', attrs: { src: logo, alt: '' } })
        : h('span', { cls: 'hd-logo hd-logo--txt', text: A.initials(c.name),
            style: 'background:' + (c.color || 'var(--brand)') +
                   ';color:' + window.Sections.onColor(c.color) }),
      h('h1', { cls: 'hd-client', text: c.name }),
    ]));

    if (A.accounts().length > 1) {
      hd.appendChild(h('div', { cls: 'seg' }, A.accounts().map(function (a) {
        var on = A.account() && A.account().id === a.id;
        return h('button', {
          cls: 'seg-b', attrs: { 'aria-pressed': String(on),
            title: a.platform + ' · ' + A.platform(a.platform).feed.replace('/', ':') },
          on: { click: function () { A.set({ accountId: a.id, selectedId: null }, 'account'); } },
        }, [a.platform]);
      })));
    } else if (A.accounts().length === 1) {
      hd.appendChild(h('span', { cls: 'hd-handle',
        text: A.accounts()[0].handle || A.accounts()[0].platform }));
    }

    /* Stepper for the next/previous month — the common move — with the full
       picker beside it for anything further. The stepper alone was six clicks
       from March next year; the picker alone loses the one-tap "next month". */
    hd.appendChild(h('div', { cls: 'stepper' }, [
      h('button', {
        cls: 'iconbtn', attrs: { 'aria-label': 'Mese precedente' },
        on: { click: function () { A.set({ month: A.shiftMonth(-1), selectedId: null }, 'month'); } },
      }, [icon('left', 14)]),
      monthPicker(),
      h('button', {
        cls: 'iconbtn', attrs: { 'aria-label': 'Mese successivo' },
        on: { click: function () { A.set({ month: A.shiftMonth(1), selectedId: null }, 'month'); } },
      }, [icon('right', 14)]),
    ]));

    hd.appendChild(h('div', { style: 'flex:1' }));

    var q = h('input', {
      cls: 'search',
      attrs: { type: 'search', placeholder: 'Filtra…', 'aria-label': 'Filtra contenuti',
               value: A.state.query },
      on: { input: function () { A.set({ query: q.value }, 'query'); } },
    });
    hd.appendChild(h('div', { cls: 'search-wrap' }, [icon('search', 13), q]));

    hd.appendChild(h('div', { cls: 'seg' }, [
      { id: 'feed',  label: 'Post' },
      { id: 'story', label: 'Storie' },
    ].map(function (k) {
      var on = A.state.kind === k.id;
      return h('button', {
        cls: 'seg-b', attrs: { 'aria-pressed': String(on) },
        on: { click: function () { A.set({ kind: k.id, selectedId: null }, 'kind'); } },
      }, [k.label]);
    })));

    hd.appendChild(h('div', { cls: 'seg seg--view' }, [
      { id: 'list',  label: 'Tutti',    ic: 'rows' },
      { id: 'board', label: 'Pipeline', ic: 'board' },
      { id: 'grid',  label: 'Griglia',  ic: 'grid' },
    ].map(function (v) {
      var on = A.state.view === v.id;
      return h('button', {
        cls: 'seg-b', attrs: { 'aria-pressed': String(on), title: v.label },
        on: { click: function () { A.set({ view: v.id }, 'view'); } },
      }, [icon(v.ic, 13), h('span', { cls: 'seg-t', text: v.label })]);
    })));

    /* Opens the client's own portal, not a view of this one — an action, not
       a state this header is "in", which is why it sits outside the toggle
       group above rather than as a fourth member of it. Replaces the
       workspace calendar's old slot here: the coverage calendar (left rail)
       already covers "which days are filled" across every account, and
       jumping straight to what the client sees is the more useful thing to
       reach from here while planning. */
    hd.appendChild(h('button', {
      cls: 'btn btn--preview', attrs: { title: 'Apri il portale in una nuova scheda' },
      on: { click: function () {
        var c = A.client();
        if (c) window.open(A.portalUrl(c), '_blank', 'noopener');
      } },
    }, [icon('eye', 13), h('span', { cls: 'seg-t', text: 'Anteprima' })]));

    hd.appendChild(h('button', {
      cls: 'btn btn--primary',
      on: { click: function () { A.set({ selectedId: A.createItem({}) }, 'create'); } },
    }, [icon('plus', 13), 'Nuovo']));
  }

  /* Month picker bound to app state. Marks months that already hold content
     for the current account, so "where did I leave off" is answered before
     the click. */
  function monthPicker() {
    var acc = A.account();
    return window.MonthPicker.create({
      value: A.state.month,
      hasContent: function (label) {
        if (!acc) return false;
        return (S.getFeed(acc.id, label) || []).length > 0
            || (S.getStories(acc.id, label) || []).length > 0;
      },
      onPick: function (val) { A.set({ month: val, selectedId: null }, 'month'); },
    });
  }

  /* ══ STATUS BAR ═════════════════════════════════════════════════════════
     Only in the workspace: it describes the month on screen. On Home or
     Clients there is no "the month on screen", so it collapses. */

  function renderStatus() {
    var bar = A.clear(els.status);
    var inWorkspace = A.state.section === 'content' && A.state.routeId && A.client();

    if (!inWorkspace) {
      els.status.classList.add('is-bare');
      bar.appendChild(h('span', { cls: 'st-save', attrs: { id: 'save-state' }, text: '● Locale' }));
      return;
    }
    els.status.classList.remove('is-bare');

    var list = A.items();
    var p = A.progress(list);
    var CELLS = 16;
    var filled = Math.round(p.pct * CELLS);

    bar.appendChild(h('div', { cls: 'st-left' }, A.STATUSES.map(function (st) {
      var n = list.filter(function (i) { return (i.apprStato || 'bozza') === st.id; }).length;
      return h('span', { cls: 'st-seg', attrs: { 'data-s': st.id } }, [
        h('b', { text: st.token }), String(n),
      ]);
    })));
    bar.appendChild(h('div', { style: 'flex:1' }));
    bar.appendChild(h('div', { cls: 'st-right' }, [
      h('span', { cls: 'st-bar' }, [
        h('b', { text: '█'.repeat(filled) }), '░'.repeat(CELLS - filled),
      ]),
      h('span', { cls: 'st-ratio', text: p.done + '/' + p.total }),
      h('span', { cls: 'st-save', attrs: { id: 'save-state' }, text: '● Locale' }),
    ]));
  }

  /* ══ PALETTE ════════════════════════════════════════════════════════════ */

  var paletteOpen = false, palIndex = 0;

  function commands() {
    var out = [];
    MENU.forEach(function (m) {
      out.push({ group: 'Vai a', label: m.label, run: function () { A.go(m.path); } });
    });
    out.push({ group: 'Vai a', label: 'Connessioni',
      run: function () { A.go('/connections'); } });
    A.clients().forEach(function (c) {
      out.push({ group: 'Contenuti', label: c.name,
        run: function () { A.go('/content/' + c.id); } });
      out.push({ group: 'Scheda', label: c.name,
        run: function () { A.go('/clients/' + c.id); } });
      out.push({ group: 'Calendario', label: c.name,
        run: function () { A.go('/calendar/' + c.id); } });
      out.push({ group: 'UGC', label: c.name,
        run: function () { A.go('/ugc/' + c.id); } });
      out.push({ group: 'Portale', label: c.name,
        run: function () { window.open(A.portalUrl(c), '_blank', 'noopener'); } });
    });
    if (A.state.section === 'content' && A.state.routeId) {
      [['list','Tutti'],['board','Pipeline'],['grid','Griglia']].forEach(function (v) {
        out.push({ group: 'Vista', label: v[1], run: function () { A.set({ view: v[0] }, 'view'); } });
      });
      out.push({ group: 'Azione', label: 'Anteprima cliente', run: function () {
        var c = A.client();
        if (c) window.open(A.portalUrl(c), '_blank', 'noopener');
      } });
      out.push({ group: 'Azione', label: 'Nuovo contenuto',
        run: function () { A.set({ selectedId: A.createItem({}) }, 'create'); } });
    }
    out.push({ group: 'Azione', label: 'Nuovo cliente',
      run: function () { A.go('/clients/' + A.createClient({})); } });
    out.push({ group: 'Azione', label: 'Esporta dati', run: exportData });
    return out;
  }

  function openPalette() {
    paletteOpen = true; palIndex = 0;
    els.palette.classList.add('is-open');
    var input = A.$('#pal-input');
    input.value = '';
    paintPalette('');
    setTimeout(function () { input.focus(); }, 20);
  }
  function closePalette() {
    paletteOpen = false;
    els.palette.classList.remove('is-open');
  }

  function paintPalette(q) {
    var listEl = A.clear(A.$('#pal-list'));
    var matches = commands().filter(function (c) {
      return !q || (c.label + ' ' + c.group).toLowerCase().indexOf(q.toLowerCase()) >= 0;
    });
    palIndex = Math.min(palIndex, Math.max(0, matches.length - 1));
    if (!matches.length) {
      listEl.appendChild(h('div', { cls: 'pal-empty', text: 'Nessun comando' }));
      listEl._matches = [];
      return;
    }
    matches.forEach(function (c, i) {
      listEl.appendChild(h('button', {
        cls: 'pal-row' + (i === palIndex ? ' is-on' : ''),
        on: { click: function () { c.run(); closePalette(); } },
      }, [
        h('span', { cls: 'pal-group', text: c.group }),
        h('span', { cls: 'pal-label', text: c.label }),
      ]));
    });
    listEl._matches = matches;
  }

  /* ══ FEEDBACK ═══════════════════════════════════════════════════════════ */

  var toastTimer = null;
  function toast(msg) {
    var t = els.toast;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
  }

  function flashSave() {
    var el = A.$('#save-state');
    if (!el) return;
    el.textContent = '● Salvo…';
    el.dataset.state = 'saving';
    clearTimeout(flashSave._t);
    flashSave._t = setTimeout(function () {
      var cur = A.$('#save-state');
      if (!cur) return;
      cur.textContent = '● Locale';
      delete cur.dataset.state;
    }, 700);
  }

  function exportData() {
    try {
      var blob = new Blob([JSON.stringify(S.exportAll(), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ideology-studio-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast('Esportato');
    } catch (e) { toast('Esportazione fallita'); }
  }

  function importData() {
    var f = document.createElement('input');
    f.type = 'file'; f.accept = 'application/json';
    f.onchange = function () {
      var file = f.files && f.files[0];
      if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          S.importAll(JSON.parse(fr.result));
          toast('Importato');
          render();
        } catch (e) { toast(e.message || 'Import fallito'); }
      };
      fr.readAsText(file);
    };
    f.click();
  }

  /* ══ RENDER ═════════════════════════════════════════════════════════════ */

  var raf = null;
  function render() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = null;
      renderMenu();
      renderHeader();
      renderSection();
      renderStatus();
      document.body.dataset.section = A.state.section;
      document.body.classList.toggle('has-inspector',
        !!(A.state.selectedId && A.state.section === 'content' && A.state.routeId));
    });
  }

  function renderSection() {
    var mount = A.clear(els.view);
    var s = A.state.section;

    if (s === 'home')     return window.Sections.home(mount);
    if (s === 'clients')  return window.Sections.clients(mount);
    if (s === 'calendar') {
      return A.state.routeId && A.client()
        ? window.Sections.calendarMonth(mount, A.state.routeId)
        : window.Sections.calendarPicker(mount);
    }
    if (s === 'ugc') {
      return A.state.routeId && A.client()
        ? window.Sections.ugcMonth(mount, A.state.routeId)
        : window.Sections.ugcPicker(mount);
    }
    if (s === 'preview')  return window.Sections.preview(mount);
    if (s === 'connections') return window.Sections.connections(mount);
    if (s === 'settings') return window.Sections.settings(mount);

    if (s === 'content') {
      if (!A.state.routeId || !A.client()) return window.Sections.contentPicker(mount);
      if (!A.account()) {
        /* A client with no channel has nowhere to put content. Say so and
           point at the fix rather than rendering an empty board. */
        mount.appendChild(h('div', { cls: 'empty' }, [
          h('p', { text: 'Questo cliente non ha ancora un account social.' }),
          h('button', {
            cls: 'btn btn--primary',
            on: { click: function () { A.go('/clients/' + A.state.routeId); } },
          }, [icon('plus', 13), 'Aggiungi un account']),
        ]));
        window.Inspector.render(els.inspector);
        return;
      }
      window.Views.render(mount);
      window.Inspector.render(els.inspector);
      return;
    }
  }

  /* ══ BOOT ═══════════════════════════════════════════════════════════════ */

  function boot() {
    els.rail      = A.$('#rail');
    els.header    = A.$('#header');
    els.view      = A.$('#view');
    els.inspector = A.$('#inspector');
    els.status    = A.$('#status');
    els.palette   = A.$('#palette');
    els.toast     = A.$('#toast');

    if (S.isEmpty() && window.IdeologySeed) IdeologySeed.run(S);

    /* An approved post that has already reached its date should read as
       published the moment anyone opens the studio, not sit at "Approvato"
       until someone remembers to flip it by hand. */
    S.sweepPublished();

    var saved = S.getSetting('ui', {}) || {};
    A.state.month = saved.month || A.thisMonth();
    A.state.view  = saved.view  || 'list';
    A.state.kind  = saved.kind  || 'feed';
    A.state.accountId = saved.accountId || null;
    A.state.theme = saved.theme || 'light';
    document.documentElement.setAttribute('data-theme', A.state.theme);

    A.subscribe(function (reason) {
      render();
      if (['item', 'create', 'remove', 'move', 'clients'].indexOf(reason) >= 0) flashSave();
    });
    S.subscribe(function (e) { if (e.detail && e.detail.external) render(); });

    window.addEventListener('hashchange', A.readRoute);
    wireKeys();
    A.readRoute();
    render();

    /* Catches a post crossing its publish date while the tab is left open —
       the boot-time sweep above only covers what was already due on load. */
    setInterval(function () { if (S.sweepPublished()) render(); }, 5 * 60 * 1000);
  }

  function wireKeys() {
    var input = A.$('#pal-input');
    input.addEventListener('input', function () { palIndex = 0; paintPalette(input.value); });
    input.addEventListener('keydown', function (e) {
      var matches = (A.$('#pal-list')._matches) || [];
      if (e.key === 'ArrowDown') { e.preventDefault(); palIndex = Math.min(palIndex + 1, matches.length - 1); paintPalette(input.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palIndex = Math.max(palIndex - 1, 0); paintPalette(input.value); }
      else if (e.key === 'Enter') { e.preventDefault(); if (matches[palIndex]) { matches[palIndex].run(); closePalette(); } }
    });
    els.palette.addEventListener('click', function (e) {
      if (e.target === e.currentTarget) closePalette();
    });

    document.addEventListener('keydown', function (e) {
      var mod = e.metaKey || e.ctrlKey;
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '');

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        paletteOpen ? closePalette() : openPalette();
        return;
      }
      if (e.key === 'Escape') {
        if (paletteOpen) { closePalette(); return; }
        if (A.state.selectedId) { A.set({ selectedId: null }, 'close'); return; }
      }
      if (typing || mod) return;

      /* Workspace-only shortcuts. Firing "new content" from the client list
         would create a post against whatever client happened to be in state,
         which is exactly the kind of surprise a global shortcut should not
         produce. */
      if (A.state.section !== 'content' || !A.state.routeId) return;
      if (e.key === '1') A.set({ view: 'list' }, 'view');
      if (e.key === '2') A.set({ view: 'board' }, 'view');
      if (e.key === '3') A.set({ view: 'grid' }, 'view');
      if (e.key === '4') { var c4 = A.client(); if (c4) window.open(A.portalUrl(c4), '_blank', 'noopener'); }
      if (e.key === 'n') { e.preventDefault(); A.set({ selectedId: A.createItem({}) }, 'create'); }
      if (e.key === '[') A.set({ month: A.shiftMonth(-1), selectedId: null }, 'month');
      if (e.key === ']') A.set({ month: A.shiftMonth(1), selectedId: null }, 'month');
    });
  }

  return {
    boot: boot, render: render, toast: toast,
    openPalette: openPalette, exportData: exportData, importData: importData,
  };
})();

document.addEventListener('DOMContentLoaded', function () { window.Shell.boot(); });
