'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
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
  X,
  Loader2,
  ChevronsUp,
  MoreHorizontal,
  ClipboardCopy,
  Download,
  Maximize2,
} from 'lucide-react';

import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useUser } from '@/contexts/user-context';
import { PaperStatusBadge } from './paper-status-badge';
import { TagEditor } from './tag-editor';
import { DiscoveryPanel } from './discovery-panel';
import { NotesEditor, NotesDisplay } from './notes-editor';
import type { Paper, Collection } from '@/lib/db/schema';

interface PaperDetailPageProps {
  paperId: string;
}

export function PaperDetailPage({ paperId }: PaperDetailPageProps) {
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesCitationFormat, setNotesCitationFormat] = useState('Numbered');
  const [notesLanguage, setNotesLanguage] = useState('English (US)');
  const [notesSpellcheck, setNotesSpellcheck] = useState(true);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [generatedNotesContent, setGeneratedNotesContent] = useState<string | null>(null);

  // Fetch paper detail
  const { data: paperData, isLoading } = useQuery({
    queryKey: ['paper-detail', paperId],
    queryFn: async () => {
      const res = await fetch(`/api/library/${paperId}`);
      if (!res.ok) throw new Error('Failed to fetch paper');
      return res.json();
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const paper: Paper | undefined = query.state.data?.paper;
      if (paper && paper.status !== 'ready' && paper.status !== 'failed') {
        return 5000;
      }
      return false;
    },
  });

  const paper: Paper | null = paperData?.paper || null;
  const tags: string[] = paperData?.tags || [];
  const paperCollections: Collection[] = paperData?.collections || [];
  const paperCollectionIds = new Set(paperCollections.map((c) => c.id));

  // Fetch all collections for the picker
  const { data: collectionsData } = useQuery({
    queryKey: ['library-collections'],
    queryFn: async () => {
      const res = await fetch('/api/library/collections');
      if (!res.ok) throw new Error('Failed to fetch collections');
      return res.json();
    },
    enabled: !!user,
  });

  const allCollections: Collection[] = collectionsData?.collections || [];

  // Add to collection
  const addToCollectionMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      const res = await fetch(`/api/library/${paperId}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId }),
      });
      if (!res.ok) throw new Error('Failed to add to collection');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-detail', paperId] });
    },
    onError: () => {
      toast.error('Failed to add to collection');
    },
  });

  // Remove from collection
  const removeFromCollectionMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      const res = await fetch(`/api/library/${paperId}/collections`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId }),
      });
      if (!res.ok) throw new Error('Failed to remove from collection');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-detail', paperId] });
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
      const res = await fetch(`/api/library/${paperId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes }),
      });
      if (!res.ok) throw new Error('Failed to update notes');
    },
    onSuccess: () => {
      toast.success('Notes saved');
      setIsEditingNotes(false);
      queryClient.invalidateQueries({ queryKey: ['paper-detail', paperId] });
    },
  });

  // Generate notes via AI
  const handleGenerateNotes = useCallback(async () => {
    setIsGeneratingNotes(true);
    try {
      const res = await fetch(`/api/library/${paperId}/generate-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citationFormat: notesCitationFormat,
          language: notesLanguage,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to generate notes' }));
        throw new Error(err.error || 'Failed to generate notes');
      }
      const data = await res.json();
      setGeneratedNotesContent(data.notes);
      toast.success('Notes generated');
    } catch (e: any) {
      console.error('Generate notes error:', e);
      toast.error(e.message || 'Failed to generate notes');
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [paperId, notesCitationFormat, notesLanguage]);

  // Delete paper mutation
  const deletePaperMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/library/${paperId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete paper');
    },
    onSuccess: () => {
      toast.success('Paper deleted');
      router.push('/library');
    },
    onError: () => {
      toast.error('Failed to delete paper');
    },
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <p className="text-muted-foreground">Sign in to view this paper.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <>
        <AppSidebar
          chatId={null}
          selectedVisibilityType="private"
          onVisibilityChange={() => {}}
          user={user}
          onHistoryClick={() => router.push('/searches')}
        />
        <div className="flex flex-1 items-center justify-center min-h-screen">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!paper) {
    return (
      <>
        <AppSidebar
          chatId={null}
          selectedVisibilityType="private"
          onVisibilityChange={() => {}}
          user={user}
          onHistoryClick={() => router.push('/searches')}
        />
        <div className="flex flex-1 flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-muted-foreground">Paper not found.</p>
          <Button variant="outline" onClick={() => router.push('/library')}>
            Back to Library
          </Button>
        </div>
      </>
    );
  }

  // Compact metadata items
  const metadataItems = [
    paper.authors?.length && {
      icon: Users,
      label: paper.authors.slice(0, 4).join(', ') + (paper.authors.length > 4 ? ` +${paper.authors.length - 4}` : ''),
    },
    paper.year && { icon: Calendar, label: String(paper.year) },
    paper.journal && { icon: BookOpen, label: paper.journal },
    paper.totalPages && { icon: FileText, label: `${paper.totalPages} pages` },
  ].filter(Boolean) as Array<{ icon: React.ComponentType<{ className?: string }>; label: string }>;

  return (
    <>
      <AppSidebar
        chatId={null}
        selectedVisibilityType="private"
        onVisibilityChange={() => {}}
        user={user}
        onHistoryClick={() => router.push('/searches')}
      />
      <div className="flex flex-1 flex-col min-h-screen w-full">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-2.5">
          <SidebarTrigger className="size-8" />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => router.push('/library')}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Library</span>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-medium truncate">{paper.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PaperStatusBadge status={paper.status} />
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setDrawerOpen(true)}
              >
                <ChevronsUp className="h-3.5 w-3.5" />
                Details
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/new?paperId=${paper.id}`)}
              disabled={paper.status !== 'ready'}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Chat</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => deletePaperMutation.mutate()}
              title="Delete paper"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Main split layout: details left, PDF right */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar content — shared between aside (desktop) and drawer (mobile) */}
          {(() => {
            const sidebarContent = (
              <>
                {/* Paper info */}
                <div className="px-5 py-4 space-y-3 border-b">
                  <h2 className="text-lg font-semibold leading-snug">{paper.title}</h2>
                  {paper.error && (
                    <p className="text-xs text-destructive">{paper.error}</p>
                  )}

                  {/* Metadata */}
                  {metadataItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                      {metadataItems.map((item, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          <item.icon className="h-3.5 w-3.5 shrink-0" />
                          {item.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* DOI */}
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

                  {/* Collections */}
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
                              const isIn = paperCollectionIds.has(col.id);
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
                                  {isIn && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>

                {/* Tabs */}
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

                  <div className="flex-1 min-h-0">
                    {paper.abstract && (
                      <TabsContent value="abstract" className="mt-0 h-full">
                        <ScrollArea className="h-full">
                          <div className="p-5">
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {paper.abstract}
                            </p>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    )}

                    <TabsContent value="tags" className="mt-0 h-full">
                      <ScrollArea className="h-full">
                        <div className="p-5">
                          <TagEditor paperId={paper.id} tags={tags} />
                          {tags.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-3">
                              Add tags to organize and categorize this paper.
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="notes" className="mt-0 h-full flex flex-col min-h-0 data-[state=inactive]:hidden" forceMount>
                      {/* 3-dot options menu */}
                      <div className="flex items-center justify-end gap-0.5 px-5 pt-5 pb-2 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-md h-7 w-7 hover:bg-muted">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() => {
                                const text = paper.notes || '';
                                navigator.clipboard.writeText(text);
                                toast.success('Contents copied to clipboard');
                              }}
                              disabled={!paper.notes}
                            >
                              <ClipboardCopy className="h-4 w-4 mr-2" />
                              Copy contents
                            </DropdownMenuItem>

                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger disabled={!paper.notes}>
                                <Download className="h-4 w-4 mr-2" />
                                Export
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-44">
                                {/* Export as PDF — uses /api/export/pdf */}
                                <DropdownMenuItem
                                  onClick={async () => {
                                    try {
                                      const res = await fetch('/api/export/pdf', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          title: paper.title || 'Notes',
                                          content: paper.notes || '',
                                          meta: { createdAt: paper.createdAt || Date.now() },
                                        }),
                                      });
                                      if (!res.ok) throw new Error(await res.text());
                                      const blob = await res.blob();
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `${paper.title || 'notes'}.pdf`;
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      URL.revokeObjectURL(url);
                                      toast.success('PDF downloaded');
                                    } catch (e) {
                                      console.error('Export PDF error:', e);
                                      toast.error('Failed to export PDF');
                                    }
                                  }}
                                >
                                  Export as PDF
                                </DropdownMenuItem>

                                {/* Export as HTML */}
                                <DropdownMenuItem
                                  onClick={() => {
                                    const md = paper.notes || '';
                                    // Convert basic markdown to HTML
                                    const htmlBody = md
                                      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                                      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                                      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                      .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                      .replace(/~~(.+?)~~/g, '<del>$1</del>')
                                      .replace(/^- (.+)$/gm, '<li>$1</li>')
                                      .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
                                      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
                                      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
                                      .replace(/\n{2,}/g, '</p><p>')
                                      .replace(/\n/g, '<br/>');
                                    const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${paper.title || 'Notes'}</title>\n<style>\n  body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.7; color: #1a1a1a; }\n  h1 { font-size: 1.8rem; margin-top: 1.5rem; }\n  h2 { font-size: 1.4rem; margin-top: 1.2rem; }\n  h3 { font-size: 1.1rem; margin-top: 1rem; }\n  blockquote { border-left: 3px solid #ccc; padding-left: 1rem; color: #555; }\n  ul, ol { padding-left: 1.5rem; }\n  @media (prefers-color-scheme: dark) { body { background: #1a1a1a; color: #e0e0e0; } blockquote { border-color: #555; color: #aaa; } }\n</style>\n</head>\n<body>\n<p>${htmlBody}</p>\n</body>\n</html>`;
                                    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${paper.title || 'notes'}.html`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    URL.revokeObjectURL(url);
                                    toast.success('HTML downloaded');
                                  }}
                                >
                                  Export as HTML
                                </DropdownMenuItem>

                                {/* Export as Word (.doc via HTML) */}
                                <DropdownMenuItem
                                  onClick={() => {
                                    const md = paper.notes || '';
                                    const htmlBody = md
                                      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                                      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                                      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                      .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                      .replace(/~~(.+?)~~/g, '<del>$1</del>')
                                      .replace(/^- (.+)$/gm, '<li>$1</li>')
                                      .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
                                      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
                                      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
                                      .replace(/\n{2,}/g, '</p><p>')
                                      .replace(/\n/g, '<br/>');
                                    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">\n<head><meta charset="utf-8"><title>${paper.title || 'Notes'}</title></head>\n<body style="font-family:Calibri,sans-serif;line-height:1.6;"><p>${htmlBody}</p></body></html>`;
                                    const blob = new Blob(['\ufeff' + doc], { type: 'application/msword' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${paper.title || 'notes'}.doc`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    URL.revokeObjectURL(url);
                                    toast.success('Word document downloaded');
                                  }}
                                >
                                  Export as Word
                                </DropdownMenuItem>

                                {/* Export as LaTeX */}
                                <DropdownMenuItem
                                  onClick={() => {
                                    const md = paper.notes || '';
                                    const texBody = md
                                      .replace(/^# (.+)$/gm, '\\section{$1}')
                                      .replace(/^## (.+)$/gm, '\\subsection{$1}')
                                      .replace(/^### (.+)$/gm, '\\subsubsection{$1}')
                                      .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
                                      .replace(/\*(.+?)\*/g, '\\textit{$1}')
                                      .replace(/~~(.+?)~~/g, '\\sout{$1}')
                                      .replace(/^- (.+)$/gm, '  \\item $1')
                                      .replace(/(  \\item .+\n?)+/g, (m) => `\\begin{itemize}\n${m}\\end{itemize}\n`)
                                      .replace(/^> (.+)$/gm, '\\begin{quote}\n$1\n\\end{quote}');
                                    const tex = `\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{ulem}\n\\usepackage{hyperref}\n\\usepackage{geometry}\n\\geometry{margin=1in}\n\n\\title{${(paper.title || 'Notes').replace(/[&%$#_{}~^\\]/g, '\\$&')}}\n\\date{}\n\n\\begin{document}\n\\maketitle\n\n${texBody}\n\n\\end{document}`;
                                    const blob = new Blob([tex], { type: 'application/x-latex;charset=utf-8' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${paper.title || 'notes'}.tex`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    URL.revokeObjectURL(url);
                                    toast.success('LaTeX downloaded');
                                  }}
                                >
                                  Export as LaTeX
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuItem
                              onClick={() => {
                                if (paper.notes) {
                                  const win = window.open('', '_blank');
                                  if (win) {
                                    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${paper.title || 'Notes'}</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#222}@media(prefers-color-scheme:dark){body{background:#1a1a1a;color:#e0e0e0}}</style></head><body><pre style="white-space:pre-wrap;word-wrap:break-word">${paper.notes}</pre></body></html>`);
                                    win.document.close();
                                  }
                                }
                              }}
                              disabled={!paper.notes}
                            >
                              <Maximize2 className="h-4 w-4 mr-2" />
                              Open in full view
                            </DropdownMenuItem>

                            {paper.notes && (
                              <>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5 text-xs text-muted-foreground space-y-0.5">
                                  <div className="flex justify-between">
                                    <span>Word count</span>
                                    <span className="font-medium text-foreground">
                                      {paper.notes.trim().split(/\s+/).filter(Boolean).length.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Character count</span>
                                    <span className="font-medium text-foreground">
                                      {paper.notes.length.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <ScrollArea className="flex-1 min-h-0">
                        <div className="px-5 pb-5">
                          {isEditingNotes ? (
                            <NotesEditor
                              initialContent={paper.notes || ''}
                              onSave={(markdown) => updateNotesMutation.mutate(markdown)}
                              onCancel={() => setIsEditingNotes(false)}
                              isSaving={updateNotesMutation.isPending}
                              isMobile={isMobile}
                              spellCheck={notesSpellcheck}
                              onSpellCheckChange={setNotesSpellcheck}
                              citationFormat={notesCitationFormat}
                              onCitationFormatChange={setNotesCitationFormat}
                              language={notesLanguage}
                              onLanguageChange={setNotesLanguage}
                              onGenerate={paper.status === 'ready' ? handleGenerateNotes : undefined}
                              isGenerating={isGeneratingNotes}
                              generatedContent={generatedNotesContent}
                              onGeneratedContentInserted={() => setGeneratedNotesContent(null)}
                            />
                          ) : (
                            <div
                              onClick={() => setIsEditingNotes(true)}
                              className="cursor-pointer rounded-md p-3 border border-dashed hover:border-primary/30 hover:bg-muted/30 transition-colors min-h-32"
                            >
                              {paper.notes ? (
                                <NotesDisplay content={paper.notes} />
                              ) : (
                                <p className="text-sm text-muted-foreground/50 italic">
                                  Click to add notes about this paper...
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="related" className="mt-0 h-full">
                      <ScrollArea className="h-full">
                        <div className="p-5">
                          {paper.status === 'ready' ? (
                            <DiscoveryPanel paperId={paper.id} />
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-8">
                              Paper must be fully indexed before finding related papers.
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </div>
                </Tabs>
              </>
            );

            return (
              <>
                {/* Desktop: inline aside */}
                {!isMobile && (
                  <aside className="w-96 xl:w-[440px] border-r flex flex-col shrink-0">
                    {sidebarContent}
                  </aside>
                )}

                {/* Mobile: bottom drawer */}
                {isMobile && (
                  <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <DrawerContent className="h-[85vh]">
                      <DrawerHeader className="sr-only">
                        <DrawerTitle>Paper details</DrawerTitle>
                      </DrawerHeader>
                      <div className="flex flex-col flex-1 min-h-0 overflow-auto">
                        {sidebarContent}
                      </div>
                    </DrawerContent>
                  </Drawer>
                )}

                {/* Right: PDF viewer */}
                <main className="flex-1 bg-muted/30 flex flex-col min-w-0">
                  {paper.fileUrl ? (
                    <iframe
                      src={paper.fileUrl}
                      className="flex-1 w-full border-0"
                      title={`PDF: ${paper.title}`}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">No PDF Available</h3>
                      <p className="text-xs text-muted-foreground/70">
                        This paper was imported from metadata only. No PDF file is attached.
                      </p>
                    </div>
                  )}
                </main>
              </>
            );
          })()}
        </div>
      </div>
    </>
  );
}
