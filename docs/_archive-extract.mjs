/*
 * extract.mjs — builds the Ideology studio page out of the source tool's
 * content page, by deletion rather than by copying.
 *
 * Why a script and not hand-editing: the source page is 2014 lines and app.js
 * is 14,938. Cutting those by hand once is error-prone; cutting them by hand
 * AGAIN after the source changes is worse. This is re-runnable, so a fix
 * upstream can be pulled forward by editing the KEEP list and re-running.
 *
 * Run:  node docs/extract.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC  = resolve(ROOT, '..', 'Nassa-Content-main');

/* ── Scope ────────────────────────────────────────────────────────────────
   The five tabs that make up "social posts + client preview", plus the studio
   client-list that is the app's home screen. Everything else in the source —
   strategy, brand kit, moodboard, ads, landing, print, reports, QBR, the
   yearly plan, shooting, briefs, storyboard, notes — is dropped entirely. */
const KEEP_TABS = ['studio', 'feed', 'stories', 'ped', 'cal', 'preview'];

const TAB_LABELS = {
  feed:    'Feed',
  stories: 'Stories',
  ped:     'UGC',
  cal:     'Calendario',
  preview: 'Preview',
};

/* ══ HTML ═════════════════════════════════════════════════════════════════ */

let html = readFileSync(resolve(SRC, 'src/pages/content/index.html'), 'utf8');
const before = html.length;
let lines = html.split('\n');

/* ── 1. Drop out-of-scope <div class="tab-page" id="page-X"> panels ────────
   Every panel is a sibling at the same indent, so a panel runs from its own
   opening line up to the next panel's opening line (or to the end-of-main
   marker for the last one). No brace matching needed, and no risk of a nested
   div inside a kept panel being mistaken for a boundary. */
const panelStarts = [];
lines.forEach((line, i) => {
  const m = line.match(/^\s*<div class="tab-page[^"]*" id="page-([a-z]+)">/);
  if (m) panelStarts.push({ index: i, id: m[1] });
});

const mainEnd = lines.findIndex(l => l.includes('</div><!-- /main -->'));
if (mainEnd < 0) throw new Error('could not find end-of-main marker');
if (!panelStarts.length) throw new Error('found no tab-page panels — source layout changed');

const dropRanges = [];
panelStarts.forEach((p, i) => {
  const end = i + 1 < panelStarts.length ? panelStarts[i + 1].index : mainEnd;
  if (!KEEP_TABS.includes(p.id)) dropRanges.push([p.index, end - 1, p.id]);
});

const dropped = new Set();
dropRanges.forEach(([a, b]) => { for (let i = a; i <= b; i++) dropped.add(i); });
console.log('panels dropped :', dropRanges.map(r => r[2]).join(', '));
console.log('panels kept    :', panelStarts.filter(p => KEEP_TABS.includes(p.id)).map(p => p.id).join(', '));

lines = lines.filter((_, i) => !dropped.has(i));
html = lines.join('\n');

/* ── 2. Replace the two-level macro nav with one flat tab row ──────────────
   The source had six macro groups feeding 22 sub-tabs. With five tabs left,
   a two-level nav is pure overhead — every click cost an extra step to reach
   a sibling. Flattened to a single row. switchMacro() is stubbed in the page
   rather than removed, because app.js still calls it on boot.

   Matched by walking div depth rather than by regex: a non-greedy pattern
   stops at the first </div></div> pair it sees, which is nested inside this
   block, and silently leaves the outer div unclosed. That produced an
   off-by-one in the document tree that only showed up as a layout bug. */

/** Returns [startLine, endLine] of the element opened on `openLine`. */
function blockRange(arr, openLine) {
  let depth = 0;
  for (let i = openLine; i < arr.length; i++) {
    const opens  = (arr[i].match(/<div\b/g) || []).length;
    const closes = (arr[i].match(/<\/div>/g) || []).length;
    depth += opens - closes;
    if (depth <= 0) return [openLine, i];
  }
  throw new Error('unbalanced block starting at line ' + (openLine + 1));
}

{
  const l = html.split('\n');
  const navOpen = l.findIndex(x => x.includes('id="macro-nav"'));
  if (navOpen < 0) throw new Error('could not locate macro nav block');
  const commentLine = (navOpen > 0 && l[navOpen - 1].includes('Macro-aree')) ? navOpen - 1 : navOpen;
  const [, navClose] = blockRange(l, navOpen);

  const flatNav = [
    `    <!-- Tab row — flattened from the source's two-level macro nav.`,
    `         Five destinations do not need a hub-and-spoke; see docs/extract.mjs. -->`,
    `    <div class="tab-nav" id="tab-nav" role="tablist">`,
    ...KEEP_TABS.filter(t => t !== 'studio').map(t =>
      `      <button class="tab-btn" id="sub-tab-${t}" role="tab" aria-selected="false" onclick="switchTab('${t}')">${TAB_LABELS[t]}</button>`),
    `    </div>`,
  ];

  l.splice(commentLine, navClose - commentLine + 1, ...flatNav);
  html = l.join('\n');
}

/* ── 3. Strip chrome that has no meaning without a backend ─────────────────
   Cross-app nav (those apps do not exist here), the user switcher and logout
   (no auth), and the cloud-sync badge (no cloud). The badge is replaced with a
   local-storage indicator rather than deleted, because app.js writes to it. */
html = html.replace(/[ \t]*<!-- App nav -->[\s\S]*?<\/nav>\n/, '');
html = html.replace(
  /[ \t]*<span class="cloud-badge"[^>]*>[\s\S]*?<\/span>\n/,
  '    <span class="cloud-badge" id="cloud-status" title="Salvataggio locale">Locale</span>\n'
);
html = html.replace(/[ \t]*<div style="position:relative;display:inline-block;">[\s\S]*?<\/div>\n[ \t]*<\/div>\n(?=[ \t]*<button onclick="nassaLogout)/, '');
html = html.replace(/[ \t]*<button onclick="nassaLogout\(\)"[\s\S]*?<\/button>\n/, '');
html = html.replace(/[ \t]*<!-- USER SWITCHER -->[\s\S]*?<\/div>\n\n(?=<div class="body">)/, '');

/* ── 4. Brand ─────────────────────────────────────────────────────────────
   The wordmark is the studio's own stylisation, set in their display face. */
html = html
  .replace(/<title>[^<]*<\/title>/, '<title>Ideology Studio</title>')
  .replace(/<meta name="description"[^>]*>/,
    '<meta name="description" content="Ideology Creative Studio — pianificazione contenuti social">')
  .replace(/<meta property="og:title"[^>]*>/, '<meta property="og:title" content="Ideology Studio">')
  .replace(/<meta property="og:description"[^>]*>/,
    '<meta property="og:description" content="Pianificazione contenuti social — Ideology Creative Studio">')
  /* Root-absolute, not relative. The server maps "/" to this file, so a
     relative "../../styles/…" would resolve against "/" in the browser and
     404 — the page loads, unstyled, with no obvious cause. Root-absolute
     paths resolve identically whether the page is reached at "/" or at its
     real path. */
  .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>')
  /* Three layers, in this order and for a reason:
       tokens  — the palette and type scale
       ideology.css — GENERATED component styles inherited from the source
       art     — the identity, hand-written, loaded last so it always wins
     Keeping the art direction outside the generated file is what lets the
     extractor be re-run without destroying the design. */
  .replace(/<link rel="stylesheet" href="\/style\.css"\/>/,
    '<link rel="stylesheet" href="/src/styles/ideology-tokens.css"/>\n' +
    '<link rel="stylesheet" href="/src/styles/ideology.css"/>\n' +
    '<link rel="stylesheet" href="/src/styles/ideology-art.css"/>');

html = html.replace(
  /[ \t]*<img class="brand-mark"[^>]*>\n[ \t]*<div class="brand-name"[^>]*>[^<]*<\/div>/,
  `    <span class="brand-mark" aria-hidden="true">!d</span>
    <div class="brand-name" id="brand-name-text">!d3ol0gy</div>`
);

/* The preview tab carries a second copy of the wordmark (it mocks up a phone
   chrome), which the selector above does not reach because it is an <img> on
   its own line with no sibling brand-name. */
html = html.replace(
  /<img class="brand-mark"[^>]*>/g,
  '<span class="brand-mark" aria-hidden="true">!d</span>'
);

/* Remaining source-brand strings: a stylesheet comment, a placeholder, and a
   deep link to the Week Plan app — which does not exist in this build, so the
   hint that points at it is removed rather than left pointing nowhere. */
html = html
  .replace(/NassaContent Moodboard/g, 'Moodboard')
  .replace(/placeholder="es\. Nassa Studio"/g, 'placeholder="es. Ideology"')
  .replace(/\/\/ Nassa Studio logo → hub[^\n]*\n/, '// Wordmark → back to the client list\n')
  .replace(
    /[ \t]*<div style="font-size:11px;color:var\(--text-3\);margin-top:-2px;">↗ Nome, pacchetto[\s\S]*?<\/div>\n/,
    ''
  );

/* Dark is the default here, so the toggle's resting icon is the sun. */
html = html.replace(/(id="theme-toggle"[^>]*>)🌙/, '$1☀');

/* ── 5. Scripts ───────────────────────────────────────────────────────────
   Store and seed load BEFORE app.js: app.js reads from the store during its
   own boot, so the data has to already be there. */
html = html.replace(
  /<script src="\/app\.js"><\/script>/,
  `<script src="/src/store/store.js"></script>
<script src="/src/store/seed.js"></script>
<script src="/src/store/api-shim.js"></script>
<script src="/src/app.js"></script>`
);

html = html.replace(/function nassaGoHome\(\)/, 'function ideologyGoHome()');
html = html.replace(/\bnassaGoHome\b/g, 'ideologyGoHome');

/* app.js still calls switchMacro on boot; the flat nav has no macros. */
html = html.replace(
  /if\(typeof switchMacro=='function'\)\{ switchMacro\('strategia', true\); \}/,
  ''
).replace(
  /if\(typeof switchMacro==='function'\)\{ switchMacro\('strategia', true\); \}/,
  '/* flat nav — no macro groups to initialise */'
);

writeFileSync(resolve(ROOT, 'src/pages/studio/index.html'), html);
console.log(`studio page    : ${before} -> ${html.length} bytes (${Math.round((1 - html.length / before) * 100)}% smaller)`);

/* ══ CSS ══════════════════════════════════════════════════════════════════
   style.css is 2375 var() calls against 303 hex literals, so the palette
   swap is almost entirely done by the token file. What is patched here are
   the literals that encode a LIGHT-ground assumption and would otherwise be
   invisible or glaring on black. */

let css = readFileSync(resolve(SRC, 'style.css'), 'utf8');
const cssBefore = css.length;

css = css.replace(
  /@import url\(['"]https:\/\/fonts\.googleapis\.com[^)]*\);?/g,
  '/* font import removed — faces are vendored, see ideology-tokens.css */'
);

/* ── Remove the source's own palette ───────────────────────────────────────
   style.css carries a full duplicate of the old tool's design tokens — a
   :root block AND [data-theme="dark"] blocks that redefine --bg, --surface,
   --text and the rest. Because this file loads after ideology-tokens.css, all
   of those win, and the Ideology palette is silently overridden.

   This has to run BEFORE the literal→token mapping below, or that mapping
   rewrites the offending declarations into self-referential nonsense such as
   `--bg: var(--surface-lt)` — which is exactly what shipped on the first
   attempt and painted the page #232323 instead of #101010.

   Only declarations for tokens THIS project owns are dropped. These blocks
   also define things the token file has no opinion on (--chip-*, --cell-bg,
   --ugc-* workflow colours, --overlay-*), and the components still need them,
   so the blocks are edited rather than deleted.

   The owned list is read out of the token file rather than hard-coded, so
   adding a token there cannot quietly reintroduce the conflict. */
{
  const tokenFile = readFileSync(resolve(ROOT, 'src/styles/ideology-tokens.css'), 'utf8');

  /* Anchored to a selector at the start of a line, not to the first textual
     occurrence: the token file's header comment mentions [data-theme="light"]
     while explaining the theming model, and matching that produced a backwards
     slice and an empty token set — making this whole step a silent no-op. */
  const rootStart  = tokenFile.search(/^:root\s*\{/m);
  const lightStart = tokenFile.search(/^\[data-theme="light"\]\s*\{/m);
  if (rootStart < 0 || lightStart < 0 || lightStart < rootStart) {
    throw new Error('token file layout not recognised — cannot determine owned tokens');
  }
  const owned = new Set(
    [...tokenFile.slice(rootStart, lightStart).matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map(m => m[1])
  );
  if (owned.size < 20) throw new Error(`only ${owned.size} owned tokens parsed — pattern is wrong`);

  /* Anchored with the m flag to a selector at the start of a line. An earlier
     version required a preceding "}" and matched nothing at all, because both
     blocks in this stylesheet follow a comment — another silent no-op, which
     is why the count is asserted below rather than merely logged. */
  let stripped = 0;
  let blocks = 0;
  css = css.replace(/^([ \t]*)(:root|\[data-theme="dark"\])\s*\{([^}]*)\}/gm,
    (whole, ws, sel, body) => {
      blocks++;
      const kept = body.split(';').filter(decl => {
        const name = (decl.match(/(--[a-z0-9-]+)\s*:/i) || [])[1];
        if (name && owned.has(name)) { stripped++; return false; }
        return decl.trim().length > 0;
      });
      if (!kept.length) {
        return `${ws}/* ${sel} palette removed — owned by ideology-tokens.css */`;
      }
      return `${ws}${sel} {${kept.join(';')};\n}`;
    });

  console.log(`  palette      : ${stripped} declarations removed from ${blocks} blocks, ${owned.size} tokens owned`);
  if (stripped < 30) {
    throw new Error(
      `only ${stripped} palette declarations stripped from ${blocks} blocks — expected 30+. ` +
      `The source stylesheet redefines the design tokens; if they are not removed they ` +
      `override the Ideology palette and the app renders in the old studio's colours.`
    );
  }
}

/* Hairline borders written as near-black rgba disappear on a black ground;
   on dark they have to be near-WHITE at low alpha to read at all. */
css = css
  .replace(/rgba\(0,\s*0,\s*0,\s*\.(0[1-9]|1[0-5])\)/g, 'rgba(255,255,255,.08)')
  .replace(/rgba\(0,\s*0,\s*0,\s*0\.(0[1-9]|1[0-5])\)/g, 'rgba(255,255,255,.08)');

/* Bare white/near-white grounds baked into components, routed to tokens.
   Runs AFTER the palette strip above, so token DEFINITIONS are already gone
   and only genuine component literals are rewritten here. */
const LITERAL_MAP = {
  '#ffffff': 'var(--surface)',
  '#fff':    'var(--surface)',
  '#fefefe': 'var(--surface)',
  '#fafafa': 'var(--surface-lt)',
  '#f9f9fb': 'var(--surface-lt)',
  '#f5f5f7': 'var(--surface-lt)',
  '#f0f0f2': 'var(--border-lt)',
  '#e5e7eb': 'var(--border)',
  '#1c1c1e': 'var(--text)',
  '#6b6b6b': 'var(--text-2)',
  '#6b7280': 'var(--text-3)',
  '#9ca3af': 'var(--text-3)',
  '#0dff00': 'var(--brand)',
  '#00cc00': 'var(--brand-dk)',
};
let literalHits = 0;
for (const [hex, token] of Object.entries(LITERAL_MAP)) {
  const re = new RegExp(hex.replace('#', '#') + '\\b', 'gi');
  css = css.replace(re, () => { literalHits++; return token; });
}

/* Styles for the flat tab row introduced above. The source's .macro-tab /
   .sub-tab rules are left in place but unused — they cost nothing and keeping
   them means a re-run that changes the nav decision does not need a CSS edit
   as well. Brand yellow marks the active tab; that underline is the single
   strongest brand signal in the whole chrome, so it is deliberately 2px and
   full-strength rather than a tint. */
css += `

/* ── Flat tab row (Ideology) ───────────────────────────────────────────── */
.tab-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 100%;
  padding: 0 16px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tab-nav::-webkit-scrollbar { display: none; }

.tab-btn {
  appearance: none;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  padding: 8px 14px;
  font-family: var(--font);
  font-size: var(--fs-sm);
  font-weight: 500;
  letter-spacing: var(--ls-tight);
  color: var(--text-3);
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--t-fast), border-color var(--t-fast);
}
.tab-btn:hover { color: var(--text-2); }
.tab-btn.active,
.tab-btn[aria-selected="true"] {
  color: var(--text);
  border-bottom-color: var(--brand);
}

/* ── Wordmark ──────────────────────────────────────────────────────────────
   Set in the studio's own display face. Kept to the two opening glyphs at
   small sizes: FK Raster Grotesk is a blended raster face and the full
   "!d3ol0gy" is illegible below ~18px. */
.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--rs);
  background: var(--brand);
  color: var(--brand-on);
  font-family: var(--font-mark);
  font-size: 13px;
  line-height: 1;
  letter-spacing: -.04em;
  flex-shrink: 0;
}
.brand-name {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: var(--ls-tight);
  color: var(--text);
}

/* ── Offline / missing-image fallback ──────────────────────────────────────
   Demo imagery is fetched from the network. Without this, an offline load
   shows a grid of broken-image glyphs and the tool looks broken rather than
   merely disconnected. */
img.is-broken {
  background:
    repeating-linear-gradient(45deg,
      var(--surface-lt) 0 10px,
      var(--surface-hi) 10px 20px);
  object-fit: contain;
  /* A failed <img> still paints its alt text and a broken-file glyph; hiding
     the content leaves just the striped placeholder, which reads as "image
     pending" rather than "this app is broken". */
  color: transparent;
  font-size: 0;
}

/* ── Feed cell: keep the status badge clear of the tag strip ───────────────
   .feed-cell-stato-btn is positioned "bottom:38px", a magic number tuned to a
   tag strip exactly one line tall. PP Neue Montreal is wider than the Inter
   the source was built against, so at a 230px cell the pillar and format
   chips wrapped onto a second line, the strip grew past 38px, and the badge
   landed on top of the chips.

   Rather than re-tune the magic number to a different font — which breaks
   again at the next width or label — the strip is pinned to a single line and
   the chips ellipsize. That holds the height constant whatever the font does,
   and reads better in a narrow cell than a two-line wrap anyway. */
/* The badge stays an overlay. Pulling it into normal flow made it vanish
   behind the cell's fixed-height media box, which loses the approval state —
   the main thing this grid is read for.

   Measured in the browser: the metadata chips begin 80px in from the cell's
   left edge, and the badge is pinned at 8px. Capping it at 64px leaves an 8px
   gap and makes an overlap arithmetically impossible, whatever the font or the
   label. The two long Italian states ("Da Revisionare", "Da Approvare")
   ellipsise; they keep their colour dot, which is what is actually scanned
   here, and the full label is restored on hover via the title attribute set
   alongside this rule. */
.feed-cell-stato-btn {
  max-width: 64px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  z-index: 4;
}

/* Local-save badge replacing the cloud-sync indicator. */
.cloud-badge {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--text-3);
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  padding: 2px 10px;
  white-space: nowrap;
}
.cloud-badge[data-state="saving"] { color: var(--brand); border-color: var(--brand); }
.cloud-badge[data-state="error"]  { color: var(--danger-text); border-color: var(--danger-border); }
`;

css = `/* IDEOLOGY STUDIO — component styles
 *
 * Derived from the source tool's stylesheet by docs/extract.mjs. The palette
 * itself is NOT here — it lives in ideology-tokens.css, which this file reads
 * through var(). Edit colours there, not in this file.
 *
 * ${literalHits} hard-coded light-theme literals were routed to tokens during
 * extraction; anything still written as a hex below is a semantic status
 * colour (a badge, a chart series) that is intentionally theme-independent.
 */

${css}`;

writeFileSync(resolve(ROOT, 'src/styles/ideology.css'), css);
console.log(`stylesheet     : ${cssBefore} -> ${css.length} bytes, ${literalHits} literals tokenised`);

/* ══ APP.JS ═══════════════════════════════════════════════════════════════
   The application logic is kept as-is apart from its edges. What changes is
   only where data comes from and goes to: every fetch() to /api/* is replaced
   with an IdeologyStore call. Render, drag-and-drop, the editor, the preview
   mock — none of that is touched, because none of it knows about transport.

   Dead code for the 20 removed tabs is deliberately LEFT IN. Those functions
   are unreachable (nothing routes to them and their panels no longer exist),
   and cutting them out of a 14,938-line file by pattern would be a real risk
   of clipping a shared helper. They cost download size, not correctness.
   Stripping them is a separate, verifiable pass — see docs/NEXT.md. */

let js = readFileSync(resolve(SRC, 'app.js'), 'utf8');
const jsBefore = js.length;
const applied = [];

/*
 * Every transform declares how many lines it expects to replace, and the swap
 * is refused if the match is wildly bigger.
 *
 * This guard exists because of a real failure during this extraction: the
 * DROPBOX.upload pattern terminated on "\n  },\n};" while the object actually
 * ends "\n  }\n};" — no comma. The lazy quantifier happily ran on to the next
 * matching sequence 5,000 lines later and swallowed 220 functions, including
 * renderFeedGrid and switchTab. The output still parsed as valid JavaScript,
 * so `node --check` said nothing was wrong. A silent, plausible-looking result
 * is the worst kind, and a line-count assertion catches it instantly.
 */
function swap(label, pattern, replacement, { maxLines = 120, optional = false } = {}) {
  const m = js.match(pattern);
  if (!m) {
    if (optional) return;
    throw new Error(`app.js transform "${label}" matched nothing — source changed?`);
  }
  const span = m[0].split('\n').length;
  if (span > maxLines) {
    throw new Error(
      `app.js transform "${label}" matched ${span} lines (limit ${maxLines}). ` +
      `The pattern is almost certainly running past its intended block — ` +
      `tighten the terminator rather than raising the limit.`
    );
  }
  js = js.replace(pattern, replacement);
  applied.push(`${label}(${span}L)`);
}

/* ── Boot: no auth ────────────────────────────────────────────────────────
   The source gated the whole app behind a session check against /api/auth and
   fell through to a login screen. There is no auth here, so the app boots
   straight into the client list. Seeding happens first so the very first paint
   already has data. */
swap('boot', /document\.addEventListener\('DOMContentLoaded', async \(\) => \{[\s\S]*?_showLoginScreen\(\);\n\}\);/,
`document.addEventListener('DOMContentLoaded', () => {
  // No auth in this build — the app is local-only, so there is no session to
  // check and no login screen to fall through to.
  const app = document.querySelector('.app');

  try {
    if (window.IdeologyStore && window.IdeologySeed && IdeologyStore.isEmpty()) {
      IdeologySeed.run(IdeologyStore);
    }
  } catch (e) {
    console.error('[boot] seeding failed:', e);
  }

  _ideologyUser = { username: 'studio', role: 'admin', profile: null };
  if (app) app.style.display = 'flex';
  _bootApp();
});`);

/* ── CLOUD.load ───────────────────────────────────────────────────────────
   Same return shape as the network version ({data, updatedAt} or null) so
   loadFromCloud() above it needs no change at all. */
swap('CLOUD.load', /  async load\(\) \{[\s\S]*?\n  \},\n\n  scheduleSave/,
`  async load() {
    // Reads the local store instead of GET /api/project. Kept async and kept
    // returning the same { data, updatedAt } shape as the network version, so
    // every caller upstream is unchanged.
    try {
      CLOUD.setStatus('loading');
      const s = window.IdeologyStore;
      const data = {
        clients:  s.get('clients'),
        feeds:    s.get('feeds'),
        stories:  s.get('stories'),
        pedPlans: s.get('pedPlans'),
        pilastri: s.get('pillars'),
        formati:  s.get('formats'),
        highlights: {}, notesData: {}, ideologyDocs: {},
        landing: {}, stampa: {}, mood: {}, shooting: {}, brief: {}, brandKit: {},
        reportData: {}, qbrData: {}, adsCampaigns: {}, sbBozze: {}, ugcInfluencer: {},
      };
      CLOUD.setStatus('saved');
      return { data, updatedAt: s.getSetting('updatedAt', null) };
    } catch (e) {
      console.error('[store] load failed:', e);
      CLOUD.setStatus('error');
      return null;
    }
  },

  scheduleSave`);

/* ── CLOUD.saveNow ────────────────────────────────────────────────────────
   Writes each collection separately. The source POSTed one blob containing
   everything, which is what let one tab overwrite another's work; per-key
   writes remove that failure mode outright. */
swap('CLOUD.saveNow', /  async saveNow\(projectData\) \{[\s\S]*?\n  \},\n\n  setStatus/,
`  async saveNow(projectData) {
    // Writes to the local store instead of POST /api/project. Per-collection,
    // not one blob: a feed edit can no longer clobber the client list.
    if (!projectData) return;
    try {
      CLOUD.setStatus('saving');
      const s = window.IdeologyStore;
      s.set('clients',  projectData.clients  || []);
      s.set('feeds',    projectData.feeds    || {});
      s.set('stories',  projectData.stories  || {});
      s.set('pedPlans', projectData.pedPlans || {});
      if (projectData.pilastri) s.set('pillars', projectData.pilastri);
      if (projectData.formati)  s.set('formats', projectData.formati);
      s.setSetting('updatedAt', new Date().toISOString());
      CLOUD.setStatus('saved');
    } catch (e) {
      CLOUD.setStatus('error');
      // QUOTA is the one failure a user can actually act on, so it gets a real
      // message rather than a generic "save failed".
      if (e && e.code === 'QUOTA') {
        showToast(e.message, 'warn');
      } else {
        console.error('[store] save failed:', e);
        showToast('Salvataggio locale fallito: ' + (e.message || e), 'warn');
      }
    }
  },

  setStatus`);

/* ── Status badge ─────────────────────────────────────────────────────────
   The badge said "Cloud"; there is no cloud. Drive the data-state attribute
   the new stylesheet styles against. */
swap('CLOUD.setStatus', /  setStatus\(s\) \{/,
`  setStatus(s) {
    const _b = document.getElementById('cloud-status');
    if (_b) {
      _b.dataset.state = s;
      _b.textContent = s === 'saving' ? 'Salvo…'
                     : s === 'error'  ? 'Errore'
                     : s === 'loading' ? 'Carico…'
                     : 'Locale';
    }`);

/* ── Per-user feed assignment ─────────────────────────────────────────────
   Came from /api/team and narrowed the visible client list. With no auth
   there is one operator who sees everything, so this resolves to null and the
   filter in loadFromCloud() short-circuits. */
swap('getMyAssignment', /async function getMyAssignment\(\) \{[\s\S]*?\n\}/,
`async function getMyAssignment() {
  // No auth in this build — one operator, full visibility. Returning null
  // makes the caller skip its narrowing branch entirely.
  return null;
}`);

/* ── Uploads ──────────────────────────────────────────────────────────────
   Dropbox is gone with the backend. Files are read straight into a data URL
   so drag-and-drop of real images still works offline.

   This is a prototype trade with a hard edge, stated rather than hidden:
   localStorage is ~5MB and a single phone photo can be 3MB as base64, so a
   few uploads will hit the quota. The store raises a typed QUOTA error and
   saveNow() above surfaces it. Downscaling on import is what makes this
   properly usable — see docs/NEXT.md. */
swap('DROPBOX.getToken', /  async getToken\(\) \{[\s\S]*?\n  \},/,
`  async getToken() {
    // No token in a local build — kept so callers do not need a null check.
    return null;
  },`);

swap('DROPBOX.upload', /  async upload\(file, destPath\) \{[\s\S]*?\n  \}\n\};/,
`  async upload(file) {
    // Local stand-in for the Dropbox round-trip: read the file into a data URL
    // and hand back the same { url } shape the callers already expect.
    DROPBOX.uploading++;
    const bar = document.getElementById('dbx-upload-bar');
    const txt = document.getElementById('dbx-upload-text');
    if (bar) bar.classList.add('visible');
    if (txt) txt.textContent = 'Importo: ' + file.name;
    try {
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload  = () => res(fr.result);
        fr.onerror = () => rej(new Error('Lettura del file fallita: ' + file.name));
        fr.readAsDataURL(file);
      });
      return { url: dataUrl, shared_link: dataUrl, name: file.name };
    } finally {
      DROPBOX.uploading--;
      if (DROPBOX.uploading <= 0 && bar) bar.classList.remove('visible');
    }
  },
};`);

/* ── Theme ────────────────────────────────────────────────────────────────
   Dark is the default here rather than the opt-in, so the persisted value is
   read with 'dark' as the fallback instead of 'light'. */
swap('theme init', /\(function initTheme\(\)\{[\s\S]*?\n\}\)\(\);/,
`(function initTheme(){
  // Dark-first: unlike the source, light is the deviation, so an unset
  // preference resolves to dark rather than falling through to light.
  var saved = null;
  try { saved = localStorage.getItem('ideology_theme'); } catch(_) {}
  applyTheme(saved === 'light' ? 'light' : 'dark');
})();`);

swap('applyTheme', /function applyTheme\(theme\)\{[\s\S]*?\n\}/,
`function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  var btn = document.getElementById('theme-toggle');
  if(btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
  try { localStorage.setItem('ideology_theme', theme); } catch(_) {}
}`);

/* ── Preview header avatar ────────────────────────────────────────────────
   The mock profile header hard-coded the letter "N" — the source studio's
   initial — next to the client's own name, so every client's preview showed
   someone else's monogram. Derived from the client name instead. */
swap('preview avatar', /<div class="preview-logo">N<\/div>/,
  '<div class="preview-logo">${esc(((cl.name||\'?\').trim()[0]||\'?\').toUpperCase())}</div>',
  { maxLines: 2 });

/* The feed-grid status badge is width-capped in CSS (see the stylesheet note),
   so long state labels ellipsise. Carry the full text in a tooltip so nothing
   is actually lost. */
swap('status badge tooltip', /(sb=document\.createElement\('button'\);sb\.className='feed-cell-stato-btn';)/,
  "$1sb.title=_fc.label;", { maxLines: 2 });

/* ── Art direction: geometry ──────────────────────────────────────────────
   The app builds a lot of its badges with inline style strings, and an inline
   style beats any stylesheet rule that is not !important. Rather than litter
   ideology-art.css with overrides for elements that have no class to target
   (many of these spans are built anonymously), the geometry is corrected at
   the source: every pill built in JS squares off, matching the right angles
   the rest of the design is drawn with.

   18 call sites, one rule — and a count assertion, because a rename upstream
   that silently drops to zero would leave rounded pills scattered through an
   otherwise square UI. */
{
  const before = (js.match(/border-radius:\s*99px/g) || []).length;
  js = js.replace(/border-radius:\s*99px/g, 'border-radius:0');
  if (before < 10) throw new Error(`expected ~18 inline pill radii, found ${before}`);
  applied.push(`squared-pills(${before})`);
}

/* The 5px status dots become 5px squares — same reasoning, and it keeps them
   consistent with the swatches used everywhere else. Scoped to that exact
   size so avatars and other genuine circles are untouched. */
js = js.replace(/width:5px;height:5px;border-radius:50%/g, 'width:5px;height:5px;border-radius:0');

/* ── Art direction: metadata chips under each frame ───────────────────────
   These were filled lozenges in the pillar's own colour. Two of them under
   every frame meant ~24 blocks of saturated fill competing with the images
   the grid exists to judge.

   Re-cut as a coloured swatch plus an uppercase label: the colour still
   identifies the pillar at a glance, but it now occupies 5px instead of a
   whole tag, and the images get the contrast back. */
/* This chip sits ON the photograph, not under it, so it cannot take its
   colour from the theme — a light theme token over a light image is
   unreadable, and so is a dark one over a dark image. It gets the same
   treatment as the status badge beside it: a blurred near-black scrim with
   fixed light text, which holds over any photograph in either theme.
   Set a step smaller than the badge: the TERMINAL layer puts these in a mono
   face, which is wider than the humanist one the 10px was measured against,
   and longer pillar names were clipping at the cell edge. */
swap('pillar chip (under frame)',
  /_pilBadge2\.style\.cssText = `display:inline-flex;align-items:center;gap:3px;padding:2px 7px 2px 5px;border-radius:0;font-size:10px;font-weight:700;background:\$\{_pColor2\};color:\$\{_pText2\};/,
  '_pilBadge2.style.cssText = `display:inline-flex;align-items:center;gap:5px;padding:3px 7px;border-radius:0;font-size:9px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;background:rgba(8,8,8,.84);backdrop-filter:blur(6px);color:#e8e8e8;',
  { maxLines: 2 });

swap('pillar swatch',
  /_pilBadge2\.innerHTML = `<span style="width:5px;height:5px;border-radius:0;background:\$\{_pText2\};opacity:\.5;/,
  '_pilBadge2.innerHTML = `<span style="width:5px;height:5px;border-radius:0;background:${_pColor2};opacity:1;',
  { maxLines: 2 });

swap('format chip (under frame)',
  /_fmtBadge2\.style\.cssText = `display:inline-flex;align-items:center;gap:3px;padding:2px 7px 2px 5px;border-radius:0;font-size:10px;font-weight:700;background:\$\{_fmtColor2\};color:\$\{_fmtText2\};/,
  '_fmtBadge2.style.cssText = `display:inline-flex;align-items:center;gap:5px;padding:0;border-radius:0;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;background:none;color:var(--text-3);',
  { maxLines: 2 });

swap('format swatch',
  /_fmtBadge2\.innerHTML = '<span style="width:5px;height:5px;border-radius:0;background:'\+_fmtText2\+';opacity:\.5;/,
  "_fmtBadge2.innerHTML = '<span style=\"width:5px;height:5px;border-radius:0;background:'+_fmtColor2+';opacity:1;",
  { maxLines: 2 });

/* ── Status tokens ────────────────────────────────────────────────────────
   The TERMINAL direction renders state as a fixed-width bracketed token, so a
   column of them scans like a log: [OK] under [OK] under [??], words aligned,
   instead of ragged Italian of varying length.

   The word is KEPT beside the token deliberately. A symbol-only badge is fast
   once learned and meaningless before that, and status is the single most
   important thing in this grid — so the token carries the speed and the word
   carries the meaning. Labels are also shortened to fit the badge without
   truncating ("Da Revisionare" never could).

   Replaced label-by-label rather than map-by-map: the source defines the SAME
   status set twice under two different names (_fc for the card view, _fstCfg
   for the feed cell). A map-shaped pattern caught only the first, and the
   grid — the one place it actually matters — kept the old labels while the
   transform still reported success. */
{
  const LABELS = [
    [/label:'Bozza'/g,          "label:'[··] BOZZA'"],
    [/label:'Da Revisionare'/g, "label:'[!!] REVISIONE'"],
    [/label:'Da Approvare'/g,   "label:'[??] ATTESA'"],
    [/label:'Approvato'/g,      "label:'[OK] APPROVATO'"],
    [/label:'Pubblicato'/g,     "label:'[>>] ONLINE'"],
  ];
  /* Status dots re-tuned to the palette. The source's traffic-light green is
     dropped: green/red is the pair that fails most colour-blind viewers, and
     there is no green anywhere in this identity — approved is brand yellow,
     which also makes a finished month light up. */
  const DOTS = [
    [/dot:'#888'/g,    "dot:'#6e6e6e'"],
    [/dot:'#e05c00'/g, "dot:'#ff5a7a'"],
    [/dot:'#d4a800'/g, "dot:'#f59e0b'"],
    [/dot:'#22c97a'/g, "dot:'#F2C700'"],
    [/dot:'#2563eb'/g, "dot:'#35c9d6'"],
  ];
  let n = 0;
  [...LABELS, ...DOTS].forEach(([re, to]) => {
    js = js.replace(re, () => { n++; return to; });
  });
  if (n < 10) throw new Error(`only ${n} status labels/dots rewritten — expected 10+`);
  applied.push(`status-tokens(${n})`);
}

/* The metadata row reserves space for the status badge with a fixed-width
   spacer, sized in the source to 68px — the comment there says "Bozza ~60px",
   i.e. it was measured against the SHORTEST label. In the redesign the badge
   is set in uppercase at wider tracking, so "DA REVISIONARE" runs well past
   68px and lands on the pillar chip.
   Widened to 124px, which is the badge's CSS max-width (116px) plus the row
   gap. Those two numbers have to move together — if the cap in
   ideology-art.css changes, change this with it. */
swap('status badge gutter',
  /_spacer\.style\.cssText = 'display:inline-block;width:68px;flex-shrink:0;';/,
  "_spacer.style.cssText = 'display:inline-block;width:124px;flex-shrink:0;';",
  { maxLines: 2 });

/* The format chip is dropped from the feed cell entirely.
   A 230px cell has room for the status badge and one metadata chip. Set in
   caps, three items collide — and the collision cannot be fixed in CSS here
   because this row is built as an unclassed div, so there is no selector to
   reach it with. Format is the one to cut: a carousel or reel already
   announces itself with a corner tag, and "foto singola" is the default case,
   so the chip was restating what the frame already said. It remains in the
   editor, the card view and the format filter. */
swap('drop format chip in cell',
  /\n\s*_tagRow\.appendChild\(_fmtBadge2\);/,
  '\n            /* not appended — see docs/extract.mjs, "drop format chip in cell" */',
  { maxLines: 3 });

/* ── Naming ───────────────────────────────────────────────────────────────
   Identifiers and log prefixes only. Ordered longest-first so that e.g.
   NassaPED is consumed before the bare "Nassa" pattern can half-match it. */
const RENAMES = [
  [/nassa_offline_snapshot/g, 'ideology_offline_snapshot'],
  [/\bnassa_home_theme\b/g,   'ideology_theme'],
  [/\bnassa_theme\b/g,        'ideology_theme'],
  [/\bnassa_studio\b/g,       'ideology_studio'],
  [/\bnassa_user\b/g,         'ideology_user'],
  [/\b_nassaUser\b/g,         '_ideologyUser'],
  [/\bnassaUser\b/g,          'ideologyUser'],
  [/\bnassaDocs\b/g,          'ideologyDocs'],
  [/\bnassaUid\b/g,           'ideologyUid'],
  [/\bnassaLogout\b/g,        'ideologyLogout'],
  [/\bNassaContent\b/g,       'Ideology Studio'],
  [/\bNassaStudio\b/g,        'IdeologyStudio'],
  [/\bNassaPortal\b/g,        'IdeologyPortal'],
  [/\bNassaBrand\b/g,         'IdeologyBrand'],
  [/\bNassaPED\b/g,           'Ideology'],
  [/\bNASSA\b/g,              'IDEOLOGY'],
  [/nassa-login-screen/g,     'ideology-login-screen'],
  [/'x-nassa-key'/g,          "'x-ideology-key'"],
  [/\/nassa-logo\.png/g,      '/assets/favicon.svg'],
  [/nassa-logo\.png/g,        'assets/favicon.svg'],
  [/\bNassa Studio\b/g,       'Ideology Studio'],
  [/\bNassa\b/g,              'Ideology'],
];
let renameHits = 0;
RENAMES.forEach(([re, to]) => {
  js = js.replace(re, () => { renameHits++; return to; });
});

/* ── Broken-image fallback ────────────────────────────────────────────────
   Demo imagery is fetched from the network, and app.js builds <img> elements
   in dozens of places without an error handler. When a request fails — no
   network, or the demo host rate-limiting a screen full of thumbnails at once
   — the cells render empty and the tool looks broken rather than merely
   offline. One capturing listener covers every image on the page, including
   ones added later, without touching the render code. */
js += `

/* Appended by docs/extract.mjs — see the broken-image note there. */
document.addEventListener('error', function (e) {
  var el = e.target;
  if (el && el.tagName === 'IMG' && !el.classList.contains('is-broken')) {
    el.classList.add('is-broken');
  }
}, true);   // capturing: 'error' on an element does not bubble
`;

/* _ideologyUser is assigned in the new boot; make sure it is declared. */
if (!/\b(let|var|const)\s+_ideologyUser\b/.test(js)) {
  js = 'var _ideologyUser = null;\n' + js;
}

js = `/* IDEOLOGY STUDIO — application logic
 *
 * Generated from the source tool's app.js by docs/extract.mjs. Do not hand-edit
 * this file expecting the change to survive: re-running the extractor
 * regenerates it. Persistent changes belong in the extractor, in the store, or
 * in a new module.
 *
 * Transforms applied: ${applied.join(', ')}, plus ${renameHits} identifier renames.
 */

${js}`;

writeFileSync(resolve(ROOT, 'src/app.js'), js);
console.log(`app logic      : ${jsBefore} -> ${js.length} bytes`);
console.log(`  transforms   : ${applied.join(', ')}`);
console.log(`  renames      : ${renameHits}`);

console.log('\ndone.');
