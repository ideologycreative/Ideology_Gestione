'use client';

import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { MonthPicker } from '@/components/content/MonthPicker';
import { TYPES, statusOf } from '@/lib/platforms';
import { STORY_COLOR, entryColor, type CoverageEntry } from '@/lib/calendar-color';
import { monthParam, parseMonthParam, monthLabel, monthMeta, shiftMonth } from '@/lib/month-param';
import type { Database } from '@/lib/supabase/types';

type ClientRow = Database['public']['Tables']['clients']['Row'];

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export function CalendarCoverage({ client, byDay }: { client: ClientRow; byDay: Record<number, CoverageEntry[]> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const month = parseMonthParam(searchParams.get('month') ?? undefined);
  const meta = monthMeta(month);
  const label = monthLabel(month);

  const daysCovered = Object.keys(byDay).length;
  const total = Object.values(byDay).reduce((n, list) => n + list.length, 0);
  const sponsored = Object.values(byDay).reduce((n, list) => n + list.filter((x) => x.sponsored).length, 0);

  function pushMonth(d: Date) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('month', monthParam(d));
    router.push(`${pathname}?${next.toString()}`);
  }

  const today = new Date();
  const isThisMonth = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth();

  return (
    <div className="page">
      <Link href="/calendar" className="back">
        <Icon name="left" size={12} />
        Tutti i clienti
      </Link>

      <div className="page-hd">
        <div>
          <h1 className="page-title">{client.name}</h1>
          <p className="page-sub">
            {label} · {daysCovered} giorni coperti su {meta.days} · {total} contenuti
            {sponsored ? ` · ${sponsored} sponsorizzati` : ''}
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <Link href={`/content/${client.id}`} className="btn">
          <Icon name="layers" size={13} />
          Pianifica
        </Link>
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
        <div style={{ flex: 1 }} />
        <div className="legend">
          {TYPES.map((t) => (
            <span className="legend-i" key={t.id}>
              <i className="dot" style={{ background: t.color }} />
              {t.label}
            </span>
          ))}
          <span className="legend-i">
            <i className="dot" style={{ background: STORY_COLOR }} />
            Storia
          </span>
          <span className="legend-i">
            <i className="dot dot--spon" />
            Sponsorizzato
          </span>
        </div>
      </div>

      <div className="cov">
        {WEEKDAYS.map((d) => (
          <div className="cov-hd" key={d}>
            {d}
          </div>
        ))}
        {Array.from({ length: meta.lead }).map((_, i) => (
          <div className="cov-cell cov-cell--pad" key={`pad-${i}`} />
        ))}
        {Array.from({ length: meta.days }).map((_, i) => {
          const day = i + 1;
          const list = byDay[day] ?? [];
          const hasSpon = list.some((x) => x.sponsored);
          const ordered = [...list].sort((a, b) => (b.sponsored ? 1 : 0) - (a.sponsored ? 1 : 0));
          const title = list.length
            ? `${day}: ${list.map((x) => `${x.sponsored ? 'Sponsorizzato' : x.kind === 'story' ? 'Storia' : (TYPES.find((t) => t.id === x.type)?.label ?? x.type)} (${x.platforms.join(', ')})`).join(', ')}`
            : `${day}: nessun contenuto`;

          return (
            <Link
              key={day}
              href={`/content/${client.id}`}
              className={'cov-cell' + (list.length ? ' is-full' : '') + (hasSpon ? ' is-spon' : '') + (isThisMonth && today.getDate() === day ? ' is-today' : '')}
              title={title}
              aria-label={`${day}, ${list.length} contenuti`}
            >
              <span className="cov-day">{String(day).padStart(2, '0')}</span>
              {list.length > 0 && (
                <span className="cov-dots">
                  {ordered.slice(0, 8).map((x) => (
                    <i
                      key={x.id}
                      className={'dot' + (x.sponsored ? ' dot--spon' : '')}
                      style={{ background: entryColor(x) }}
                      title={`${x.sponsored ? 'Sponsorizzato' : x.kind === 'story' ? 'Storia' : (TYPES.find((t) => t.id === x.type)?.label ?? x.type)} · ${x.platforms.join(', ')} · ${statusOf(x.stato).label}`}
                    />
                  ))}
                  {ordered.length > 8 && <span className="cov-more">+{ordered.length - 8}</span>}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
