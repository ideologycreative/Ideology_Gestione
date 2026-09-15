import { TYPES } from '@/lib/platforms';
import type { ApprStato } from '@/lib/supabase/types';

export type CoverageEntry = {
  id: string;
  kind: 'feed' | 'story';
  type: string;
  platforms: string[];
  stato: ApprStato;
  sponsored: boolean;
};

export const STORY_COLOR = '#f37c7b';

/** No server-only imports on purpose — used from client components too (e.g. CalendarCoverage). */
export function typeColor(type: string) {
  return TYPES.find((t) => t.id === type)?.color ?? TYPES[0].color;
}

export function entryColor(e: CoverageEntry) {
  if (e.sponsored) return 'var(--brand)';
  if (e.kind === 'story') return STORY_COLOR;
  return typeColor(e.type);
}
