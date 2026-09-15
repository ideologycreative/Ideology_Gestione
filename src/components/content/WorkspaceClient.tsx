'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { WorkspaceHeader } from '@/components/content/WorkspaceHeader';
import { WorkspaceBody } from '@/components/content/WorkspaceBody';
import { WorkspaceStatus } from '@/components/content/WorkspaceStatus';
import { InspectorPanel } from '@/components/content/InspectorPanel';
import { PageFrame } from '@/components/PageFrame';
import { useInspector } from '@/components/InspectorContext';
import { createItem } from '@/app/(app)/content/[clientId]/actions';
import { monthLabel as monthLabelFn, parseMonthParam } from '@/lib/month-param';
import type { Database } from '@/lib/supabase/types';

type ClientRow = Database['public']['Tables']['clients']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];
type PillarRow = Database['public']['Tables']['pillars']['Row'];
type ItemRow = Database['public']['Tables']['content_items']['Row'];

export function WorkspaceClient({
  client,
  accounts,
  account,
  pillars,
  items,
  groupSizes,
  kind,
  view,
  selectedItem,
  selectedAccount,
  targetAccountIds,
  hasStoryLink,
}: {
  client: ClientRow;
  accounts: AccountRow[];
  account: AccountRow | null;
  pillars: PillarRow[];
  items: ItemRow[];
  groupSizes: Record<string, number>;
  kind: 'feed' | 'story';
  view: 'list' | 'board' | 'grid';
  selectedItem: ItemRow | null;
  selectedAccount: AccountRow | null;
  targetAccountIds: string[];
  hasStoryLink: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { open, close } = useInspector();
  const [query, setQuery] = useState('');

  const selectedId = searchParams.get('item');

  function pushParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  const selectItem = (id: string) => pushParams({ item: id });
  const closeItem = () => pushParams({ item: null });
  const switchTo = (nextItemId: string | null, nextAccountId: string | null) => {
    const patch: Record<string, string | null> = { item: nextItemId };
    if (nextAccountId) patch.account = nextAccountId;
    pushParams(patch);
  };

  // Relays the currently-selected item's inspector into the shared overlay
  // slot PageFrame reads from — the panel content genuinely changes as the
  // selection changes, so syncing it into context via an effect (rather
  // than computing it during render) is the documented pattern for this.
  useEffect(() => {
    if (selectedItem && selectedAccount) {
      open(
        <InspectorPanel
          clientId={client.id}
          item={selectedItem}
          account={selectedAccount}
          accounts={accounts}
          pillars={pillars}
          hasStoryLink={hasStoryLink}
          targetAccountIds={targetAccountIds}
          onClose={closeItem}
          onClosedByRemoval={switchTo}
        />
      );
    } else {
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, selectedAccount, hasStoryLink, targetAccountIds]);

  const filtered = query
    ? items.filter((it) => {
        const q = query.toLowerCase();
        return (it.copy || '').toLowerCase().includes(q) || (it.note || '').toLowerCase().includes(q);
      })
    : items;

  const month = parseMonthParam(searchParams.get('month') ?? undefined);

  if (!account) {
    return (
      <PageFrame>
        <div className="page">
          <div className="empty">
            <p>Nessun account social collegato a {client.name}.</p>
            <a className="btn btn--primary" href={`/clients/${client.id}`}>
              Aggiungi un account
            </a>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      header={<WorkspaceHeader client={client} accounts={accounts} account={account} kind={kind} view={view} query={query} onQueryChange={setQuery} />}
      status={<WorkspaceStatus items={items} />}
    >
      <WorkspaceBody
        clientId={client.id}
        account={account}
        kind={kind}
        view={view}
        items={filtered}
        pillars={pillars}
        groupSizes={groupSizes}
        selectedId={selectedId}
        onSelect={selectItem}
        onNew={async () => {
          const id = await createItem(client.id, account.id, kind, new Date().toISOString().slice(0, 10));
          selectItem(id);
        }}
        monthLabel={monthLabelFn(month)}
      />
    </PageFrame>
  );
}
