# Ideology Studio

Social content planning and client approval, for **Ideology Creative Studio**.

Two surfaces:

- **Studio** — internal. Manage clients, then plan a month: pipeline, feed order, calendar. Grids render at each platform's real aspect ratio.
- **Portal** — client-facing. A share link, no login: the client approves posts or asks for changes.

A **local prototype** — no backend, no accounts, no server. Everything runs in the browser and persists to `localStorage`. Meant to be clicked through and judged, not deployed.

---

## Run it

```bash
node serve.mjs
```

| | |
|---|---|
| Studio | <http://localhost:4321/> |
| Client portal | <http://localhost:4321/client?t=mf7c21a8b309> |

Demo data seeds itself on first load — 5 clients, 24 feeds, ~213 posts across three months.

Must be served over http. Opening files with `file://` gives each an opaque origin, which blocks `localStorage` entirely — the app would look like it simply refuses to save.

Portal links, one per client: `mf7c21a8b309` (Marefuori) · `tr4e90d17c62` (Terrarossa) · `vl2b83f45a10` (Vulcano Lab) · `nd5a12c88e47` (Nodo Studio) · `kl9f67b23d54` (Kalát)

---

## The tool

Left menu holds **sections**, all reachable from each other at any time:

| Section | What it is |
|---|---|
| **Home** | Near-empty. Wordmark, month, and only the numbers worth acting on. Alerts appear only when work is blocked. |
| **Clienti** | The roster. Add, edit, delete. Name, brand colour, logo, per-platform accounts, portal link. |
| **Contenuti** | Client picker → that client's month: pipeline, grid, calendar. |
| **Calendario** | Client picker → a coverage map of the month. Dots only, colour-coded by content type. |
| **Anteprima** | Client picker → opens their portal **in a new tab**. |
| **Impostazioni** | Ideology logo (shown on every portal), storage usage, export/import, reset. |

Routing is hash-based, so every screen has a real URL and the back button works:
`#/clients/c_marefuori`, `#/content/c_vulcano`, `#/calendar/c_kalat`.

### Platform drives the shape

Each account carries a platform, and that decides the aspect ratio and column
count of the grid — in the admin **and** in the client portal. What you approve
is the shape that gets published.

| Platform | Feed ratio | Columns |
|---|---|---|
| Instagram · Threads | 4:5 | 3 |
| Facebook · LinkedIn | 1:1 | 3 |
| TikTok | 9:16 | 4 |
| YouTube | 16:9 | 2 |
| Pinterest | 2:3 | 4 |

Stories and Reels are always 9:16 whatever the platform.

> Facebook is set to **1:1** because that is its *feed*. 9:16 is Facebook
> Stories and Reels, which this app already covers via the Storie filter and
> the Reel type. Change `feed` in `PLATFORMS` (src/app/core.js) if you want
> it otherwise.

### Inside a client's month

Three views, each with a job:

| View | For | Drag does |
|---|---|---|
| **Pipeline** | Where the work is: bozza → in attesa → revisione → approvato | Moves status |
| **Griglia** | What the profile will look like, at the real ratio | Reorders the feed |
| **Calendario** | What lands when, posts *and* stories together | Reschedules |

Content type (Post / Storie) is a **filter**, not a page. The inspector is
**docked, not modal** — edit while the board stays live. No save button.

**Keyboard**: `1`/`2`/`3` views · `[` `]` month · `n` new · `⌘K` palette · `Esc` close.

### The coverage calendar

One question: which days are filled, which are empty. No titles, no thumbnails
— a dot per post is the whole vocabulary, and the eye reads density across a
grid far faster than a list of names. It spans **every account** and both posts
and stories, because a gap only matters if it is a gap everywhere.

Each dot is coloured by what it is:

| Mark | Meaning |
|---|---|
| teal | Foto |
| violet | Carosello |
| crimson | Video / Reel |
| coral | Storia |
| **large ringed yellow** | **Sponsorizzato** |

Sponsored is larger *and* ringed, not merely a different hue — so it survives
colour-blindness and greyscale. Sponsored dots also sort first, so a busy day
can never push them out of view.

### Sponsorizzazione

Any post can be flagged as paid, from the switch in the inspector. It is an
explicit decision, never inferred from content — a sponsored post carries legal
disclosure requirements and a different budget line.

Once flagged, it is loud in three places:

| Where | How |
|---|---|
| **Client portal** | `SPONSOR` badge, brand yellow, top-right of the frame — it is a disclosure, so it is the one label allowed to compete with the photograph |
| **Coverage calendar** | A larger ringed dot plus a tinted day cell. Size and ring carry it as well as colour, so it survives colour-blindness and greyscale |
| **Workspace** | Yellow edge on the card and grid cell, `$` marker and a lit row in the calendar view |

Home carries a **Sponsorizzati** count for the current month.

### The client portal

Each portal wears **the client's own colour**, not Ideology's. Five clients
used to produce five copies of one agency page; the client colour is now
injected as the palette at boot, and every chrome element reads from it. Text
placed on that colour is computed from its luminance rather than assumed — a
pale brand needs black on top, a dark one white, and guessing wrong makes the
approve button unreadable.

The ground stays dark whatever the accent, and the accent never touches a
photograph: judging a colour grade beside a field of someone's brand teal is
not possible, and judging photographs is what the page is for.

- **Ideology's mark** sits top-left, the **client's logo** top-right. Upload the
  studio logo in *Impostazioni*, the client logo in that client's card.
- The month is the **title of the document** — `Settembre PED` set large — with a
  small selector beside it covering **all 12 months across four years**, so an
  empty November or a date in 2027 needs no edit to the tool.
- **Clicking a frame opens the post as the platform renders it**, not a
  lightbox. Instagram desktop puts media left and a caption rail right, under
  the account's handle and avatar with the real action row; Facebook and
  LinkedIn stack header, caption, media. What gets signed off is what gets
  published, crop included.

### The portal is a dead end

It opens in a new tab and carries **no link back into the studio** — a client
should never be one misclick from the admin, and a screen-share of the portal
shows them nothing but their own content. The test suite asserts this.

## What changed, and why

The first build of this was *extracted* from an older agency tool and inherited its whole information architecture. Restyling could not fix that, so the tool was rebuilt:

| Was | Now | Why |
|---|---|---|
| One flat screen | Five sections with real URLs | Home, Clienti, Contenuti, Anteprima, Impostazioni — each reachable from any other |
| Client table as home page | Section menu + a client picker inside Contenuti | Switching client is navigation, not a destination — and the roster's state is visible while you choose |
| 5 tabs = 5 content types | 3 views + a type filter | Feed/Stories/UGC were lenses on one month, split across pages |
| ~20 toolbar controls | One header line + ⌘K | 12 month pills, 4 ON/OFF display toggles, 4 view switches, all above the work |
| Approval as a badge | The pipeline **is** a view | The workflow was in the data (`apprStato`) but invisible |
| Modal editing | Docked inspector | You edit a caption *while* comparing it to its neighbours |
| 4 KPI cards (revenue, accounts) | Status bar for the month on screen | Studio-level figures on a screen about one client's month |

That removed about **1 MB** of inherited code — a 780KB generated `app.js` and a 215KB stylesheet describing a layout this build no longer has. What replaced it:

```
src/app/core.js        state, routing, platform rules, selectors, DOM helpers
src/app/sections.js    home · clients CRUD · coverage calendar · pickers · settings
src/app/views.js       pipeline · grid · calendar
src/app/inspector.js   the editing panel
src/app/shell.js       menu, contextual header, palette, status, router
src/styles/app.css     layout + components
src/pages/studio/      the frame; sections are built from the store
```

The retired code is archived under `docs/_archive-*` rather than deleted, along with the extractor that generated it.

---

## Design — "Terminal"

Ideology sells Web3, AI, XR and motion, calls itself *indomabili avanguardisti*, and picked **FK Raster Grotesk** — a blended raster face — as its display type. That is a typeface you choose when you want *computed*. The design follows a signal already in their identity rather than inventing a mood beside it.

1. **Two typefaces, strictly divided.** JetBrains Mono for what the *machine* says — labels, counts, dates, status. PP Neue Montreal for what a *person* wrote — captions, notes. That split is the texture, and it keeps prose readable where all-mono would not.
2. **Brackets and rules, never boxes with shadows.**
3. **Status is a token** — `[OK]` `[??]` `[!!]` `[··]`, fixed width, scannable down a column like a log. The Italian word stays beside it: the token is faster once learned, the word means nobody has to learn it first.
4. **Yellow is phosphor** — light, not paint. Only on what is live.
5. **Right angles.**

Type note worth keeping: **both brand faces have a decorative zero.** Gustavo's is slashed *by default* and cannot be switched off, so figures avoid it. JetBrains Mono's is dotted, which at 9px made `19.09` read as `19.89` — that one *is* an addressable feature, disabled via `font-feature-settings: "zero" 0`.

Brand values were read out of ideology.it's live stylesheet, not eyeballed: `--brand #F2C700`, `--bg #101010`, `--surface-hi #282828`, with `#2DA7A7` / `#e40e49` / `#f37c7b` as categorical accents. Text on yellow is always near-black — white fails contrast badly.

---

## Layout

```
ideology-studio/
├── serve.mjs                    static dev server, zero deps
├── assets/fonts/                vendored faces (brand + JetBrains Mono)
├── src/
│   ├── app/                     the application
│   ├── pages/
│   │   ├── studio/index.html    frame
│   │   └── client/index.html    portal
│   ├── store/
│   │   ├── store.js             persistence — the backend seam
│   │   └── seed.js              demo data
│   └── styles/
│       ├── ideology-tokens.css  the palette
│       └── app.css              layout + components
└── docs/
    ├── smoke.mjs                66 assertions in a real browser
    ├── shots.mjs                screenshots
    ├── NEXT.md                  what is not done
    └── _archive-*               the extracted build this replaced
```

```bash
node docs/smoke.mjs       # 66 assertions in a real browser
node docs/shots.mjs       # screenshots to docs/shots/
```

---

## Known limits

Real and deliberate, not oversights:

- **~5MB ceiling.** `localStorage`. Uploaded images become base64 data URLs and fill it fast. The store raises a typed `QUOTA` error and the inspector surfaces it, but a handful of phone photos will hit the wall. Downscaling on import is the fix — see `docs/NEXT.md`.
- **No auth.** Anyone opening the page is an operator. The portal's share token is the only access control, and it guards demo data.
- **Nothing shared between people.** Two browsers hold two independent datasets; use the palette's export to move one.
- **Demo images need network.** Fixed picsum seeds; offline they fall back to a striped placeholder.

---

Built for Ideology Creative Studio (Ragusa · Milano). The five clients are invented — no real client data from the source tool was carried over.
