-- Ideology Studio — initial schema
-- ═══════════════════════════════════════════════════════════════════════════
-- Ported field-for-field from the localStorage prototype (src/store/seed.js,
-- src/app/core.js — see legacy/ for the original app this replaces). Two
-- structural changes from the old JSON-blob model, both deliberate:
--   1. `pilastro`/`formato` were denormalized NAME strings on every item —
--      now real foreign keys to `pillars`/`formats`, so renaming a category
--      doesn't require rewriting every post that used it.
--   2. Client access used to be "possession of a 12-char URL token." Real
--      accounts + Row-Level Security replace that everywhere below.

create extension if not exists pgcrypto;

-- ── Enums ─────────────────────────────────────────────────────────────────

create type appr_stato as enum ('bozza','approvare','revisione','approvato','pubblicato');
create type content_kind as enum ('feed','story');
create type content_type as enum ('photo','carousel','reel');
create type publish_state as enum ('pending','scheduled','publishing','published','failed');
create type ugc_stato as enum ('raccolto','selezionato','adattato','approvato','autonoma');
create type profile_kind as enum ('studio','client');
create type job_state as enum ('pending','claimed','done','failed');
create type client_tipo as enum ('retainer','oneshot');

-- ── updated_at helper ────────────────────────────────────────────────────

create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── clients ──────────────────────────────────────────────────────────────

create table clients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  color               text not null default '#5B50E6',
  tipo                client_tipo not null default 'retainer',
  status              text not null default 'Attivo',
  pkg                 text,
  pkg_hours           numeric,
  revenue             numeric,
  budget              numeric,
  progetto_nome       text,
  progetto_deadline   date,
  theme               text not null default 'dark' check (theme in ('dark','light')),
  timezone            text not null default 'Europe/Rome',
  referente_nome      text not null default '',
  referente_email     text not null default '',
  referente_tel       text not null default '',
  note                text not null default '',
  logo_url            text not null default '',
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();

-- ── profiles — one row per auth.users, discriminates studio vs. client ──

create table profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  kind        profile_kind not null,
  client_id   uuid references clients(id) on delete cascade,
  name        text not null default '',
  ui_prefs    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint client_id_required_for_client_kind
    check ((kind = 'client') = (client_id is not null))
);

-- Auto-create a profile on signup/invite. `kind`/`client_id`/`name` come from
-- the metadata passed at signup (studio: {kind:'studio', name}) or invite
-- (client: {kind:'client', client_id, name}) — see the invite route.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, kind, client_id, name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'kind')::profile_kind, 'studio'),
    nullif(new.raw_user_meta_data->>'client_id', '')::uuid,
    coalesce(new.raw_user_meta_data->>'name', '')
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── accounts (per-client social accounts) ───────────────────────────────

create table accounts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  platform        text not null check (platform in
                    ('Instagram','Facebook','TikTok','LinkedIn','YouTube','Pinterest','Threads')),
  handle          text not null default '',
  name            text not null default '',
  meta_connection_id uuid, -- fk added after meta_connections exists, below
  meta_page_id    text,
  meta_ig_user_id text,
  created_at      timestamptz not null default now()
);
create index accounts_client_id_idx on accounts (client_id);
-- A page can back at most one account across the whole studio (the
-- "already bound to another client" guard, now a real constraint instead
-- of a linear scan).
create unique index accounts_meta_page_unique on accounts (meta_page_id)
  where meta_page_id is not null;

-- ── pillars / formats (per-client categories) ───────────────────────────

create table pillars (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null,
  color       text not null default '#5B50E6'
);
create index pillars_client_id_idx on pillars (client_id);

create table formats (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null,
  ratio       text not null default '1/1'
);
create index formats_client_id_idx on formats (client_id);

-- ── content_items (feed + story posts) ──────────────────────────────────

create table content_items (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  account_id      uuid not null references accounts(id) on delete cascade,
  kind            content_kind not null,
  group_id        uuid not null default gen_random_uuid(), -- links copies across channels
  type            content_type not null default 'photo',
  url             text not null default '',
  external_url    text not null default '',
  video_url       text not null default '',
  slides          jsonb not null default '[]'::jsonb, -- [{url,externalUrl,videoUrl,name,copy,note}]
  date            date not null,
  publish_time    time not null default '09:00', -- new: posts had no time of day before scheduling existed
  copy            text not null default '',
  note            text not null default '',
  pillar_id       uuid references pillars(id) on delete set null,
  format_id       uuid references formats(id) on delete set null,
  appr_stato      appr_stato not null default 'bozza',
  appr_revisions  integer not null default 0,
  sponsored       boolean not null default false,
  client_note     text not null default '',
  appr_note       text not null default '',
  client_name     text not null default '',
  appr_by         text not null default '',
  appr_date       timestamptz,
  publish_state   publish_state not null default 'pending',
  permalink       text,
  publish_error   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger content_items_set_updated_at before update on content_items
  for each row execute function set_updated_at();
create index content_items_client_date_idx on content_items (client_id, date);
create index content_items_group_idx on content_items (group_id);
create index content_items_account_kind_idx on content_items (account_id, kind, date);

-- ── ugc_slots ────────────────────────────────────────────────────────────

create table ugc_slots (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  date        date not null,
  brief       text not null default '',
  ugc_stato   ugc_stato not null default 'raccolto',
  creator     text not null default '',
  created_at  timestamptz not null default now()
);
create index ugc_slots_client_date_idx on ugc_slots (client_id, date);

-- ── meta_connections / meta_pages ────────────────────────────────────────

create table meta_connections (
  id                      uuid primary key default gen_random_uuid(),
  provider                text not null default 'meta',
  meta_account_id         text not null unique, -- the real Meta user/business id, not a local id —
                                                 -- reconnecting the same Meta account must resolve to
                                                 -- the same row so bindings don't orphan (see
                                                 -- docs/META-INTEGRATION-PLAN.md gotcha #7)
  account_name            text not null default '',
  business_name           text not null default '',
  access_token_encrypted  bytea, -- populated + encrypted in Phase E; service-role only, see RLS below
  connected_at            timestamptz not null default now(),
  expires_at              timestamptz,
  created_by              uuid references auth.users(id),
  created_at              timestamptz not null default now()
);

create table meta_pages (
  id              uuid primary key default gen_random_uuid(),
  connection_id   uuid not null references meta_connections(id) on delete cascade,
  page_id         text not null,
  name            text not null default '',
  category        text not null default '',
  ig_user_id      text,
  ig_username     text,
  ig_account_type text check (ig_account_type in ('BUSINESS','CREATOR','PERSONAL')),
  unique (connection_id, page_id)
);

alter table accounts
  add constraint accounts_meta_connection_fk
  foreign key (meta_connection_id) references meta_connections(id) on delete set null;

-- ── scheduled_jobs (the auto-publish worker's queue) ────────────────────

create table scheduled_jobs (
  id                uuid primary key default gen_random_uuid(),
  content_item_id   uuid not null references content_items(id) on delete cascade,
  run_at            timestamptz not null,
  state             job_state not null default 'pending',
  attempts          integer not null default 0,
  idempotency_key   text not null unique,
  claimed_at        timestamptz,
  completed_at      timestamptz,
  error             text,
  created_at        timestamptz not null default now()
);
-- The worker's claim query: "every pending job whose time has come."
create index scheduled_jobs_due_idx on scheduled_jobs (run_at) where state = 'pending';

-- ── settings (org-wide only — per-user prefs live on profiles.ui_prefs) ──

create table settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
create trigger settings_set_updated_at before update on settings
  for each row execute function set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Row-Level Security
-- ═══════════════════════════════════════════════════════════════════════════

create function is_studio() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where user_id = auth.uid() and kind = 'studio'
  );
$$;

create function my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from profiles where user_id = auth.uid() and kind = 'client';
$$;

alter table clients enable row level security;
alter table profiles enable row level security;
alter table accounts enable row level security;
alter table pillars enable row level security;
alter table formats enable row level security;
alter table content_items enable row level security;
alter table ugc_slots enable row level security;
alter table meta_connections enable row level security;
alter table meta_pages enable row level security;
alter table scheduled_jobs enable row level security;
alter table settings enable row level security;

-- profiles: everyone can read/update their own row; studio can read all
-- (needed for the Clienti team-management surface).
create policy profiles_self_select on profiles for select
  using (user_id = auth.uid() or is_studio());
create policy profiles_self_update on profiles for update
  using (user_id = auth.uid());

-- clients: studio full access; a client account can only ever see its own row.
create policy clients_studio_all on clients for all
  using (is_studio()) with check (is_studio());
create policy clients_self_select on clients for select
  using (id = my_client_id());

-- accounts / pillars / formats / ugc_slots: studio full access; client
-- read-only on their own client_id.
create policy accounts_studio_all on accounts for all
  using (is_studio()) with check (is_studio());
create policy accounts_client_select on accounts for select
  using (client_id = my_client_id());

create policy pillars_studio_all on pillars for all
  using (is_studio()) with check (is_studio());
create policy pillars_client_select on pillars for select
  using (client_id = my_client_id());

create policy formats_studio_all on formats for all
  using (is_studio()) with check (is_studio());
create policy formats_client_select on formats for select
  using (client_id = my_client_id());

create policy ugc_slots_studio_all on ugc_slots for all
  using (is_studio()) with check (is_studio());
create policy ugc_slots_client_select on ugc_slots for select
  using (client_id = my_client_id());

-- content_items: studio full access. A client can READ every column on
-- their own rows (including client_note/client_name, which they authored) —
-- but gets NO update/insert/delete grant at all. The only way a client
-- session can change appr_stato/client_note/etc. is through the two RPC
-- functions below, which touch only the fields the portal is allowed to
-- touch and verify client_id server-side before writing anything.
create policy content_items_studio_all on content_items for all
  using (is_studio()) with check (is_studio());
create policy content_items_client_select on content_items for select
  using (client_id = my_client_id());

-- meta_connections / meta_pages / scheduled_jobs / settings: studio only.
-- No client policy at all — a client role gets zero rows, full stop.
create policy meta_connections_studio_all on meta_connections for all
  using (is_studio()) with check (is_studio());
create policy meta_pages_studio_all on meta_pages for all
  using (is_studio()) with check (is_studio());
create policy scheduled_jobs_studio_all on scheduled_jobs for all
  using (is_studio()) with check (is_studio());
create policy settings_studio_all on settings for all
  using (is_studio()) with check (is_studio());

-- access_token_encrypted must never reach a client OR studio browser
-- session — only the service role (the cron worker, the OAuth callback
-- route) reads it. Revoke column access from the authenticated role
-- entirely rather than relying on app code to avoid selecting it.
revoke select (access_token_encrypted) on meta_connections from authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Portal RPCs — the only writes a client session can make
-- ═══════════════════════════════════════════════════════════════════════════

create function approve_content_item(p_item_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_client_id uuid;
  v_name text;
begin
  select client_id into v_client_id from content_items where id = p_item_id;
  if v_client_id is null or v_client_id <> my_client_id() then
    raise exception 'not authorized';
  end if;
  select name into v_name from profiles where user_id = auth.uid();
  update content_items set
    appr_stato = 'approvato',
    appr_by = coalesce(nullif(v_name, ''), 'Cliente'),
    appr_date = now()
  where id = p_item_id;
end;
$$;

create function request_revision(p_item_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_client_id uuid;
  v_name text;
begin
  select client_id into v_client_id from content_items where id = p_item_id;
  if v_client_id is null or v_client_id <> my_client_id() then
    raise exception 'not authorized';
  end if;
  select name into v_name from profiles where user_id = auth.uid();
  update content_items set
    appr_stato = 'revisione',
    client_note = p_note,
    appr_note = p_note,
    client_name = coalesce(nullif(split_part(v_name, ' ', 1), ''), 'Cliente'),
    appr_revisions = appr_revisions + 1,
    appr_date = now()
  where id = p_item_id;
end;
$$;

grant execute on function approve_content_item(uuid) to authenticated;
grant execute on function request_revision(uuid, text) to authenticated;
