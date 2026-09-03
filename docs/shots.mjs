/* Screenshots of every section, so the result can be judged by eye.
   Output: docs/shots/*.png */

import puppeteer from '../../node_modules/puppeteer/lib/puppeteer/puppeteer.js';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT  = resolve(dirname(fileURLToPath(import.meta.url)), 'shots');
const BASE = process.env.BASE || 'http://localhost:4321';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

async function shot(name) {
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: resolve(OUT, name + '.png') });
  console.log('  ' + name + '.png');
}
async function goto(hash) {
  await page.evaluate(h => { location.hash = h; }, hash);
  await new Promise(r => setTimeout(r, 500));
}

await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await shot('01-home');

await goto('#/clients');
await shot('02-clients');

await page.evaluate(() => { location.hash = '#/clients/' + App.clients()[0].id; });
await shot('03-client-edit');

await goto('#/content');
await shot('04-content-picker');

await page.evaluate(() => { location.hash = '#/content/' + App.clients()[0].id; });
await new Promise(r => setTimeout(r, 500));
await page.evaluate(() => App.set({ view: 'board' }));
await shot('05-pipeline');

await page.evaluate(() => App.set({ view: 'grid' }));
await shot('06-grid-instagram');

// A TikTok account, to show the grid following the platform's real ratio.
await page.evaluate(() => {
  const c = App.clients().find(x => (x.accounts||[]).some(a => a.platform === 'TikTok'));
  if (c) { location.hash = '#/content/' + c.id;
    setTimeout(() => App.set({ view: 'grid',
      accountId: c.accounts.find(a => a.platform === 'TikTok').id }), 250); }
});
await shot('07-grid-tiktok');

await page.evaluate(() => App.set({ view: 'calendar' }));
await shot('08-calendar');

await page.evaluate(() => { const c = document.querySelector('.cal-item'); if (c) c.click(); });
await shot('09-inspector');

await goto('#/calendar');
await shot('10-calendar-picker');

await page.evaluate(() => { location.hash = '#/calendar/' + App.clients()[0].id; });
await shot('11-calendar-coverage');

await goto('#/preview');
await shot('12-preview');

await goto('#/settings');
await shot('13-settings');

// Two portals side by side: the point is that they look like different
// brands, not two copies of one agency template.
await page.goto(BASE + '/client?t=mf7c21a8b309', { waitUntil: 'networkidle2' });
await shot('14-portal-marefuori');

await page.goto(BASE + '/client?t=tr4e90d17c62', { waitUntil: 'networkidle2' });
await shot('15-portal-terrarossa');

// The platform post view.
await page.goto(BASE + '/client?t=mf7c21a8b309', { waitUntil: 'networkidle2' });
// The month picker, open.
await page.evaluate(() => document.querySelector('.mp-btn').click());
await shot('16-month-picker');
await page.evaluate(() => document.querySelector('.mp-btn').click());

await page.evaluate(() => document.querySelector('.cv-media').click());
await shot('17-post-instagram');
await page.evaluate(() => document.getElementById('pv-close').click());
await new Promise(r => setTimeout(r, 300));

// A reel — opens as a playing video at true 9:16.
await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.cv-post')];
  const r = cards.find(c => /reel/i.test((c.querySelector('.cv-mark-tr')||{}).textContent||''));
  if (r) r.querySelector('.cv-media').click();
});
await new Promise(r => setTimeout(r, 1400));
await shot('18-post-reel-video');
await page.evaluate(() => document.getElementById('pv-close').click());

// Same post on the Facebook account — stacked layout, 1:1 crop.
await page.evaluate(() => {
  const bs = [...document.querySelectorAll('.cv-seg button')];
  const fb = bs.find(b => /facebook/i.test(b.textContent));
  if (fb) fb.click();
});
await new Promise(r => setTimeout(r, 600));
await page.evaluate(() => { const m = document.querySelector('.cv-media'); if (m) m.click(); });
await shot('19-post-facebook');

await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2 });
await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await shot('20-mobile-home');

// Back to desktop for the two new features.
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

// Client editor for Nodo Studio -- theme picker with Chiaro selected.
await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await page.evaluate(() => { location.hash = '#/clients/c_nodo'; });
await shot('21-client-theme-picker');

// Nodo Studio's own portal -- the light theme in the wild.
await page.goto(BASE + '/client?t=nd5a12c88e47', { waitUntil: 'networkidle2' });
await shot('22-portal-light-theme');

// Multi-channel picker in the inspector -- both boxes tickable/untickable now.
await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await page.evaluate(() => {
  const c = App.clients().find(x => (x.accounts || []).length > 1);
  location.hash = '#/content/' + c.id;
});
await new Promise(r => setTimeout(r, 500));
await page.evaluate(() => App.set({ view: 'board' }));
await new Promise(r => setTimeout(r, 400));
await page.evaluate(async () => {
  const card = document.querySelector('.card');
  if (!card) return;
  card.click();
  await new Promise(r => setTimeout(r, 300));
  const off = [...document.querySelectorAll('.target')].find(b => b.getAttribute('aria-checked') === 'false');
  if (off) { off.click(); await new Promise(r => setTimeout(r, 400)); }
});
await shot('23-inspector-two-channels');

await browser.close().catch(() => {});
console.log('\nsaved to docs/shots/');
