'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, FolderPlus, Library, Clock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Collection } from '@/lib/db/schema';

interface CollectionSidebarProps {
  collections: Collection[];
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
}

export function CollectionSidebar({
  collections,
  selectedCollectionId,
  onSelectCollection,
}: CollectionSidebarProps) {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const createMutation = useMutation({
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
      setCreateDialogOpen(false);
      setNewCollectionName('');
    },
    onError: () => {
      toast.error('Failed to create collection');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/library/collections/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete collection');
    },
    onSuccess: () => {
      toast.success('Collection deleted');
      queryClient.invalidateQueries({ queryKey: ['library-collections'] });
      if (selectedCollectionId) onSelectCollection(null);
    },
  });

  return (
    <aside className="hidden md:flex flex-col w-56 border-r bg-muted/30 p-3 shrink-0">
      <div className="space-y-1">
        {/* All Papers */}
        <button
          onClick={() => onSelectCollection(null)}
          className={cn(
            'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted',
            !selectedCollectionId && 'bg-muted font-medium',
          )}
        >
          <Library className="h-4 w-4" />
          All Papers
        </button>
      </div>

      {/* Collections header */}
      <div className="flex items-center justify-between mt-6 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Collections
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setCreateDialogOpen(true)}
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Collection list */}
      <div className="space-y-0.5 flex-1 overflow-y-auto">
        {collections.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">No collections yet</p>
        ) : (
          collections.map((col) => (
            <div
              key={col.id}
              className={cn(
                'group flex items-center justify-between rounded-md transition-colors hover:bg-muted',
                selectedCollectionId === col.id && 'bg-muted font-medium',
              )}
            >
              <button
                onClick={() => onSelectCollection(col.id)}
                className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-sm"
              >
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: col.color || '#6b7280' }}
                />
                <span className="truncate">{col.name}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 mr-1 shrink-0"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="right">
                  <DropdownMenuItem
                    onClick={() => deleteMutation.mutate(col.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>

      {/* Create collection dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                createMutation.mutate(newCollectionName.trim());
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newCollectionName.trim())}
              disabled={!newCollectionName.trim() || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
