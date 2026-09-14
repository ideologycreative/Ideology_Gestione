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

  // The CSS grid only makes room for the inspector column when
  // body.has-inspector is set (see app.css's .app rule) — same mechanism
  // the legacy app used.
  useEffect(() => {
    document.body.classList.toggle('has-inspector', content != null);
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
