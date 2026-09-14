/** Ported from legacy/src/app/core.js — same rules, unchanged. */

export function initials(name: string | null | undefined): string {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Only http(s) and data:image URLs may reach a src — a stored "javascript:" URL becomes script execution otherwise. */
export function safeUrl(u: string | null | undefined): string {
  const s = String(u || '').trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,/i.test(s)) return s;
  return '';
}

/** Same gate for video sources, with video MIME types (and blob: for in-session previews). */
export function safeVideoUrl(u: string | null | undefined): string {
  const s = String(u || '').trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^data:video\/(mp4|webm|ogg|quicktime);base64,/i.test(s)) return s;
  if (/^blob:/i.test(s)) return s;
  return '';
}

/** Contrast for text sitting on a client's own colour — relative luminance, not a guess. */
export function onColor(hex: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#101010';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) > 0.38 ? '#101010' : '#f2f2f2';
}
