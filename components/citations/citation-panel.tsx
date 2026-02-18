'use client';

import { useState } from 'react';
import type { CitationSource } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FileText, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CitationDetailPopover } from './citation-detail-popover';

interface CitationPanelProps {
  citations: CitationSource[];
  onClose?: () => void;
  highlightedCitation?: string;
}

export function CitationPanel({ citations, onClose, highlightedCitation }: CitationPanelProps) {
  const [expandedPapers, setExpandedPapers] = useState<Set<string>>(new Set());

  if (citations.length === 0) return null;

  // Group citations by paper
  const grouped = citations.reduce(
    (acc, citation) => {
      const key = citation.paperId;
      if (!acc[key]) {
        acc[key] = {
          paperTitle: citation.paperTitle,
          paperId: citation.paperId,
          citations: [],
        };
      }
      acc[key].citations.push(citation);
      return acc;
    },
    {} as Record<string, { paperTitle: string; paperId: string; citations: CitationSource[] }>,
  );

  const togglePaper = (paperId: string) => {
    setExpandedPapers((prev) => {
      const next = new Set(prev);
      if (next.has(paperId)) {
        next.delete(paperId);
      } else {
        next.add(paperId);
      }
      return next;
    });
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <h3 className="text-sm font-semibold">Sources ({citations.length})</h3>
        {onClose && (
          <Button variant="ghost" size="icon" className="size-6" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        )}
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {Object.values(grouped).map((group) => {
          const isExpanded = expandedPapers.has(group.paperId);
          return (
            <div key={group.paperId} className="border-b last:border-b-0">
              <button
                onClick={() => togglePaper(group.paperId)}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/50 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <FileText className="size-4 shrink-0 text-primary" />
                <span className="text-sm font-medium truncate">{group.paperTitle}</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {group.citations.length} ref{group.citations.length !== 1 ? 's' : ''}
                </span>
              </button>
              {isExpanded && (
                <div className="px-3 pb-2 space-y-1.5">
                  {group.citations.map((citation) => (
                    <CitationDetailPopover key={citation.citationKey} citation={citation}>
                      <button
                        id={`citation-${citation.citationKey.replace(/[\[\]]/g, '')}`}
                        className={cn(
                          'rounded p-2 text-xs transition-colors w-full text-left cursor-pointer',
                          'hover:bg-primary/5',
                          highlightedCitation === citation.citationKey
                            ? 'bg-primary/10 ring-1 ring-primary/30'
                            : 'bg-muted/30',
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="inline-flex items-center justify-center min-w-5 h-4 px-1 text-[10px] font-semibold rounded bg-primary/10 text-primary">
                            {citation.citationKey.replace(/[\[\]]/g, '')}
                          </span>
                          <span className="font-medium text-foreground truncate">
                            {citation.nodeTitle}
                          </span>
                          <span className="text-muted-foreground ml-auto shrink-0">
                            pp. {citation.pageStart}
                            {citation.pageEnd !== citation.pageStart && `–${citation.pageEnd}`}
                          </span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed line-clamp-3 border-l-2 border-primary/20 pl-2">
                          {citation.text}
                        </p>
                      </button>
                    </CitationDetailPopover>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
