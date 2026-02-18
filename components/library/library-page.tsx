'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload,
  Grid3x3,
  TableProperties,
  Search,
  FileText,
  Loader2,
  Library,
  FolderPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/contexts/user-context';
import { PaperCard } from './paper-card';
import { LibraryUploadDialog } from './library-upload-dialog';
import { PaperStatusBadge } from './paper-status-badge';
import { cn } from '@/lib/utils';
import type { Paper, Collection } from '@/lib/db/schema';

export function LibraryPage() {
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [journalFilter, setJournalFilter] = useState<string>('all');
  const [authorFilter, setAuthorFilter] = useState<string>('all');
  const [hasNotesFilter, setHasNotesFilter] = useState<string>('all');
  const [hasPdfFilter, setHasPdfFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'title' | 'year' | 'createdAt' | 'authors'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch papers - poll every 5s if any are processing
  const { data: papersData, isLoading: isPapersLoading } = useQuery({
    queryKey: ['library-papers', selectedCollectionId],
    queryFn: async () => {
      if (selectedCollectionId) {
        const res = await fetch(`/api/library/collections/${selectedCollectionId}`);
        if (!res.ok) throw new Error('Failed to fetch papers');
        return res.json();
      }
      const res = await fetch('/api/library');
      if (!res.ok) throw new Error('Failed to fetch papers');
      return res.json();
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const papers: Paper[] = query.state.data?.papers || [];
      const processing = papers.some((p) => p.status !== 'ready' && p.status !== 'failed');
      return processing ? 5000 : false;
    },
  });

  const papers: Paper[] = papersData?.papers || [];

  // Fetch collections
  const { data: collectionsData } = useQuery({
    queryKey: ['library-collections'],
    queryFn: async () => {
      const res = await fetch('/api/library/collections');
      if (!res.ok) throw new Error('Failed to fetch collections');
      return res.json();
    },
    enabled: !!user,
  });

  const collections: Collection[] = collectionsData?.collections || [];

  // Stats
  const stats = useMemo(() => {
    const total = papers.length;
    const processing = papers.filter((p) => p.status !== 'ready' && p.status !== 'failed').length;
    return { total, processing };
  }, [papers]);

  // Create collection mutation
  const createCollectionMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/library/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create collection');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Collection created');
      queryClient.invalidateQueries({ queryKey: ['library-collections'] });
      setCreateCollectionOpen(false);
      setNewCollectionName('');
    },
    onError: () => {
      toast.error('Failed to create collection');
    },
  });

  // Unique years for filter dropdown
  const availableYears = useMemo(() => {
    const years = papers
      .map((p) => p.year)
      .filter((y): y is number => y != null);
    return [...new Set(years)].sort((a, b) => b - a);
  }, [papers]);

  // Unique journals for filter dropdown
  const availableJournals = useMemo(() => {
    const journals = papers
      .map((p) => p.journal)
      .filter((j): j is string => !!j);
    return [...new Set(journals)].sort((a, b) => a.localeCompare(b));
  }, [papers]);

  // Unique authors for filter dropdown (top 50 most frequent)
  const availableAuthors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of papers) {
      for (const a of p.authors ?? []) {
        counts.set(a, (counts.get(a) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([name]) => name);
  }, [papers]);

  // Filter papers by search query + status + year
  const filteredPapers = useMemo(() => {
    let result = papers.filter((paper) => {
      // Text search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          paper.title.toLowerCase().includes(q) ||
          paper.authors?.some((a: string) => a.toLowerCase().includes(q)) ||
          paper.journal?.toLowerCase().includes(q) ||
          paper.doi?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'processing') {
          if (paper.status === 'ready' || paper.status === 'failed') return false;
        } else if (paper.status !== statusFilter) {
          return false;
        }
      }
      // Year filter
      if (yearFilter !== 'all') {
        if (String(paper.year) !== yearFilter) return false;
      }
      // Journal filter
      if (journalFilter !== 'all') {
        if (paper.journal !== journalFilter) return false;
      }
      // Author filter
      if (authorFilter !== 'all') {
        if (!paper.authors?.includes(authorFilter)) return false;
      }
      // Has notes filter
      if (hasNotesFilter !== 'all') {
        const hasNotes = !!paper.notes?.trim();
        if (hasNotesFilter === 'yes' && !hasNotes) return false;
        if (hasNotesFilter === 'no' && hasNotes) return false;
      }
      // Has PDF filter
      if (hasPdfFilter !== 'all') {
        const hasPdf = !!paper.fileUrl;
        if (hasPdfFilter === 'yes' && !hasPdf) return false;
        if (hasPdfFilter === 'no' && hasPdf) return false;
      }
      // Date filter
      if (dateFilter !== 'all') {
        const added = new Date(paper.createdAt);
        const now = new Date();
        const diffDays = (now.getTime() - added.getTime()) / (1000 * 60 * 60 * 24);
        if (dateFilter === '7d' && diffDays > 7) return false;
        if (dateFilter === '30d' && diffDays > 30) return false;
        if (dateFilter === '90d' && diffDays > 90) return false;
        if (dateFilter === '1y' && diffDays > 365) return false;
      }
      return true;
    });

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = (a.title || '').localeCompare(b.title || '');
          break;
        case 'year':
          cmp = (a.year ?? 0) - (b.year ?? 0);
          break;
        case 'authors':
          cmp = (a.authors?.[0] || '').localeCompare(b.authors?.[0] || '');
          break;
        case 'createdAt':
        default:
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [papers, searchQuery, statusFilter, yearFilter, journalFilter, authorFilter, hasNotesFilter, hasPdfFilter, dateFilter, sortField, sortDir]);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (yearFilter !== 'all' ? 1 : 0) +
    (journalFilter !== 'all' ? 1 : 0) +
    (authorFilter !== 'all' ? 1 : 0) +
    (hasNotesFilter !== 'all' ? 1 : 0) +
    (hasPdfFilter !== 'all' ? 1 : 0) +
    (dateFilter !== 'all' ? 1 : 0);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'title' || field === 'authors' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setYearFilter('all');
    setJournalFilter('all');
    setAuthorFilter('all');
    setHasNotesFilter('all');
    setHasPdfFilter('all');
    setDateFilter('all');
  };

  const handleUploadComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['library-papers'] });
    setUploadDialogOpen(false);
  }, [queryClient]);

  const handlePaperClick = (paperId: string) => {
    router.push(`/library/${paperId}`);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Library className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Research Library</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Upload papers, organize collections, and chat with your research using AI.
          </p>
          <Button onClick={() => router.push('/sign-in')} size="lg">Sign In to Get Started</Button>
        </div>
      </div>
    );
  }

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
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-3">
          <SidebarTrigger className="size-8" />
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Library</h1>
            {stats.total > 0 && (
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {stats.total}
              </span>
            )}
            {stats.processing > 0 && (
              <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                {stats.processing} processing
              </span>
            )}
          </div>
          <div className="flex-1" />

          {/* Search */}
          <div className="relative max-w-sm w-full hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search papers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('table')}
            >
              <TableProperties className="h-4 w-4" />
            </Button>
          </div>

          {/* Filter toggle */}
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 gap-1.5 hidden sm:inline-flex"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="default" className="h-4 min-w-4 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {/* Upload button */}
          <Button onClick={() => setUploadDialogOpen(true)} size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        </header>

        {/* Collection filter pills */}
        {collections.length > 0 && (
          <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 border-b overflow-x-auto">
            <button
              onClick={() => setSelectedCollectionId(null)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                !selectedCollectionId
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <Library className="h-3 w-3" />
              All Papers
            </button>
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={() => setSelectedCollectionId(col.id)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  selectedCollectionId === col.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: col.color || '#6b7280' }}
                />
                {col.name}
              </button>
            ))}
            <button
              onClick={() => setCreateCollectionOpen(true)}
              className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <FolderPlus className="h-3 w-3" />
              New
            </button>
          </div>
        )}

        {/* Filter bar */}
        {showFilters && (
          <div className="flex items-center gap-2.5 px-4 sm:px-6 py-2.5 border-b bg-muted/30 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="w-32 h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {availableYears.length > 0 && (
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger size="sm" className="w-28 h-8 text-xs">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {availableJournals.length > 0 && (
              <Select value={journalFilter} onValueChange={setJournalFilter}>
                <SelectTrigger size="sm" className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Journal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All journals</SelectItem>
                  {availableJournals.map((j) => (
                    <SelectItem key={j} value={j}>
                      <span className="truncate max-w-[180px] block">{j}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {availableAuthors.length > 0 && (
              <Select value={authorFilter} onValueChange={setAuthorFilter}>
                <SelectTrigger size="sm" className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Author" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All authors</SelectItem>
                  {availableAuthors.map((a) => (
                    <SelectItem key={a} value={a}>
                      <span className="truncate max-w-[180px] block">{a}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger size="sm" className="w-32 h-8 text-xs">
                <SelectValue placeholder="Date added" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>

            <Select value={hasNotesFilter} onValueChange={setHasNotesFilter}>
              <SelectTrigger size="sm" className="w-28 h-8 text-xs">
                <SelectValue placeholder="Notes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Has notes</SelectItem>
                <SelectItem value="no">No notes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={hasPdfFilter} onValueChange={setHasPdfFilter}>
              <SelectTrigger size="sm" className="w-28 h-8 text-xs">
                <SelectValue placeholder="PDF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Has PDF</SelectItem>
                <SelectItem value="no">No PDF</SelectItem>
              </SelectContent>
            </Select>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" />
                Clear all
              </Button>
            )}

            <span className="text-xs text-muted-foreground ml-auto">
              {filteredPapers.length} of {papers.length} papers
            </span>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Mobile search + filter */}
          <div className="sm:hidden space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search papers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setShowFilters((v) => !v)}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="h-4 min-w-4 px-1 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                {filteredPapers.length} papers
              </span>
            </div>
          </div>

          {isPapersLoading ? (
            viewMode === 'table' ? (
              <div className="rounded-lg border">
                <div className="divide-y">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3">
                      <div className="animate-pulse rounded bg-muted/50 h-4 flex-1" />
                      <div className="animate-pulse rounded bg-muted/50 h-4 w-32 hidden md:block" />
                      <div className="animate-pulse rounded bg-muted/50 h-4 w-12 hidden lg:block" />
                      <div className="animate-pulse rounded bg-muted/50 h-5 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-lg border bg-muted/30 h-44" />
                ))}
              </div>
            )
          ) : filteredPapers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
                {searchQuery ? (
                  <Search className="h-8 w-8 text-muted-foreground/50" />
                ) : (
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-1">
                {searchQuery ? 'No papers match your search' : 'Your library is empty'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                {searchQuery
                  ? 'Try a different search term or browse all papers'
                  : 'Upload research papers to build your library. AI will extract metadata and index the content automatically.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setUploadDialogOpen(true)} size="lg" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Your First Paper
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPapers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  isSelected={false}
                  onClick={() => handlePaperClick(paper.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40%]">
                      <button
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                        onClick={() => toggleSort('title')}
                      >
                        Title
                        <SortIcon field="title" />
                      </button>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      <button
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                        onClick={() => toggleSort('authors')}
                      >
                        Authors
                        <SortIcon field="authors" />
                      </button>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell w-[120px]">
                      <button
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                        onClick={() => toggleSort('year')}
                      >
                        Year
                        <SortIcon field="year" />
                      </button>
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">Journal</TableHead>
                    <TableHead className="hidden sm:table-cell w-[80px] text-center">Pages</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="hidden lg:table-cell w-[100px]">
                      <button
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                        onClick={() => toggleSort('createdAt')}
                      >
                        Added
                        <SortIcon field="createdAt" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPapers.map((paper) => (
                    <TableRow
                      key={paper.id}
                      className="cursor-pointer"
                      onClick={() => handlePaperClick(paper.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="min-w-0">
                          <p className="truncate max-w-xs lg:max-w-md">
                            {paper.title || paper.fileName || 'Untitled Paper'}
                          </p>
                          {/* Show authors on mobile since column is hidden */}
                          <p className="text-xs text-muted-foreground truncate mt-0.5 md:hidden">
                            {paper.authors?.slice(0, 2).join(', ') || 'Unknown authors'}
                            {(paper.authors?.length ?? 0) > 2 && ` +${(paper.authors?.length ?? 0) - 2}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        <p className="truncate max-w-[200px]">
                          {paper.authors?.slice(0, 3).join(', ') || '—'}
                          {(paper.authors?.length ?? 0) > 3 && ` +${(paper.authors?.length ?? 0) - 3}`}
                        </p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {paper.year || '—'}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground">
                        <p className="truncate max-w-[160px]">{paper.journal || '—'}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-center text-muted-foreground">
                        {paper.totalPages || '—'}
                      </TableCell>
                      <TableCell>
                        <PaperStatusBadge status={paper.status} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                        {new Date(paper.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </div>

      <LibraryUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={handleUploadComplete}
        collectionId={selectedCollectionId}
      />

      {/* Create collection dialog */}
      <Dialog open={createCollectionOpen} onOpenChange={setCreateCollectionOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Collection</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Collection name"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCollectionName.trim()) {
                createCollectionMutation.mutate(newCollectionName.trim());
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCollectionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createCollectionMutation.mutate(newCollectionName.trim())}
              disabled={!newCollectionName.trim() || createCollectionMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
