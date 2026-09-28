'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type InspectorState = {
  content: ReactNode | null;
  open: (node: ReactNode) => void;
  close: () => void;
};

const InspectorCtx = createContext<InspectorState | null>(null);

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);

  // The inspector is a modal now (see PageFrame/app.css's #inspector-scrim)
  // — Escape closes it same as clicking outside or its own close button.
  useEffect(() => {
    if (!content) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setContent(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [content]);

  return (
    <InspectorCtx.Provider value={{ content, open: setContent, close: () => setContent(null) }}>
      {children}
    </InspectorCtx.Provider>
  );
}

export function useInspector() {
  const ctx = useContext(InspectorCtx);
  if (!ctx) throw new Error('useInspector must be used within InspectorProvider');
  return ctx;
}
