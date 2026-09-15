import { UGC_STATI, UGC_STATO_COLOR } from '@/lib/ugc';
import { fmtDay } from '@/lib/platforms';
import { MONTHS } from '@/lib/dates';
import type { Database } from '@/lib/supabase/types';

type SlotRow = Database['public']['Tables']['ugc_slots']['Row'];

/** Ported from legacy client portal's ugcPanel() — read-only, grouped by month; the studio-side editor lives at src/app/(app)/ugc. */
export function PortalUgc({ slots }: { slots: SlotRow[] }) {
  if (!slots.length) {
    return <div className="cv-ugc cv-empty">Nessun piano UGC disponibile</div>;
  }

  const byMonth = new Map<string, SlotRow[]>();
  for (const slot of slots) {
    const [y, m] = slot.date.split('-');
    const key = `${MONTHS[Number(m) - 1]} ${y}`;
    (byMonth.get(key) ?? byMonth.set(key, []).get(key)!).push(slot);
  }

  return (
    <div className="cv-ugc">
      {[...byMonth.entries()].map(([month, monthSlots]) => (
        <div key={month}>
          <h2 className="cv-ugc-month">{month}</h2>
          <div className="cv-ugc-grid">
            {monthSlots.map((slot) => (
              <div className="cv-slot" key={slot.id}>
                <div className="cv-slot-date">{fmtDay(slot.date)}</div>
                <div className="cv-slot-brief">{slot.brief || '—'}</div>
                <div className="cv-slot-meta">
                  <span className="cv-chip">
                    <i style={{ background: UGC_STATO_COLOR[slot.ugc_stato] ?? UGC_STATO_COLOR.autonoma }} />
                    {UGC_STATI.find((s) => s.id === slot.ugc_stato)?.label ?? slot.ugc_stato}
                  </span>
                  {slot.creator && <span className="cv-creator">{slot.creator}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
