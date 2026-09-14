/*
 * MONTH PICKER — shared by the studio app and the client portal
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A year stepper over a twelve-month grid. Replaces two controls that both had
 * the same flaw from opposite directions:
 *
 *   · the portal's <select>, which listed a hard-coded 2025–2028 as 48 rows —
 *     a scroll list to pick one of twelve things, and a range that quietly
 *     expires the day someone plans into 2029;
 *   · the studio's ‹ › stepper, fine for "next month" and six clicks away
 *     from March next year.
 *
 * The grid is the right shape because a year IS twelve things — you recognise
 * a month by position, not by reading down a list. The year steps either way
 * with no limit, so nothing about this needs maintaining as time passes.
 *
 * Months that already hold content carry a dot. Choosing a month is almost
 * always "where did I leave off" or "which one is still empty", and the dots
 * answer both before you click.
 *
 * Standalone on purpose: no imports, no framework, no knowledge of the store.
 * The portal is a separate page that does not load the app's core, so a shared
 * component has to be able to stand on its own.
 */

window.MonthPicker = (function () {
  'use strict';

  var MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  var SHORT  = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function parse(value) {
    var p = String(value || '').split(' ');
    var i = MONTHS.indexOf(p[0]);
    var y = parseInt(p[1], 10);
    if (i < 0 || isNaN(y)) {
      var now = new Date();
      return { m: now.getMonth(), y: now.getFullYear() };
    }
    return { m: i, y: y };
  }

  function label(m, y) { return MONTHS[m] + ' ' + y; }

  /*
   * create({ value, onPick, hasContent })
   *   value      — "Settembre 2026"
   *   onPick     — fn(newValue)
   *   hasContent — optional fn(monthLabel) -> bool, for the dots
   * Returns the trigger element; the popover is its child.
   */
  function create(opts) {
    opts = opts || {};
    var sel = parse(opts.value);
    var viewYear = sel.y;          // the year the grid is showing
    var open = false;

    var root = h('div', 'mp');

    var btn = h('button', 'mp-btn');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.appendChild(h('span', null, label(sel.m, sel.y)));
    btn.appendChild(h('span', 'mp-caret', '▾'));
    root.appendChild(btn);

    var pop = h('div', 'mp-pop');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Scegli il mese');
    root.appendChild(pop);

    function paint() {
      pop.textContent = '';

      /* Year row. Unbounded in both directions — no range to outgrow. */
      var yr = h('div', 'mp-yr');
      var prev = h('button', 'mp-step', '‹');
      prev.type = 'button';
      prev.setAttribute('aria-label', 'Anno precedente');
      prev.onclick = function (e) { e.stopPropagation(); viewYear--; paint(); };

      var next = h('button', 'mp-step', '›');
      next.type = 'button';
      next.setAttribute('aria-label', 'Anno successivo');
      next.onclick = function (e) { e.stopPropagation(); viewYear++; paint(); };

      yr.appendChild(prev);
      yr.appendChild(h('span', 'mp-yr-v', String(viewYear)));
      yr.appendChild(next);
      pop.appendChild(yr);

      /* Twelve months, four across — a year read as a shape. */
      var grid = h('div', 'mp-grid');
      var now = new Date();
      SHORT.forEach(function (s, i) {
        var val = label(i, viewYear);
        var b = h('button', 'mp-m', s);
        b.type = 'button';
        b.setAttribute('aria-label', label(i, viewYear));
        if (i === sel.m && viewYear === sel.y) {
          b.classList.add('is-on');
          b.setAttribute('aria-current', 'true');
        }
        if (now.getMonth() === i && now.getFullYear() === viewYear) b.classList.add('is-now');
        if (opts.hasContent && opts.hasContent(val)) b.classList.add('has');
        b.onclick = function (e) {
          e.stopPropagation();
          sel = { m: i, y: viewYear };
          btn.firstChild.textContent = label(sel.m, sel.y);
          close();
          if (opts.onPick) opts.onPick(val);
        };
        grid.appendChild(b);
      });
      pop.appendChild(grid);

      /* Always one click back to now, however far you have wandered. */
      var today = h('button', 'mp-today', 'Mese corrente');
      today.type = 'button';
      today.onclick = function (e) {
        e.stopPropagation();
        var n = new Date();
        sel = { m: n.getMonth(), y: n.getFullYear() };
        viewYear = sel.y;
        btn.firstChild.textContent = label(sel.m, sel.y);
        close();
        if (opts.onPick) opts.onPick(label(sel.m, sel.y));
      };
      pop.appendChild(today);
    }

    function openPop() {
      open = true;
      viewYear = sel.y;
      paint();
      root.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('keydown', onKey, true);
    }

    function close() {
      if (!open) return;
      open = false;
      root.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
    }

    function onOutside(e) { if (!root.contains(e.target)) close(); }

    /* Escape closes the picker and nothing else — stopping propagation keeps
       it from also closing the dialog or lightbox underneath. */
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); btn.focus(); }
    }

    btn.onclick = function (e) {
      e.stopPropagation();
      open ? close() : openPop();
    };

    root.setValue = function (v) {
      sel = parse(v);
      viewYear = sel.y;
      btn.firstChild.textContent = label(sel.m, sel.y);
    };
    root.close = close;

    return root;
  }

  return { create: create, MONTHS: MONTHS, SHORT: SHORT, label: label, parse: parse };
})();
