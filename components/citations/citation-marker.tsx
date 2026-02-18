'use client';

import type { CitationSource } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCitationViewer } from './citation-context';

interface CitationMarkerProps {
  citationKey: string;
  citation?: CitationSource;
  allCitations?: CitationSource[];
}

export function CitationMarker({
  citationKey,
  citation,
  allCitations,
}: CitationMarkerProps) {
  const { openViewer } = useCitationViewer();
  const number = citationKey.replace(/[\[\]]/g, '');

  if (!citation) {
    return (
      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-semibold rounded bg-muted text-muted-foreground cursor-default">
        {number}
      </span>
    );
  }

  const handleClick = () => {
    const citations = allCitations || [citation];
    openViewer(citations, citationKey);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center min-w-5 h-5 px-1',
        'text-[10px] font-semibold rounded',
        'bg-primary/10 text-primary hover:bg-primary/20',
        'cursor-pointer transition-colors align-super',
      )}
    >
      {number}
    </button>
  );
}
