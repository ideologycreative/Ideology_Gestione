import { createClient } from '@/lib/supabase/server';
import { monthBounds } from '@/lib/dates';
import type { CoverageEntry } from '@/lib/calendar-color';

export type { CoverageEntry } from '@/lib/calendar-color';
export { STORY_COLOR, typeColor, entryColor } from '@/lib/calendar-color';

/**
 * Ported from legacy/src/app/core.js's clientMonthDays() — a coverage map,
 * not a content view: every account, both kinds, bozza excluded, and a
 * multi-channel post (shared group_id) collapses to ONE entry per day
 * carrying every platform it reaches, not one dot per channel copy.
 */
export async function getClientMonthDays(clientId: string, month: Date): Promise<Record<number, CoverageEntry[]>> {
  const supabase = await createClient();
  const { start, end } = monthBounds(month);

  const { data } = await supabase
    .from('content_items')
    .select('id, kind, type, date, appr_stato, sponsored, group_id, accounts!inner(platform)')
    .eq('client_id', clientId)
    .neq('appr_stato', 'bozza')
    .gte('date', start)
    .lt('date', end);

  const byDay: Record<number, CoverageEntry[]> = {};
  const entryByGroup = new Map<string, CoverageEntry>();

  for (const row of data ?? []) {
    const day = Number(row.date.split('-')[2]);
    if (!day) continue;
    const platform = (row.accounts as unknown as { platform: string }).platform;
    const key = `${day}|${row.group_id}`;
    const existing = entryByGroup.get(key);
    if (existing) {
      if (!existing.platforms.includes(platform)) existing.platforms.push(platform);
      continue;
    }
    const entry: CoverageEntry = {
      id: row.id,
      kind: row.kind,
      type: row.type,
      platforms: [platform],
      stato: row.appr_stato,
      sponsored: row.sponsored,
    };
    (byDay[day] ??= []).push(entry);
    entryByGroup.set(key, entry);
  }

  return byDay;
}
