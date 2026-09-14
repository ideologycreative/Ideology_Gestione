'use client';

import type { ReactNode } from 'react';
import { useInspector } from '@/components/InspectorContext';

/**
 * The header/view/inspector/status regions of app.css's `.app` grid — every
 * page renders one of these as its top-level output, as a sibling of
 * <RailNav> under the shared `.app` container in (app)/layout.tsx. Header
 * and status are contextual per legacy/src/app/shell.js ("empty on Home and
 * Settings"); a page that has nothing for them just omits the props.
 */
export function PageFrame({
  header,
  status,
  children,
}: {
  header?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
}) {
  const { content: inspectorContent } = useInspector();

  return (
    <>
      <header id="header" className={header ? '' : 'is-bare'}>
        {header}
      </header>
      <main id="view" tabIndex={-1}>
        {children}
      </main>
      <aside id="inspector" className={inspectorContent ? 'is-open' : ''} aria-label="Dettaglio contenuto">
        {inspectorContent}
      </aside>
      <footer id="status" className={status ? '' : 'is-bare'}>
        {status}
      </footer>
    </>
  );
}
