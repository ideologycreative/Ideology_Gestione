/*
 * smoke.mjs — boots both surfaces in a real browser and asserts they work.
 *
 * Rewritten for the rebuilt tool. The previous suite asserted on the extracted
 * app's structure (switchTab, #page-feed, .tab-btn, setGlobalClient); none of
 * that exists any more, and a test suite that describes a shape the product no
 * longer has is worse than none.
 *
 * What it covers is what actually broke during this build: boot, seeding,
 * palette resolution, each of the three views rendering, the pipeline drag,
 * inspector edits committing, XSS, and approval round-tripping to the portal.
 *
 * Run:  node serve.mjs        (one terminal)
 *       node docs/smoke.mjs   (another)
 */

import puppeteer from '../../node_modules/puppeteer/lib/puppeteer/puppeteer.js';

const BASE  = process.env.BASE || 'http://localhost:4321';
const TOKEN = 'mf7c21a8b309';
const EXTERNAL_OK = /picsum\.photos|fastly\.picsum/;

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

async function open(browser, url) {
  const page = await browser.newPage();
  const errors = [], bad = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => { if (!EXTERNAL_OK.test(r.url())) bad.push(r.url()); });
  page.on('response', r => {
    if (r.status() >= 400 && !EXTERNAL_OK.test(r.url())) bad.push(r.status() + ' ' + r.url());
  });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  return { page, errors, bad };
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  /* ── Studio ───────────────────────────────────────────────────────────── */
  console.log('\nSTUDIO  ' + BASE + '/');
  {
    const { page, errors, bad } = await open(browser, BASE + '/');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });

    check('no console errors',  errors.length === 0, errors.slice(0, 3).join(' | '));
    check('no failed requests', bad.length === 0,    bad.slice(0, 3).join(' | '));

    const boot = await page.evaluate(() => ({
      seeded:  window.IdeologyStore ? window.IdeologyStore.get('clients').length : -1,
      posts:   window.IdeologyStore
        ? Object.values(window.IdeologyStore.get('feeds')).reduce((n, a) => n + a.length, 0) : -1,
      brand:   getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(),
      bg:      getComputedStyle(document.body).backgroundColor,
      mono:    document.fonts ? document.fonts.check('12px "Ideology Mono"') : null,
      menu:    [...document.querySelectorAll('.menu-item')].map(e => e.textContent.trim()),
      section: document.body.dataset.section,
      hasHero: !!document.querySelector('.home-word'),
      stats:   document.querySelectorAll('.stat').length,
    }));

    check('demo data seeded',   boot.seeded === 5, boot.seeded + ' clients');
    check('feeds seeded',       boot.posts > 100,  boot.posts + ' posts');
    check('brand token',        boot.brand.toUpperCase() === '#F2C700', boot.brand);
    check('page ground',        boot.bg === 'rgb(16, 16, 16)', boot.bg);
    check('mono face loaded',   boot.mono === true);
    check('6 sections in menu', boot.menu.length === 6, boot.menu.join(' / '));
    check('boots on home',      boot.section === 'home' && boot.hasHero);
    check('home shows stats',   boot.stats === 5, boot.stats + ' stats');

    /* Routing — every section reachable, URL and screen agree. */
    for (const [hash, section, sel] of [
      ['#/clients',  'clients',  '.tiles'],
      ['#/content',  'content',  '.tiles'],
      ['#/calendar', 'calendar', '.tiles'],
      ['#/preview',  'preview',  '.tiles'],
      ['#/settings', 'settings', '.card-panel'],
      ['#/',         'home',     '.home-word'],
    ]) {
      await page.evaluate(hh => { location.hash = hh; }, hash);
      await new Promise(r => setTimeout(r, 320));
      const r = await page.evaluate(s2 => ({
        section: document.body.dataset.section,
        found: !!document.querySelector(s2),
      }), sel);
      check('route ' + hash, r.section === section && r.found, r.section);
    }

    /* Client CRUD, end to end. */
    const crud = await page.evaluate(async () => {
      const before = App.clients().length;
      const id = App.createClient({ name: 'TEST SRL' });
      await new Promise(r => setTimeout(r, 120));
      App.updateClient(id, { color: '#2DA7A7' });
      const accId = App.addAccount(id, 'TikTok');
      App.updateAccount(id, accId, { handle: '@testsrl' });
      const c = App.client(id);
      const mid = {
        name: c.name, color: c.color,
        acc: (c.accounts[0] || {}).platform,
        handle: (c.accounts[0] || {}).handle,
        token: !!c.shareToken,
      };
      App.removeClient(id);
      return { before, mid, after: App.clients().length };
    });
    check('create client',      crud.mid.name === 'TEST SRL', crud.mid.name);
    check('edit colour',        crud.mid.color === '#2DA7A7');
    check('add account',        crud.mid.acc === 'TikTok' && crud.mid.handle === '@testsrl');
    check('share token minted', crud.mid.token === true);
    check('remove client',      crud.after === crud.before, crud.before + ' -> ' + crud.after);

    /* Platform drives the published shape. */
    const ratios = await page.evaluate(async () => {
      const igC = App.clients().find(x => (x.accounts || []).some(a => a.platform === 'Instagram'));
      const tkC = App.clients().find(x => (x.accounts || []).some(a => a.platform === 'TikTok'));
      const out = { ig: null, tk: null };
      if (igC) {
        const a = igC.accounts.find(x => x.platform === 'Instagram');
        location.hash = '#/content/' + igC.id;
        await new Promise(r => setTimeout(r, 300));
        App.set({ view: 'grid', accountId: a.id });
        await new Promise(r => setTimeout(r, 360));
        const t = document.querySelector('.gcell .thumb');
        out.ig = t ? t.style.aspectRatio : null;
      }
      if (tkC) {
        const a = tkC.accounts.find(x => x.platform === 'TikTok');
        location.hash = '#/content/' + tkC.id;
        await new Promise(r => setTimeout(r, 300));
        App.set({ view: 'grid', accountId: a.id });
        await new Promise(r => setTimeout(r, 360));
        const t = document.querySelector('.gcell .thumb');
        out.tk = t ? t.style.aspectRatio : null;
      }
      return out;
    });
    check('Instagram grid is 4:5', /4\s*\/\s*5/.test(ratios.ig || ''), ratios.ig);
    if (ratios.tk) check('TikTok grid is 9:16', /9\s*\/\s*16/.test(ratios.tk), ratios.tk);

    /* Workspace still works after the restructure. */
    await page.evaluate(() => {
      location.hash = '#/content/' + App.clients()[0].id;
    });
    await new Promise(r => setTimeout(r, 340));
    // The ratio block above left the view on grid; assert the board explicitly
    // rather than inheriting whatever the previous test happened to leave.
    await page.evaluate(() => App.set({ view: 'board' }));
    await new Promise(r => setTimeout(r, 300));

    const struct = await page.evaluate(() => ({
      cols: [...document.querySelectorAll('.col-name')].map(e => e.textContent),
      noTabs: document.querySelectorAll('.tab-btn, [id^="page-"]').length,
      hasStatus: !!document.querySelector('#status .st-bar'),
    }));
    check('pipeline has 5 named stages', struct.cols.length === 5, struct.cols.join(' -> '));
    check('old tab structure gone',  struct.noTabs === 0, struct.noTabs + ' leftovers');
    check('status bar in workspace', struct.hasStatus);

    for (const [key, view, sel] of [['1','board','.board'],['2','grid','.ggrid'],['3','calendar','.cal']]) {
      await page.keyboard.press(key);
      await new Promise(r => setTimeout(r, 280));
      const r = await page.evaluate(s2 => {
        const el = document.querySelector(s2);
        return { present: !!el, kids: el ? el.children.length : 0 };
      }, sel);
      check('view "' + view + '" renders', r.present && r.kids > 0, r.kids + ' nodes');
    }

    await page.keyboard.press('1');
    await new Promise(r => setTimeout(r, 280));
    const moved = await page.evaluate(async () => {
      const before = [...document.querySelectorAll('.col')].map(c => c.querySelectorAll('.card').length);
      const card = document.querySelector('.col[data-s="bozza"] .card');
      if (!card) return { skipped: true, why: 'no draft card' };
      card.click();
      await new Promise(r => setTimeout(r, 280));
      const btn = document.querySelector('.statelist .state[data-s="approvato"]');
      if (!btn) return { skipped: true, why: 'no status control' };
      btn.click();
      await new Promise(r => setTimeout(r, 280));
      const after = [...document.querySelectorAll('.col')].map(c => c.querySelectorAll('.card').length);
      return { before, after };
    });
    check('moving a card changes the pipeline',
      !moved.skipped && moved.before[0] > moved.after[0] && moved.after[3] > moved.before[3],
      moved.skipped ? moved.why : moved.before.join(',') + ' -> ' + moved.after.join(','));

    const edited = await page.evaluate(async () => {
      const card = document.querySelector('.card');
      if (!card) return { skipped: true, why: 'no card' };
      card.click();
      await new Promise(r => setTimeout(r, 260));
      const id = App.state.selectedId;
      const ta = document.querySelector('.insp-body textarea.input');
      if (!ta) return { skipped: true, why: 'no caption field' };
      ta.value = 'CAPTION MODIFICATA DAL TEST';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 520));
      return { stored: (App.itemById(id) || {}).copy };
    });
    check('inspector edit persists',
      !edited.skipped && edited.stored === 'CAPTION MODIFICATA DAL TEST',
      edited.stored || edited.why);


    /* ── Coverage calendar ────────────────────────────────────────────────
       The new section: dots only, and sponsored posts have to be the loudest
       thing on it. */
    const cov = await page.evaluate(async () => {
      const c = App.clients()[0];
      location.hash = '#/calendar/' + c.id;
      await new Promise(r => setTimeout(r, 420));
      const cells = document.querySelectorAll('.cov-cell:not(.cov-cell--pad)');
      const dots  = document.querySelectorAll('.cov .dot');
      const spon  = document.querySelectorAll('.cov .dot--spon');
      const titles = [...document.querySelectorAll('.cov-cell .cal-item-t, .cov-cell .cov-title')];
      // Dot size must actually differ, not just colour — the mark has to
      // survive greyscale and colour-blindness.
      let plainSize = null, sponSize = null;
      const p0 = document.querySelector('.cov .dot:not(.dot--spon)');
      const s0 = document.querySelector('.cov .dot--spon');
      if (p0) plainSize = Math.round(p0.getBoundingClientRect().width);
      if (s0) sponSize  = Math.round(s0.getBoundingClientRect().width);
      return {
        cells: cells.length, dots: dots.length, spon: spon.length,
        titles: titles.length, plainSize, sponSize,
        full: document.querySelectorAll('.cov-cell.is-full').length,
      };
    });
    check('coverage calendar renders days', cov.cells >= 28, cov.cells + ' cells');
    check('days carry dots',                cov.dots > 0, cov.dots + ' dots');
    check('some days are marked full',      cov.full > 0, cov.full + ' filled');
    check('no titles in coverage view',     cov.titles === 0, cov.titles + ' titles');
    check('sponsored dots present',         cov.spon > 0, cov.spon + ' sponsored');
    check('sponsored dot is larger, not just coloured',
      cov.sponSize > cov.plainSize, cov.plainSize + 'px -> ' + cov.sponSize + 'px');

    /* Photo, carousel, reel, story and sponsored each need their own colour —
       a coverage map where every mark looks the same is just a density plot. */
    const palette = await page.evaluate(() => {
      const seen = {};
      [...document.querySelectorAll('.cov .dot')].forEach(d => {
        seen[getComputedStyle(d).backgroundColor] = true;
      });
      return { colours: Object.keys(seen), legend: document.querySelectorAll('.legend-i').length };
    });
    check('dots use several type colours', palette.colours.length >= 3,
      palette.colours.length + ' distinct');
    check('legend names every mark', palette.legend >= 5, palette.legend + ' entries');

    /* ── Sponsored toggle ─────────────────────────────────────────────────── */
    const spon = await page.evaluate(async () => {
      const c = App.clients()[0];
      location.hash = '#/content/' + c.id;
      await new Promise(r => setTimeout(r, 380));
      App.set({ view: 'board' });
      await new Promise(r => setTimeout(r, 300));
      const card = document.querySelector('.card');
      if (!card) return { skipped: true, why: 'no card' };
      card.click();
      await new Promise(r => setTimeout(r, 280));
      const id = App.state.selectedId;
      const was = !!(App.itemById(id) || {}).sponsored;
      const t = document.querySelector('.toggle');
      if (!t) return { skipped: true, why: 'no toggle' };
      t.click();
      await new Promise(r => setTimeout(r, 300));
      const now = !!(App.itemById(id) || {}).sponsored;
      // Leave it ON so the badge assertion below has something to find.
      if (!now) { document.querySelector('.toggle').click(); await new Promise(r => setTimeout(r, 300)); }
      return { was, now, flipped: was !== now,
               badge: !!document.querySelector('.thumb-spon') };
    });
    check('sponsored toggle flips the flag', !spon.skipped && spon.flipped,
      spon.skipped ? spon.why : spon.was + ' -> ' + spon.now);
    check('sponsored badge on the frame', !spon.skipped && spon.badge === true);


    /* ── Named statuses ───────────────────────────────────────────────────
       The control was a row of bare tokens; the words are what make it
       readable to someone who has not learned [??] yet. */
    const states = await page.evaluate(async () => {
      const card = document.querySelector('.card');
      if (!card) return { skipped: true, why: 'no card' };
      card.click();
      await new Promise(r => setTimeout(r, 300));
      const rows = [...document.querySelectorAll('.statelist .state')];
      return {
        count: rows.length,
        labels: rows.map(r => (r.querySelector('.state-lbl') || {}).textContent),
        tokens: rows.map(r => (r.querySelector('.state-tok') || {}).textContent),
        selected: rows.filter(r => r.getAttribute('aria-checked') === 'true').length,
      };
    });
    check('status list shows 5 options', !states.skipped && states.count === 5,
      states.skipped ? states.why : states.count + '');
    check('each status has a word, not just a token',
      !states.skipped && states.labels.every(l => l && l.length > 3),
      (states.labels || []).join(' / '));
    check('tokens are kept alongside the words',
      !states.skipped && states.tokens.every(t => /\[.{2}\]/.test(t || '')),
      (states.tokens || []).join(' '));
    check('exactly one status selected', !states.skipped && states.selected === 1);

    /* ── One post, several channels ───────────────────────────────────────
       Ticking a second channel should create that channel's copy — same
       content, its own approval state — rather than making you build it
       twice. */
    const multi = await page.evaluate(async () => {
      // A client with two accounts.
      const c = App.clients().find(x => (x.accounts || []).length > 1);
      if (!c) return { skipped: true, why: 'no multi-account client' };
      location.hash = '#/content/' + c.id;
      await new Promise(r => setTimeout(r, 420));
      App.set({ view: 'board', accountId: c.accounts[0].id });
      await new Promise(r => setTimeout(r, 350));

      const card = document.querySelector('.card');
      if (!card) return { skipped: true, why: 'no card' };
      card.click();
      await new Promise(r => setTimeout(r, 320));

      const id = App.state.selectedId;
      const item = App.itemById(id);
      const before = App.targetsOf(item).length;
      const beforeOther = (window.IdeologyStore.getFeed(c.accounts[1].id, App.state.month) || []).length;

      const boxes = [...document.querySelectorAll('.target')];
      const off = boxes.find(b => b.getAttribute('aria-checked') === 'false');
      if (!off) return { skipped: true, why: 'both channels already on' };
      off.click();
      await new Promise(r => setTimeout(r, 400));

      const after = App.targetsOf(App.itemById(id)).length;
      const afterOther = (window.IdeologyStore.getFeed(c.accounts[1].id, App.state.month) || []).length;

      // The copy must carry the same content and its own state.
      const gid = App.itemById(id).groupId;
      const sibs = App.groupSiblings(gid);
      const src = App.itemById(id);
      const clone = (sibs.find(x => x.item.id !== id) || {}).item;

      // Editing the caption must reach the clone.
      App.patchItem(id, { copy: 'SYNC TEST' });
      await new Promise(r => setTimeout(r, 300));
      const cloneAfter = App.groupSiblings(gid).find(x => x.item.id !== id);

      return {
        before, after, beforeOther, afterOther,
        sameImage: clone ? clone.url === src.url : false,
        cloneIsDraft: clone ? clone.apprStato === 'bozza' : false,
        captionSynced: cloneAfter ? cloneAfter.item.copy === 'SYNC TEST' : false,
        marker: !!document.querySelector('.card-links'),
      };
    });

    if (multi.skipped) {
      check('multi-channel publishing', false, multi.why);
    } else {
      check('adding a channel grows the target list',
        multi.after === multi.before + 1, multi.before + ' -> ' + multi.after);
      check('the other account gains a copy',
        multi.afterOther === multi.beforeOther + 1,
        multi.beforeOther + ' -> ' + multi.afterOther);
      check('the copy carries the same media', multi.sameImage === true);
      check('the copy starts as its own draft', multi.cloneIsDraft === true);
      check('editing content syncs across channels', multi.captionSynced === true);
      check('grid marks a multi-channel post', multi.marker === true);
    }

    /* ── Deselecting the current channel ──────────────────────────────────
       Reported bug: ticking OFF the account you are currently viewing did
       nothing -- the click registered but the box never cleared. Cause:
       setTargets() protected the copy under the cursor from its own removal
       list, so removal never reached it. Continuing straight on from the
       "multi" block above, the post is now on two channels; this turns the
       FIRST one back off, which is exactly the case that was broken. */
    const deselect = await page.evaluate(async () => {
      if (!App.state.selectedId) return { skipped: true, why: 'no post selected' };
      const startAccount = App.state.accountId;
      const id = App.state.selectedId;
      const before = App.targetsOf(App.itemById(id)).length;
      if (before < 2) return { skipped: true, why: 'post is not on 2 channels' };

      const onBox = [...document.querySelectorAll('.target')]
        .find(b => b.getAttribute('aria-checked') === 'true');
      if (!onBox) return { skipped: true, why: 'no checked channel found' };
      onBox.click();
      await new Promise(r => setTimeout(r, 400));

      // The old copy is deleted outright; the panel should now be showing
      // its surviving sibling under a different id and a different account.
      // Re-query the DOM fresh rather than reuse onBox -- clicking triggers
      // a full inspector re-render (A.clear + rebuild), which detaches the
      // original node; its own attributes freeze at click-time and checking
      // them again proves nothing about what actually painted afterward.
      const oldGone = !App.itemById(id);
      const now = App.itemById(App.state.selectedId);
      const checkedNow = document.querySelectorAll('.target[aria-checked="true"]').length;
      return {
        before,
        after: now ? App.targetsOf(now).length : -1,
        oldCopyDeleted: oldGone,
        stillHasSelection: !!App.state.selectedId,
        accountChanged: App.state.accountId !== startAccount,
        checkedBoxesNow: checkedNow,
      };
    });
    if (deselect.skipped) {
      check('deselect current channel', false, deselect.why);
    } else {
      check('the panel reflects the new state (1 box checked, not 2)',
        deselect.checkedBoxesNow === 1, deselect.checkedBoxesNow + ' checked');
      check('deselecting drops the target count', deselect.after === deselect.before - 1,
        deselect.before + ' -> ' + deselect.after);
      check('inspector follows to the surviving channel',
        deselect.stillHasSelection && deselect.accountChanged);
      check("the deselected channel's own copy is gone", deselect.oldCopyDeleted === true);
    }

    /* The very last channel must stay locked -- a post cannot go out nowhere. */
    const lastLock = await page.evaluate(async () => {
      const boxes = [...document.querySelectorAll('.target')];
      const on = boxes.find(b => b.getAttribute('aria-checked') === 'true');
      if (!on) return { skipped: true };
      return { disabled: on.disabled === true || on.hasAttribute('disabled') };
    });
    if (!lastLock.skipped) {
      check('the last remaining channel cannot be unticked', lastLock.disabled === true);
    }

    /* Command palette. */
    const pal = await page.evaluate(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      const open = document.querySelector('#palette').classList.contains('is-open');
      const rows = document.querySelectorAll('.pal-row').length;
      return { open, rows };
    });
    check('palette opens on ⌘K', pal.open && pal.rows > 5, pal.rows + ' commands');

    await page.close();
  }

  /* ── Portal ───────────────────────────────────────────────────────────── */
  console.log('\nPORTAL  ' + BASE + '/client?t=' + TOKEN);
  {
    const { page, errors, bad } = await open(browser, `${BASE}/client?t=${TOKEN}`);
    // Desktop width on purpose: the Instagram post view stacks below 860px
    // by design, and the assertions below are about the DESKTOP layout. The
    // default headless viewport is 800px, which silently tested the mobile
    // arrangement against a desktop expectation.
    await page.setViewport({ width: 1280, height: 900 });
    await page.reload({ waitUntil: 'networkidle2' });

    check('no console errors',  errors.length === 0, errors.slice(0, 3).join(' | '));
    check('no failed requests', bad.length === 0,    bad.slice(0, 3).join(' | '));

    const p = await page.evaluate(() => ({
      client:  (document.querySelector('.cv-client') || {}).textContent,
      posts:   document.querySelectorAll('.cv-post').length,
      ratio:   (document.querySelector('.cv-progress span') || {}).textContent,
      bg:      getComputedStyle(document.body).backgroundColor,
      fatal:   !!document.querySelector('.cv-fatal'),
    }));
    check('resolves share token', !p.fatal && p.client === 'Marefuori', p.client);
    check('renders posts',        p.posts > 0, p.posts + ' posts');
    check('shows ratio',          !!p.ratio, p.ratio);
    check('dark ground',          p.bg === 'rgb(16, 16, 16)', p.bg);

    /* -- Per-client portal theme --------------------------------------------
       Every portal used to be black regardless of the client. A client's
       theme is now stored on their own record and applied via data-theme at
       boot; this opens a SECOND client's portal (Nodo Studio, seeded with
       theme:'light') in a fresh page to prove the choice is actually
       per-client, not a global flip -- Marefuori above must stay dark while
       this one goes white in the same browser session. */
    const light = await open(browser, BASE + '/client?t=nd5a12c88e47');
    const lp = await light.page.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute('data-theme'),
      bg: getComputedStyle(document.body).backgroundColor,
      text: getComputedStyle(document.body).color,
      client: (document.querySelector('.cv-client') || {}).textContent,
    }));
    check('light-theme client renders data-theme=light', lp.dataTheme === 'light', lp.dataTheme);
    check('light-theme portal ground is white', lp.bg === 'rgb(255, 255, 255)', lp.bg);
    check('light-theme portal text is dark, not washed out',
      lp.text === 'rgb(16, 16, 16)', lp.text);
    check('opened the right client', lp.client === 'Nodo Studio', lp.client);
    await light.page.close();

    /* XSS regression. The portal this replaced interpolated captions into
       innerHTML; with 'unsafe-inline' in the CSP that executed. */
    const xss = await page.evaluate(() => {
      const S = window.IdeologyStore;
      const c = S.getClientByToken('mf7c21a8b309');
      const acc = c.accounts[0];
      const M = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                 'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
      const now = new Date();
      const m = M[now.getMonth()] + ' ' + now.getFullYear();
      const items = S.getFeed(acc.id, m).slice();
      const victim = items.find(i => (i.apprStato || 'bozza') !== 'bozza');
      if (!victim) return { skipped: true };
      victim.copy = '<img src=x onerror="window.__XSS=1">PWNED';
      S.setFeed(acc.id, m, items);
      return { injected: true };
    });
    if (!xss.skipped) {
      await page.reload({ waitUntil: 'networkidle2' });
      const r = await page.evaluate(() => ({
        fired: !!window.__XSS,
        shown: [...document.querySelectorAll('.cv-copy')].some(e => e.textContent.includes('PWNED')),
      }));
      check('caption markup does NOT execute', r.fired === false);
      check('caption rendered as text',        r.shown === true);
    }

    /* The portal is a dead end by design: a client must never be one misclick
       from the admin, and a screen-share of it should show them nothing else. */
    const leak = await page.evaluate(() => {
      const hrefs = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href') || '');
      return hrefs.filter(x => /#\/(clients|content|preview|settings)/.test(x)
                            || /pages\/studio/.test(x));
    });
    check('portal has no link into the studio', leak.length === 0, leak.join(' | '));

    /* Sponsorship is a disclosure — it has to reach the client, not just sit
       in the admin. */
    const disclosure = await page.evaluate(() => {
      const S = window.IdeologyStore;
      const c = S.getClientByToken('mf7c21a8b309');
      const acc = c.accounts[0];
      const M = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                 'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
      const now = new Date();
      const m = M[now.getMonth()] + ' ' + now.getFullYear();
      const items = S.getFeed(acc.id, m).slice();
      const v = items.find(i => (i.apprStato || 'bozza') !== 'bozza');
      if (!v) return { skipped: true };
      v.sponsored = true;
      S.setFeed(acc.id, m, items);
      return { ok: true };
    });
    if (!disclosure.skipped) {
      await page.reload({ waitUntil: 'networkidle2' });
      const shown = await page.evaluate(() => {
        const b = document.querySelector('.cv-spon');
        if (!b) return { found: false };
        const r = b.getBoundingClientRect();
        const card = b.closest('.cv-post').getBoundingClientRect();
        return {
          found: true,
          text: b.textContent.trim(),
          // Top-right of the frame, as specified.
          topRight: Math.abs(r.right - card.right) < 3 && Math.abs(r.top - card.top) < 3,
        };
      });
      check('portal shows SPONSOR badge', shown.found, shown.text);
      check('badge sits top-right of the frame', shown.topRight === true);
    }

    /* ── Client palette, identity and month range ────────────────────────
       Each portal should look like the CLIENT's page, not like five copies of
       one agency template. */
    const brandcheck = await page.evaluate(() => {
      const S = window.IdeologyStore;
      const c = S.getClientByToken('mf7c21a8b309');
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent').trim();
      const btn = document.querySelector('.cv-btn.primary');
      const label = (document.querySelector('.mp-btn span') || {}).textContent || '';
      return {
        accent,
        clientColor: (c.color || '').toLowerCase(),
        btnBg: btn ? getComputedStyle(btn).backgroundColor : null,
        monthTitle: (document.querySelector('.cv-month') || {}).textContent,
        monthSize: document.querySelector('.cv-month')
          ? Math.round(parseFloat(getComputedStyle(document.querySelector('.cv-month')).fontSize)) : 0,
        pickerLabel: label,
        hasPicker: !!document.querySelector('.mp-btn'),
        studioMark: !!document.querySelector('.cv-studio'),
        clientMark: !!document.querySelector('.cv-logo'),
      };
    });
    check('portal uses the client colour',
      brandcheck.accent.toLowerCase() === brandcheck.clientColor,
      brandcheck.accent + ' vs ' + brandcheck.clientColor);
    check('approve button carries it', !!brandcheck.btnBg && brandcheck.btnBg !== 'rgba(0, 0, 0, 0)',
      brandcheck.btnBg);
    check('month title is large', brandcheck.monthSize >= 34, brandcheck.monthSize + 'px');
    check('month title reads "<mese> PED"', /PED/.test(brandcheck.monthTitle || ''),
      (brandcheck.monthTitle || '').trim());
    check('month picker replaces the dropdown', brandcheck.hasPicker === true,
      brandcheck.pickerLabel);
    check('studio mark present', brandcheck.studioMark);
    check('client mark present',  brandcheck.clientMark);



    /* ── Grid alignment ───────────────────────────────────────────────────
       A regression guard for a real break: frames were drawn at each item's
       own ratio, so a 9:16 reel sat beside a 4:5 photo and no row could line
       up. In a grid every cell takes the ACCOUNT's ratio — which is also what
       the platforms do to a reel in a profile grid. */
    const align = await page.evaluate(() => {
      const media = [...document.querySelectorAll('.cv-post .cv-media')];
      if (!media.length) return { skipped: true };
      const heights = media.map(m => Math.round(m.getBoundingClientRect().height));
      const ratios  = [...new Set(media.map(m => getComputedStyle(m).aspectRatio))];
      const tops    = [...new Set(media.map(m => Math.round(m.getBoundingClientRect().top)))];
      // Cards in the same row should share a top edge and a bottom edge.
      const cards = [...document.querySelectorAll('.cv-post')];
      const firstRowTop = Math.round(cards[0].getBoundingClientRect().top);
      const row = cards.filter(c => Math.abs(Math.round(c.getBoundingClientRect().top) - firstRowTop) < 3);
      const rowBottoms = [...new Set(row.map(c => Math.round(c.getBoundingClientRect().bottom)))];
      return {
        distinctHeights: [...new Set(heights)],
        distinctRatios: ratios,
        rowSize: row.length,
        rowBottoms,
        hasReel: !!document.querySelector('.cv-mark-tr'),
      };
    });
    check('every grid frame is the same height',
      !align.skipped && align.distinctHeights.length === 1,
      (align.distinctHeights || []).join(', ') + 'px');
    check('every grid frame uses one ratio',
      !align.skipped && align.distinctRatios.length === 1,
      (align.distinctRatios || []).join(' | '));
    check('cards in a row share a bottom edge',
      !align.skipped && align.rowBottoms.length === 1,
      align.rowSize + ' cards, bottoms: ' + (align.rowBottoms || []).join(', '));


    /* ── Reels play, and the detail view does not re-crop ─────────────────
       Two bugs this guards. (1) A "reel" was a still image with a label —
       nothing played. (2) The detail frame used object-fit:cover over a
       flex-stretched box, so a 9:16 source rendered 600x774 and was cropped a
       SECOND time, differently from the grid: the client approved one framing
       and was shown another. */
    const reel = await page.evaluate(async () => {
      const cards = [...document.querySelectorAll('.cv-post')];
      const r = cards.find(c => /reel/i.test((c.querySelector('.cv-mark-tr') || {}).textContent || ''));
      if (!r) return { skipped: true, why: 'no reel in this month' };
      const gridBox = r.querySelector('.cv-media').getBoundingClientRect();
      const gridRatio = getComputedStyle(r.querySelector('.cv-media')).aspectRatio;
      const hasPlayGlyph = !!r.querySelector('.cv-play');

      r.querySelector('.cv-media').click();
      await new Promise(res => setTimeout(res, 900));

      const v = document.querySelector('.pv-media video');
      const m = document.querySelector('.pv-media');
      const box = m.getBoundingClientRect();
      let playing = false, readable = false;
      if (v) {
        try { await v.play(); } catch (e) {}
        await new Promise(res => setTimeout(res, 600));
        readable = v.readyState >= 2;
        playing = !v.paused && v.currentTime > 0;
      }
      return {
        hasPlayGlyph,
        gridRatio,
        isVideo: !!v,
        controls: v ? v.controls : null,
        muted: v ? v.muted : null,
        loop: v ? v.loop : null,
        readable, playing,
        fit: v ? getComputedStyle(v).objectFit
               : getComputedStyle(document.querySelector('.pv-media img')).objectFit,
        detailRatio: getComputedStyle(m).aspectRatio,
        // The rendered box must actually match the ratio it claims.
        boxRatio: (box.width / box.height).toFixed(2),
      };
    });

    if (reel.skipped) {
      check('reel checks', false, reel.why);
    } else {
      check('reel shows a play glyph in the grid', reel.hasPlayGlyph === true);
      check('opening a reel gives a <video>', reel.isVideo === true);
      check('video is muted, looping, scrubbable',
        reel.muted === true && reel.loop === true && reel.controls === true);
      check('video actually loads and plays',
        reel.readable === true && reel.playing === true,
        'readyState ok: ' + reel.readable + ', playing: ' + reel.playing);
      check('detail media is contained, never re-cropped',
        reel.fit === 'contain', reel.fit);
      check('detail frame is the ratio it claims',
        Math.abs(Number(reel.boxRatio) - (9 / 16)) < 0.04,
        reel.detailRatio + ' rendered as ' + reel.boxRatio);
      check('grid crops the reel to the feed ratio',
        /4\s*\/\s*5/.test(reel.gridRatio), reel.gridRatio);
    }

    await page.evaluate(() => document.getElementById('pv-close').click());
    await new Promise(r => setTimeout(r, 250));

    /* ── Month picker ─────────────────────────────────────────────────────
       A year stepper over a twelve-month grid. The point is that it is
       unbounded — the old <select> hard-coded 2025-2028 and would have gone
       stale on its own. */
    const picker = await page.evaluate(async () => {
      const btn = document.querySelector('.mp-btn');
      if (!btn) return { skipped: true, why: 'no picker' };
      btn.click();
      await new Promise(r => setTimeout(r, 220));
      const openNow = document.querySelector('.mp').classList.contains('is-open');
      const cells = document.querySelectorAll('.mp-m').length;
      const marked = document.querySelectorAll('.mp-m.has').length;
      const startYear = document.querySelector('.mp-yr-v').textContent;

      // Step forward four years — further than any hard-coded range went.
      const next = document.querySelectorAll('.mp-step')[1];
      for (let i = 0; i < 4; i++) next.click();
      await new Promise(r => setTimeout(r, 160));
      const farYear = document.querySelector('.mp-yr-v').textContent;

      // Pick March there.
      document.querySelectorAll('.mp-m')[2].click();
      await new Promise(r => setTimeout(r, 320));
      return {
        openNow, cells, marked, startYear, farYear,
        title: (document.querySelector('.cv-month') || {}).textContent,
        closed: !document.querySelector('.mp').classList.contains('is-open'),
        label: (document.querySelector('.mp-btn span') || {}).textContent,
      };
    });
    check('picker opens', !picker.skipped && picker.openNow, picker.why);
    check('shows 12 months at once', picker.cells === 12, picker.cells + ' cells');
    check('marks months holding content', picker.marked > 0, picker.marked + ' marked');
    check('year steps without limit',
      Number(picker.farYear) === Number(picker.startYear) + 4,
      picker.startYear + ' -> ' + picker.farYear);
    check('picking a far month drives the page',
      /Marzo/i.test(picker.title || '') && (picker.label || '').includes(picker.farYear),
      (picker.title || '').trim() + ' / ' + picker.label);
    check('picker closes after choosing', picker.closed === true);

    // Back to the current month so the assertions below see the seeded data.
    await page.evaluate(async () => {
      document.querySelector('.mp-btn').click();
      await new Promise(r => setTimeout(r, 200));
      document.querySelector('.mp-today').click();
    });
    await new Promise(r => setTimeout(r, 400));

    /* ── Platform post view ───────────────────────────────────────────────
       Clicking a frame opens the post as the platform renders it, not a bare
       lightbox. */
    const post = await page.evaluate(async () => {
      const m = document.querySelector('.cv-media');
      if (!m) return { skipped: true };
      m.click();
      await new Promise(r => setTimeout(r, 320));
      const card = document.querySelector('.pv-card');
      const side = document.querySelector('.pv-side');
      const user = document.querySelector('.pv-user');
      const av   = document.querySelector('.pv-av');
      const media = document.querySelector('.pv-media');
      return {
        open: document.getElementById('pv').classList.contains('open'),
        hasCard: !!card,
        white: card ? getComputedStyle(card).backgroundColor : null,
        // Instagram desktop: media LEFT, caption rail RIGHT.
        sideRight: (side && media)
          ? side.getBoundingClientRect().left >= media.getBoundingClientRect().right - 2
          : false,
        handle: user ? user.textContent : null,
        hasAvatar: !!av,
        platLabel: (document.getElementById('pv-plat') || {}).textContent,
      };
    });
    check('clicking a frame opens the post view', !post.skipped && post.open && post.hasCard);
    check('rendered as the platform (white card)',
      post.white === 'rgb(255, 255, 255)', post.white);
    check('IG desktop: caption rail sits right of media', post.sideRight === true);
    check('shows the account handle', /@|marefuori/i.test(post.handle || ''), post.handle);
    check('shows an avatar', post.hasAvatar === true);
    check('names the platform', /instagram/i.test(post.platLabel || ''), post.platLabel);

    await page.evaluate(() => document.getElementById('pv-close').click());
    await new Promise(r => setTimeout(r, 200));

    /* Approval persists. */
    const appr = await page.evaluate(async () => {
      const btn = document.querySelector('.cv-btn.primary');
      if (!btn) return { skipped: true };
      const before = document.querySelectorAll('.cv-done').length;
      btn.click();
      await new Promise(r => setTimeout(r, 260));
      return { before, after: document.querySelectorAll('.cv-done').length };
    });
    if (!appr.skipped) {
      check('approve updates the board', appr.after > appr.before,
        appr.before + ' → ' + appr.after);
      await page.reload({ waitUntil: 'networkidle2' });
      const kept = await page.evaluate(() => document.querySelectorAll('.cv-done').length);
      check('approval survives reload', kept >= appr.after, kept + ' approved');
    }

    await page.close();
  }
} finally {
  // Windows holds the temp profile lockfile briefly after exit; a cleanup
  // race must not mask an otherwise green run.
  await browser.close().catch(e => console.log('  (cleanup: ' + e.message.slice(0, 50) + ')'));
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
