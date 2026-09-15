import { createClient } from '@/lib/supabase/server';
import { monthBounds } from '@/lib/dates';
import { notFound } from 'next/navigation';

export async function getWorkspaceData(clientId: string, accountId: string | undefined, kind: 'feed' | 'story', month: Date) {
  const supabase = await createClient();

  const [{ data: client }, { data: accounts }, { data: pillars }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('accounts').select('*').eq('client_id', clientId).order('created_at'),
    supabase.from('pillars').select('*').eq('client_id', clientId).order('name'),
  ]);

  if (!client) notFound();

  const accs = accounts ?? [];
  const account = accs.find((a) => a.id === accountId) ?? accs[0] ?? null;

  const { start, end } = monthBounds(month);
  const { data: items } = account
    ? await supabase
        .from('content_items')
        .select('*')
        .eq('account_id', account.id)
        .eq('kind', kind)
        .gte('date', start)
        .lt('date', end)
        .order('sort_order')
    : { data: [] };

  const groupIds = [...new Set((items ?? []).map((i) => i.group_id))];
  const groupSizes: Record<string, number> = {};
  if (groupIds.length) {
    const { data: groupRows } = await supabase.from('content_items').select('group_id').in('group_id', groupIds);
    for (const row of groupRows ?? []) groupSizes[row.group_id] = (groupSizes[row.group_id] ?? 0) + 1;
  }

  return { client, accounts: accs, account, pillars: pillars ?? [], items: items ?? [], groupSizes };
}
