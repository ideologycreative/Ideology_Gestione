'use client';

import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Thumb } from '@/components/content/Thumb';
import { statusOf, ratioFor, fmtDay } from '@/lib/platforms';
import type { Database } from '@/lib/supabase/types';

type ClientRow = Database['public']['Tables']['clients']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];
type ItemRow = Database['public']['Tables']['content_items']['Row'];

export function PreviewGrid({
  client,
  accounts,
  account,
  items,
}: {
  client: ClientRow;
  accounts: AccountRow[];
  account: AccountRow | null;
  items: ItemRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="page">
      <Link href="/preview" className="back">
        <Icon name="left" size={12} />
        Tutti i clienti
      </Link>

      <div className="page-hd">
        <div>
          <h1 className="page-title">{client.name}</h1>
          <p className="page-sub">Vista cliente — bozze escluse</p>
        </div>
        <div style={{ flex: 1 }} />
        {accounts.length > 1 && (
          <div className="seg">
            {accounts.map((a) => (
              <button
                key={a.id}
                className="seg-b"
                aria-pressed={account?.id === a.id}
                onClick={() => {
                  const next = new URLSearchParams(searchParams.toString());
                  next.set('account', a.id);
                  router.push(`${pathname}?${next.toString()}`);
                }}
              >
                {a.platform}
              </button>
            ))}
          </div>
        )}
      </div>

      {!account ? (
        <div className="empty">
          <p>Nessun account social collegato.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <p>Nessun contenuto visibile al cliente questo mese.</p>
        </div>
      ) : (
        <div className="lgrid-wrap">
          <div className="lgrid">
            {items.map((item) => {
              const st = statusOf(item.appr_stato);
              return (
                <div className="lcard" key={item.id}>
                  <Thumb item={item} ratio={ratioFor(item, account, 'grid')} />
                  <div className="lcard-ft">
                    <div className="lcard-meta">
                      <span className="lcard-date">{fmtDay(item.date)}</span>
                      <span className="lstatus" data-s={item.appr_stato}>
                        {st.label}
                      </span>
                    </div>
                    <span className={'lcard-cap' + (item.copy ? '' : ' lcard-cap--empty')}>{item.copy || 'Senza caption'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
