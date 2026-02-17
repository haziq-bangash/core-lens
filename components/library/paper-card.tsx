'use client';

import React from 'react';
import { FileText, Calendar, Users, BookOpen, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PaperStatusBadge } from './paper-status-badge';
import { cn } from '@/lib/utils';
import type { Paper } from '@/lib/db/schema';

interface PaperCardProps {
  paper: Paper;
  isSelected: boolean;
  onClick: () => void;
}

export function PaperCard({ paper, isSelected, onClick }: PaperCardProps) {
  const isProcessing = paper.status !== 'ready' && paper.status !== 'failed';

  return (
    <Card
      onClick={onClick}
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group relative overflow-hidden',
        isSelected && 'border-primary/50 shadow-md ring-1 ring-primary/20',
        isProcessing && 'animate-pulse',
      )}
    >
      {/* Top color accent bar */}
      <div
        className={cn(
          'h-1 w-full',
          paper.status === 'ready' && 'bg-emerald-500/60',
          paper.status === 'failed' && 'bg-destructive/60',
          isProcessing && 'bg-blue-500/60',
          paper.status === 'pending' && 'bg-muted-foreground/30',
        )}
      />

      <CardContent className="p-4 space-y-2.5">
        {/* Status badge - top right */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold line-clamp-2 leading-snug flex-1">
            {paper.title || paper.fileName || 'Untitled Paper'}
          </h3>
          <PaperStatusBadge status={paper.status} />
        </div>

        {/* Authors */}
        {paper.authors && paper.authors.length > 0 && (
          <p className="text-xs text-muted-foreground truncate">
            {paper.authors.slice(0, 3).join(', ')}
            {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
          </p>
        )}

        {/* Metadata chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {paper.year && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/80 rounded-md px-1.5 py-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {paper.year}
            </span>
          )}
          {paper.journal && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/80 rounded-md px-1.5 py-0.5 truncate max-w-32">
              <BookOpen className="h-2.5 w-2.5 shrink-0" />
              {paper.journal}
            </span>
          )}
          {paper.totalPages && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/80 rounded-md px-1.5 py-0.5">
              <FileText className="h-2.5 w-2.5" />
              {paper.totalPages} pp
            </span>
          )}
        </div>

        {/* Abstract preview - only when ready */}
        {paper.abstract && paper.status === 'ready' && (
          <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed">
            {paper.abstract}
          </p>
        )}

        {/* Processing indicator for non-ready papers */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>
              {paper.status === 'extracting_metadata'
                ? 'Extracting metadata...'
                : paper.status === 'indexing'
                  ? 'Indexing content...'
                  : 'Processing...'}
            </span>
          </div>
        )}

        {/* Error message */}
        {paper.status === 'failed' && paper.error && (
          <p className="text-xs text-destructive line-clamp-1">{paper.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
