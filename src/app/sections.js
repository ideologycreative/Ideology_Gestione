/*
 * IDEOLOGY STUDIO — sections
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Everything that is not the content workspace: home, client management, the
 * portal launcher, settings. Each exports render(mount).
 *
 * A note on the shape of two of these. CONTENT and PREVIEW both begin with a
 * client picker rather than jumping straight into whichever client was open
 * last. That is deliberate: both are "which client am I dealing with" moments,
 * and the picker is where a studio lead sees the whole roster's state at once
 * — who is behind, who is waiting on a client reply. Landing directly in the
 * last-opened client hides exactly that.
 */

window.Sections = (function () {
  'use strict';

  var A = window.App;
  var h = A.h, icon = A.icon;

  /* Text commits rebuild the whole page (there is no partial re-render in
     this app), which would otherwise blow the input away after every single
     keystroke. Debouncing means the rebuild lands on a pause, not mid-word —
     the same trade the inspector already makes for its own text fields. */
  /* Keyed per field, not one shared timer — a single timer meant editing two
     different fields within 260ms of each other (tabbing from Creator to
     Brief while filling in a UGC row, say) silently dropped whichever one
     committed first: the second call's clearTimeout cancelled it before its
     callback ever ran. */
  var editTimers = {};
  function debounced(key, fn) {
    clearTimeout(editTimers[key]);
    editTimers[key] = setTimeout(fn, 260);
  }

  /* ── Shared: a client tile ───────────────────────────────────────────────
     Used by both pickers. Carries the client's own colour and logo, because
     across five or fifteen clients the brand mark is what you actually
     recognise — faster than reading names. */
  function clientTile(c, opts) {
    opts = opts || {};
    var p = A.clientProgress(c, A.thisMonth());
    var logo = A.safeUrl(c.logo);

    var mark = logo
      ? h('img', { cls: 'tile-logo', attrs: { src: logo, alt: '' } })
      : h('span', { cls: 'tile-logo tile-logo--txt', text: A.initials(c.name),
                    style: 'background:' + (c.color || 'var(--brand)') + ';color:' + onColor(c.color) });

    return h('button', {
      cls: 'tile',
      attrs: { title: c.name },
      on: { click: opts.onClick },
    }, [
      h('span', { cls: 'tile-bar', style: 'background:' + (c.color || 'var(--brand)') }),
      h('div', { cls: 'tile-hd' }, [
        mark,
        h('div', { cls: 'tile-id' }, [
          h('span', { cls: 'tile-name', text: c.name }),
          h('span', { cls: 'tile-accs',
            text: (c.accounts || []).map(function (a) { return a.platform; }).join(' · ') || 'Nessun account' }),
        ]),
      ]),
      h('div', { cls: 'tile-ft' }, [
        h('span', { cls: 'tile-meter' }, [
          h('i', { style: 'width:' + Math.round(p.pct * 100) + '%;background:' + (c.color || 'var(--brand)') }),
        ]),
        h('span', { cls: 'tile-count', text: p.total ? p.done + '/' + p.total : '—' }),
      ]),
      p.pending
        ? h('span', { cls: 'tile-flag', text: '[??] ' + p.pending })
        : null,
      opts.action || null,
    ]);
  }

  /* Contrast for text sitting on a client's own colour. Yellow and pale
     brand colours need black on top; dark ones need white. Relative
     luminance, not a guess. */
  function onColor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return '#101010';
    var n = parseInt(m[1], 16);
    var r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var f = function (v) { return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return (.2126 * f(r) + .7152 * f(g) + .0722 * f(b)) > .38 ? '#101010' : '#f2f2f2';
  }

  function pageHead(title, sub, actions) {
    return h('div', { cls: 'page-hd' }, [
      h('div', {}, [
        h('h1', { cls: 'page-title', text: title }),
        sub ? h('p', { cls: 'page-sub', text: sub }) : null,
      ]),
      h('div', { style: 'flex:1' }),
      actions || null,
    ]);
  }

  /* ══ HOME ═══════════════════════════════════════════════════════════════
     Deliberately quiet. The wordmark, the month, and the few numbers that
     change what you do next — not a dashboard of charts nobody acts on. */

  function renderHome(mount) {
    var t = A.studioStats();
    var page = h('div', { cls: 'page page--home' });

    page.appendChild(h('div', { cls: 'home-hero' }, [
      h('div', { cls: 'home-mark', text: '!d', attrs: { 'aria-hidden': 'true' } }),
      h('h1', { cls: 'home-word', text: 'Ideology' }),
      h('p', { cls: 'home-sub', text: 'Creative Studio · Ragusa · Milano' }),
    ]));

    page.appendChild(h('div', { cls: 'home-month', text: A.thisMonth() }));

    var stats = [
      { n: t.clients,  l: 'Clienti',        go: '/clients' },
      { n: t.accounts, l: 'Account social', go: '/clients' },
      { n: t.posts,    l: 'Contenuti',      go: '/content' },
      { n: t.done,     l: 'Approvati',      go: '/content', brand: true },
      { n: t.sponsored, l: 'Sponsorizzati',  go: '/calendar', spon: true },
    ];
    page.appendChild(h('div', { cls: 'home-stats' }, stats.map(function (s) {
      return h('button', {
        cls: 'stat' + (s.brand ? ' stat--brand' : '') + (s.spon ? ' stat--spon' : ''),
        on: { click: function () { A.go(s.go); } },
      }, [
        h('span', { cls: 'stat-n', text: String(s.n) }),
        h('span', { cls: 'stat-l', text: s.l }),
      ]);
    })));

    /* Only shown when there is something to act on. A permanent "0 waiting"
       row is noise; a row that appears only when work is blocked is a signal. */
    if (t.pending || t.revision) {
      var alerts = h('div', { cls: 'home-alerts' });
      if (t.pending) {
        alerts.appendChild(h('button', {
          cls: 'alert', on: { click: function () { A.go('/content'); } },
        }, [
          h('b', { text: '[??]' }),
          t.pending + (t.pending === 1 ? ' contenuto in attesa del cliente' : ' contenuti in attesa del cliente'),
        ]));
      }
      if (t.revision) {
        alerts.appendChild(h('button', {
          cls: 'alert alert--warn', on: { click: function () { A.go('/content'); } },
        }, [
          h('b', { text: '[!!]' }),
          t.revision + (t.revision === 1 ? ' modifica richiesta' : ' modifiche richieste'),
        ]));
      }
      page.appendChild(alerts);
    }

    mount.appendChild(page);
  }

  /* ══ CLIENTS ════════════════════════════════════════════════════════════ */

  function renderClients(mount) {
    if (A.state.routeId) return renderClientEdit(mount, A.state.routeId);

    var page = h('div', { cls: 'page' });
    page.appendChild(pageHead('Clienti', A.clients().length + ' in gestione',
      h('button', {
        cls: 'btn btn--primary',
        on: { click: function () { A.go('/clients/' + A.createClient({})); } },
      }, [icon('plus', 13), 'Nuovo cliente'])
    ));

    var list = A.clients();
    if (!list.length) {
      page.appendChild(h('div', { cls: 'empty' }, [
        h('p', { text: 'Nessun cliente. Aggiungine uno per iniziare.' }),
      ]));
    } else {
      page.appendChild(h('div', { cls: 'tiles' }, list.map(function (c) {
        return clientTile(c, { onClick: function () { A.go('/clients/' + c.id); } });
      })));
    }
    mount.appendChild(page);
  }

  /* ── Client editor ─────────────────────────────────────────────────────
     One page, saving on every change. Identity, then channels, then the
     portal link, then the destructive action last and visually separated. */

  function renderClientEdit(mount, id) {
    var c = A.client(id);
    if (!c) { A.go('/clients'); return; }

    var page = h('div', { cls: 'page' });

    page.appendChild(h('button', {
      cls: 'back', on: { click: function () { A.go('/clients'); } },
    }, [icon('left', 12), 'Tutti i clienti']));

    page.appendChild(pageHead(c.name || 'Cliente', 'Le modifiche si salvano da sole',
      h('div', { cls: 'f-row' }, [
        h('button', {
          cls: 'btn',
          on: { click: function () { A.go('/content/' + c.id); } },
        }, [icon('layers', 13), 'Contenuti']),
        h('button', {
          cls: 'btn btn--primary',
          on: { click: function () { window.open(A.portalUrl(c), '_blank', 'noopener'); } },
        }, [icon('external', 13), 'Apri portale']),
      ])
    ));

    var grid = h('div', { cls: 'form-grid' });

    /* ── Identity ─────────────────────────────────────────────────────── */
    var idCard = h('section', { cls: 'card-panel card-panel--span' }, [
      h('h2', { cls: 'panel-t', text: 'Identità' }),
    ]);

    var name = h('input', {
      cls: 'input', attrs: { type: 'text', value: c.name || '', 'aria-label': 'Nome cliente' },
      on: { input: function () {
        var v = name.value;
        debounced('client-name-' + c.id, function () { A.updateClient(c.id, { name: v }); });
      } },
    });
    idCard.appendChild(fld('Nome azienda', name));

    /* Colour: swatches plus a native picker. The swatches are the studio's
       own accents, which is what most clients get assigned; the picker is
       there for the ones with a real brand colour of their own. */
    var SWATCHES = ['#F2C700', '#2DA7A7', '#e40e49', '#f37c7b', '#00AFAF', '#8B7BD8', '#4ADE80', '#a3a3a3'];
    var picker = h('input', {
      cls: 'color-native',
      attrs: { type: 'color', value: /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#F2C700',
               'aria-label': 'Colore personalizzato' },
      on: { input: function () {
        hexInput.value = picker.value;
        hexInput.classList.remove('is-invalid');
        A.updateClient(c.id, { color: picker.value });
      } },
    });
    /* The picker's own swatch is a colour well, not a place to read or type a
       code — this is the field that makes "the colour code works" literally
       true: paste a brand hex here and it applies, live, once it is valid. */
    var hexInput = h('input', {
      cls: 'input hexinput',
      attrs: { type: 'text', maxlength: '7', placeholder: '#RRGGBB',
               'aria-label': 'Codice colore esadecimale', value: c.color || '#F2C700' },
      on: { input: function () {
        var v = hexInput.value.trim();
        if (v && v[0] !== '#') v = '#' + v;
        if (!/^#[0-9a-f]{6}$/i.test(v)) { hexInput.classList.add('is-invalid'); return; }
        hexInput.classList.remove('is-invalid');
        picker.value = v;
        debounced('client-color-' + c.id, function () { A.updateClient(c.id, { color: v }); });
      } },
    });
    idCard.appendChild(fld('Colore', h('div', { cls: 'swatches' },
      SWATCHES.map(function (hex) {
        return h('button', {
          cls: 'swatch' + ((c.color || '').toLowerCase() === hex.toLowerCase() ? ' is-on' : ''),
          style: 'background:' + hex,
          attrs: { 'aria-label': hex, title: hex },
          on: { click: function () { A.updateClient(c.id, { color: hex }); } },
        });
      }).concat([picker, hexInput])
    ), 'Un preset, il selettore, o incolla direttamente un codice esadecimale.'));

    /* Portal background. Two tiles rather than a toggle, because the choice
       is genuinely visual -- black ground vs white ground -- and a tile that
       actually LOOKS like the result is faster to read than a labelled
       switch. Live-swatches the client's own colour into each preview so the
       decision is made with the real combination, not an abstract yellow. */
    var curTheme = c.theme === 'light' ? 'light' : 'dark';
    idCard.appendChild(fld('Sfondo portale',
      h('div', { cls: 'theme-pick' }, [
        { id: 'dark',  label: 'Scuro',  bg: '#101010', fg: '#f2f2f2' },
        { id: 'light', label: 'Chiaro', bg: '#ffffff', fg: '#101010' },
      ].map(function (t) {
        var on = curTheme === t.id;
        return h('button', {
          cls: 'theme-tile' + (on ? ' is-on' : ''),
          attrs: { 'aria-pressed': String(on) },
          on: { click: function () { A.updateClient(c.id, { theme: t.id }); } },
        }, [
          h('span', {
            cls: 'theme-swatch',
            style: 'background:' + t.bg + ';color:' + t.fg,
          }, [
            h('i', { style: 'background:' + (c.color || '#F2C700') }),
          ]),
          h('span', { cls: 'theme-lbl', text: t.label }),
        ]);
      }))
    , 'Come vedrà il piano il cliente quando apre il link. Lo sfondo scuro è quello dello studio; il chiaro è pensato per un cliente il cui lavoro rende meglio su bianco.'));

    /* Logo — stored as a data URL, same trade as post images. */
    var logoFile = h('input', {
      attrs: { type: 'file', accept: 'image/*', hidden: 'hidden' },
      on: { change: function () {
        var f = logoFile.files && logoFile.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try { A.updateClient(c.id, { logo: fr.result }); window.Shell.toast('Logo aggiornato'); }
          catch (e) {
            window.Shell.toast(e && e.code === 'QUOTA' ? 'Spazio locale esaurito' : 'Caricamento fallito');
          }
        };
        fr.onerror = function () { window.Shell.toast('Lettura del file fallita'); };
        fr.readAsDataURL(f);
      } },
    });
    var logoPrev = A.safeUrl(c.logo)
      ? h('img', { cls: 'logo-prev', attrs: { src: A.safeUrl(c.logo), alt: 'Logo ' + c.name } })
      : h('span', { cls: 'logo-prev logo-prev--txt', text: A.initials(c.name),
                    style: 'background:' + (c.color || 'var(--brand)') + ';color:' + onColor(c.color) });

    idCard.appendChild(fld('Logo', h('div', { cls: 'logo-row' }, [
      logoPrev,
      h('button', { cls: 'btn', on: { click: function () { logoFile.click(); } } },
        [icon('image', 13), 'Carica']),
      A.safeUrl(c.logo)
        ? h('button', { cls: 'btn', on: { click: function () { A.updateClient(c.id, { logo: '' }); } } },
            ['Rimuovi'])
        : null,
      logoFile,
    ]), 'PNG o SVG con sfondo trasparente. In mancanza si usano le iniziali.'));

    var note = h('textarea', {
      cls: 'input input--area', attrs: { rows: '3', 'aria-label': 'Note',
        placeholder: 'Tono di voce, vincoli, referente…' },
      on: { input: function () {
        var v = note.value;
        debounced('client-note-' + c.id, function () { A.updateClient(c.id, { note: v }); });
      } },
    });
    note.value = c.note || '';
    idCard.appendChild(fld('Note interne', note));

    grid.appendChild(idCard);

    /* ── Categories ───────────────────────────────────────────────────────
       What kind of content a post is — customer review, product, service,
       niche, educational, before/after. Every client has its own mix, so
       unlike the fixed fields above this list is entirely built by the
       studio: add one, rename it, recolour it, or drop it. The chip that
       applies a category lives in the post editor; this is where the set of
       categories itself is defined. */
    var catCard = h('section', { cls: 'card-panel card-panel--span' }, [
      h('h2', { cls: 'panel-t', text: 'Categorie di contenuto' }),
      h('p', { cls: 'panel-sub',
        text: 'Che tipo di contenuto è: recensione cliente, prodotto, servizio, educational, prima/dopo… Appaiono come chip su ogni post.' }),
    ]);

    A.pillars(c.id).forEach(function (cat) {
      var row = h('div', { cls: 'cat-row' });

      var sw = h('input', {
        cls: 'color-native color-native--sm',
        attrs: { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cat.color || '') ? cat.color : '#2DA7A7',
                 'aria-label': 'Colore categoria' },
        on: { input: function () { A.updatePillar(c.id, cat.id, { color: sw.value }); } },
      });

      var nm = h('input', {
        cls: 'input', attrs: { type: 'text', value: cat.name || '', 'aria-label': 'Nome categoria' },
        on: { input: function () {
          var v = nm.value;
          debounced('cat-name-' + cat.id, function () { A.updatePillar(c.id, cat.id, { name: v }); });
        } },
      });

      row.appendChild(sw);
      row.appendChild(nm);
      row.appendChild(h('button', {
        cls: 'iconbtn', attrs: { 'aria-label': 'Elimina categoria', title: 'Elimina categoria' },
        on: { click: function () {
          if (!confirm('Eliminare la categoria "' + (cat.name || '') +
            '"? I contenuti già taggati manterranno l\'etichetta.')) return;
          A.removePillar(c.id, cat.id);
          window.Shell.toast('Categoria eliminata');
        } },
      }, [icon('trash', 13)]));

      catCard.appendChild(row);
    });

    if (!A.pillars(c.id).length) {
      catCard.appendChild(h('p', { cls: 'panel-empty', text: 'Nessuna categoria ancora.' }));
    }

    catCard.appendChild(h('button', {
      cls: 'btn', on: { click: function () { A.addPillar(c.id, {}); } },
    }, [icon('plus', 13), 'Aggiungi categoria']));

    grid.appendChild(catCard);

    /* ── Channels ─────────────────────────────────────────────────────── */
    var accCard = h('section', { cls: 'card-panel card-panel--span' }, [
      h('h2', { cls: 'panel-t', text: 'Account social' }),
      h('p', { cls: 'panel-sub',
        text: 'Il formato di ogni piattaforma decide le proporzioni della griglia, nel pannello e nel portale cliente.' }),
    ]);

    (c.accounts || []).forEach(function (a) {
      var pf = A.platform(a.platform);
      var row = h('div', { cls: 'acc-row' });

      var sel = h('select', {
        cls: 'input', attrs: { 'aria-label': 'Piattaforma' },
        on: { change: function () { A.updateAccount(c.id, a.id, { platform: sel.value }); } },
      }, Object.keys(A.PLATFORMS).map(function (k) {
        var o = h('option', { text: A.PLATFORMS[k].label, attrs: { value: k } });
        if (a.platform === k) o.selected = true;
        return o;
      }));

      var nm = h('input', {
        cls: 'input', attrs: { type: 'text', placeholder: 'Nome pagina', value: a.name || '',
                               'aria-label': 'Nome account' },
        on: { input: function () {
          var v = nm.value;
          debounced('acc-name-' + a.id, function () { A.updateAccount(c.id, a.id, { name: v }); });
        } },
      });

      var hd = h('input', {
        cls: 'input', attrs: { type: 'text', placeholder: '@username', value: a.handle || '',
                               'aria-label': 'Username' },
        on: { input: function () {
          var v = hd.value;
          debounced('acc-handle-' + a.id, function () { A.updateAccount(c.id, a.id, { handle: v }); });
        } },
      });

      row.appendChild(h('div', { cls: 'acc-main' }, [sel, nm, hd]));
      row.appendChild(h('div', { cls: 'acc-side' }, [
        h('span', { cls: 'acc-ratio', text: pf.feed.replace('/', ':') }),
        h('button', {
          cls: 'iconbtn', attrs: { 'aria-label': 'Rimuovi account', title: 'Rimuovi — cancella anche i suoi contenuti' },
          on: { click: function () {
            if (!confirm('Rimuovere questo account? I contenuti collegati verranno eliminati.')) return;
            A.removeAccount(c.id, a.id);
            window.Shell.toast('Account rimosso');
          } },
        }, [icon('trash', 13)]),
      ]));
      accCard.appendChild(row);

      /* Which real Meta page this channel publishes to. Only meaningful for
         the networks Meta actually owns — a TikTok or LinkedIn row has nothing
         to bind, and pretending otherwise would be noise. */
      if (a.platform === 'Instagram' || a.platform === 'Facebook') {
        accCard.appendChild(metaBindingRow(c, a));
      }
    });

    if (!(c.accounts || []).length) {
      accCard.appendChild(h('p', { cls: 'panel-empty', text: 'Nessun account collegato.' }));
    }

    accCard.appendChild(h('button', {
      cls: 'btn', on: { click: function () { A.addAccount(c.id, 'Instagram'); } },
    }, [icon('plus', 13), 'Aggiungi account']));

    grid.appendChild(accCard);

    /* ── Portal ───────────────────────────────────────────────────────── */
    var url = A.portalUrl(c);
    var portalCard = h('section', { cls: 'card-panel card-panel--span' }, [
      h('h2', { cls: 'panel-t', text: 'Portale cliente' }),
      h('p', { cls: 'panel-sub',
        text: 'Link privato per approvare i contenuti. Nessun login: chi ha il link ha accesso.' }),
      h('div', { cls: 'url-row' }, [
        h('code', { cls: 'url', text: url }),
        h('button', {
          cls: 'btn btn--primary',
          on: { click: function () {
            A.copy(url)
              .then(function () { window.Shell.toast('Link copiato'); })
              .catch(function () { window.Shell.toast('Copia non riuscita'); });
          } },
        }, [icon('copy', 13), 'Copia link']),
        h('button', {
          cls: 'btn',
          on: { click: function () { window.open(url, '_blank', 'noopener'); } },
        }, [icon('external', 13), 'Apri']),
      ]),
    ]);
    grid.appendChild(portalCard);

    /* ── Danger ───────────────────────────────────────────────────────── */
    grid.appendChild(h('section', { cls: 'card-panel card-panel--danger card-panel--span' }, [
      h('h2', { cls: 'panel-t', text: 'Elimina cliente' }),
      h('p', { cls: 'panel-sub',
        text: 'Rimuove il cliente e tutti i suoi contenuti, account e piani. Irreversibile.' }),
      h('button', {
        cls: 'btn btn--danger',
        on: { click: function () {
          if (!confirm('Eliminare "' + c.name + '" e tutti i suoi contenuti? Non è reversibile.')) return;
          A.removeClient(c.id);
          window.Shell.toast('Cliente eliminato');
          A.go('/clients');
        } },
      }, [icon('trash', 13), 'Elimina ' + (c.name || 'cliente')]),
    ]));

    page.appendChild(grid);
    mount.appendChild(page);
  }

  /* ── Meta page binding, per client channel ───────────────────────────────
     The point where "I have a lot of client pages under one account and they
     must never get mixed" is actually enforced. Three things do that work:
     the bound page's REAL name from Meta is shown (not the name someone typed
     into the field above it), a page already taken by another client cannot be
     picked, and a binding that stops resolving turns loud instead of silently
     failing at publish time. */
  function metaBindingRow(c, a) {
    var wrap = h('div', { cls: 'bind-row' });
    var page = A.boundPage(a);
    var issue = A.bindingIssue(a);

    if (A.isBound(a) && page && !issue) {
      wrap.classList.add('is-ok');
      wrap.appendChild(h('span', { cls: 'bind-icon', text: '✓' }));
      wrap.appendChild(h('div', { cls: 'bind-id' }, [
        h('span', { cls: 'bind-page', text: page.name }),
        h('span', { cls: 'bind-sub', text: a.platform === 'Instagram' && page.igUsername
          ? '@' + page.igUsername
          : 'Pagina Facebook' }),
      ]));
    } else if (A.isBound(a)) {
      wrap.classList.add('is-bad');
      wrap.appendChild(h('span', { cls: 'bind-icon', text: '!' }));
      wrap.appendChild(h('div', { cls: 'bind-id' }, [
        h('span', { cls: 'bind-page', text: page ? page.name : 'Pagina non disponibile' }),
        h('span', { cls: 'bind-sub', text: issue }),
      ]));
    } else {
      wrap.appendChild(h('span', { cls: 'bind-icon bind-icon--none', text: '·' }));
      wrap.appendChild(h('div', { cls: 'bind-id' }, [
        h('span', { cls: 'bind-page bind-page--none', text: 'Nessuna pagina Meta collegata' }),
        h('span', { cls: 'bind-sub', text: 'Questo canale non pubblicherà finché non scegli una pagina.' }),
      ]));
    }

    var pages = A.metaPages();
    if (!pages.length) {
      wrap.appendChild(h('button', {
        cls: 'btn btn--xs', on: { click: function () { A.go('/connections'); } },
      }, ['Collega Meta']));
      return wrap;
    }

    /* A select rather than a dialog: the whole decision is "which of these
       pages", and every constraint (already taken, wrong IG account type, no
       IG linked) can be said in the option label itself. */
    var picker = h('select', {
      cls: 'input input--sm bind-picker', attrs: { 'aria-label': 'Pagina Meta' },
      on: { change: function () {
        if (!picker.value) { A.unbindAccount(c.id, a.id); window.Shell.toast('Pagina scollegata'); return; }
        var parts = picker.value.split('|');
        var res = A.bindAccount(c.id, a.id, parts[0], parts[1]);
        window.Shell.toast(res.ok ? 'Collegato a ' + res.page.name : res.reason);
      } },
    });
    picker.appendChild(h('option', { text: '— nessuna —', attrs: { value: '' } }));

    pages.forEach(function (p) {
      var taken = A.pageBoundTo(p.connectionId, p.pageId, a.id);
      var label = p.name;
      var blocked = false;

      if (a.platform === 'Instagram') {
        if (!p.igUserId) { label += ' — nessun IG collegato'; blocked = true; }
        else if (p.igAccountType === 'PERSONAL') { label += ' — IG personale, non pubblicabile'; blocked = true; }
        else label += ' — @' + p.igUsername;
      }
      if (taken) { label += ' (già su ' + taken.client.name + ')'; blocked = true; }

      var opt = h('option', {
        text: label,
        attrs: { value: p.connectionId + '|' + p.pageId, disabled: blocked ? 'disabled' : null },
      });
      if (a.meta && a.meta.pageId === p.pageId && a.meta.connectionId === p.connectionId) opt.selected = true;
      picker.appendChild(opt);
    });

    wrap.appendChild(picker);
    return wrap;
  }

  function fld(label, control, hint) {
    return h('div', { cls: 'f' }, [
      h('label', { cls: 'f-label', text: label }),
      control,
      hint ? h('p', { cls: 'f-hint', text: hint }) : null,
    ]);
  }

  /* ══ CONTENT PICKER ═════════════════════════════════════════════════════ */

  function renderContentPicker(mount) {
    var page = h('div', { cls: 'page' });
    page.appendChild(pageHead('Contenuti', 'Scegli un cliente da pianificare · ' + A.thisMonth()));

    var list = A.clients();
    if (!list.length) {
      page.appendChild(h('div', { cls: 'empty' }, [
        h('p', { text: 'Nessun cliente ancora.' }),
        h('button', { cls: 'btn btn--primary', on: { click: function () { A.go('/clients'); } } },
          [icon('plus', 13), 'Aggiungi un cliente']),
      ]));
    } else {
      page.appendChild(h('div', { cls: 'tiles' }, list.map(function (c) {
        return clientTile(c, { onClick: function () { A.go('/content/' + c.id); } });
      })));
    }
    mount.appendChild(page);
  }

  /* ══ CALENDARIO ═════════════════════════════════════════════════════════
     A coverage map, not a content view. One question: which days of the month
     are filled and which are empty. So it carries no titles, no thumbnails
     and no captions — a dot per post is the entire vocabulary, and the eye
     reads density across a grid far faster than it reads a list of names.

     It spans EVERY account and both posts and stories, because a gap only
     matters if it is a gap everywhere. The workspace calendar is the one for
     detail; this is the one for shape. */

  function renderCalendarPicker(mount) {
    var page = h('div', { cls: 'page' });
    page.appendChild(pageHead('Calendario', 'Scegli un cliente per vedere la copertura del mese'));

    var list = A.clients();
    if (!list.length) {
      page.appendChild(h('div', { cls: 'empty' }, [h('p', { text: 'Nessun cliente ancora.' })]));
    } else {
      page.appendChild(h('div', { cls: 'tiles' }, list.map(function (c) {
        return clientTile(c, { onClick: function () { A.go('/calendar/' + c.id); } });
      })));
    }
    mount.appendChild(page);
  }

  function renderCalendarMonth(mount, id) {
    var c = A.client(id);
    if (!c) { A.go('/calendar'); return; }

    var month = A.state.month || A.thisMonth();
    var meta  = A.monthMeta(month);
    var byDay = A.clientMonthDays(c.id, month);

    var days = Object.keys(byDay).length;
    var total = Object.keys(byDay).reduce(function (n, k) { return n + byDay[k].length; }, 0);
    var sponsored = Object.keys(byDay).reduce(function (n, k) {
      return n + byDay[k].filter(function (x) { return x.sponsored; }).length;
    }, 0);

    var page = h('div', { cls: 'page' });

    page.appendChild(h('button', {
      cls: 'back', on: { click: function () { A.go('/calendar'); } },
    }, [icon('left', 12), 'Tutti i clienti']));

    page.appendChild(pageHead(c.name, days + ' giorni coperti su ' + meta.days +
      ' · ' + total + ' contenuti' + (sponsored ? ' · ' + sponsored + ' sponsorizzati' : ''),
      h('div', { cls: 'f-row' }, [
        h('button', {
          cls: 'btn', on: { click: function () { A.go('/content/' + c.id); } },
        }, [icon('layers', 13), 'Pianifica']),
      ])
    ));

    /* Month stepper — the only control on the page. */
    page.appendChild(h('div', { cls: 'cov-bar' }, [
      h('div', { cls: 'stepper' }, [
        h('button', {
          cls: 'iconbtn', attrs: { 'aria-label': 'Mese precedente' },
          on: { click: function () { A.set({ month: A.shiftMonth(-1) }, 'month'); } },
        }, [icon('left', 14)]),
        window.MonthPicker.create({
          value: month,
          /* Dots here span every account, matching what this view counts. */
          hasContent: function (lbl) {
            return Object.keys(A.clientMonthDays(c.id, lbl)).length > 0;
          },
          onPick: function (val) { A.set({ month: val }, 'month'); },
        }),
        h('button', {
          cls: 'iconbtn', attrs: { 'aria-label': 'Mese successivo' },
          on: { click: function () { A.set({ month: A.shiftMonth(1) }, 'month'); } },
        }, [icon('right', 14)]),
      ]),
      h('div', { style: 'flex:1' }),
      h('div', { cls: 'legend' }, A.TYPES.map(function (t) {
        return h('span', { cls: 'legend-i' }, [
          h('i', { cls: 'dot', style: 'background:' + t.color }), t.label,
        ]);
      }).concat([
        h('span', { cls: 'legend-i' }, [
          h('i', { cls: 'dot', style: 'background:' + A.STORY_COLOR }), 'Storia',
        ]),
        h('span', { cls: 'legend-i' }, [
          h('i', { cls: 'dot dot--spon' }), 'Sponsorizzato',
        ]),
      ])),
    ]));

    var cal = h('div', { cls: 'cov' });
    ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].forEach(function (d) {
      cal.appendChild(h('div', { cls: 'cov-hd', text: d }));
    });
    for (var i = 0; i < meta.lead; i++) {
      cal.appendChild(h('div', { cls: 'cov-cell cov-cell--pad' }));
    }

    var today = new Date();
    var isNow = today.getFullYear() === meta.year && today.getMonth() === meta.month;

    for (var day = 1; day <= meta.days; day++) {
      (function (day) {
        var list = byDay[day] || [];
        var hasSpon = list.some(function (x) { return x.sponsored; });

        var cell = h('button', {
          cls: 'cov-cell'
            + (list.length ? ' is-full' : '')
            + (hasSpon ? ' is-spon' : '')
            + (isNow && today.getDate() === day ? ' is-today' : ''),
          attrs: {
            title: list.length
              ? day + ': ' + list.map(function (x) {
                  return x.sponsored ? 'Sponsorizzato'
                    : x.kind === 'story' ? 'Storia' : A.typeOf(x.type).label;
                }).join(', ')
              : day + ': nessun contenuto',
            'aria-label': day + ', ' + list.length + ' contenuti',
          },
          /* Clicking a day hands off to the workspace, on that month. The
             coverage map answers "where are the gaps"; filling one is the
             planner's job, so it sends you there rather than editing here. */
          on: { click: function () { A.go('/content/' + c.id); } },
        }, [
          h('span', { cls: 'cov-day', text: String(day).padStart(2, '0') }),
        ]);

        if (list.length) {
          /* Sponsored dots sort first so they are never pushed out of sight
             by a busy day. */
          var ordered = list.slice().sort(function (a, b) {
            return (b.sponsored ? 1 : 0) - (a.sponsored ? 1 : 0);
          });
          var dots = h('span', { cls: 'cov-dots' });
          ordered.slice(0, 8).forEach(function (x) {
            var label = x.sponsored ? 'Sponsorizzato'
              : x.kind === 'story' ? 'Storia' : A.typeOf(x.type).label;
            dots.appendChild(h('i', {
              cls: 'dot' + (x.sponsored ? ' dot--spon' : ''),
              style: 'background:' + A.entryColor(x),
              attrs: { title: label },
            }));
          });
          if (ordered.length > 8) {
            dots.appendChild(h('span', { cls: 'cov-more', text: '+' + (ordered.length - 8) }));
          }
          cell.appendChild(dots);
        }
        cal.appendChild(cell);
      })(day);
    }

    page.appendChild(cal);
    mount.appendChild(page);
  }

  /* ══ UGC ════════════════════════════════════════════════════════════════
     Briefs for creators, not posts the studio makes itself — client + month,
     same scope as Calendario and for the same reason: a brief goes out
     before anyone knows which account the result lands on. This was
     previously portal-only (the client could see a UGC tab with data only
     seed.js ever wrote); this is the studio side that was missing. */

  function renderUgcPicker(mount) {
    var page = h('div', { cls: 'page' });
    page.appendChild(pageHead('UGC', 'Scegli un cliente per gestire i brief creator'));

    var list = A.clients();
    if (!list.length) {
      page.appendChild(h('div', { cls: 'empty' }, [h('p', { text: 'Nessun cliente ancora.' })]));
    } else {
      page.appendChild(h('div', { cls: 'tiles' }, list.map(function (c) {
        return clientTile(c, { onClick: function () { A.go('/ugc/' + c.id); } });
      })));
    }
    mount.appendChild(page);
  }

  function renderUgcMonth(mount, id) {
    var c = A.client(id);
    if (!c) { A.go('/ugc'); return; }

    var month = A.state.month || A.thisMonth();
    var slots = A.ugcSlots(c.id, month);

    var page = h('div', { cls: 'page' });

    page.appendChild(h('button', {
      cls: 'back', on: { click: function () { A.go('/ugc'); } },
    }, [icon('left', 12), 'Tutti i clienti']));

    page.appendChild(pageHead(c.name, slots.length + ' brief in ' + month,
      h('button', {
        cls: 'btn btn--primary',
        on: { click: function () { A.addUgcSlot(c.id, month, {}); } },
      }, [icon('plus', 13), 'Nuovo brief'])
    ));

    page.appendChild(h('div', { cls: 'cov-bar' }, [
      h('div', { cls: 'stepper' }, [
        h('button', {
          cls: 'iconbtn', attrs: { 'aria-label': 'Mese precedente' },
          on: { click: function () { A.set({ month: A.shiftMonth(-1) }, 'month'); } },
        }, [icon('left', 14)]),
        window.MonthPicker.create({
          value: month,
          hasContent: function (lbl) { return A.ugcSlots(c.id, lbl).length > 0; },
          onPick: function (val) { A.set({ month: val }, 'month'); },
        }),
        h('button', {
          cls: 'iconbtn', attrs: { 'aria-label': 'Mese successivo' },
          on: { click: function () { A.set({ month: A.shiftMonth(1) }, 'month'); } },
        }, [icon('right', 14)]),
      ]),
    ]));

    var listWrap = h('div', { cls: 'ugc-list' });

    if (!slots.length) {
      listWrap.appendChild(h('p', { cls: 'panel-empty', text: 'Nessun brief per ' + month + '.' }));
    }

    slots.forEach(function (slot) {
      var date = h('input', {
        cls: 'input', attrs: { type: 'date', 'aria-label': 'Data' },
        on: { change: function () { A.updateUgcSlot(c.id, month, slot.id, { date: date.value }); } },
      });
      date.value = slot.date || '';

      var creator = h('input', {
        cls: 'input', attrs: { type: 'text', placeholder: '@creator', value: slot.creator || '',
                               'aria-label': 'Creator' },
        on: { input: function () {
          var v = creator.value;
          debounced('ugc-creator-' + slot.id, function () { A.updateUgcSlot(c.id, month, slot.id, { creator: v }); });
        } },
      });

      var brief = h('input', {
        cls: 'input', attrs: { type: 'text', placeholder: 'Cosa deve girare il creator…',
                               value: slot.brief || '', 'aria-label': 'Brief' },
        on: { input: function () {
          var v = brief.value;
          debounced('ugc-brief-' + slot.id, function () { A.updateUgcSlot(c.id, month, slot.id, { brief: v }); });
        } },
      });

      var status = h('select', {
        cls: 'input', attrs: { 'aria-label': 'Stato' },
        on: { change: function () { A.updateUgcSlot(c.id, month, slot.id, { ugcStato: status.value }); } },
      }, A.UGC_STATI.map(function (st) {
        var o = h('option', { text: st.label, attrs: { value: st.id, title: st.hint } });
        if ((slot.ugcStato || 'raccolto') === st.id) o.selected = true;
        return o;
      }));

      listWrap.appendChild(h('div', { cls: 'ugc-row' }, [
        h('div', { cls: 'ugc-main' }, [date, creator, brief, status]),
        h('div', { cls: 'ugc-side' }, [
          h('button', {
            cls: 'iconbtn', attrs: { 'aria-label': 'Elimina brief', title: 'Elimina brief' },
            on: { click: function () {
              if (!confirm('Eliminare questo brief?')) return;
              A.removeUgcSlot(c.id, month, slot.id);
              window.Shell.toast('Brief eliminato');
            } },
          }, [icon('trash', 13)]),
        ]),
      ]));
    });

    page.appendChild(listWrap);
    mount.appendChild(page);
  }

  /* ══ CONNESSIONI ════════════════════════════════════════════════════════
     The studio half of the Meta integration: which Meta account is connected
     and which pages it can reach. The other half — which page a given client
     publishes to — lives on the client's own card, because that is where the
     "these must never get mixed" guarantee has to be visible.

     Everything here is read-only status plus connect/reconnect/remove. It is
     checked rarely, which is exactly why the states that matter (a token about
     to expire, a binding pointing at a page we lost) have to shout rather than
     wait to be noticed. */

  function statusPill(status, daysLeft) {
    var label = status === 'expired' ? 'Scaduta'
      : status === 'expiring' ? 'Scade fra ' + daysLeft + 'g'
      : 'Attiva';
    return h('span', { cls: 'conn-pill', attrs: { 'data-s': status }, text: label });
  }

  function renderConnections(mount) {
    var page = h('div', { cls: 'page' });
    var conns = A.connections();

    page.appendChild(pageHead('Connessioni',
      'Account Meta collegati. Le pagine si assegnano poi a ogni cliente.',
      conns.length ? h('button', {
        cls: 'btn btn--primary',
        on: { click: function () {
          A.connectMetaMock();
          window.Shell.toast('Account Meta collegato (simulazione)');
        } },
      }, [icon('plus', 13), 'Collega account']) : null
    ));

    /* Honest about what this is until the backend exists. Connecting for real
       needs a server to hold the app secret — see the plan doc. */
    page.appendChild(h('div', { cls: 'conn-note' }, [
      h('b', { text: 'Modalità dimostrativa' }),
      h('span', { text: 'La connessione reale a Meta richiede il backend: il collegamento OAuth e i token devono stare sul server, mai nel browser. Qui l’interfaccia funziona su dati simulati.' }),
    ]));

    /* Bindings that no longer resolve, gathered across every client — the one
       thing on this page that is genuinely urgent. */
    var broken = [];
    A.clients().forEach(function (c) {
      A.clientBindingIssues(c).forEach(function (b) {
        broken.push({ client: c, account: b.account, issue: b.issue });
      });
    });
    if (broken.length) {
      var warn = h('div', { cls: 'conn-warn' }, [
        h('b', { text: '[!!] ' + broken.length + (broken.length === 1 ? ' collegamento da sistemare' : ' collegamenti da sistemare') }),
      ]);
      broken.forEach(function (b) {
        warn.appendChild(h('button', {
          cls: 'conn-warn-row',
          on: { click: function () { A.go('/clients/' + b.client.id); } },
        }, [
          h('span', { cls: 'conn-warn-client', text: b.client.name + ' · ' + b.account.platform }),
          h('span', { cls: 'conn-warn-msg', text: b.issue }),
        ]));
      });
      page.appendChild(warn);
    }

    if (!conns.length) {
      page.appendChild(h('div', { cls: 'empty' }, [
        h('p', { text: 'Nessun account Meta collegato.' }),
        h('p', { cls: 'note-line',
          text: 'Collegando il tuo account Meta, il tool vede le pagine Facebook che gestisci e gli account Instagram associati. Ogni cliente viene poi assegnato a una pagina specifica dalla sua scheda.' }),
        h('button', {
          cls: 'btn btn--primary',
          on: { click: function () {
            A.connectMetaMock();
            window.Shell.toast('Account Meta collegato (simulazione)');
          } },
        }, [icon('plus', 13), 'Collega account Meta']),
      ]));
      mount.appendChild(page);
      return;
    }

    conns.forEach(function (conn) {
      var status = A.connectionStatus(conn);
      var days = A.connectionDaysLeft(conn);
      var pages = conn.pages || [];
      var boundCount = pages.filter(function (p) {
        return !!A.pageBoundTo(conn.id, p.pageId);
      }).length;

      var card = h('section', { cls: 'card-panel card-panel--span conn-card' });

      card.appendChild(h('div', { cls: 'conn-hd' }, [
        h('span', { cls: 'conn-mark', text: 'f' , attrs: { 'aria-hidden': 'true' } }),
        h('div', { cls: 'conn-id' }, [
          h('span', { cls: 'conn-name', text: conn.accountName }),
          h('span', { cls: 'conn-biz', text: conn.businessName || 'Account personale' }),
        ]),
        h('div', { style: 'flex:1' }),
        statusPill(status, days),
      ]));

      card.appendChild(h('p', { cls: 'panel-sub', text:
        pages.length + (pages.length === 1 ? ' pagina disponibile' : ' pagine disponibili') +
        ' · ' + boundCount + ' assegnate a clienti' +
        (conn.expiresAt ? ' · token valido fino al ' + fmtDay(conn.expiresAt) : '') }));

      if (status === 'expired') {
        card.appendChild(h('div', { cls: 'conn-expired',
          text: 'Connessione scaduta: nessun contenuto verrà pubblicato finché non riconnetti.' }));
      }

      var list = h('div', { cls: 'conn-pages' });
      pages.forEach(function (p) {
        var taken = A.pageBoundTo(conn.id, p.pageId);
        var row = h('div', { cls: 'conn-page' + (taken ? ' is-bound' : '') });

        row.appendChild(h('div', { cls: 'conn-page-id' }, [
          h('span', { cls: 'conn-page-name', text: p.name }),
          h('span', { cls: 'conn-page-cat', text: p.category || '' }),
        ]));

        var tags = h('div', { cls: 'conn-page-tags' });
        tags.appendChild(h('span', { cls: 'conn-tag', text: 'FB' }));
        if (p.igUserId) {
          tags.appendChild(h('span', {
            cls: 'conn-tag' + (p.igAccountType === 'PERSONAL' ? ' conn-tag--bad' : ' conn-tag--ig'),
            attrs: { title: p.igAccountType === 'PERSONAL'
              ? 'Account personale: non pubblicabile via API'
              : 'Instagram ' + (p.igAccountType || '').toLowerCase() },
            text: 'IG',
          }));
        }
        row.appendChild(tags);

        row.appendChild(h('span', {
          cls: 'conn-page-to' + (taken ? '' : ' is-free'),
          text: taken ? taken.client.name : 'non assegnata',
        }));
        list.appendChild(row);
      });
      card.appendChild(list);

      card.appendChild(h('div', { cls: 'f-row', style: 'margin-top:14px' }, [
        h('button', {
          cls: status === 'active' ? 'btn' : 'btn btn--primary',
          on: { click: function () {
            A.reconnectMetaMock(conn.id);
            window.Shell.toast('Connessione rinnovata');
          } },
        }, [icon('link', 13), 'Riconnetti']),
        h('button', {
          cls: 'btn btn--danger',
          on: { click: function () {
            if (!confirm('Rimuovere questa connessione? I clienti collegati alle sue pagine smetteranno di pubblicare finché non ne colleghi un’altra.')) return;
            A.removeConnection(conn.id);
            window.Shell.toast('Connessione rimossa');
          } },
        }, [icon('trash', 13), 'Rimuovi']),
      ]));

      page.appendChild(card);
    });

    mount.appendChild(page);
  }

  function fmtDay(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return String(d.getDate()).padStart(2, '0') + '.' +
           String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  }

  /* ══ PREVIEW PICKER ═════════════════════════════════════════════════════
     Opens the client's portal in a NEW TAB, always. The portal is the
     client's surface and must never be framed inside the studio app — if it
     opened in place, a screen-share would show them the whole admin. */

  function renderPreview(mount) {
    var page = h('div', { cls: 'page' });
    page.appendChild(pageHead('Anteprima cliente',
      'Apre il portale in una nuova scheda — è quello che vede il cliente'));

    var list = A.clients();
    if (!list.length) {
      page.appendChild(h('div', { cls: 'empty' }, [h('p', { text: 'Nessun cliente ancora.' })]));
      mount.appendChild(page);
      return;
    }

    page.appendChild(h('div', { cls: 'tiles' }, list.map(function (c) {
      return clientTile(c, {
        onClick: function () { window.open(A.portalUrl(c), '_blank', 'noopener'); },
        action: h('span', { cls: 'tile-go' }, [icon('external', 12), 'Apri portale']),
      });
    })));

    page.appendChild(h('p', { cls: 'note-line',
      text: 'Suggerimento: dalla scheda di un cliente puoi copiare il link da inviare.' }));

    mount.appendChild(page);
  }

  /* ══ SETTINGS ═══════════════════════════════════════════════════════════ */

  function renderSettings(mount) {
    var page = h('div', { cls: 'page' });
    page.appendChild(pageHead('Impostazioni', 'Dati locali di questa installazione'));

    var u = window.IdeologyStore.usage();
    var grid = h('div', { cls: 'form-grid' });

    grid.appendChild(h('section', { cls: 'card-panel' }, [
      h('h2', { cls: 'panel-t', text: 'Archivio locale' }),
      h('p', { cls: 'panel-sub',
        text: 'Tutto è salvato in questo browser. Non c’è server: cambiando computer i dati non ti seguono.' }),
      h('div', { cls: 'usage' }, [
        h('span', { cls: 'usage-bar' }, [
          h('i', { style: 'width:' + Math.min(100, u.pctOfTypicalQuota) + '%' }),
        ]),
        h('span', { cls: 'usage-n', text: u.kb + ' KB · ' + u.pctOfTypicalQuota + '%' }),
      ]),
      h('p', { cls: 'f-hint',
        text: 'Le immagini caricate riempiono in fretta i ~5MB disponibili. Esporta spesso.' }),
    ]));

    /* Studio identity. Lives here rather than with any client because it is
       the one mark that appears on EVERY client's portal — the "a cura di"
       line at the top of the page they are sent. */
    var logo = A.studioLogo();
    var logoFile = h('input', {
      attrs: { type: 'file', accept: 'image/*', hidden: 'hidden' },
      on: { change: function () {
        var f = logoFile.files && logoFile.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try { A.setStudioLogo(fr.result); A.emit('settings'); window.Shell.toast('Logo aggiornato'); }
          catch (e) {
            window.Shell.toast(e && e.code === 'QUOTA' ? 'Spazio locale esaurito' : 'Caricamento fallito');
          }
        };
        fr.onerror = function () { window.Shell.toast('Lettura del file fallita'); };
        fr.readAsDataURL(f);
      } },
    });

    grid.appendChild(h('section', { cls: 'card-panel card-panel--span' }, [
      h('h2', { cls: 'panel-t', text: 'Logo Ideology' }),
      h('p', { cls: 'panel-sub',
        text: 'Compare in cima al portale di ogni cliente. Senza logo si usa il monogramma !d.' }),
      h('div', { cls: 'logo-row' }, [
        A.safeUrl(logo)
          ? h('img', { cls: 'logo-prev', attrs: { src: A.safeUrl(logo), alt: 'Logo Ideology' } })
          : h('span', { cls: 'logo-prev logo-prev--txt', text: '!d',
                        style: 'background:var(--brand);color:var(--brand-on);font-family:var(--font-mark)' }),
        h('button', { cls: 'btn', on: { click: function () { logoFile.click(); } } },
          [icon('image', 13), 'Carica']),
        A.safeUrl(logo)
          ? h('button', { cls: 'btn', on: { click: function () {
              A.setStudioLogo(''); A.emit('settings'); window.Shell.toast('Logo rimosso');
            } } }, ['Rimuovi'])
          : null,
        logoFile,
      ]),
      h('p', { cls: 'f-hint', text: 'PNG o SVG, sfondo trasparente, orizzontale.' }),
    ]));

    grid.appendChild(h('section', { cls: 'card-panel' }, [
      h('h2', { cls: 'panel-t', text: 'Esporta / importa' }),
      h('p', { cls: 'panel-sub', text: 'L’unico backup che esiste senza un server.' }),
      h('div', { cls: 'f-row' }, [
        h('button', { cls: 'btn btn--primary', on: { click: window.Shell.exportData } },
          [icon('external', 13), 'Esporta JSON']),
        h('button', { cls: 'btn', on: { click: window.Shell.importData } },
          [icon('plus', 13), 'Importa JSON']),
      ]),
    ]));

    grid.appendChild(h('section', { cls: 'card-panel card-panel--danger card-panel--span' }, [
      h('h2', { cls: 'panel-t', text: 'Azzera' }),
      h('p', { cls: 'panel-sub',
        text: 'Cancella tutto e ricarica i dati dimostrativi.' }),
      h('button', {
        cls: 'btn btn--danger',
        on: { click: function () {
          if (!confirm('Cancellare tutti i dati locali e ripartire dai dati demo?')) return;
          window.IdeologyStore.reset();
          if (window.IdeologySeed) window.IdeologySeed.run(window.IdeologyStore);
          window.Shell.toast('Dati azzerati');
          A.go('/');
        } },
      }, [icon('trash', 13), 'Azzera dati locali']),
    ]));

    page.appendChild(grid);
    mount.appendChild(page);
  }

  return {
    home: renderHome,
    clients: renderClients,
    contentPicker: renderContentPicker,
    calendarPicker: renderCalendarPicker,
    calendarMonth: renderCalendarMonth,
    ugcPicker: renderUgcPicker,
    ugcMonth: renderUgcMonth,
    connections: renderConnections,
    preview: renderPreview,
    settings: renderSettings,
    clientTile: clientTile,
    onColor: onColor,
  };
})();
