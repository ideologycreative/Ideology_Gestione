import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/components/PageFrame';
import { PreviewGrid } from '@/components/PreviewGrid';
import { monthBounds } from '@/lib/dates';

export default async function PreviewClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ account?: string }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const [{ data: client }, { data: accounts }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('accounts').select('*').eq('client_id', clientId).order('created_at'),
  ]);
  if (!client) notFound();

  const accs = accounts ?? [];
  const account = accs.find((a) => a.id === sp.account) ?? accs[0] ?? null;

  const { start, end } = monthBounds();
  const { data: items } = account
    ? await supabase
        .from('content_items')
        .select('*')
        .eq('account_id', account.id)
        .eq('kind', 'feed')
        .neq('appr_stato', 'bozza')
        .gte('date', start)
        .lt('date', end)
        .order('date')
    : { data: [] };

  return (
    <PageFrame>
      <PreviewGrid client={client} accounts={accs} account={account} items={items ?? []} />
    </PageFrame>
  );
}
