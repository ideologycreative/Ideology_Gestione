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

  /* Every commit in this panel — a toggle, a chip, a channel tick — goes
     through A.patchItem/setTargets/setStoryLink, which emits, which triggers
     a full render() of this panel (there is no partial update in this app).
     A fresh .insp-body element starts scrolled to top, so without this the
     panel visibly jumped to the top of a 340px column on every single click,
     which reads as both "it jumped" and "it's laggy". Restored only when
     re-rendering the SAME post — switching to a different one should reset
     to top, that scroll position means nothing there. */
  var lastItemId = null, lastScrollTop = 0;

  function field(label, control, hint) {
    return h('div', { cls: 'f' }, [
      h('label', { cls: 'f-label', text: label }),
      control,
      hint ? h('p', { cls: 'f-hint', text: hint }) : null,
    ]);
  }

  function render(mount) {
    var prevBody = mount.querySelector('.insp-body');
    if (prevBody) lastScrollTop = prevBody.scrollTop;

    A.clear(mount);
    var item = A.state.selectedId ? A.itemById(A.state.selectedId) : null;

    if (!item) {
      mount.classList.remove('is-open');
      lastItemId = null;
      return;
    }
    mount.classList.add('is-open');
    var sameItem = lastItemId === item.id;
    lastItemId = item.id;

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

    /* ── Client feedback, read-only ───────────────────────────────────────
       The one block in this panel the studio did not write, and the reason
       the post is in In revisione — it used to sit at the bottom, under a
       screenful of fields, which meant scrolling past the whole form just to
       find out what the client actually asked for. Pinned here, between the
       header and the scrolling body, it stays on screen no matter how far
       down the form you scroll — a popup would need an extra click to see
       something that should be the first thing you see. */
    if (item.clientNote) {
      mount.appendChild(h('div', { cls: 'insp-client' }, [
        h('span', { cls: 'insp-client-hd',
                    text: 'Richiesta di ' + (item.clientName || 'cliente') }),
        h('p', { text: item.clientNote }),
      ]));
    }

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

    /* ── Status ─────────────────────────────────────────────────────────
       A named list, not a row of symbols. The tokens were fast to scan once
       learned and meaningless before that — and this panel is where you SET
       the state, which is exactly the moment the word matters. Five items in
       a row would also have squeezed every label to three letters in a 340px
       panel, so it runs vertically.

       Duplicated from the board's drag on purpose: a gesture-only interaction
       is unusable by keyboard and unreachable on touch. */
    var cur = item.apprStato || 'bozza';
    body.appendChild(field('Stato',
      h('div', { cls: 'statelist', attrs: { role: 'radiogroup', 'aria-label': 'Stato' } },
        A.STATUSES.map(function (st) {
          var on = cur === st.id;
          return h('button', {
            cls: 'state' + (on ? ' is-on' : ''),
            attrs: { role: 'radio', 'aria-checked': String(on),
                     'data-s': st.id, title: st.hint },
            on: { click: function () {
              if (on) return;
              A.patchItem(item.id, { apprStato: st.id });
              window.Shell.toast('→ ' + st.label);
            } },
          }, [
            h('span', { cls: 'state-tok', text: st.token }),
            h('span', { cls: 'state-lbl', text: st.label }),
          ]);
        })
      ),
      A.statusOf(cur).hint
    ));

    /* ── Channels ───────────────────────────────────────────────────────
       One piece of content, several places it goes out. Ticking Facebook here
       creates that channel's copy of this post — same image, same caption,
       same date — instead of making you build it twice.

       Each channel keeps its OWN approval state and its own position in that
       profile's grid, because a client can sign off on Instagram and ask for
       a change on Facebook, and the two feeds are ordered differently. Edit
       the content anywhere and every channel follows. */
    var accs = A.accounts();
    if (accs.length > 1) {
      var targets = A.targetsOf(item);
      body.appendChild(field('Pubblica su',
        h('div', { cls: 'targets' }, accs.map(function (a) {
          var on = targets.indexOf(a.id) >= 0;
          var pf = A.platform(a.platform);
          return h('button', {
            cls: 'target' + (on ? ' is-on' : ''),
            attrs: {
              role: 'switch', 'aria-checked': String(on),
              /* Only the LAST remaining channel is locked — a post has to go
                 out somewhere. Every other tick is live, including the channel
                 you are currently viewing. */
              disabled: (on && targets.length === 1) ? 'disabled' : null,
              title: (on && targets.length === 1)
                ? 'Un contenuto deve restare su almeno un canale'
                : a.platform + ' · ' + pf.feed.replace('/', ':'),
            },
            on: { click: function () {
              var next = on
                ? targets.filter(function (x) { return x !== a.id; })
                : targets.concat([a.id]);
              if (!next.length) return;
              var res = A.setTargets(item.id, next) || {};
              /* Dropping the channel you were viewing deletes that copy, so
                 follow the group to its surviving sibling — switching account
                 too, or the panel would describe something off screen. */
              if (res.removedSelf) {
                A.set({
                  accountId: res.nextAccountId || A.state.accountId,
                  selectedId: res.nextId || null,
                }, 'targets');
              }
              window.Shell.toast(on ? a.platform + ' rimosso' : 'Aggiunto a ' + a.platform);
            } },
          }, [
            h('span', { cls: 'target-box' }, on ? [icon('check', 11)] : []),
            h('span', { cls: 'target-name', text: a.platform }),
            h('span', { cls: 'target-ratio', text: pf.feed.replace('/', ':') }),
          ]);
        })),
        targets.length > 1
          ? 'Immagine, caption e data restano uguali su tutti i canali. Approvazione separata.'
          : 'Seleziona un altro canale per pubblicare lo stesso contenuto anche lì.'
      ));
    }

    /* ── Feed ⇄ Story ──────────────────────────────────────────────────────
       Crosses the other axis from channels: not another ACCOUNT, but the
       other SURFACE on the same one. Turning this on creates a companion
       copy in Storie for the account you are looking at, kept in sync the
       same way a second channel is — same media, same caption, own approval.
       Reads the other way round too: open that story and the switch here
       says "Anche nei Post". */
    var storyOn = A.hasStoryLink(item);
    var storyLabel = item._kind === 'story' ? 'Anche nei Post' : 'Anche nelle Storie';
    body.appendChild(field(storyLabel,
      h('button', {
        cls: 'toggle' + (storyOn ? ' is-on' : ''),
        attrs: { role: 'switch', 'aria-checked': String(storyOn) },
        on: { click: function () {
          A.setStoryLink(item.id, !storyOn);
          window.Shell.toast(storyOn ? 'Collegamento rimosso' : 'Collegato — vedi ' +
            (item._kind === 'story' ? 'Contenuti' : 'Storie'));
        } },
      }, [
        h('span', { cls: 'toggle-track' }, [h('i')]),
        icon('layers', 13),
        h('span', { text: storyOn ? 'Collegato' : 'Indipendente' }),
      ]),
      item._kind === 'story'
        ? 'Pubblica lo stesso contenuto anche nel feed di questo account.'
        : 'Pubblica lo stesso contenuto anche nelle Storie di questo account.'
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

    /* ── Category ───────────────────────────────────────────────────────────
       What kind of content this is — customer review, product, educational,
       before/after. Chips rather than a select: there are a handful per
       client, they are colour-coded, and picking one should be a single tap.
       The list itself is edited from the client's own settings page, not
       here — this panel only applies a category, it does not define them. */
    var pills = A.pillars();
    if (pills.length) {
      body.appendChild(field('Categoria',
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
        })),
        'Aggiungi o modifica le categorie dalla scheda del cliente.'
      ));
    }

    /* ── Media ──────────────────────────────────────────────────────────── */
    if (item.type !== 'carousel') {
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
    }

    /* ── Carousel slides ────────────────────────────────────────────────────
       A carousel is not one image but an ordered set of them — and, since a
       carousel can mix a photo slide with a clip, each slide carries its own
       optional video the same way a reel does: the image is always what the
       grid and the client see first, the video is what plays once opened.
       Slide 1 doubles as the cover — its image is what item.url becomes, so
       the thumbnail everywhere else in the app stays correct without a
       second field to keep in sync. */
    if (item.type === 'carousel') {
      var slides = (item.slides || []).slice();

      function commitSlides(next) {
        var cover = next[0] || {};
        A.patchItem(item.id, {
          slides: next,
          url: cover.url || '',
          externalUrl: cover.url || '',
        });
      }

      var slideWrap = h('div', { cls: 'slide-editor' });

      slides.forEach(function (sl, i) {
        var prev = h('div', { cls: 'slide-prev' });
        var purl = A.safeUrl(sl.url || sl.externalUrl);
        if (purl) prev.appendChild(h('img', { attrs: { src: purl, alt: '' } }));
        else prev.appendChild(icon('image', 16));
        if (sl.videoUrl) prev.appendChild(h('span', { cls: 'slide-vtag', text: 'VIDEO' }));

        var imgUrl = h('input', {
          cls: 'input input--sm',
          attrs: { type: 'text', placeholder: 'URL immagine', 'aria-label': 'Immagine slide ' + (i + 1) },
          on: { input: function () {
            var v = imgUrl.value;
            debounced(function () {
              var next = slides.slice();
              next[i] = Object.assign({}, next[i], { url: v, externalUrl: v });
              commitSlides(next);
            });
          } },
        });
        imgUrl.value = sl.url || '';

        var imgFile = h('input', {
          attrs: { type: 'file', accept: 'image/*', hidden: 'hidden' },
          on: { change: function () {
            var f = imgFile.files && imgFile.files[0];
            if (!f) return;
            var fr = new FileReader();
            fr.onload = function () {
              try {
                var next = slides.slice();
                next[i] = Object.assign({}, next[i], { url: fr.result, externalUrl: fr.result });
                commitSlides(next);
              } catch (e) {
                window.Shell.toast(e && e.code === 'QUOTA' ? 'Spazio locale esaurito' : 'Caricamento fallito');
              }
            };
            fr.readAsDataURL(f);
          } },
        });

        var vurl = h('input', {
          cls: 'input input--sm',
          attrs: { type: 'text', placeholder: 'URL video (opzionale)', 'aria-label': 'Video slide ' + (i + 1) },
          on: { input: function () {
            var v = vurl.value;
            debounced(function () {
              var next = slides.slice();
              next[i] = Object.assign({}, next[i], { videoUrl: v });
              commitSlides(next);
            });
          } },
        });
        vurl.value = sl.videoUrl || '';

        var vfile = h('input', {
          attrs: { type: 'file', accept: 'video/*', hidden: 'hidden' },
          on: { change: function () {
            var f = vfile.files && vfile.files[0];
            if (!f) return;
            try {
              var u = URL.createObjectURL(f);
              var next = slides.slice();
              next[i] = Object.assign({}, next[i], { videoUrl: u });
              commitSlides(next);
              window.Shell.toast('Video collegato (solo questa sessione)');
            } catch (e) { window.Shell.toast('Impossibile leggere il video'); }
          } },
        });

        var row = h('div', { cls: 'slide-row' }, [
          prev,
          h('div', { cls: 'slide-body' }, [
            imgUrl,
            vurl,
            h('div', { cls: 'f-row', style: 'margin-top:6px' }, [
              h('button', { cls: 'btn btn--xs', on: { click: function () { imgFile.click(); } } }, ['Carica img']),
              h('button', { cls: 'btn btn--xs', on: { click: function () { vfile.click(); } } },
                [sl.videoUrl ? 'Sostituisci video' : 'Aggiungi video']),
              sl.videoUrl
                ? h('button', { cls: 'btn btn--xs', on: { click: function () {
                    var next = slides.slice();
                    next[i] = Object.assign({}, next[i], { videoUrl: '' });
                    commitSlides(next);
                  } } }, ['Rimuovi video'])
                : null,
            ]),
            imgFile, vfile,
          ]),
          h('div', { cls: 'slide-side' }, [
            h('button', {
              cls: 'iconbtn', attrs: { 'aria-label': 'Sposta su', title: 'Sposta su', disabled: i === 0 ? 'disabled' : null },
              on: { click: function () {
                if (i === 0) return;
                var next = slides.slice();
                var t = next[i - 1]; next[i - 1] = next[i]; next[i] = t;
                commitSlides(next);
              } },
            }, ['↑']),
            h('button', {
              cls: 'iconbtn', attrs: { 'aria-label': 'Sposta giù', title: 'Sposta giù', disabled: i === slides.length - 1 ? 'disabled' : null },
              on: { click: function () {
                if (i === slides.length - 1) return;
                var next = slides.slice();
                var t = next[i + 1]; next[i + 1] = next[i]; next[i] = t;
                commitSlides(next);
              } },
            }, ['↓']),
            h('button', {
              cls: 'iconbtn', attrs: { 'aria-label': 'Elimina slide', title: 'Elimina slide' },
              on: { click: function () {
                var next = slides.slice();
                next.splice(i, 1);
                commitSlides(next);
              } },
            }, [icon('trash', 12)]),
          ]),
        ]);
        slideWrap.appendChild(row);
      });

      body.appendChild(field('Slide del carosello (' + slides.length + ')',
        h('div', {}, [
          slideWrap,
          h('button', {
            cls: 'btn', style: 'margin-top:8px',
            on: { click: function () {
              commitSlides(slides.concat([{ url: '', externalUrl: '', videoUrl: '', copy: '' }]));
            } },
          }, [icon('plus', 13), 'Aggiungi slide']),
        ]),
        'La prima slide è la copertina mostrata in griglia. Una slide con video mostra la sua immagine finché non viene aperta.'
      ));
    }

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

    mount.appendChild(body);
    if (sameItem) body.scrollTop = lastScrollTop;

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
