'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  X,
  Trash2,
  ExternalLink,
  MessageSquare,
  FileText,
  Calendar,
  Users,
  BookOpen,
  Hash,
  Tag,
  StickyNote,
  Sparkles,
  AlignLeft,
  FolderPlus,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { PaperStatusBadge } from './paper-status-badge';
import { TagEditor } from './tag-editor';
import { DiscoveryPanel } from './discovery-panel';
import { useRouter } from 'next/navigation';
import type { Paper, Collection } from '@/lib/db/schema';

interface PaperDetailDrawerProps {
  paper: Paper;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: () => void;
  allCollections: Collection[];
}

export function PaperDetailDrawer({ paper, onClose, onDelete, onUpdate, allCollections }: PaperDetailDrawerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(paper.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Fetch tags + collections for this paper
  const { data: paperData } = useQuery({
    queryKey: ['paper-detail', paper.id],
    queryFn: async () => {
      const res = await fetch(`/api/library/${paper.id}`);
      if (!res.ok) throw new Error('Failed to fetch paper');
      return res.json();
    },
  });

  const tags: string[] = paperData?.tags || [];
  const paperCollections: Collection[] = paperData?.collections || [];
  const paperCollectionIds = new Set(paperCollections.map((c) => c.id));

  // Add to collection
  const addToCollectionMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      const res = await fetch(`/api/library/${paper.id}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId }),
      });
      if (!res.ok) throw new Error('Failed to add to collection');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-detail', paper.id] });
      queryClient.invalidateQueries({ queryKey: ['library-papers'] });
    },
    onError: () => {
      toast.error('Failed to add to collection');
    },
  });

  // Remove from collection
  const removeFromCollectionMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      const res = await fetch(`/api/library/${paper.id}/collections`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId }),
      });
      if (!res.ok) throw new Error('Failed to remove from collection');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-detail', paper.id] });
      queryClient.invalidateQueries({ queryKey: ['library-papers'] });
    },
    onError: () => {
      toast.error('Failed to remove from collection');
    },
  });

  const toggleCollection = (collectionId: string) => {
    if (paperCollectionIds.has(collectionId)) {
      removeFromCollectionMutation.mutate(collectionId);
    } else {
      addToCollectionMutation.mutate(collectionId);
    }
  };

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const res = await fetch(`/api/library/${paper.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes }),
      });
      if (!res.ok) throw new Error('Failed to update notes');
    },
    onSuccess: () => {
      toast.success('Notes saved');
      setIsEditingNotes(false);
      onUpdate();
    },
  });

  const handleChatAboutPaper = () => {
    router.push(`/new?paperId=${paper.id}`);
  };

  // Compact metadata items
  const metadataItems = [
    paper.authors?.length && {
      icon: Users,
      value: paper.authors.slice(0, 4).join(', ') + (paper.authors.length > 4 ? ` +${paper.authors.length - 4}` : ''),
    },
    paper.year && { icon: Calendar, value: String(paper.year) },
    paper.journal && { icon: BookOpen, value: paper.journal },
    paper.totalPages && { icon: FileText, value: `${paper.totalPages} pp` },
  ].filter(Boolean) as Array<{ icon: React.ComponentType<{ className?: string }>; value: string }>;

  return (
    <aside className="w-80 lg:w-105 border-l bg-background flex flex-col shrink-0">
      {/* Header with close + actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-muted-foreground">Paper Details</h3>
        <div className="flex items-center gap-1">
          {paper.fileUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => window.open(paper.fileUrl!, '_blank')}
              title="Open PDF"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
            title="Delete paper"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Paper info - always visible above tabs */}
      <div className="px-4 py-4 space-y-3 border-b">
        {/* Title + Status */}
        <div className="flex items-start gap-2">
          <h2 className="text-[15px] font-semibold leading-snug flex-1">{paper.title}</h2>
          <PaperStatusBadge status={paper.status} />
        </div>
        {paper.error && (
          <p className="text-xs text-destructive">{paper.error}</p>
        )}

        {/* Compact metadata row */}
        {metadataItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {metadataItems.map((item, i) => (
              <span key={i} className="flex items-center gap-1">
                <item.icon className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-45">{item.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* DOI link */}
        {paper.doi && (
          <a
            href={`https://doi.org/${paper.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Hash className="h-3 w-3" />
            {paper.doi}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}

        {/* Collections row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {paperCollections.map((col) => (
            <span
              key={col.id}
              className="inline-flex items-center gap-1 text-[11px] rounded-md px-1.5 py-0.5 bg-muted/80 text-muted-foreground"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: col.color || '#6b7280' }}
              />
              {col.name}
              <button
                onClick={() => removeFromCollectionMutation.mutate(col.id)}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {allCollections.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  <FolderPlus className="h-3 w-3" />
                  {paperCollections.length === 0 ? 'Add to collection' : 'Add'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                <div className="space-y-0.5">
                  {allCollections.map((col) => {
                    const isInCollection = paperCollectionIds.has(col.id);
                    return (
                      <button
                        key={col.id}
                        onClick={() => toggleCollection(col.id)}
                        className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: col.color || '#6b7280' }}
                        />
                        <span className="flex-1 text-left truncate text-xs">{col.name}</span>
                        {isInCollection && (
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Tabs section */}
      <Tabs defaultValue={paper.abstract ? 'abstract' : 'tags'} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full rounded-none border-b bg-transparent h-10 p-0 gap-0">
          {paper.abstract && (
            <TabsTrigger
              value="abstract"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-10 gap-1.5 text-xs"
            >
              <AlignLeft className="h-3.5 w-3.5" />
              Abstract
            </TabsTrigger>
          )}
          <TabsTrigger
            value="tags"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-10 gap-1.5 text-xs"
          >
            <Tag className="h-3.5 w-3.5" />
            Tags
            {tags.length > 0 && (
              <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5 leading-none">
                {tags.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="notes"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-10 gap-1.5 text-xs"
          >
            <StickyNote className="h-3.5 w-3.5" />
            Notes
            {paper.notes && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="related"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-10 gap-1.5 text-xs"
            disabled={paper.status !== 'ready'}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Related
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {paper.abstract && (
            <TabsContent value="abstract" className="p-4 mt-0">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {paper.abstract}
              </p>
            </TabsContent>
          )}

          <TabsContent value="tags" className="p-4 mt-0">
            <TagEditor paperId={paper.id} tags={tags} />
            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Add tags to organize and categorize this paper.
              </p>
            )}
          </TabsContent>

          <TabsContent value="notes" className="p-4 mt-0">
            {isEditingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Write your notes about this paper..."
                  className="min-h-32 text-sm resize-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateNotesMutation.mutate(notes)}
                    disabled={updateNotesMutation.isPending}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditingNotes(false);
                      setNotes(paper.notes || '');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingNotes(true)}
                className="cursor-pointer rounded-md p-3 border border-dashed hover:border-primary/30 hover:bg-muted/30 transition-colors min-h-24"
              >
                {paper.notes ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{paper.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">
                    Click to add notes about this paper...
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="related" className="p-4 mt-0">
            {paper.status === 'ready' ? (
              <DiscoveryPanel paperId={paper.id} />
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">
                Paper must be fully indexed before finding related papers.
              </p>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Footer action */}
      <div className="p-3 border-t">
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={handleChatAboutPaper}
          disabled={paper.status !== 'ready'}
        >
          <MessageSquare className="h-4 w-4" />
          Chat About This Paper
        </Button>
      </div>
    </aside>
  );
}
