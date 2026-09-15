import { STATUSES } from '@/lib/platforms';
import type { Database } from '@/lib/supabase/types';

type ItemRow = Database['public']['Tables']['content_items']['Row'];

export function WorkspaceStatus({ items }: { items: ItemRow[] }) {
  const done = items.filter((i) => i.appr_stato === 'approvato').length;
  const total = items.length;
  const pct = total ? done / total : 0;
  const CELLS = 16;
  const filled = Math.round(pct * CELLS);

  return (
    <>
      <div className="st-left">
        {STATUSES.map((st) => {
          const n = items.filter((i) => i.appr_stato === st.id).length;
          return (
            <span className="st-seg" key={st.id} data-s={st.id}>
              <b>{st.token}</b>
              {n}
            </span>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <div className="st-right">
        <span className="st-bar">
          <b>{'█'.repeat(filled)}</b>
          {'░'.repeat(CELLS - filled)}
        </span>
        <span className="st-ratio">
          {done}/{total}
        </span>
        <span className="st-save">● Cloud</span>
      </div>
    </>
  );
}
