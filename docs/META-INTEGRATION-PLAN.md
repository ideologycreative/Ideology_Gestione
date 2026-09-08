# Meta (Facebook + Instagram) connection & auto-publishing — plan

Status: **planned, not started.** Paused pending a backend-stack decision.

Goal: connect Meta account(s), bind a Facebook Page + Instagram account to each
client in this tool, and have an approved post publish itself to that page on its
scheduled date — without anyone opening Business Suite.

---

## 1. Why this needs a backend

The app today is browser-only, with `localStorage` as the entire database. That was
deliberate (see the header of `src/store/store.js`), and it is exactly what has to
change. Four reasons, none of them optional:

1. **OAuth needs a server.** Exchanging Meta's auth code for a token requires the app
   secret. In browser JS anyone can read it; Meta forbids it.
2. **Page tokens cannot live in `localStorage`.** A page token is permission to post
   as the client. `localStorage` is readable by any XSS on that origin.
3. **Instagram has no API-side scheduling** (see §2).
4. **Media must be a public URL Meta can fetch.** Instagram's servers download the
   `image_url` / `video_url` you hand them. Current uploads are base64 data URLs in
   `localStorage`, and videos are `blob:` URLs that die with the tab — unpublishable.

---

## 2. Facebook schedules itself; Instagram does not

| | Facebook Page | Instagram |
|---|---|---|
| Scheduling | `published=false` + `scheduled_publish_time` — Meta holds and publishes it | **No equivalent.** `POST /media` (container) → `POST /media_publish` fires immediately |
| Container TTL | n/a | 24h |

Business Suite *does* schedule Instagram — but Business Suite is Meta's own
first-party product using an internal queue that isn't exposed publicly. Every
third-party scheduler (Buffer, Later, Hootsuite, Metricool) works the way described
here: they hold the media on their own servers and call `media_publish` at the
scheduled second.

Practically this is a cron job running every minute (Supabase `pg_cron`, a
Vercel/Cloudflare cron trigger, or a small VPS). Routine, not heavy infrastructure.

**Option:** hybrid — hand FB posts to Meta with `scheduled_publish_time` (they publish
even if our server is down), fire IG ourselves. Cost: cancel/reschedule then needs two
code paths. Default recommendation is to run both through our own scheduler so
behaviour is uniform.

---

## 3. App Review — probably NOT a blocker for this use case

A Meta app in **Development Mode** with **Standard Access** can use
`pages_manage_posts` and `instagram_content_publish` **without App Review**, for any
account holding a role on the app (Admin / Developer / Tester) — including the pages
that account administers.

- **Agency case** (studio's own Meta account administers all client pages):
  works with no review. This is the primary intended setup.
- **Client connects their own account:** that account needs a Tester role on the app
  (they accept an invite). Workable for a handful of clients; clunky beyond that.
- **App Review + Business Verification** is required only to onboard arbitrary
  clients smoothly, or if this is ever productised. Weeks, and needs a working app
  to demo — so it is a later step, not a prerequisite.

---

## 4. Keeping client pages from getting mixed up

One Meta login exposes *every* page the user manages (`GET /me/accounts`). Binding is
explicit and stored per client-account: `{ connectionId, pageId, igUserId }`.

Guards:
- bound page name + avatar + ID shown on the client before anything publishes
- publish refuses if the bound page is no longer in the authorized list
- publish refuses if two clients resolve to the same page
- every publish logged with the page it went to

---

## 5. Architecture

- **Backend**: Supabase (Postgres + Storage + Auth + Edge Functions + `pg_cron`) or
  Node + Postgres self-hosted. *Decision pending — backend team.*
- **Tokens**: encrypted at rest, server-side only. The browser sees page names and
  publish status, never a token.
- **Media**: uploads go to object storage; the stored public URL is what both the
  client portal and Meta use. Also removes today's ~5MB cap and makes the portal work
  across devices.
- **Scheduler**: `scheduled_jobs` table (`run_at`, `state`, `attempts`,
  `idempotency_key`). Worker claims due jobs, publishes, writes back. The idempotency
  key is what makes a retry unable to double-post.
- **Publish state** per post: `pending | scheduled | publishing | published | failed`,
  plus `permalink` and `error`, surfaced on the card with a retry action.

### Flow
1. Client approves in the portal → `approvato`
2. Backend creates a scheduled job for that post's date/time
3. Worker fires: **FB** `POST /{page-id}/photos|videos|feed` · **IG** create container
   → `media_publish` (separate paths for image, carousel, reel, story)
4. Result written back: `pubblicato` + permalink, or `failed` + reason
5. Un-approving / changing the date / requesting revision cancels or moves the job

---

## 6. Known gotchas to design for

1. **Posts have no time of day.** `item.date` is `YYYY-MM-DD`. Scheduling needs a
   publish time + per-client timezone, or everything fires at midnight.
   **This is a real data-model change and should land early.**
2. **Token expiry** — long-lived tokens ~60 days. Silent expiry means posts silently
   stop going out. Needs refresh, plus a loud "reconnect" state in the UI.
3. **Instagram format rules are strict** — feed aspect 4:5–1.91:1, reels 9:16,
   codec/length/size caps, 2200-char captions, 30 hashtags. The planner currently
   accepts anything; without pre-flight validation, posts fail *at publish time*. The
   existing `fitwarn` measurement in `inspector.js` extends naturally into this.
4. **Rate limit** — ~25 IG publishes per account per 24h.
5. **Failures must be loud.** For an agency tool a silently-unpublished post is the
   worst outcome. Failure state on the card + notification.
6. **Personal IG accounts cannot be published to at all** — Business/Creator only,
   linked to a Page. Worth auditing client accounts before building.

---

## 7. Phasing

| Phase | Scope | Needs Meta credentials? |
|---|---|---|
| 1 | Backend foundation: auth, Postgres, `IdeologyStore` behind an API, media → storage | No |
| 2 | Connessioni section, OAuth, page ↔ client binding | Yes (app + your account) |
| 3 | Scheduling engine: jobs, cron worker, retries, cancel, publish states — **mock publisher** | No |
| 4 | Real Meta adapters (FB first, IG second) | Yes |

Recommended start: **Phase 1 + Phase 3 with the mock publisher.** That is most of the
product surface, fully buildable and testable with no Meta credentials, and it reduces
the Meta work to swapping one adapter.

The current `localStorage` mode should keep working throughout as an offline/demo
path, so nothing breaks while the backend lands.

---

## 8. Open decisions

1. Backend stack — Supabase vs. self-hosted Node + Postgres *(with backend team)*
2. Default connection model — agency-managed, per-client, or both
3. Whether to start Business Verification now (long lead time) or defer, given §3
   means it is not needed for the agency setup

## 9. What the studio needs to provide when we resume

- Backend host + Postgres, and a public HTTPS domain (OAuth redirect + media URLs)
- A Meta Developer app → App ID + App Secret, with the studio account as Admin
- Confirmation that each client's Instagram is Business/Creator and linked to its Page

---

### Reference
- Facebook scheduled publishing (`published=false` + `scheduled_publish_time`) —
  confirmed supported, Graph API v24, March 2026
- Instagram Content Publishing (container → `media_publish`, no scheduling parameter),
  <https://developers.facebook.com/documentation/instagram-platform/content-publishing>
- Development Mode / Standard Access vs. App Review,
  <https://developers.facebook.com/docs/instagram-platform/create-an-instagram-app/>
