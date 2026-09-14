'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';

/**
 * The studio-chrome light/dark toggle (separate from a client's own portal
 * background choice). A per-device preference, not shared data, so this
 * stays client-side — localStorage + a data-theme attribute on <html>,
 * same mechanism the legacy app used, just without the localStorage-as-database
 * baggage that came with it there.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('ideology-theme') as 'light' | 'dark' | null) || 'light';
  });

  // Root layout hardcodes data-theme="light" for the first paint (matches
  // the lazy-init fallback above, so no flash for the common case) — this
  // effect is what actually applies a restored 'dark' preference.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('ideology-theme', next);
  }

  const isLight = theme === 'light';
  return (
    <button
      className="rail-link"
      title={isLight ? 'Passa al tema scuro' : 'Passa al tema chiaro'}
      onClick={toggle}
      type="button"
    >
      <Icon name={isLight ? 'moon' : 'sun'} size={12} />
      <span>{isLight ? 'Scuro' : 'Chiaro'}</span>
    </button>
  );
}
