import { createClient } from '@/lib/supabase/server';
import { monthBounds } from '@/lib/dates';

export type StudioStats = {
  clients: number;
  accounts: number;
  posts: number;
  done: number;
  pending: number;
  revision: number;
  sponsored: number;
};

/**
 * Ported from legacy/src/app/core.js's studioStats() — same five counters,
 * same scope (this month's feed items only; stories aren't counted here,
 * matching the original). There it looped every feed item client-side over
 * localStorage; here it's two small aggregate queries.
 */
export async function getStudioStats(): Promise<StudioStats> {
  const supabase = await createClient();
  const { start, end } = monthBounds();

  const [{ count: clients }, { count: accounts }, { data: items }] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('accounts').select('id', { count: 'exact', head: true }),
    supabase
      .from('content_items')
      .select('appr_stato, sponsored')
      .eq('kind', 'feed')
      .gte('date', start)
      .lt('date', end),
  ]);

  const t: StudioStats = {
    clients: clients ?? 0,
    accounts: accounts ?? 0,
    posts: items?.length ?? 0,
    done: 0,
    pending: 0,
    revision: 0,
    sponsored: 0,
  };

  for (const it of items ?? []) {
    if (it.appr_stato === 'approvato') t.done++;
    if (it.appr_stato === 'approvare') t.pending++;
    if (it.appr_stato === 'revisione') t.revision++;
    if (it.sponsored) t.sponsored++;
  }

  return t;
}
