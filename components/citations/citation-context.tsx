'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { CitationSource } from '@/lib/types';

interface CitationViewerState {
  isOpen: boolean;
  citations: CitationSource[];
  activeCitationKey: string | null;
}

interface CitationContextValue {
  state: CitationViewerState;
  openViewer: (citations: CitationSource[], citationKey?: string) => void;
  closeViewer: () => void;
  setActiveCitation: (citationKey: string) => void;
}

const CitationContext = createContext<CitationContextValue | null>(null);

export function CitationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CitationViewerState>({
    isOpen: false,
    citations: [],
    activeCitationKey: null,
  });

  const openViewer = useCallback((citations: CitationSource[], citationKey?: string) => {
    setState({
      isOpen: true,
      citations,
      activeCitationKey: citationKey || citations[0]?.citationKey || null,
    });
  }, []);

  const closeViewer = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const setActiveCitation = useCallback((citationKey: string) => {
    setState((prev) => ({ ...prev, activeCitationKey: citationKey }));
  }, []);

  return (
    <CitationContext.Provider value={{ state, openViewer, closeViewer, setActiveCitation }}>
      {children}
    </CitationContext.Provider>
  );
}

export function useCitationViewer() {
  const context = useContext(CitationContext);
  if (!context) {
    throw new Error('useCitationViewer must be used within a CitationProvider');
  }
  return context;
}
