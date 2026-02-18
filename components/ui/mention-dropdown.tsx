'use client';

import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Command as CommandPrimitive } from 'cmdk';
import { FileText, FolderOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Mention } from '@/lib/mention-types';
import type { Paper, Collection } from '@/lib/db/schema';

interface MentionDropdownProps {
  query: string;
  onSelect: (mention: Mention) => void;
  onClose: () => void;
  className?: string;
}

export function MentionDropdown({ query, onSelect, onClose, className }: MentionDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: papersData, isLoading: papersLoading } = useQuery({
    queryKey: ['mention-papers'],
    queryFn: async () => {
      const res = await fetch('/api/library?limit=100');
      if (!res.ok) throw new Error('Failed to fetch papers');
      return res.json() as Promise<{ papers: Paper[] }>;
    },
    staleTime: 30_000,
  });

  const { data: collectionsData, isLoading: collectionsLoading } = useQuery({
    queryKey: ['mention-collections'],
    queryFn: async () => {
      const res = await fetch('/api/library/collections');
      if (!res.ok) throw new Error('Failed to fetch collections');
      return res.json() as Promise<{ collections: Collection[] }>;
    },
    staleTime: 30_000,
  });

  const papers = papersData?.papers?.filter((p) => p.status === 'ready') || [];
  const collections = collectionsData?.collections || [];
  const isLoading = papersLoading || collectionsLoading;
  const hasResults = papers.length > 0 || collections.length > 0;

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute bottom-full left-0 right-0 mb-1 z-50',
        'rounded-lg border bg-popover text-popover-foreground shadow-lg',
        'max-h-72 overflow-hidden',
        className,
      )}
    >
      <CommandPrimitive
        filter={(value, search) => {
          if (!search) return 1;
          return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
        }}
        className="flex flex-col"
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="text-xs text-muted-foreground font-medium">@</span>
          <CommandPrimitive.Input
            value={query}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search papers & collections..."
            autoFocus
          />
        </div>

        <CommandPrimitive.List className="max-h-56 overflow-y-auto p-1">
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && !hasResults && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No papers or collections found. Upload papers to get started.
            </div>
          )}

          {papers.length > 0 && (
            <CommandPrimitive.Group
              heading="Papers"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {papers.map((paper) => (
                <CommandPrimitive.Item
                  key={`paper-${paper.id}`}
                  value={paper.title}
                  onSelect={() => {
                    onSelect({ type: 'paper', id: paper.id, label: paper.title });
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{paper.title}</span>
                  {paper.year && (
                    <span className="text-[11px] text-muted-foreground shrink-0">{paper.year}</span>
                  )}
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          )}

          {collections.length > 0 && (
            <CommandPrimitive.Group
              heading="Collections"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {collections.map((col) => (
                <CommandPrimitive.Item
                  key={`col-${col.id}`}
                  value={col.name}
                  onSelect={() => {
                    onSelect({ type: 'collection', id: col.id, label: col.name });
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: col.color || '#6b7280' }}
                  />
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{col.name}</span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          )}
        </CommandPrimitive.List>

        <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↵</kbd> select</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">esc</kbd> close</span>
        </div>
      </CommandPrimitive>
    </div>
  );
}
