import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

function fakePermalink(platform: string, itemId: string): string {
  return `https://mock-${platform.toLowerCase()}.ideology.local/p/${itemId.slice(0, 8)}`;
}

/**
 * The mock publisher — same role legacy's sweepPublished() played (called
 * once at boot from both the studio shell and the client portal), now
 * driving real scheduled_jobs/content_items rows instead of rewriting a
 * localStorage array. A real Meta call (Phase E, blocked on Meta Developer
 * credentials) swaps in for the "publish" step below; nothing else about
 * the flow changes from the UI's perspective.
 *
 * Uses the service-role client because this runs on behalf of no one in
 * particular — every client's due jobs get processed in one pass,
 * regardless of which studio user's request happened to trigger it.
 */
export async function runPublishSweep(): Promise<void> {
  const supabase = createServiceClient();

  const { data: jobs } = await supabase
    .from('scheduled_jobs')
    .select('id, content_item_id, attempts')
    .eq('state', 'pending')
    .lte('run_at', new Date().toISOString())
    .limit(20);
  if (!jobs?.length) return;

  for (const job of jobs) {
    // Guards against double-processing if two sweeps overlap (e.g. two tabs
    // loading a page at once) — only the sweep that actually flips
    // state='pending' -> 'claimed' proceeds.
    const { data: claimed } = await supabase
      .from('scheduled_jobs')
      .update({ state: 'claimed', claimed_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('state', 'pending')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    const { data: item } = await supabase
      .from('content_items')
      .select('id, accounts(platform)')
      .eq('id', job.content_item_id)
      .maybeSingle();
    if (!item) {
      await supabase.from('scheduled_jobs').update({ state: 'failed', error: 'content item no longer exists' }).eq('id', job.id);
      continue;
    }

    try {
      await supabase.from('content_items').update({ publish_state: 'publishing' }).eq('id', item.id);

      const platform = (item.accounts as unknown as { platform: string } | null)?.platform ?? 'Instagram';
      const permalink = fakePermalink(platform, item.id);

      await supabase
        .from('content_items')
        .update({ publish_state: 'published', appr_stato: 'pubblicato', permalink, publish_error: null })
        .eq('id', item.id);
      await supabase.from('scheduled_jobs').update({ state: 'done', completed_at: new Date().toISOString() }).eq('id', job.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown publish error';
      await supabase.from('content_items').update({ publish_state: 'failed', publish_error: message }).eq('id', item.id);
      await supabase.from('scheduled_jobs').update({ state: 'failed', attempts: job.attempts + 1, error: message }).eq('id', job.id);
    }
  }
}
