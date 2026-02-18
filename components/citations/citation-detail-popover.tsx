'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Sparkles, ExternalLink, Loader2, Plus, BookOpen, Quote } from 'lucide-react';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { CitationSource } from '@/lib/types';

interface RelatedPaper {
  paperId: string;
  title: string;
  authors?: { authorId: string; name: string }[];
  year?: number;
  venue?: string;
  citationCount?: number;
}

interface CitationDetailPopoverProps {
  citation: CitationSource;
  children: React.ReactNode;
}

export function CitationDetailPopover({ citation, children }: CitationDetailPopoverProps) {
  const router = useRouter();
  const [relatedPapers, setRelatedPapers] = useState<RelatedPaper[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [hasLoadedRelated, setHasLoadedRelated] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  const number = citation.citationKey.replace(/[\[\]]/g, '');

  const handleViewInPdf = useCallback(() => {
    router.push(`/library/${citation.paperId}?page=${citation.pageStart}`);
  }, [router, citation.paperId, citation.pageStart]);

  const handleFindRelated = useCallback(async () => {
    if (hasLoadedRelated) return;

    setIsLoadingRelated(true);
    try {
      const query = encodeURIComponent(citation.nodeTitle || citation.paperTitle);
      const res = await fetch(`/api/citations/related?query=${query}&paperId=${citation.paperId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRelatedPapers(data.papers || []);
    } catch {
      setRelatedPapers([]);
    } finally {
      setIsLoadingRelated(false);
      setHasLoadedRelated(true);
    }
  }, [citation.nodeTitle, citation.paperTitle, citation.paperId, hasLoadedRelated]);

  const handleImportPaper = useCallback(async (paper: RelatedPaper) => {
    setImportingId(paper.paperId);
    try {
      const res = await fetch('/api/library/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://api.semanticscholar.org/graph/v1/paper/${paper.paperId}` }),
      });
      if (!res.ok) throw new Error('Import failed');
    } catch {
      // Silent fail — user can try again
    } finally {
      setImportingId(null);
    }
  }, []);

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 space-y-2">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 text-sm font-bold rounded-md bg-primary/10 text-primary shrink-0">
              {number}
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base leading-snug">
                {citation.paperTitle}
              </SheetTitle>
              <SheetDescription className="mt-1 flex items-center gap-1.5">
                <BookOpen className="size-3.5 shrink-0" />
                <span>{citation.nodeTitle}</span>
                <span className="text-muted-foreground/50">&middot;</span>
                <span>
                  pp. {citation.pageStart}
                  {citation.pageEnd !== citation.pageStart && `–${citation.pageEnd}`}
                </span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Separator />

        {/* Scrollable content */}
        <ScrollArea className="flex-1">
          {/* Source excerpt */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Quote className="size-4 text-primary" />
              <h4 className="text-sm font-medium">Source Excerpt</h4>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 border-l-3 border-primary/30">
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {citation.text}
              </p>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="px-5 py-4 flex flex-wrap items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={handleViewInPdf}
            >
              <FileText className="size-3.5" />
              View in PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleFindRelated}
              disabled={isLoadingRelated}
            >
              {isLoadingRelated ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Find Related Papers
            </Button>
          </div>

          {/* Related papers */}
          {hasLoadedRelated && (
            <>
              <Separator />
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="size-4 text-primary" />
                  <h4 className="text-sm font-medium">Related Papers</h4>
                  <span className="text-xs text-muted-foreground">
                    ({relatedPapers.length})
                  </span>
                </div>

                {relatedPapers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No related papers found for this topic.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {relatedPapers.map((paper) => (
                      <div
                        key={paper.paperId}
                        className="rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug line-clamp-2">
                              {paper.title}
                            </p>
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                              {paper.authors && paper.authors.length > 0 && (
                                <span className="truncate max-w-[200px]">
                                  {paper.authors.slice(0, 3).map((a) => a.name).join(', ')}
                                  {paper.authors.length > 3 && ' et al.'}
                                </span>
                              )}
                              {paper.year && (
                                <>
                                  <span className="text-muted-foreground/50">&middot;</span>
                                  <span>{paper.year}</span>
                                </>
                              )}
                              {paper.venue && (
                                <>
                                  <span className="text-muted-foreground/50">&middot;</span>
                                  <span className="truncate max-w-[120px]">{paper.venue}</span>
                                </>
                              )}
                              {paper.citationCount != null && (
                                <>
                                  <span className="text-muted-foreground/50">&middot;</span>
                                  <span>{paper.citationCount} citations</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => handleImportPaper(paper)}
                            disabled={importingId === paper.paperId}
                          >
                            {importingId === paper.paperId ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Plus className="size-3" />
                            )}
                            Add to Library
                          </Button>
                          <a
                            href={`https://www.semanticscholar.org/paper/${paper.paperId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs',
                              'text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
                            )}
                          >
                            <ExternalLink className="size-3" />
                            Semantic Scholar
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
