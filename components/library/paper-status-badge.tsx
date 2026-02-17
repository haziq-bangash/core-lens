'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock, FileSearch } from 'lucide-react';

interface PaperStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    variant: 'outline',
    icon: <Clock className="h-3 w-3" />,
  },
  extracting_metadata: {
    label: 'Extracting',
    variant: 'secondary',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  indexing: {
    label: 'Indexing',
    variant: 'secondary',
    icon: <FileSearch className="h-3 w-3 animate-pulse" />,
  },
  processing: {
    label: 'Processing',
    variant: 'secondary',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  ready: {
    label: 'Ready',
    variant: 'default',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" />,
  },
};

export function PaperStatusBadge({ status }: PaperStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;

  if (status === 'ready') return null; // Don't show badge for ready papers

  return (
    <Badge variant={config.variant} className="gap-1 text-[10px] px-1.5 py-0 h-5 shrink-0">
      {config.icon}
      {config.label}
    </Badge>
  );
}
