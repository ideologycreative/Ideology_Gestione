import { createClient } from '@/lib/supabase/server';
import { monthBounds } from '@/lib/dates';
import { parseMonthParam } from '@/lib/month-param';
import { PortalControls } from '@/components/portal/PortalControls';
import { PortalGrid } from '@/components/portal/PortalGrid';
import { PortalUgc } from '@/components/portal/PortalUgc';
import type { Database } from '@/lib/supabase/types';

type SlotRow = Database['public']['Tables']['ugc_slots']['Row'];

export default async function PortalHomePage({ searchParams }: { searchParams: Promise<{ account?: string; month?: string; view?: string }> }) {
  const { account: accountParam, month: monthParam_, view } = await searchParams;
  const supabase = await createClient();

  const [{ data: client }, { data: accounts }, { data: pillars }, { count: ugcCount }] = await Promise.all([
    supabase.from('clients').select('*').single(),
    supabase.from('accounts').select('*').order('created_at'),
    supabase.from('pillars').select('*').order('name'),
    supabase.from('ugc_slots').select('id', { count: 'exact', head: true }),
  ]);

  const accs = accounts ?? [];
  const account = accs.find((a) => a.id === accountParam) ?? accs[0] ?? null;
  const month = parseMonthParam(monthParam_);
  const hasUgc = (ugcCount ?? 0) > 0;
  const activeView = view === 'ugc' && hasUgc ? 'ugc' : 'preview';

  if (!client) {
    return (
      <div className="cv-fatal">
        <h1>Contenuti non trovati</h1>
        <p>Il tuo account non risulta collegato a nessun cliente attivo. Contatta il tuo referente Ideology.</p>
      </div>
    );
  }

  let items: Awaited<ReturnType<typeof loadItems>> = [];
  if (activeView === 'preview' && account) {
    items = await loadItems(account.id, month);
  }

  let ugcSlots: SlotRow[] = [];
  if (activeView === 'ugc') {
    const { data } = await supabase.from('ugc_slots').select('*').order('date');
    ugcSlots = data ?? [];
  }

  const doneCount = items.filter((i) => i.appr_stato === 'approvato').length;

  return (
    <>
      <PortalControls month={month} account={account} accounts={accs} hasUgc={hasUgc} view={activeView} done={doneCount} total={items.length} />
      {activeView === 'ugc' ? <PortalUgc slots={ugcSlots} /> : <PortalGrid items={items} account={account} pillars={pillars ?? []} client={client} month={month} />}
    </>
  );
}

async function loadItems(accountId: string, month: Date) {
  const supabase = await createClient();
  const { start, end } = monthBounds(month);
  const { data } = await supabase
    .from('content_items')
    .select('*')
    .eq('account_id', accountId)
    .eq('kind', 'feed')
    .neq('appr_stato', 'bozza')
    .gte('date', start)
    .lt('date', end)
    .order('date');
  return data ?? [];
}
