-- ═══════════════════════════════════════════════════════════════════════════
-- Auto-publish scheduling (Phase D — mock publisher)
--
-- An approved post gets a scheduled_jobs row automatically; reverting it
-- (studio drags it back, or a client requests a revision) cancels that row.
-- A separate sweep (src/lib/publish-sweep.ts, run from the service role)
-- claims due jobs and flips them to published — the mock adapter the plan
-- calls for; a real Meta call swaps in later without touching this part.
-- ═══════════════════════════════════════════════════════════════════════════

-- At most one PENDING job per item — reapproving after a revert creates a
-- fresh row instead of colliding with a stale one still sitting at 'pending'.
create unique index scheduled_jobs_pending_item_idx
  on scheduled_jobs (content_item_id) where state = 'pending';

-- Shared by the trigger below and the studio's retry-after-failure action
-- (src/app/(app)/content/[clientId]/actions.ts's retryPublish). run_at is
-- computed from the item's date + publish_time in the CLIENT's own
-- timezone (clients.timezone) — "09:00" means 9am where the client is, not
-- wherever the Postgres server happens to run.
create function schedule_item_publish(p_item_id uuid) returns void
language plpgsql as $$
declare
  v_item content_items%rowtype;
  v_tz text;
  v_run_at timestamptz;
begin
  select * into v_item from content_items where id = p_item_id;
  if not found then return; end if;

  select coalesce(timezone, 'UTC') into v_tz from clients where id = v_item.client_id;
  v_run_at := timezone(v_tz, v_item.date::timestamp + v_item.publish_time);

  insert into scheduled_jobs (content_item_id, run_at, idempotency_key)
  values (p_item_id, v_run_at, gen_random_uuid()::text)
  on conflict (content_item_id) where state = 'pending'
  do update set run_at = excluded.run_at;

  update content_items set publish_state = 'scheduled' where id = p_item_id;
end;
$$;
grant execute on function schedule_item_publish(uuid) to authenticated;

-- Plain (invoker-rights) function/trigger on purpose: the studio's own
-- direct UPDATE already has full RLS grants on both tables
-- (content_items_studio_all/scheduled_jobs_studio_all), and the client
-- portal's path runs entirely inside the SECURITY DEFINER
-- approve_content_item/request_revision RPCs, which already execute with
-- elevated privileges for everything they do — including firing this
-- trigger. No extra privilege escalation needed either way.
create function sync_publish_schedule() returns trigger
language plpgsql as $$
begin
  if new.appr_stato = 'approvato' and new.publish_state in ('pending', 'scheduled') then
    perform schedule_item_publish(new.id);
  elsif old.appr_stato = 'approvato' and new.appr_stato <> 'approvato' and new.publish_state = 'scheduled' then
    delete from scheduled_jobs where content_item_id = new.id and state = 'pending';
    update content_items set publish_state = 'pending' where id = new.id;
  end if;
  return null; -- AFTER trigger, return value ignored
end;
$$;

create trigger content_items_sync_publish_schedule
  after update of appr_stato, date, publish_time on content_items
  for each row execute function sync_publish_schedule();
