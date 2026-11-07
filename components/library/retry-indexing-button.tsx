'use client';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RetryIndexingButtonProps {
  paperId: string;
  className?: string;
}

/** Re-runs processing for a paper that failed or was interrupted. */
export function RetryIndexingButton({ paperId, className }: RetryIndexingButtonProps) {
  const queryClient = useQueryClient();

  const retry = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/library/${paperId}/reindex`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Could not retry indexing');
      }
    },
    onSuccess: () => {
      toast.success('Re-indexing started');
      queryClient.invalidateQueries({ queryKey: ['library-papers'] });
      queryClient.invalidateQueries({ queryKey: ['paper-detail', paperId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={retry.isPending}
      className={cn('h-7 gap-1.5 px-2 text-xs', className)}
      onClick={(event) => {
        // Cards are clickable; don't open the paper when retrying.
        event.stopPropagation();
        retry.mutate();
      }}
    >
      {retry.isPending ? <Loader2 className="size-3 animate-spin" /> : <RotateCw className="size-3" />}
      Retry
    </Button>
  );
}
