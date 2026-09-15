import { PageFrame } from '@/components/PageFrame';
import { ConnectionsView } from '@/components/ConnectionsView';
import { getConnectionsWithPages, getAllBindingIssues } from '@/lib/meta';
import { createClient } from '@/lib/supabase/server';

export default async function ConnectionsPage() {
  const supabase = await createClient();
  const [connections, brokenIssues, { data: boundAccounts }] = await Promise.all([
    getConnectionsWithPages(),
    getAllBindingIssues(),
    supabase.from('accounts').select('meta_connection_id, meta_page_id, clients(name)').not('meta_page_id', 'is', null),
  ]);

  const boundCounts: Record<string, number> = {};
  const boundPageOwners: Record<string, string> = {};
  for (const a of boundAccounts ?? []) {
    if (!a.meta_connection_id || !a.meta_page_id) continue;
    boundCounts[a.meta_connection_id] = (boundCounts[a.meta_connection_id] ?? 0) + 1;
    boundPageOwners[`${a.meta_connection_id}|${a.meta_page_id}`] = (a.clients as unknown as { name: string } | null)?.name ?? '';
  }

  return (
    <PageFrame>
      <ConnectionsView connections={connections} brokenIssues={brokenIssues} boundCounts={boundCounts} boundPageOwners={boundPageOwners} />
    </PageFrame>
  );
}
