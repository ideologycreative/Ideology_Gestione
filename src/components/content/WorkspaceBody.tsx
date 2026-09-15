'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { Thumb } from '@/components/content/Thumb';
import { STATUSES, statusOf, fmtDay, platform, ratioFor } from '@/lib/platforms';
import { patchItem, moveItem } from '@/app/(app)/content/[clientId]/actions';
import type { Database } from '@/lib/supabase/types';

type ItemRow = Database['public']['Tables']['content_items']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];
type PillarRow = Database['public']['Tables']['pillars']['Row'];

function EmptyState({ msg, onNew }: { msg: string; onNew: () => void }) {
  return (
    <div className="empty">
      <p>{msg}</p>
      <button className="btn btn--primary" onClick={onNew}>
        <Icon name="plus" size={13} />
        Nuovo contenuto
      </button>
    </div>
  );
}

export function WorkspaceBody({
  clientId,
  account,
  kind,
  view,
  items,
  pillars,
  groupSizes,
  selectedId,
  onSelect,
  onNew,
  monthLabel,
}: {
  clientId: string;
  account: AccountRow;
  kind: 'feed' | 'story';
  view: 'list' | 'board' | 'grid';
  items: ItemRow[];
  pillars: PillarRow[];
  groupSizes: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  monthLabel: string;
}) {
  if (!items.length) return <EmptyState msg={`Nessun contenuto in ${monthLabel}`} onNew={onNew} />;

  if (view === 'board') return <BoardView {...{ clientId, items, selectedId, onSelect, pillars, groupSizes }} />;
  if (view === 'grid') return <GridView {...{ clientId, account, kind, items, selectedId, onSelect }} />;
  return <ListView {...{ items, selectedId, onSelect, monthLabel }} />;
}

/* ══ LIST (Tutti) ═══════════════════════════════════════════════════════ */

function ListView({
  items,
  selectedId,
  onSelect,
  monthLabel,
}: {
  items: ItemRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  monthLabel: string;
}) {
  const sorted = [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return (
    <div className="lgrid-wrap">
      <p className="hint">Tutti i contenuti di {monthLabel}, in ordine di data. Per lo stato a colonne usa Pipeline.</p>
      <div className="lgrid">
        {sorted.map((item) => {
          const st = statusOf(item.appr_stato);
          return (
            <div
              key={item.id}
              className={'lcard' + (selectedId === item.id ? ' is-sel' : '') + (item.sponsored ? ' is-spon' : '')}
              tabIndex={0}
              role="button"
              aria-label={`${item.copy || 'Contenuto'} — ${st.label} — ${fmtDay(item.date)}`}
              onClick={() => onSelect(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(item.id);
                }
              }}
            >
              <Thumb item={item} ratio="4/5" />
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
  );
}

/* ══ BOARD (Pipeline) ═══════════════════════════════════════════════════ */

function BoardView({
  clientId,
  items,
  selectedId,
  onSelect,
  pillars,
  groupSizes,
}: {
  clientId: string;
  items: ItemRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  pillars: PillarRow[];
  groupSizes: Record<string, number>;
}) {
  const [overCol, setOverCol] = useState<string | null>(null);

  return (
    <div className="board">
      {STATUSES.map((st) => {
        const inCol = items.filter((i) => (i.appr_stato || 'bozza') === st.id);
        return (
          <div
            key={st.id}
            className={'col' + (overCol === st.id ? ' is-over' : '')}
            data-s={st.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(st.id);
            }}
            onDragLeave={() => setOverCol(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              const id = e.dataTransfer.getData('text/plain');
              const cur = items.find((i) => i.id === id);
              if (!cur || (cur.appr_stato || 'bozza') === st.id) return;
              void patchItem(clientId, id, { appr_stato: st.id });
            }}
          >
            <div className="col-hd">
              <span className="col-token">{st.token}</span>
              <span className="col-name">{st.label}</span>
              <span className="col-n">{inCol.length}</span>
            </div>
            <div className="col-body">
              {inCol.length === 0 && <div className="col-empty">—</div>}
              {inCol.map((item) => {
                const pillar = pillars.find((p) => p.id === item.pillar_id);
                const siblings = groupSizes[item.group_id] ?? 1;
                return (
                  <div
                    key={item.id}
                    className={'card' + (selectedId === item.id ? ' is-sel' : '') + (item.sponsored ? ' is-spon' : '')}
                    tabIndex={0}
                    role="button"
                    aria-label={`${item.copy || 'Contenuto'} — ${st.label}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id);
                      e.dataTransfer.effectAllowed = 'move';
                      document.body.classList.add('is-dragging');
                    }}
                    onDragEnd={() => document.body.classList.remove('is-dragging')}
                    onClick={() => onSelect(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(item.id);
                      }
                    }}
                  >
                    <Thumb item={item} ratio="16/9" />
                    <div className="card-body">
                      <div className="card-meta">
                        <span className="card-date">{fmtDay(item.date)}</span>
                        {siblings > 1 && (
                          <span className="card-links" title={`Su ${siblings} canali`}>
                            <Icon name="link" size={9} />
                            {siblings}
                          </span>
                        )}
                        {pillar && (
                          <span className="ptag">
                            <i style={{ background: pillar.color }} />
                            {pillar.name}
                          </span>
                        )}
                      </div>
                      {item.copy && <p className="card-copy">{item.copy}</p>}
                      {item.client_note && <div className="card-note">{item.client_note}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══ GRID (Griglia) ═══════════════════════════════════════════════════════ */

function GridView({
  clientId,
  account,
  kind,
  items,
  selectedId,
  onSelect,
}: {
  clientId: string;
  account: AccountRow;
  kind: 'feed' | 'story';
  items: ItemRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [order, setOrder] = useState(items);
  const [overId, setOverId] = useState<string | null>(null);
  if (order !== items && order.map((i) => i.id).join() !== items.map((i) => i.id).join()) {
    // Server data changed (new fetch) — resync local drag order.
    setOrder(items);
  }
  const pf = platform(account.platform);

  return (
    <div className="gridview">
      <div className="ggrid" style={{ ['--gcols' as string]: pf.cols }}>
        {order.map((item, i) => (
          <div
            key={item.id}
            className={'gcell' + (selectedId === item.id ? ' is-sel' : '') + (item.sponsored ? ' is-spon' : '') + (overId === item.id ? ' is-over' : '')}
            tabIndex={0}
            role="button"
            aria-label={`Posizione ${i + 1}. ${item.copy || 'Contenuto'}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', item.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(item.id);
            }}
            onDragLeave={() => setOverId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOverId(null);
              const id = e.dataTransfer.getData('text/plain');
              if (!id || id === item.id) return;
              const from = order.findIndex((x) => x.id === id);
              if (from < 0) return;
              const next = order.slice();
              const [moved] = next.splice(from, 1);
              next.splice(i, 0, moved);
              setOrder(next);
              void moveItem(clientId, account.id, kind, next.map((x) => x.id));
            }}
            onClick={() => onSelect(item.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(item.id);
              }
            }}
          >
            <Thumb item={item} ratio={ratioFor(item, account, 'grid')} />
            <div className="gcell-bar">
              <span className="gcell-i">{String(i + 1).padStart(2, '0')}</span>
              <span className="sdot" data-s={item.appr_stato} title={statusOf(item.appr_stato).label} />
              <span className="gcell-date">{fmtDay(item.date)}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="hint">
        {pf.label} · {pf.feed.replace('/', ':')} — trascina per riordinare, questo è l&apos;ordine con cui il profilo verrà letto.
      </p>
    </div>
  );
}
