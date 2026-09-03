/*
 * IDEOLOGY STUDIO — views
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Three lenses on one client-account-month. Each exports render(mount) and
 * nothing else; the shell decides which one is mounted.
 *
 *   BOARD     the pipeline — bozza → in attesa → revisione → approvato.
 *             This is the view the old tool did not have, and the reason the
 *             rebuild was worth doing: the workflow existed in the data all
 *             along (apprStato) but was only ever visible as a badge on a
 *             thumbnail. Drag a card across to move the work along.
 *
 *   GRID      the profile order, drawn at the account's real aspect ratio —
 *             4:5 on Instagram, 9:16 on TikTok, 16:9 on YouTube. Frames butt
 *             together with no gutters because that is what a feed looks
 *             like; drag to reorder, and the array order IS the published
 *             order.
 *
 *   CALENDAR  by date, posts AND stories together. Showing both is the whole
 *             point — a story and a post going out the same day are the same
 *             afternoon's work, and the old tool put them on separate pages.
 */

window.Views = (function () {
  'use strict';

  var A = window.App;
  var h = A.h, icon = A.icon;

  /* ── Shared: the card ──────────────────────────────────────────────────
     One card component across all three views. Density varies, the anatomy
     does not — so a post is recognisable wherever you meet it. */

  function thumb(item, opts) {
    opts = opts || {};
    var url = A.safeUrl(item.url || item.externalUrl);
    var box = h('div', {
      cls: 'thumb',
      attrs: { 'data-type': item.type || 'photo' },
      /* The frame is the real published shape, from the account's platform.
         Defaults to the GRID rule — every cell the same — because that is
         where thumbs are used most; the inspector passes its own ratio. */
      style: 'aspect-ratio:' + (opts.ratio || A.ratioFor(item, A.account(), 'grid')),
    });
    if (url) {
      var img = h('img', {
        attrs: { src: url, alt: item.copy ? item.copy.slice(0, 60) : '', loading: 'lazy' },
      });
      img.addEventListener('error', function () { img.classList.add('is-broken'); });
      box.appendChild(img);
    } else {
      box.classList.add('thumb--empty');
      box.appendChild(icon('image', 18));
    }
    if (item.type === 'carousel') {
      box.appendChild(h('span', { cls: 'thumb-tag', text: 'CAR ' + ((item.slides || []).length || '') }));
    } else if (item.type === 'reel') {
      box.appendChild(h('span', { cls: 'thumb-tag', text: 'REEL' }));
    }
    if (item._kind === 'story') {
      box.appendChild(h('span', { cls: 'thumb-tag thumb-tag--l', text: 'STORY' }));
    }
    /* Paid placement, marked on the frame itself so it travels with the post
       into every view rather than living only in the inspector. */
    if (item.sponsored) {
      box.appendChild(h('span', { cls: 'thumb-spon', text: 'SPONSOR' }));
    }
    return box;
  }

  function statusDot(item) {
    return h('span', {
      cls: 'sdot',
      attrs: { 'data-s': item.apprStato || 'bozza', title: A.statusOf(item.apprStato).label },
    });
  }

  function pillarTag(item) {
    if (!item.pilastro) return null;
    var p = A.pillars().find(function (x) { return x.name === item.pilastro; });
    return h('span', { cls: 'ptag' }, [
      h('i', { style: 'background:' + ((p && p.color) || 'var(--brand)') }),
      item.pilastro,
    ]);
  }

  function selectItem(id) { A.set({ selectedId: id }, 'select'); }

  /* Cards are draggable everywhere; what a drop MEANS is the view's business.
     Setting both a payload and a body class lets drop targets style
     themselves only while a drag is actually in flight. */
  function makeDraggable(el, id) {
    el.draggable = true;
    el.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      document.body.classList.add('is-dragging');
      el.classList.add('is-ghost');
    });
    el.addEventListener('dragend', function () {
      document.body.classList.remove('is-dragging');
      el.classList.remove('is-ghost');
    });
  }

  /* ══ BOARD ══════════════════════════════════════════════════════════════ */

  function renderBoard(mount) {
    var all = A.items();
    var board = h('div', { cls: 'board' });

    A.STATUSES.forEach(function (st) {
      var inCol = all.filter(function (i) { return (i.apprStato || 'bozza') === st.id; });

      var col = h('div', { cls: 'col', attrs: { 'data-s': st.id } });

      col.appendChild(h('div', { cls: 'col-hd' }, [
        h('span', { cls: 'col-token', text: st.token }),
        h('span', { cls: 'col-name', text: st.label }),
        h('span', { cls: 'col-n', text: String(inCol.length) }),
      ]));

      var body = h('div', { cls: 'col-body' });

      if (!inCol.length) {
        body.appendChild(h('div', { cls: 'col-empty', text: '—' }));
      }

      inCol.forEach(function (item) {
        var card = h('div', {
          cls: 'card' + (A.state.selectedId === item.id ? ' is-sel' : '')
                 + (item.sponsored ? ' is-spon' : ''),
          attrs: { tabindex: '0', role: 'button',
                   'aria-label': (item.copy || 'Contenuto') + ' — ' + st.label },
          on: {
            click: function () { selectItem(item.id); },
            keydown: function (e) {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectItem(item.id); }
            },
          },
        }, [
          thumb(item),
          h('div', { cls: 'card-body' }, [
            h('div', { cls: 'card-meta' }, [
              h('span', { cls: 'card-date', text: A.fmtDay(item.date) }),
              pillarTag(item),
            ]),
            item.copy ? h('p', { cls: 'card-copy', text: item.copy }) : null,
            item.clientNote ? h('div', { cls: 'card-note', text: item.clientNote }) : null,
          ]),
        ]);
        makeDraggable(card, item.id);
        body.appendChild(card);
      });

      /* Drop = set status. The pipeline is the only thing the board encodes,
         so this is the whole interaction. */
      col.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('is-over');
      });
      col.addEventListener('dragleave', function () { col.classList.remove('is-over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('is-over');
        var id = e.dataTransfer.getData('text/plain');
        if (!id) return;
        var cur = A.itemById(id);
        if (!cur || (cur.apprStato || 'bozza') === st.id) return;
        A.patchItem(id, { apprStato: st.id });
        window.Shell.toast('→ ' + st.label);
      });

      col.appendChild(body);
      board.appendChild(col);
    });

    mount.appendChild(board);
  }

  /* ══ GRID ═══════════════════════════════════════════════════════════════ */

  function renderGrid(mount) {
    var all = A.items();
    var wrap = h('div', { cls: 'gridview' });

    if (!all.length) {
      mount.appendChild(emptyState('Nessun contenuto in ' + A.state.month));
      return;
    }

    var pf = A.platform((A.account() || {}).platform);
    var grid = h('div', { cls: 'ggrid', style: '--gcols:' + pf.cols });

    all.forEach(function (item, i) {
      var cell = h('div', {
        cls: 'gcell' + (A.state.selectedId === item.id ? ' is-sel' : '')
               + (item.sponsored ? ' is-spon' : ''),
        attrs: { tabindex: '0', role: 'button',
                 'aria-label': 'Posizione ' + (i + 1) + '. ' + (item.copy || 'Contenuto') },
        on: {
          click: function () { selectItem(item.id); },
          keydown: function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectItem(item.id); }
          },
        },
      }, [
        thumb(item),
        h('div', { cls: 'gcell-bar' }, [
          h('span', { cls: 'gcell-i', text: String(i + 1).padStart(2, '0') }),
          statusDot(item),
          h('span', { cls: 'gcell-date', text: A.fmtDay(item.date) }),
        ]),
      ]);

      makeDraggable(cell, item.id);
      cell.addEventListener('dragover', function (e) {
        e.preventDefault();
        cell.classList.add('is-over');
      });
      cell.addEventListener('dragleave', function () { cell.classList.remove('is-over'); });
      cell.addEventListener('drop', function (e) {
        e.preventDefault();
        cell.classList.remove('is-over');
        var id = e.dataTransfer.getData('text/plain');
        if (!id || id === item.id) return;
        A.moveItem(id, i);
        window.Shell.toast('Ordine aggiornato');
      });

      grid.appendChild(cell);
    });

    wrap.appendChild(h('p', { cls: 'hint' }, [
      pf.label + ' · ' + pf.feed.replace('/', ':') +
      ' — trascina per riordinare, questo è l’ordine con cui il profilo verrà letto.',
    ]));
    wrap.appendChild(grid);
    mount.appendChild(wrap);
  }

  /* ══ CALENDAR ═══════════════════════════════════════════════════════════ */

  function renderCalendar(mount) {
    /* allKinds: the calendar is the one place posts and stories belong side
       by side — same day, same work. */
    var all = A.items({ allKinds: true });
    var meta = A.monthMeta(A.state.month);
    var byDay = {};
    all.forEach(function (it) {
      var d = A.dayOf(it.date);
      if (!d) return;
      (byDay[d] = byDay[d] || []).push(it);
    });

    var cal = h('div', { cls: 'cal' });

    ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].forEach(function (d) {
      cal.appendChild(h('div', { cls: 'cal-hd', text: d }));
    });

    for (var i = 0; i < meta.lead; i++) {
      cal.appendChild(h('div', { cls: 'cal-cell cal-cell--pad' }));
    }

    var today = new Date();
    var isThisMonth = today.getFullYear() === meta.year && today.getMonth() === meta.month;

    for (var day = 1; day <= meta.days; day++) {
      (function (day) {
        var list = byDay[day] || [];
        var iso = meta.year + '-' + String(meta.month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        var cell = h('div', {
          cls: 'cal-cell' + (isThisMonth && today.getDate() === day ? ' is-today' : ''),
        }, [
          h('div', { cls: 'cal-day', text: String(day).padStart(2, '0') }),
        ]);

        list.forEach(function (it) {
          cell.appendChild(h('button', {
            cls: 'cal-item' + (it.sponsored ? ' is-spon' : ''),
            attrs: { 'data-s': it.apprStato || 'bozza',
                     title: (it.sponsored ? 'SPONSORIZZATO — ' : '')
                            + ((it.copy || '').slice(0, 90) || 'Contenuto') },
            on: { click: function () { selectItem(it.id); } },
          }, [
            h('span', { cls: 'cal-item-k', text: it.sponsored ? '$' : (it._kind === 'story' ? 'S' : 'P') }),
            h('span', { cls: 'cal-item-t',
              text: it.copy || (it._kind === 'story' ? 'Storia' : 'Senza caption') }),
          ]));
        });

        /* Drop on a day = schedule for that day. Rescheduling by dragging is
           the thing a calendar is actually for; the old tool made you open a
           modal and type a date. */
        cell.addEventListener('dragover', function (e) { e.preventDefault(); cell.classList.add('is-over'); });
        cell.addEventListener('dragleave', function () { cell.classList.remove('is-over'); });
        cell.addEventListener('drop', function (e) {
          e.preventDefault();
          cell.classList.remove('is-over');
          var id = e.dataTransfer.getData('text/plain');
          if (!id) return;
          A.patchItem(id, { date: iso });
          window.Shell.toast('Spostato al ' + A.fmtDay(iso));
        });

        cal.appendChild(cell);
      })(day);
    }

    mount.appendChild(cal);
  }

  function emptyState(msg) {
    return h('div', { cls: 'empty' }, [
      h('p', { text: msg }),
      h('button', {
        cls: 'btn btn--primary',
        on: { click: function () { selectItem(A.createItem({})); } },
      }, [icon('plus', 13), 'Nuovo contenuto']),
    ]);
  }

  /* ══ Router ═════════════════════════════════════════════════════════════ */

  function render(mount) {
    A.clear(mount);
    var v = A.state.view;
    if (v === 'grid')          renderGrid(mount);
    else if (v === 'calendar') renderCalendar(mount);
    else                       renderBoard(mount);
  }

  return { render: render, thumb: thumb };
})();
