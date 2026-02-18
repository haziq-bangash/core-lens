'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Sparkles,
  ExternalLink,
  Loader2,
  Plus,
  BookOpen,
  Quote,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCitationViewer } from './citation-context';
import type { CitationSource } from '@/lib/types';

interface RelatedPaper {
  paperId: string;
  title: string;
  authors?: { authorId: string; name: string }[];
  year?: number;
  venue?: string;
  citationCount?: number;
}

function CitationNav({
  citations,
  activeCitationKey,
  onSelect,
}: {
  citations: CitationSource[];
  activeCitationKey: string | null;
  onSelect: (key: string) => void;
}) {
  const activeIndex = citations.findIndex((c) => c.citationKey === activeCitationKey);

  const goPrev = () => {
    if (activeIndex > 0) onSelect(citations[activeIndex - 1].citationKey);
  };
  const goNext = () => {
    if (activeIndex < citations.length - 1) onSelect(citations[activeIndex + 1].citationKey);
  };

  if (citations.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={goPrev}
        disabled={activeIndex <= 0}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div className="flex items-center gap-0.5 overflow-x-auto max-w-50 scrollbar-none">
        {citations.map((c) => {
          const num = c.citationKey.replace(/[\[\]]/g, '');
          return (
            <button
              key={c.citationKey}
              onClick={() => onSelect(c.citationKey)}
              className={cn(
                'inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-xs font-semibold rounded-md transition-colors shrink-0',
                c.citationKey === activeCitationKey
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {num}
            </button>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={goNext}
        disabled={activeIndex >= citations.length - 1}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

function CitationViewerContent() {
  const router = useRouter();
  const { state, setActiveCitation } = useCitationViewer();
  const { citations, activeCitationKey } = state;

  const activeCitation = useMemo(
    () => citations.find((c) => c.citationKey === activeCitationKey) || citations[0],
    [citations, activeCitationKey],
  );

  const [relatedPapers, setRelatedPapers] = useState<RelatedPaper[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [loadedRelatedFor, setLoadedRelatedFor] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  // Reset related papers when active citation changes to a different paper
  useEffect(() => {
    if (activeCitation && loadedRelatedFor !== activeCitation.paperId) {
      setRelatedPapers([]);
      setLoadedRelatedFor(null);
    }
  }, [activeCitation, loadedRelatedFor]);

  const handleViewInPdf = useCallback(() => {
    if (!activeCitation) return;
    router.push(`/library/${activeCitation.paperId}?page=${activeCitation.pageStart}`);
  }, [router, activeCitation]);

  const handleFindRelated = useCallback(async () => {
    if (!activeCitation || loadedRelatedFor === activeCitation.paperId) return;

    setIsLoadingRelated(true);
    try {
      const query = encodeURIComponent(
        activeCitation.nodeTitle || activeCitation.paperTitle,
      );
      const res = await fetch(
        `/api/citations/related?query=${query}&paperId=${activeCitation.paperId}`,
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRelatedPapers(data.papers || []);
      setLoadedRelatedFor(activeCitation.paperId);
    } catch {
      setRelatedPapers([]);
    } finally {
      setIsLoadingRelated(false);
    }
  }, [activeCitation, loadedRelatedFor]);

  const handleImportPaper = useCallback(async (paper: RelatedPaper) => {
    setImportingId(paper.paperId);
    try {
      const res = await fetch('/api/library/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `https://api.semanticscholar.org/graph/v1/paper/${paper.paperId}`,
        }),
      });
      if (!res.ok) throw new Error('Import failed');
    } catch {
      // Silent fail
    } finally {
      setImportingId(null);
    }
  }, []);

  if (!activeCitation) return null;

  const number = activeCitation.citationKey.replace(/[\[\]]/g, '');

  return (
    <div className="flex flex-col h-full">
      {/* Citation nav + header */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 text-sm font-bold rounded-md bg-primary/10 text-primary shrink-0">
              {number}
            </span>
            <span className="text-xs text-muted-foreground">
              of {citations.length} source{citations.length !== 1 ? 's' : ''}
            </span>
          </div>
          <CitationNav
            citations={citations}
            activeCitationKey={activeCitationKey}
            onSelect={setActiveCitation}
          />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug line-clamp-2">
            {activeCitation.paperTitle}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="size-3.5 shrink-0" />
            <span className="truncate">{activeCitation.nodeTitle}</span>
            <span className="text-muted-foreground/50">&middot;</span>
            <span className="shrink-0">
              pp. {activeCitation.pageStart}
              {activeCitation.pageEnd !== activeCitation.pageStart &&
                `\u2013${activeCitation.pageEnd}`}
              </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Tabbed content */}
      <Tabs defaultValue="excerpt" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-3 w-auto">
          <TabsTrigger value="excerpt" className="gap-1.5">
            <Quote className="size-3.5" />
            Excerpt
          </TabsTrigger>
          <TabsTrigger value="pdf" className="gap-1.5">
            <FileText className="size-3.5" />
            View PDF
          </TabsTrigger>
          <TabsTrigger value="related" className="gap-1.5">
            <Sparkles className="size-3.5" />
            Related
          </TabsTrigger>
        </TabsList>

        {/* Excerpt tab */}
        <TabsContent value="excerpt" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="px-4 py-4">
              <div className="rounded-lg bg-muted/50 p-4 border-l-3 border-primary/30">
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {activeCitation.text}
                </p>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 w-full"
                  onClick={handleViewInPdf}
                >
                  <FileText className="size-3.5" />
                  Open in PDF Viewer
                </Button>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* PDF tab */}
        <TabsContent value="pdf" className="flex-1 min-h-0">
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 gap-4">
            <div className="rounded-full bg-muted p-4">
              <FileText className="size-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-sm font-medium">View Source in PDF</p>
              <p className="text-xs text-muted-foreground max-w-62.5">
                Open the full paper in the PDF viewer, jumping directly to page{' '}
                {activeCitation.pageStart}.
              </p>
            </div>
            <Button className="gap-1.5" onClick={handleViewInPdf}>
              <FileText className="size-4" />
              Open PDF at Page {activeCitation.pageStart}
            </Button>
          </div>
        </TabsContent>

        {/* Related tab */}
        <TabsContent value="related" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="px-4 py-4">
              {!loadedRelatedFor || loadedRelatedFor !== activeCitation.paperId ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <div className="rounded-full bg-muted p-4">
                    <Sparkles className="size-8 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-1.5">
                    <p className="text-sm font-medium">Discover Related Papers</p>
                    <p className="text-xs text-muted-foreground max-w-62.5">
                      Find papers similar to this source using Semantic Scholar.
                    </p>
                  </div>
                  <Button
                    className="gap-1.5"
                    onClick={handleFindRelated}
                    disabled={isLoadingRelated}
                  >
                    {isLoadingRelated ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Find Related Papers
                  </Button>
                </div>
              ) : relatedPapers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No related papers found for this source.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    {relatedPapers.length} related paper
                    {relatedPapers.length !== 1 ? 's' : ''} found
                  </p>
                  {relatedPapers.map((paper) => (
                    <div
                      key={paper.paperId}
                      className="rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-sm font-medium leading-snug line-clamp-2">
                        {paper.title}
                      </p>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                        {paper.authors && paper.authors.length > 0 && (
                          <span className="truncate max-w-50">
                            {paper.authors
                              .slice(0, 3)
                              .map((a) => a.name)
                              .join(', ')}
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
                            <span className="truncate max-w-30">{paper.venue}</span>
                          </>
                        )}
                        {paper.citationCount != null && (
                          <>
                            <span className="text-muted-foreground/50">&middot;</span>
                            <span>{paper.citationCount} citations</span>
                          </>
                        )}
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
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function CitationViewer() {
  const isMobile = useIsMobile();
  const { state, closeViewer } = useCitationViewer();

  if (isMobile) {
    return (
      <Drawer open={state.isOpen} onOpenChange={(open) => !open && closeViewer()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Source Details</DrawerTitle>
            <DrawerDescription>View citation source details</DrawerDescription>
          </DrawerHeader>
          <CitationViewerContent />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={state.isOpen} onOpenChange={(open) => !open && closeViewer()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>Source Details</SheetTitle>
          <SheetDescription>View citation source details</SheetDescription>
        </SheetHeader>
        <CitationViewerContent />
      </SheetContent>
    </Sheet>
  );
}
