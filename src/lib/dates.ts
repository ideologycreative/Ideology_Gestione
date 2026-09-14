export const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

export function thisMonthLabel(d = new Date()): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** [firstOfMonth, firstOfNextMonth) as YYYY-MM-DD, for a `date >= a AND date < b` range filter. */
export function monthBounds(d = new Date()): { start: string; end: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const iso = (yy: number, mm: number) => `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
  return m === 11 ? { start: iso(y, 11), end: iso(y + 1, 0) } : { start: iso(y, m), end: iso(y, m + 1) };
}
