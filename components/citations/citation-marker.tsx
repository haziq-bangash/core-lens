'use client';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { CitationSource } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

interface CitationMarkerProps {
  citationKey: string;
  citation?: CitationSource;
  onClick?: () => void;
}

export function CitationMarker({ citationKey, citation, onClick }: CitationMarkerProps) {
  const number = citationKey.replace(/[\[\]]/g, '');

  if (!citation) {
    return (
      <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-semibold rounded bg-muted text-muted-foreground cursor-default">
        {number}
      </span>
    );
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1',
            'text-[10px] font-semibold rounded',
            'bg-primary/10 text-primary hover:bg-primary/20',
            'cursor-pointer transition-colors align-super',
          )}
        >
          {number}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-80 p-3">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <FileText className="size-4 mt-0.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight truncate">{citation.paperTitle}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {citation.nodeTitle} &middot; pp. {citation.pageStart}
                {citation.pageEnd !== citation.pageStart && `–${citation.pageEnd}`}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 border-l-2 border-primary/20 pl-2">
            {citation.text}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
