'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TagEditorProps {
  paperId: string;
  tags: string[];
}

export function TagEditor({ paperId, tags }: TagEditorProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');

  const addMutation = useMutation({
    mutationFn: async (tag: string) => {
      const res = await fetch(`/api/library/${paperId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      });
      if (!res.ok) throw new Error('Failed to add tag');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-detail', paperId] });
      setNewTag('');
      setIsAdding(false);
    },
    onError: () => {
      toast.error('Failed to add tag');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (tag: string) => {
      const res = await fetch(`/api/library/${paperId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      });
      if (!res.ok) throw new Error('Failed to remove tag');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-detail', paperId] });
    },
    onError: () => {
      toast.error('Failed to remove tag');
    },
  });

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 text-xs pr-1">
          {tag}
          <button
            onClick={() => removeMutation.mutate(tag)}
            className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}

      {isAdding ? (
        <Input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newTag.trim()) {
              addMutation.mutate(newTag.trim());
            }
            if (e.key === 'Escape') {
              setIsAdding(false);
              setNewTag('');
            }
          }}
          onBlur={() => {
            if (!newTag.trim()) {
              setIsAdding(false);
            }
          }}
          placeholder="Tag name..."
          className="h-6 w-24 text-xs"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add tag
        </button>
      )}
    </div>
  );
}
