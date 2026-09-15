'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { MonthPicker } from '@/components/content/MonthPicker';
import { UGC_STATI } from '@/lib/ugc';
import { useDebouncedCommit } from '@/lib/use-debounced-commit';
import { monthParam, parseMonthParam, monthLabel, shiftMonth } from '@/lib/month-param';
import { addUgcSlot, updateUgcSlot, removeUgcSlot } from '@/app/(app)/ugc/[clientId]/actions';
import type { Database } from '@/lib/supabase/types';

type ClientRow = Database['public']['Tables']['clients']['Row'];
type SlotRow = Database['public']['Tables']['ugc_slots']['Row'];

export function UgcMonthView({ client, slots: initialSlots }: { client: ClientRow; slots: SlotRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounced = useDebouncedCommit();
  const [slots, setSlots] = useState(initialSlots);

  const month = parseMonthParam(searchParams.get('month') ?? undefined);
  const label = monthLabel(month);

  function pushMonth(d: Date) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('month', monthParam(d));
    router.push(`${pathname}?${next.toString()}`);
  }

  function patch(id: string, p: Partial<SlotRow>) {
    setSlots((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));
    void updateUgcSlot(client.id, id, p);
  }

  return (
    <div className="page">
      <Link href="/ugc" className="back">
        <Icon name="left" size={12} />
        Tutti i clienti
      </Link>

      <div className="page-hd">
        <div>
          <h1 className="page-title">{client.name}</h1>
          <p className="page-sub">
            {slots.length} brief in {label}
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn--primary"
          onClick={async () => {
            const iso = new Date().toISOString().slice(0, 10);
            await addUgcSlot(client.id, iso);
            router.refresh();
          }}
        >
          <Icon name="plus" size={13} />
          Nuovo brief
        </button>
      </div>

      <div className="cov-bar">
        <div className="stepper">
          <button className="iconbtn" aria-label="Mese precedente" onClick={() => pushMonth(shiftMonth(month, -1))}>
            <Icon name="left" size={14} />
          </button>
          <MonthPicker value={month} onPick={pushMonth} />
          <button className="iconbtn" aria-label="Mese successivo" onClick={() => pushMonth(shiftMonth(month, 1))}>
            <Icon name="right" size={14} />
          </button>
        </div>
      </div>

      <div className="ugc-list">
        {slots.length === 0 && <p className="panel-empty">Nessun brief per {label}.</p>}

        {slots.map((slot) => (
          <div className="ugc-row" key={slot.id}>
            <div className="ugc-main">
              <input className="input" type="date" aria-label="Data" defaultValue={slot.date} onChange={(e) => patch(slot.id, { date: e.target.value })} />
              <input
                className="input"
                type="text"
                placeholder="@creator"
                aria-label="Creator"
                defaultValue={slot.creator}
                onChange={(e) => {
                  const v = e.target.value;
                  debounced('ugc-creator-' + slot.id, () => patch(slot.id, { creator: v }));
                }}
              />
              <input
                className="input"
                type="text"
                placeholder="Cosa deve girare il creator…"
                aria-label="Brief"
                defaultValue={slot.brief}
                onChange={(e) => {
                  const v = e.target.value;
                  debounced('ugc-brief-' + slot.id, () => patch(slot.id, { brief: v }));
                }}
              />
              <select className="input" aria-label="Stato" defaultValue={slot.ugc_stato} onChange={(e) => patch(slot.id, { ugc_stato: e.target.value as SlotRow['ugc_stato'] })}>
                {UGC_STATI.map((st) => (
                  <option key={st.id} value={st.id} title={st.hint}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ugc-side">
              <button
                className="iconbtn"
                aria-label="Elimina brief"
                title="Elimina brief"
                onClick={() => {
                  if (!confirm('Eliminare questo brief?')) return;
                  setSlots((s) => s.filter((x) => x.id !== slot.id));
                  void removeUgcSlot(client.id, slot.id);
                }}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
