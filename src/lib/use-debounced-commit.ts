'use client';

import { useRef } from 'react';

/**
 * Same trade as legacy/src/app/sections.js's debounced() — a text commit
 * shouldn't fire on every keystroke, but two different fields edited within
 * the window must each still land (a single shared timer silently dropped
 * whichever field committed first — the bug that file's own comment
 * documents). Keyed per field here for the same reason.
 */
export function useDebouncedCommit() {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  return function debounced(key: string, fn: () => void, delay = 260) {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, delay);
  };
}
