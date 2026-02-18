'use client';

import type { CitationSource } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CitationDetailPopover } from './citation-detail-popover';

interface CitationMarkerProps {
  citationKey: string;
  citation?: CitationSource;
}

export function CitationMarker({ citationKey, citation }: CitationMarkerProps) {
  const number = citationKey.replace(/[\[\]]/g, '');

  if (!citation) {
    return (
      <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-semibold rounded bg-muted text-muted-foreground cursor-default">
        {number}
      </span>
    );
  }

  return (
    <CitationDetailPopover citation={citation}>
      <button
        className={cn(
          'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1',
          'text-[10px] font-semibold rounded',
          'bg-primary/10 text-primary hover:bg-primary/20',
          'cursor-pointer transition-colors align-super',
        )}
      >
        {number}
      </button>
    </CitationDetailPopover>
  );
}
