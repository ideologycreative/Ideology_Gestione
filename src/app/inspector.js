/*
 * IDEOLOGY STUDIO — inspector
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The editing surface. A docked right-hand panel, NOT a modal — that is a
 * deliberate structural change from the tool this replaced, where every edit
 * opened a dialog over the work and you had to close it before you could look
 * at anything else. Editing a caption is something you do WHILE comparing it
 * to the three frames around it, so the board stays visible and live.
 *
 * Everything commits immediately to the store. There is no save button and no
 * dirty state to lose: text fields write on input (debounced), everything else
 * writes on change. The old tool's modal had an explicit save, which is what
 * made an accidental dismissal cost you the edit.
 */

window.Inspector = (function () {
  'use strict';

  var A = window.App;
  var h = A.h, icon = A.icon;

  var debounceTimer = null;
  function debounced(fn) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, 260);
  }

  function field(label, control, hint) {
    return h('div', { cls: 'f' }, [
      h('label', { cls: 'f-label', text: label }),
      control,
      hint ? h('p', { cls: 'f-hint', text: hint }) : null,
    ]);
  }

  function render(mount) {
    A.clear(mount);
    var item = A.state.selectedId ? A.itemById(A.state.selectedId) : null;

    if (!item) {
      mount.classList.remove('is-open');
      return;
    }
    mount.classList.add('is-open');

    /* ── Header ─────────────────────────────────────────────────────────── */
    mount.appendChild(h('div', { cls: 'insp-hd' }, [
      h('span', { cls: 'insp-kind', text: item._kind === 'story' ? 'STORY' : 'POST' }),
      h('span', { cls: 'insp-id', text: item.id }),
      h('div', { style: 'flex:1' }),
      h('button', {
        cls: 'iconbtn',
        attrs: { 'aria-label': 'Chiudi pannello', title: 'Chiudi (Esc)' },
        on: { click: function () { A.set({ selectedId: null }, 'close'); } },
      }, [icon('close', 14)]),
    ]));

    var body = h('div', { cls: 'insp-body' });

    /* ── Preview ────────────────────────────────────────────────────────── */
    /* Detail context: a reel or story previews at its true 9:16, unlike the
       grid where every cell is cropped to the feed ratio. */
    var placement = A.ratioFor(item, A.account(), 'detail');
    body.appendChild(window.Views.thumb(item, { ratio: placement }));

    /* Does the asset actually fit the slot it is planned for?
       A 16:9 edit dropped into a reel is published letterboxed or cropped to
       ribbons, and nobody notices until it is live. Measured from the real
       media rather than assumed, because the file is the only source of truth
       about its own shape — and warned about HERE, in the studio, where there
       is still someone who can re-export it. The client's portal stays clean
       and simply shows the truthful letterbox. */
    (function warnOnFit() {
      var src = A.safeVideoUrl(item.videoUrl) || A.safeUrl(item.url || item.externalUrl);
      if (!src) return;
      var want = (function (r) {
        var p = String(r).split('/');
        return p.length === 2 ? Number(p[0]) / Number(p[1]) : null;
      })(placement);
      if (!want) return;

      var slot = h('div');
      body.appendChild(slot);

      function verdict(w, hgt) {
        if (!w || !hgt) return;
        var got = w / hgt;
        // 8% tolerance: 4:5 and 1:1.25 are the same intent, 16:9 in 9:16 is not.
        if (Math.abs(got - want) / want <= 0.08) return;
        var fmt = function (n) { return n >= 1 ? n.toFixed(2) + ':1' : '1:' + (1 / n).toFixed(2); };
        slot.appendChild(h('div', { cls: 'fitwarn' }, [
          h('b', { text: 'Formato non corrispondente' }),
          h('span', { text: 'Il file è ' + fmt(got) + ', la posizione richiede ' +
                            placement.replace('/', ':') + '. Verrà mostrato con bande.' }),
        ]));
      }

      if (A.safeVideoUrl(item.videoUrl)) {
        var v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = function () { verdict(v.videoWidth, v.videoHeight); };
        v.src = src;
      } else {
        var i = new Image();
        i.onload = function () { verdict(i.naturalWidth, i.naturalHeight); };
        i.src = src;
      }
    })();

    /* ── Status: the pipeline, as a segmented control ───────────────────────
       Repeated here rather than left to drag-and-drop alone, because a
       gesture-only interaction is unusable by keyboard and unreachable on
       touch. Same reason the board is not the only way to move work. */
    body.appendChild(field('Stato',
      h('div', { cls: 'seg seg--status' },
        A.STATUSES.map(function (st) {
          return h('button', {
            cls: 'seg-b',
            attrs: {
              'aria-pressed': String((item.apprStato || 'bozza') === st.id),
              'data-s': st.id,
              title: st.hint,
            },
            on: { click: function () {
              A.patchItem(item.id, { apprStato: st.id });
              window.Shell.toast('→ ' + st.label);
            } },
          }, [st.token]);
        })
      ),
      A.statusOf(item.apprStato).hint
    ));

    /* ── Sponsored ────────────────────────────────────────────────────────
       Paid placement. A switch rather than a chip because it is binary and
       consequential: it changes what the client sees, how the day reads in
       the calendar, and — in the real world — the disclosure the post legally
       needs. It sits directly under status, which is the other field that
       changes who sees what. */
    var sponsored = !!item.sponsored;
    body.appendChild(field('Sponsorizzazione',
      h('button', {
        cls: 'toggle' + (sponsored ? ' is-on' : ''),
        attrs: { role: 'switch', 'aria-checked': String(sponsored) },
        on: { click: function () {
          A.patchItem(item.id, { sponsored: !sponsored });
          window.Shell.toast(sponsored ? 'Non più sponsorizzato' : 'Contenuto sponsorizzato');
        } },
      }, [
        h('span', { cls: 'toggle-track' }, [h('i')]),
        icon('megaphone', 13),
        h('span', { text: sponsored ? 'Sponsorizzato' : 'Organico' }),
      ]),
      sponsored
        ? 'Il cliente vedrà il badge SPONSOR sul contenuto.'
        : 'Attiva per i contenuti a pagamento.'
    ));

    /* ── Caption ────────────────────────────────────────────────────────── */
    var copy = h('textarea', {
      cls: 'input input--area',
      attrs: { rows: '5', placeholder: 'Scrivi la caption…', 'aria-label': 'Caption' },
      on: {
        input: function () {
          var v = copy.value;
          debounced(function () { A.patchItem(item.id, { copy: v }); });
        },
      },
    });
    copy.value = item.copy || '';
    body.appendChild(field('Caption', copy,
      (item.copy || '').length + ' caratteri'));

    /* ── Date + type ────────────────────────────────────────────────────── */
    var row = h('div', { cls: 'f-row' });

    var date = h('input', {
      cls: 'input',
      attrs: { type: 'date', 'aria-label': 'Data di pubblicazione' },
      on: { change: function () { A.patchItem(item.id, { date: date.value }); } },
    });
    date.value = item.date || '';
    row.appendChild(field('Data', date));

    var type = h('select', {
      cls: 'input',
      attrs: { 'aria-label': 'Formato' },
      on: { change: function () { A.patchItem(item.id, { type: type.value }); } },
    }, A.TYPES.map(function (t) {
      var o = h('option', { text: t.label, attrs: { value: t.id } });
      if ((item.type || 'photo') === t.id) o.selected = true;
      return o;
    }));
    row.appendChild(field('Tipo', type));

    body.appendChild(row);

    /* ── Pillar ─────────────────────────────────────────────────────────────
       Presented as chips rather than a select: there are three or four per
       client, they are colour-coded, and picking one should be a single tap. */
    var pills = A.pillars();
    if (pills.length) {
      body.appendChild(field('Pilastro',
        h('div', { cls: 'chips' }, pills.map(function (p) {
          var on = item.pilastro === p.name;
          return h('button', {
            cls: 'chip' + (on ? ' is-on' : ''),
            attrs: { 'aria-pressed': String(on) },
            on: { click: function () {
              A.patchItem(item.id, { pilastro: on ? '' : p.name });
            } },
          }, [
            h('i', { style: 'background:' + p.color }),
            p.name,
          ]);
        }))
      ));
    }

    /* ── Media ──────────────────────────────────────────────────────────── */
    var url = h('input', {
      cls: 'input',
      attrs: { type: 'text', placeholder: 'https://… oppure carica un file',
               'aria-label': 'URL immagine' },
      on: {
        input: function () {
          var v = url.value;
          debounced(function () { A.patchItem(item.id, { url: v, externalUrl: v }); });
        },
      },
    });
    url.value = item.url || '';

    var file = h('input', {
      attrs: { type: 'file', accept: 'image/*', hidden: 'hidden' },
      on: {
        change: function () {
          var f = file.files && file.files[0];
          if (!f) return;
          /* Read straight to a data URL. Honest about the trade: this is a
             local build with a ~5MB localStorage budget, so a full-size photo
             will hit the quota — the store raises a typed QUOTA error and the
             toast below surfaces it rather than failing silently. */
          var fr = new FileReader();
          fr.onload = function () {
            try {
              A.patchItem(item.id, { url: fr.result, externalUrl: fr.result });
              window.Shell.toast('Immagine caricata');
            } catch (e) {
              window.Shell.toast(e && e.code === 'QUOTA'
                ? 'Spazio locale esaurito' : 'Caricamento fallito');
            }
          };
          fr.onerror = function () { window.Shell.toast('Lettura del file fallita'); };
          fr.readAsDataURL(f);
        },
      },
    });

    body.appendChild(field('Media',
      h('div', {}, [
        url,
        h('div', { cls: 'f-row', style: 'margin-top:8px' }, [
          h('button', {
            cls: 'btn',
            on: { click: function () { file.click(); } },
          }, [icon('image', 13), 'Carica']),
          h('button', {
            cls: 'btn',
            on: { click: function () {
              A.patchItem(item.id, { url: '', externalUrl: '' });
            } },
          }, ['Rimuovi']),
        ]),
        file,
      ])
    ));

    /* ── Video ──────────────────────────────────────────────────────────
       Only for reels: a photo has nothing to play. The poster above stays the
       grid thumbnail; this is what runs when the post is opened, so a reel can
       be planned and its caption approved before the edit is finished. */
    if (item.type === 'reel') {
      var vurl = h('input', {
        cls: 'input',
        attrs: { type: 'text', placeholder: 'https://….mp4  oppure carica',
                 'aria-label': 'URL video' },
        on: { input: function () {
          var v = vurl.value;
          debounced(function () { A.patchItem(item.id, { videoUrl: v }); });
        } },
      });
      vurl.value = item.videoUrl || '';

      var vfile = h('input', {
        attrs: { type: 'file', accept: 'video/*', hidden: 'hidden' },
        on: { change: function () {
          var f = vfile.files && vfile.files[0];
          if (!f) return;
          /* Video as a data URL would blow the ~5MB budget on the first clip,
             so it is held as an object URL: it plays for this session and is
             not persisted. The field above is the durable path. */
          try {
            var u = URL.createObjectURL(f);
            A.patchItem(item.id, { videoUrl: u });
            window.Shell.toast('Video collegato (solo questa sessione)');
          } catch (e) { window.Shell.toast('Impossibile leggere il video'); }
        } },
      });

      body.appendChild(field('Video del reel',
        h('div', {}, [
          vurl,
          h('div', { cls: 'f-row', style: 'margin-top:8px' }, [
            h('button', { cls: 'btn', on: { click: function () { vfile.click(); } } },
              [icon('image', 13), 'Carica']),
            item.videoUrl
              ? h('button', { cls: 'btn', on: { click: function () {
                  A.patchItem(item.id, { videoUrl: '' });
                } } }, ['Rimuovi'])
              : null,
          ]),
          vfile,
        ]),
        item.videoUrl
          ? 'Il cliente lo vedrà partire aprendo il post.'
          : 'Senza video il cliente vede solo la copertina.'
      ));
    }

    /* ── Internal note ──────────────────────────────────────────────────── */
    var note = h('textarea', {
      cls: 'input input--area',
      attrs: { rows: '2', placeholder: 'Nota interna, non visibile al cliente',
               'aria-label': 'Nota interna' },
      on: {
        input: function () {
          var v = note.value;
          debounced(function () { A.patchItem(item.id, { note: v }); });
        },
      },
    });
    note.value = item.note || '';
    body.appendChild(field('Nota interna', note));

    /* ── Client feedback, read-only ───────────────────────────────────────
       Shown last and visually distinct: it is the one block in this panel the
       studio did not write and must not quietly overwrite. */
    if (item.clientNote) {
      body.appendChild(h('div', { cls: 'insp-client' }, [
        h('span', { cls: 'insp-client-hd',
                    text: 'Richiesta di ' + (item.clientName || 'cliente') }),
        h('p', { text: item.clientNote }),
      ]));
    }

    mount.appendChild(body);

    /* ── Footer ─────────────────────────────────────────────────────────── */
    mount.appendChild(h('div', { cls: 'insp-ft' }, [
      h('button', {
        cls: 'btn btn--danger',
        on: { click: function () {
          if (!confirm('Eliminare questo contenuto? L’azione non è reversibile.')) return;
          A.removeItem(item.id);
          window.Shell.toast('Contenuto eliminato');
        } },
      }, [icon('trash', 13), 'Elimina']),
      h('div', { style: 'flex:1' }),
      h('button', {
        cls: 'btn btn--primary',
        on: { click: function () {
          A.patchItem(item.id, { apprStato: 'approvare' });
          window.Shell.toast('Inviato al cliente');
        } },
      }, [icon('check', 13), 'Invia al cliente']),
    ]));
  }

  return { render: render };
})();
