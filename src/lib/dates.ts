export const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

export function thisMonthLabel(d = new Date()): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12 Settembre 2026" — the client portal's platform post-view detail date. */
export function longDate(iso: string | null | undefined): string {
  const p = String(iso || '').split('-');
  if (p.length !== 3) return '';
  return `${parseInt(p[2], 10)} ${MONTHS[parseInt(p[1], 10) - 1]} ${p[0]}`;
}

/** [firstOfMonth, firstOfNextMonth) as YYYY-MM-DD, for a `date >= a AND date < b` range filter. */
export function monthBounds(d = new Date()): { start: string; end: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const iso = (yy: number, mm: number) => `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
  return m === 11 ? { start: iso(y, 11), end: iso(y + 1, 0) } : { start: iso(y, m), end: iso(y, m + 1) };
}
