import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/components/PageFrame';
import { CalendarCoverage } from '@/components/CalendarCoverage';
import { getClientMonthDays } from '@/lib/calendar';
import { parseMonthParam } from '@/lib/month-param';

export default async function CalendarClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;
  const month = parseMonthParam(sp.month);

  const supabase = await createClient();
  const [{ data: client }, byDay] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    getClientMonthDays(clientId, month),
  ]);

  if (!client) notFound();

  return (
    <PageFrame>
      <CalendarCoverage client={client} byDay={byDay} />
    </PageFrame>
  );
}
