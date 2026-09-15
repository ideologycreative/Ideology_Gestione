import { createClient } from '@/lib/supabase/server';
import { getWorkspaceData } from '@/lib/content';
import { parseMonthParam } from '@/lib/month-param';
import { WorkspaceClient } from '@/components/content/WorkspaceClient';

export default async function ContentWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ account?: string; kind?: string; view?: string; month?: string; item?: string }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;

  const kind: 'feed' | 'story' = sp.kind === 'story' ? 'story' : 'feed';
  const view: 'list' | 'board' | 'grid' = sp.view === 'board' || sp.view === 'grid' ? sp.view : 'list';
  const month = parseMonthParam(sp.month);

  const { client, accounts, account, pillars, items, groupSizes } = await getWorkspaceData(clientId, sp.account, kind, month);

  let selectedItem = null;
  let selectedAccount = account;
  let targetAccountIds: string[] = [];
  let hasStoryLinkFlag = false;

  if (sp.item) {
    const supabase = await createClient();
    const { data: item } = await supabase.from('content_items').select('*').eq('id', sp.item).single();
    if (item) {
      selectedItem = item;
      selectedAccount = accounts.find((a) => a.id === item.account_id) ?? account;

      const { data: siblings } = await supabase.from('content_items').select('account_id, kind').eq('group_id', item.group_id);
      targetAccountIds = [...new Set((siblings ?? []).filter((s) => s.kind === item.kind).map((s) => s.account_id))];
      const wantKind = item.kind === 'story' ? 'feed' : 'story';
      hasStoryLinkFlag = (siblings ?? []).some((s) => s.kind === wantKind && s.account_id === item.account_id);
    }
  }

  return (
    <WorkspaceClient
      client={client}
      accounts={accounts}
      account={account}
      pillars={pillars}
      items={items}
      groupSizes={groupSizes}
      kind={kind}
      view={view}
      selectedItem={selectedItem}
      selectedAccount={selectedAccount}
      targetAccountIds={targetAccountIds}
      hasStoryLink={hasStoryLinkFlag}
    />
  );
}
