'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { MonthPicker } from '@/components/content/MonthPicker';
import { MONTHS } from '@/lib/dates';
import { monthParam } from '@/lib/month-param';
import type { Database } from '@/lib/supabase/types';

type AccountRow = Database['public']['Tables']['accounts']['Row'];

/** Ported from legacy client portal's head() — the month is the document's title (set large, landing first), the view/account/month controls stay small beside it since you read this constantly and change it rarely. */
export function PortalControls({
  month,
  account,
  accounts,
  hasUgc,
  view,
  done,
  total,
}: {
  month: Date;
  account: AccountRow | null;
  accounts: AccountRow[];
  hasUgc: boolean;
  view: 'preview' | 'ugc';
  done: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  const CELLS = 18;
  const filled = total ? Math.round((done / total) * CELLS) : 0;

  return (
    <div className="cv-head">
      <div className="cv-month-block">
        <h1 className="cv-month">
          {MONTHS[month.getMonth()]} <b>PED</b>
        </h1>
        <div className="cv-year">{month.getFullYear()} · Piano editoriale</div>
      </div>

      {view === 'preview' && total > 0 && (
        <div className="cv-counter">
          <div className="cv-count">
            <b>{String(done).padStart(2, '0')}</b>
            <span>/</span>
            {String(total).padStart(2, '0')}
          </div>
          <div className="cv-bar">
            <b>{'█'.repeat(filled)}</b>
            {'░'.repeat(CELLS - filled)}
          </div>
          <div className="cv-count-lbl">Approvati</div>
        </div>
      )}

      <div className="cv-controls">
        {hasUgc && (
          <div className="cv-seg">
            <button type="button" aria-pressed={view === 'preview'} onClick={() => setParam('view', 'preview')}>
              Contenuti
            </button>
            <button type="button" aria-pressed={view === 'ugc'} onClick={() => setParam('view', 'ugc')}>
              UGC
            </button>
          </div>
        )}

        {view === 'preview' && accounts.length > 1 && (
          <div className="cv-seg">
            {accounts.map((a) => (
              <button key={a.id} type="button" aria-pressed={a.id === account?.id} onClick={() => setParam('account', a.id)}>
                {a.platform}
              </button>
            ))}
          </div>
        )}

        {view === 'preview' && <MonthPicker value={month} onPick={(d) => setParam('month', monthParam(d))} />}
      </div>
    </div>
  );
}
