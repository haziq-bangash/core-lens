'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, ExternalLink, Users, Calendar, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface SimilarPaper {
  paperId: string;
  title: string;
  authors: string[];
  year?: number;
  abstract?: string;
  doi?: string;
  venue?: string;
  citationCount?: number;
  openAccessPdfUrl?: string | null;
}

interface DiscoveryPanelProps {
  paperId: string;
}

export function DiscoveryPanel({ paperId }: DiscoveryPanelProps) {
  const queryClient = useQueryClient();

  const {
    data: similarData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['similar-papers', paperId],
    queryFn: async () => {
      const res = await fetch(`/api/library/${paperId}/similar`);
      if (!res.ok) throw new Error('Failed to fetch similar papers');
      return res.json() as Promise<{ papers: SimilarPaper[] }>;
    },
    enabled: false, // Don't fetch automatically — user clicks "Find Similar"
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const importMutation = useMutation({
    mutationFn: async (paper: SimilarPaper) => {
      const res = await fetch('/api/library/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doi: paper.doi || undefined,
          url: paper.openAccessPdfUrl || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to import');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Paper imported to library');
      queryClient.invalidateQueries({ queryKey: ['papers'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const papers = similarData?.papers ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Related Papers
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {papers.length > 0 ? 'Refresh' : 'Find Similar'}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive">
          Failed to find similar papers. Try again later.
        </p>
      )}

      {papers.length > 0 && (
        <div className="space-y-2">
          {papers.map((paper) => (
            <div
              key={paper.paperId}
              className="rounded-md border p-3 space-y-1.5 hover:bg-muted/30 transition-colors"
            >
              <h5 className="text-sm font-medium leading-tight">{paper.title}</h5>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {paper.authors.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {paper.authors.slice(0, 3).join(', ')}
                    {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
                  </span>
                )}
                {paper.year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {paper.year}
                  </span>
                )}
                {paper.venue && (
                  <span className="flex items-center gap-1 truncate max-w-[150px]">
                    <BookOpen className="h-3 w-3 shrink-0" />
                    {paper.venue}
                  </span>
                )}
                {paper.citationCount != null && paper.citationCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {paper.citationCount} citations
                  </Badge>
                )}
              </div>

              {paper.abstract && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {paper.abstract}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                {(paper.doi || paper.openAccessPdfUrl) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs gap-1 px-2"
                    onClick={() => importMutation.mutate(paper)}
                    disabled={importMutation.isPending}
                  >
                    {importMutation.isPending && importMutation.variables?.paperId === paper.paperId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    Add to Library
                  </Button>
                )}
                {paper.doi && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1 px-2"
                    onClick={() => window.open(`https://doi.org/${paper.doi}`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" />
                    DOI
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && papers.length === 0 && !error && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Click &quot;Find Similar&quot; to discover related papers using Semantic Scholar.
        </p>
      )}
    </div>
  );
}
