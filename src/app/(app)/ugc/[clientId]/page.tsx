import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/components/PageFrame';
import { UgcMonthView } from '@/components/UgcMonthView';
import { parseMonthParam } from '@/lib/month-param';
import { monthBounds } from '@/lib/dates';

export default async function UgcClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;
  const month = parseMonthParam(sp.month);
  const { start, end } = monthBounds(month);

  const supabase = await createClient();
  const [{ data: client }, { data: slots }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('ugc_slots').select('*').eq('client_id', clientId).gte('date', start).lt('date', end).order('date'),
  ]);

  if (!client) notFound();

  return (
    <PageFrame>
      <UgcMonthView client={client} slots={slots ?? []} />
    </PageFrame>
  );
}
