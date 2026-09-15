import { MONTHS } from '@/lib/dates';

/** URL month param is "YYYY-MM"; everywhere else in the UI it's the Italian label. */
export function parseMonthParam(param: string | undefined): Date {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }
  return new Date();
}

export function monthParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function shiftMonth(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/** Days in the month + Monday-first lead offset for the coverage/calendar grids. */
export function monthMeta(d: Date): { days: number; lead: number } {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  return { days, lead };
}
