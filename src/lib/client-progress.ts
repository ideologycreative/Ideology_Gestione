import { createClient } from '@/lib/supabase/server';
import { monthBounds } from '@/lib/dates';

export type Progress = { done: number; total: number; pending: number; pct: number };

/**
 * Ported from legacy/src/app/core.js's clientProgress() — one call there per
 * tile, looping localStorage; here one batched query for every client's
 * roster tile at once (feed items this month, joined to their account's
 * client_id), grouped in JS. Same three counters, same "pending" bucket
 * (approvare OR revisione — either way it's waiting on someone else).
 */
export async function getClientProgressMap(): Promise<Record<string, Progress>> {
  const supabase = await createClient();
  const { start, end } = monthBounds();

  const { data } = await supabase
    .from('content_items')
    .select('appr_stato, accounts!inner(client_id)')
    .eq('kind', 'feed')
    .gte('date', start)
    .lt('date', end);

  const map: Record<string, Progress> = {};
  for (const row of data ?? []) {
    const clientId = (row.accounts as unknown as { client_id: string }).client_id;
    const p = (map[clientId] ??= { done: 0, total: 0, pending: 0, pct: 0 });
    p.total++;
    if (row.appr_stato === 'approvato') p.done++;
    if (row.appr_stato === 'approvare' || row.appr_stato === 'revisione') p.pending++;
  }
  for (const p of Object.values(map)) p.pct = p.total ? p.done / p.total : 0;
  return map;
}
