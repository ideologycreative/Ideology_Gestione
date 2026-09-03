# What is not done

Honest list, roughly in the order I would tackle it. Each is a deliberate stop.

---

## 1. Image handling will hit the wall

An uploaded file is read into a base64 data URL and stored in `localStorage`. A phone photo is ~3MB encoded; the quota is ~5MB. A few uploads and the store throws.

The failure is at least honest — `store.js` raises a typed `QUOTA` error and the inspector surfaces it — but it is still a wall.

**Fix:** downscale on import. Canvas at max ~1600px on the long edge, `image/webp` at ~0.82 — 3MB becomes ~150KB and the ceiling stops mattering for a prototype. IndexedDB is the better home if this outgrows a demo.

---

## 2. No backend

By design. The seam is one file: everything goes through `IdeologyStore`, nothing else touches persistence.

**When it is time,** rewrite `src/store/store.js` against a real API — the app above it does not change. Two things worth carrying over from the source tool's analysis rather than repeating:

- **Do not use one JSON blob.** The source kept the whole studio in a single row and replaced it wholesale on save; concurrent edits silently lost work. Model clients, accounts and content items as real rows.
- **Enforce access server-side.** The source filtered a client's visible data *in the browser* after sending the full dataset. Anyone with a login could read every client from DevTools.

---

## 3. Features the old build had that this one does not

The rebuild kept the core loop — plan, edit, route through approval, publish order, client sign-off — and dropped what belonged to the tool it replaced. Missing, in rough order of how much anyone would miss it:

- **Carousel slide editing.** `slides[]` is read (count badge, portal lightbox) but there is no per-slide editor. The inspector edits the cover only.
- **UGC / creator plan.** Still in the data and still rendered in the client portal, but it has no studio-side surface yet. It probably wants to be a fourth view rather than a tab.
- **Stories storyboard.** Stories are first-class in the calendar and the type filter, but there is no dedicated sequence editor.
- **Bulk actions.** No multi-select; you move one card at a time.
- **Undo.** Deletion asks for confirmation, which is not the same thing.

---

## 4. Client portal, real-world gaps

Works and is safe (output escaped, XSS regression test). Missing for real use:

- **Tokens are permanent and only 12 hex chars.** Fine against typing, not against a determined scan. Real ones want expiry and revocation.
- **No notification.** The studio only learns about a change request by opening the app.
- **No history.** `apprRevisions` counts, but a second round of feedback overwrites the first.

---

## 5. Testing

`docs/smoke.mjs` runs 30 assertions in a real browser: boot, seeding, palette, all three views, a pipeline move, an inspector edit committing, XSS, approval round-trip.

Not a test suite. No unit tests for the store, and **drag-and-drop is uncovered** — the smoke test exercises the inspector's status control instead, which is the same code path but not the same interaction. `store.js` is where unit tests pay first.

---

## 6. Smaller things

- **`--warning` and the brand are both yellow.** Warning is pushed orange (`#f59e0b`) so a warning badge never reads as a brand element. Worth a second look with real content.
- **Light theme is untested here.** The tokens exist and the portal honours them, but the app shell was drawn for black and `[data-theme="light"]` has had no scrutiny since the rebuild.
- **Italian only.** ideology.it has an EN toggle; the portal is the surface that would need it first.
- **The rail shows current-month progress for every client**, which is right for the month you are in and misleading if you are working three months ahead. It should follow the selected month or say which month it means.
