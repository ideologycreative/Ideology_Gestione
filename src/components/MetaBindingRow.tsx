'use client';

import Link from 'next/link';
import { useState } from 'react';
import { bindAccount, unbindAccount } from '@/app/(app)/connections/actions';
import type { Database } from '@/lib/supabase/types';
import type { MetaPageWithBinding } from '@/lib/meta';

type AccountRow = Database['public']['Tables']['accounts']['Row'];

/** Ported from legacy/src/app/sections.js's metaBindingRow() — same three states (bound/broken/unbound), same picker with taken/blocked options disabled. */
export function MetaBindingRow({
  clientId,
  account,
  pages,
  boundPage,
  issue,
}: {
  clientId: string;
  account: AccountRow;
  pages: MetaPageWithBinding[];
  boundPage: MetaPageWithBinding | null;
  issue: string | null;
}) {
  const [toast, setToast] = useState('');
  const isBound = !!account.meta_page_id;

  async function onChange(value: string) {
    if (!value) {
      await unbindAccount(clientId, account.id);
      setToast('Pagina scollegata');
      return;
    }
    const [connectionId, pageId] = value.split('|');
    const res = await bindAccount(clientId, account.id, connectionId, pageId);
    setToast(res.ok ? `Collegato a ${res.pageName}` : res.reason);
  }

  if (!pages.length) {
    return (
      <div className="bind-row">
        <span className="bind-icon bind-icon--none">·</span>
        <div className="bind-id">
          <span className="bind-page bind-page--none">Nessuna pagina Meta collegata</span>
          <span className="bind-sub">Questo canale non pubblicherà finché non colleghi un account Meta.</span>
        </div>
        <Link href="/connections" className="btn btn--xs">
          Collega Meta
        </Link>
      </div>
    );
  }

  return (
    <div className={'bind-row' + (isBound && !issue ? ' is-ok' : isBound ? ' is-bad' : '')}>
      {isBound && !issue && (
        <>
          <span className="bind-icon">✓</span>
          <div className="bind-id">
            <span className="bind-page">{boundPage?.name}</span>
            <span className="bind-sub">{account.platform === 'Instagram' && boundPage?.ig_username ? `@${boundPage.ig_username}` : 'Pagina Facebook'}</span>
          </div>
        </>
      )}
      {isBound && issue && (
        <>
          <span className="bind-icon">!</span>
          <div className="bind-id">
            <span className="bind-page">{boundPage?.name ?? 'Pagina non disponibile'}</span>
            <span className="bind-sub">{issue}</span>
          </div>
        </>
      )}
      {!isBound && (
        <>
          <span className="bind-icon bind-icon--none">·</span>
          <div className="bind-id">
            <span className="bind-page bind-page--none">Nessuna pagina Meta collegata</span>
            <span className="bind-sub">Questo canale non pubblicherà finché non scegli una pagina.</span>
          </div>
        </>
      )}

      <select
        className="input input--sm bind-picker"
        aria-label="Pagina Meta"
        defaultValue={isBound ? `${account.meta_connection_id}|${account.meta_page_id}` : ''}
        onChange={(e) => void onChange(e.target.value)}
      >
        <option value="">— nessuna —</option>
        {pages.map((p) => {
          let label = p.name;
          let blocked = false;
          if (account.platform === 'Instagram') {
            if (!p.ig_user_id) {
              label += ' — nessun IG collegato';
              blocked = true;
            } else if (p.ig_account_type === 'PERSONAL') {
              label += ' — IG personale, non pubblicabile';
              blocked = true;
            } else {
              label += ` — @${p.ig_username}`;
            }
          }
          if (p.takenByAccountId && p.takenByAccountId !== account.id) {
            label += ` (già su ${p.takenByClientName})`;
            blocked = true;
          }
          return (
            <option key={`${p.connection_id}|${p.page_id}`} value={`${p.connection_id}|${p.page_id}`} disabled={blocked}>
              {label}
            </option>
          );
        })}
      </select>
      {toast && <p className="f-hint">{toast}</p>}
    </div>
  );
}
