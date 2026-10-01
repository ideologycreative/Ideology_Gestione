'use client';

import Link from 'next/link';
import { useOptimistic, startTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { MonthPicker } from '@/components/content/MonthPicker';
import { initials, safeUrl } from '@/lib/utils';
import { onColor } from '@/lib/utils';
import { monthParam, parseMonthParam, shiftMonth } from '@/lib/month-param';
import { createItem } from '@/app/(app)/content/[clientId]/actions';
import type { Database } from '@/lib/supabase/types';

type ClientRow = Database['public']['Tables']['clients']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];

export function WorkspaceHeader({
  client,
  accounts,
  account,
  kind,
  view,
  query,
  onQueryChange,
}: {
  client: ClientRow;
  accounts: AccountRow[];
  account: AccountRow | null;
  kind: 'feed' | 'story';
  view: 'list' | 'board' | 'grid';
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const month = parseMonthParam(searchParams.get('month') ?? undefined);

  // router.push re-renders this whole header from fresh server props, which
  // is a real round trip — kind/view/account/month all sat frozen on the
  // old value for ~500ms after every click. Same useOptimistic fix as the
  // Inspector, just painting a navigation instead of a mutation.
  type NavState = { kind: typeof kind; view: typeof view; accountId: string | null; month: Date };
  const [opt, setOpt] = useOptimistic<NavState, Partial<NavState>>(
    { kind, view, accountId: account?.id ?? null, month },
    (state, patch) => ({ ...state, ...patch })
  );

  function pushParam(patch: Record<string, string | null>, optimisticPatch?: Partial<NavState>) {
    startTransition(() => {
      if (optimisticPatch) setOpt(optimisticPatch);
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  const logo = safeUrl(client.logo_url);

  return (
    <>
      <Link href="/content" className="back back--inline" title="Tutti i clienti">
        <Icon name="left" size={12} />
      </Link>

      <div className="hd-id">
        {logo ? (
          <img className="hd-logo" src={logo} alt="" />
        ) : (
          <span className="hd-logo hd-logo--txt" style={{ background: client.color || 'var(--brand)', color: onColor(client.color) }}>
            {initials(client.name)}
          </span>
        )}
        <h1 className="hd-client">{client.name}</h1>
      </div>

      {accounts.length > 1 ? (
        <div className="seg">
          {accounts.map((a) => (
            <button
              key={a.id}
              className="seg-b"
              aria-pressed={opt.accountId === a.id}
              title={`${a.platform}`}
              onClick={() => pushParam({ account: a.id, item: null }, { accountId: a.id })}
            >
              {a.platform}
            </button>
          ))}
        </div>
      ) : accounts.length === 1 ? (
        <span className="hd-handle">{accounts[0].handle || accounts[0].platform}</span>
      ) : null}

      <div className="stepper">
        <button
          className="iconbtn"
          aria-label="Mese precedente"
          onClick={() => {
            const d = shiftMonth(opt.month, -1);
            pushParam({ month: monthParam(d), item: null }, { month: d });
          }}
        >
          <Icon name="left" size={14} />
        </button>
        <MonthPicker
          value={opt.month}
          onPick={(d) => pushParam({ month: monthParam(d), item: null }, { month: d })}
        />
        <button
          className="iconbtn"
          aria-label="Mese successivo"
          onClick={() => {
            const d = shiftMonth(opt.month, 1);
            pushParam({ month: monthParam(d), item: null }, { month: d });
          }}
        >
          <Icon name="right" size={14} />
        </button>
      </div>

      <div style={{ flex: 1 }} />

      <div className="search-wrap">
        <Icon name="search" size={13} />
        <input
          className="search"
          type="search"
          placeholder="Filtra…"
          aria-label="Filtra contenuti"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <div className="seg">
        {(
          [
            { id: 'feed', label: 'Post' },
            { id: 'story', label: 'Storie' },
          ] as const
        ).map((k) => (
          <button key={k.id} className="seg-b" aria-pressed={opt.kind === k.id} onClick={() => pushParam({ kind: k.id, item: null }, { kind: k.id })}>
            {k.label}
          </button>
        ))}
      </div>

      <div className="seg seg--view">
        {(
          [
            { id: 'list', label: 'Tutti', ic: 'rows' },
            { id: 'board', label: 'Pipeline', ic: 'board' },
            { id: 'grid', label: 'Griglia', ic: 'grid' },
          ] as const
        ).map((v) => (
          <button key={v.id} className="seg-b" aria-pressed={opt.view === v.id} title={v.label} onClick={() => pushParam({ view: v.id }, { view: v.id })}>
            <Icon name={v.ic} size={13} />
            <span className="seg-t">{v.label}</span>
          </button>
        ))}
      </div>

      <Link href={`/preview/${client.id}`} className="btn btn--preview" title="Apri l'anteprima">
        <Icon name="eye" size={13} />
        <span className="seg-t">Anteprima</span>
      </Link>

      <button
        className="btn btn--primary"
        onClick={async () => {
          if (!account) return;
          const id = await createItem(client.id, account.id, kind, new Date().toISOString().slice(0, 10));
          pushParam({ item: id });
        }}
      >
        <Icon name="plus" size={13} />
        Nuovo
      </button>
    </>
  );
}
