import type { ApprStato, ContentType, Platform } from '@/lib/supabase/types';

/** Ported from legacy/src/app/core.js's PLATFORMS. */
export const PLATFORMS: Record<Platform, { label: string; feed: string; cols: number }> = {
  Instagram: { label: 'Instagram', feed: '4/5', cols: 3 },
  Facebook: { label: 'Facebook', feed: '1/1', cols: 3 },
  TikTok: { label: 'TikTok', feed: '9/16', cols: 4 },
  LinkedIn: { label: 'LinkedIn', feed: '1/1', cols: 3 },
  YouTube: { label: 'YouTube', feed: '16/9', cols: 2 },
  Pinterest: { label: 'Pinterest', feed: '2/3', cols: 4 },
  Threads: { label: 'Threads', feed: '4/5', cols: 3 },
};
export const STORY_RATIO = '9/16';

export function platform(p: string | null | undefined) {
  return PLATFORMS[(p as Platform) ?? 'Instagram'] ?? PLATFORMS.Instagram;
}

/** GRID always uses the account's feed ratio; DETAIL uses the item's true shape (a reel/story is 9:16). */
export function ratioFor(
  item: { kind?: string; type?: string } | null,
  acc: { platform: Platform } | null,
  context: 'grid' | 'detail'
): string {
  const feed = platform(acc?.platform).feed;
  if (context === 'grid' || !item) return feed;
  if (item.kind === 'story' || item.type === 'reel') return STORY_RATIO;
  return feed;
}

export const STATUSES: { id: ApprStato; token: string; label: string; hint: string }[] = [
  { id: 'bozza', token: '[··]', label: 'Bozza', hint: 'In lavorazione, non ancora inviato al cliente' },
  { id: 'approvare', token: '[??]', label: 'Da approvare', hint: 'Inviato al cliente, in attesa di risposta' },
  { id: 'revisione', token: '[!!]', label: 'In revisione', hint: 'Il cliente ha chiesto una modifica' },
  { id: 'approvato', token: '[OK]', label: 'Approvato', hint: 'Approvato dal cliente, pronto a uscire' },
  { id: 'pubblicato', token: '[>>]', label: 'Pubblicato', hint: 'Uscito online' },
];

export function statusOf(id: ApprStato | null | undefined) {
  return STATUSES.find((s) => s.id === id) || STATUSES[0];
}

export const TYPES: { id: ContentType; label: string; color: string }[] = [
  { id: 'photo', label: 'Foto', color: '#2DA7A7' },
  { id: 'carousel', label: 'Carosello', color: '#8B7BD8' },
  { id: 'reel', label: 'Video / Reel', color: '#e40e49' },
];

export function fmtDay(iso: string | null | undefined): string {
  const p = String(iso || '').split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}` : '—';
}

/** Fields that describe the CONTENT, kept identical across every channel a post goes out on. */
export const SHARED_FIELDS = [
  'url', 'external_url', 'video_url', 'slides',
  'copy', 'note', 'date', 'pillar_id', 'format_id',
  'type', 'sponsored',
] as const;
