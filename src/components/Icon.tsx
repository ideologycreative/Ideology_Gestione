/**
 * Ported 1:1 from legacy/src/app/core.js's ICONS map + icon() helper —
 * same paths, same viewBox, same stroke styling. Static, developer-authored
 * SVG path data only (never user input), so dangerouslySetInnerHTML here
 * carries none of the risk it would with untrusted content.
 */
const ICONS: Record<string, string> = {
  home: '<path d="M3 11l9-8 9 8M6 10v10h12V10"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0114 0M17 5.5a3.5 3.5 0 010 7M18 20a6 6 0 00-2-4.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5M3 13l9 5 9-5M3 17l9 5 9-5"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
  cog: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  board: '<path d="M3 3h5v18H3zM10 3h5v12h-5zM17 3h4v7h-4"/>',
  grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7"/>',
  rows: '<path d="M3 5h18M3 12h18M3 19h18"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
  clapper: '<path d="M3 10h18v10H3zM3 10l2-6h4l-2 6M11 10l2-6h4l-2 6M19 10l1.5-4.5"/>',
  calendar: '<path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  link: '<path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>',
  copy: '<path d="M9 9h11v11H9zM5 15H4V4h11v1"/>',
  image: '<path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6"/><circle cx="8.5" cy="8.5" r="1.5"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  external: '<path d="M14 4h6v6M20 4l-8 8M18 14v6H4V6h6"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/>',
  megaphone: '<path d="M3 10v4h3l7 4V6l-7 4H3zM17 9a4 4 0 010 6"/>',
};

export function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }}
    />
  );
}
