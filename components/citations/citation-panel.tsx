'use client';

import { useMemo } from 'react';
import type { CitationSource } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FileText, ChevronRight } from 'lucide-react';
import { useCitationViewer } from './citation-context';

interface CitationPanelProps {
  citations: CitationSource[];
  highlightedCitation?: string;
}

export function CitationPanel({ citations, highlightedCitation }: CitationPanelProps) {
  const { openViewer } = useCitationViewer();

  const paperCount = useMemo(() => {
    const papers = new Set(citations.map((c) => c.paperId));
    return papers.size;
  }, [citations]);

  if (citations.length === 0) return null;

  return (
    <button
      onClick={() => openViewer(citations, highlightedCitation || undefined)}
      className={cn(
        'flex items-center gap-2.5 w-full text-left',
        'rounded-lg border bg-card px-3 py-2.5',
        'hover:bg-muted/50 transition-colors cursor-pointer group',
      )}
    >
      <div className="flex items-center justify-center size-8 rounded-md bg-primary/10 shrink-0">
        <FileText className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {citations.length} source{citations.length !== 1 ? 's' : ''}
        </p>
        <p className="text-xs text-muted-foreground">
          from {paperCount} paper{paperCount !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {/* Citation number pills */}
        <div className="flex items-center gap-0.5">
          {citations.slice(0, 5).map((c) => (
            <span
              key={c.citationKey}
              className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-semibold rounded bg-primary/10 text-primary"
            >
              {c.citationKey.replace(/[\[\]]/g, '')}
            </span>
          ))}
          {citations.length > 5 && (
            <span className="text-xs text-muted-foreground ml-0.5">
              +{citations.length - 5}
            </span>
          )}
        </div>
        <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </button>
  );
}
