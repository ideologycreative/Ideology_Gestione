'use client';

import { useEffect, useRef, useState } from 'react';
import { MONTHS } from '@/lib/dates';
import { monthLabel } from '@/lib/month-param';

/**
 * React port of legacy/src/shared/monthpicker.js — same CSS classes (styled
 * via src/styles/monthpicker.css, ported as-is), same anatomy: a trigger
 * showing the current label, a popover with a year stepper over a 12-month
 * grid. The "which months already have content" dots aren't wired up yet —
 * a nice-to-have, not blocking.
 */
export function MonthPicker({ value, onPick }: { value: Date; onPick: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(value.getFullYear());
  const ref = useRef<HTMLDivElement>(null);

  // Subscribes to outside clicks only while open — a genuine external-system
  // subscription, not a state sync, so this stays in the effect.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const now = new Date();

  return (
    <div className={'mp' + (open ? ' is-open' : '')} ref={ref}>
      <button
        type="button"
        className="mp-btn"
        onClick={() => {
          // Resets the popover's year to match the current value — done
          // here, at the moment the user opens it (a real user event),
          // rather than via a setState-in-effect keyed on `open`.
          if (!open) setYear(value.getFullYear());
          setOpen((o) => !o);
        }}
      >
        {monthLabel(value)}
        <span className="mp-caret">▾</span>
      </button>
      <div className="mp-pop">
        <div className="mp-yr">
          <button type="button" className="mp-step" onClick={() => setYear((y) => y - 1)} aria-label="Anno precedente">
            ‹
          </button>
          <span className="mp-yr-v">{year}</span>
          <button type="button" className="mp-step" onClick={() => setYear((y) => y + 1)} aria-label="Anno successivo">
            ›
          </button>
        </div>
        <div className="mp-grid">
          {MONTHS.map((label, i) => {
            const isOn = value.getFullYear() === year && value.getMonth() === i;
            const isNow = now.getFullYear() === year && now.getMonth() === i;
            return (
              <button
                key={label}
                type="button"
                className={'mp-m' + (isOn ? ' is-on' : '') + (isNow ? ' is-now' : '')}
                onClick={() => {
                  onPick(new Date(year, i, 1));
                  setOpen(false);
                }}
              >
                {label.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="mp-today"
          onClick={() => {
            onPick(new Date(now.getFullYear(), now.getMonth(), 1));
            setOpen(false);
          }}
        >
          Oggi
        </button>
      </div>
    </div>
  );
}
