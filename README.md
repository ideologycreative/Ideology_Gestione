# Ideology Studio

Social content planning and client approval, for **Ideology Creative Studio**.

This is the Next.js + Supabase rewrite — see `legacy/` for the original
`localStorage`-only prototype it replaces (kept for reference while the UI
gets ported over; not part of the running app). The migration plan and its
phases live in `docs/` and were tracked as `greedy-sleeping-biscuit` in the
planning session that started this rewrite.

## Status: Phase A — foundation

What exists right now: the Postgres schema + Row-Level Security (`supabase/migrations/`),
real login for both the studio team and clients (Supabase Auth), and a
minimal placeholder UI proving the two are wired together correctly. The
actual studio app (Home, Clienti, Contenuti, Inspector, UGC, Calendario,
Anteprima, Impostazioni) and the client portal UI are **not yet ported** —
that's Phases B and C. See `docs/META-INTEGRATION-PLAN.md` for the
auto-publish design (Phases D/E).

## Setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Copy `.env.local.example` → `.env.local` and fill in the three keys from
   **Project Settings → API**.
3. Apply the schema — either via the Supabase CLI:
   ```bash
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   ```
   or paste `supabase/migrations/20260911120000_initial_schema.sql` into the
   Supabase dashboard's SQL editor.
4. Seed demo data + create your first logins:
   ```bash
   SEED_STUDIO_EMAIL=you@studio.test SEED_STUDIO_PASSWORD=... \
   SEED_CLIENT_EMAIL=client@test.test SEED_CLIENT_PASSWORD=... \
   node scripts/seed.mjs
   ```
   (Reads `.env.local` automatically for the Supabase connection.)
5. `npm install && npm run dev` → <http://localhost:3000>. Studio login at
   `/login`, client portal at `/portal/login`.

## Structure

| | |
|---|---|
| `src/app/` | Next.js App Router pages |
| `src/app/(app)/` | Studio-side pages (auth-gated: `profiles.kind = 'studio'`) |
| `src/app/portal/(protected)/` | Client portal pages (auth-gated: `profiles.kind = 'client'`) |
| `src/app/login`, `src/app/portal/login` | The two sign-in screens |
| `src/lib/supabase/` | Browser / server / service-role Supabase clients + hand-written DB types |
| `src/proxy.ts` | Session-refresh + auth redirect, runs on every request |
| `src/styles/` | The Studio Slate & Obsidian stylesheet, ported as-is from `legacy/` |
| `supabase/migrations/` | The full schema, RLS policies, and portal RPC functions |
| `scripts/seed.mjs` | Demo data + first-login bootstrap |
| `legacy/` | The original vanilla-JS prototype — reference only during the Phase B/C port |

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row-Level Security entirely. It's
  used in exactly three places: `scripts/seed.mjs`, the client-invite route
  (`src/app/api/invite-client/route.ts`), and — once Phase E lands — the
  Meta OAuth callback and the publish-sweep cron route. `src/lib/supabase/service.ts`
  guards it with `import 'server-only'` so an accidental client-side import
  fails the build instead of shipping the key to the browser.
- A client portal session can **read** its own client's rows (RLS-scoped)
  but cannot write to `content_items` directly — the only writes it can make
  are through the `approve_content_item` / `request_revision` Postgres
  functions, which touch only the fields the portal is allowed to touch.
