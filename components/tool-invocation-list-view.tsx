/* eslint-disable @next/next/no-img-element */
'use client';

import { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

// UI Components
import { BorderTrail } from '@/components/core/border-trail';
import { TextShimmer } from '@/components/core/text-shimmer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Icons
import { ChevronDown, Copy, Loader2, MapPin, XCircle } from 'lucide-react';

export const SearchLoadingState = ({
  icon: Icon,
  text,
  color,
}: {
  icon: LucideIcon;
  text: string;
  color: 'red' | 'green' | 'orange' | 'violet' | 'gray' | 'blue';
}) => {
  const colorVariants = {
    red: {
      background: 'bg-red-50 dark:bg-red-950',
      border: 'from-red-200 via-red-500 to-red-200 dark:from-red-400 dark:via-red-500 dark:to-red-700',
      text: 'text-red-500',
      icon: 'text-red-500',
    },
    green: {
      background: 'bg-green-50 dark:bg-green-950',
      border: 'from-green-200 via-green-500 to-green-200 dark:from-green-400 dark:via-green-500 dark:to-green-700',
      text: 'text-green-500',
      icon: 'text-green-500',
    },
    orange: {
      background: 'bg-orange-50 dark:bg-orange-950',
      border:
        'from-orange-200 via-orange-500 to-orange-200 dark:from-orange-400 dark:via-orange-500 dark:to-orange-700',
      text: 'text-orange-500',
      icon: 'text-orange-500',
    },
    violet: {
      background: 'bg-violet-50 dark:bg-violet-950',
      border:
        'from-violet-200 via-violet-500 to-violet-200 dark:from-violet-400 dark:via-violet-500 dark:to-violet-700',
      text: 'text-violet-500',
      icon: 'text-violet-500',
    },
    gray: {
      background: 'bg-muted',
      border:
        'from-muted-foreground/30 via-muted-foreground/60 to-muted-foreground/30',
      text: 'text-muted-foreground',
      icon: 'text-muted-foreground',
    },
    blue: {
      background: 'bg-blue-50 dark:bg-blue-950',
      border: 'from-blue-200 via-blue-500 to-blue-200 dark:from-blue-400 dark:via-blue-500 dark:to-blue-700',
      text: 'text-blue-500',
      icon: 'text-blue-500',
    },
  };

  const variant = colorVariants[color];

  return (
    <Card className="relative w-full h-25 my-4 overflow-hidden shadow-none">
      <BorderTrail className={cn('bg-linear-to-l', variant.border)} size={80} />
      <CardContent className="px-6!">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('relative h-10 w-10 rounded-full flex items-center justify-center', variant.background)}>
              <BorderTrail className={cn('bg-linear-to-l', variant.border)} size={40} />
              <Icon className={cn('h-5 w-5', variant.icon)} />
            </div>
            <div className="space-y-2">
              <TextShimmer className="text-base font-medium" duration={2}>
                {text}
              </TextShimmer>
              <div className="flex gap-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full bg-muted animate-pulse"
                    style={{
                      width: `${Math.random() * 40 + 20}px`,
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Dedicated nearby search skeleton loading state
export const NearbySearchSkeleton = ({ type }: { type: string }) => {
  return (
    <div className="relative w-full h-[70vh] bg-card rounded-lg overflow-hidden border border-border my-4">
      {/* Header skeleton */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-28 bg-muted rounded-full animate-pulse" />
          <div className="h-6 w-40 bg-muted rounded-full animate-pulse" />
        </div>
        {/* View toggle skeleton */}
        <div className="relative flex rounded-full bg-card border border-border p-0.5 shadow-lg">
          <div className="px-4 py-1 rounded-full bg-muted animate-pulse">
            <div className="h-4 w-8 bg-muted-foreground/20 rounded" />
          </div>
          <div className="px-4 py-1 rounded-full">
            <div className="h-4 w-8 bg-muted-foreground/20 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Content split: map (top) + list preview (bottom) */}
      <div className="w-full h-full flex flex-col">
        {/* Map area */}
        <div className="relative flex-1 min-h-[45%] bg-muted animate-pulse">
          <div className="absolute inset-0 bg-linear-to-br from-muted-foreground/20 to-transparent opacity-50" />

          {/* Mock markers */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-6 h-6 bg-blue-400 rounded-full opacity-60 animate-pulse" />
          </div>
          <div className="absolute top-1/3 right-1/3 -translate-x-1/2 -translate-y-1/2">
            <div className="w-6 h-6 bg-blue-400 rounded-full opacity-40 animate-pulse" />
          </div>
          <div className="absolute bottom-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2">
            <div className="w-6 h-6 bg-blue-400 rounded-full opacity-50 animate-pulse" />
          </div>

          {/* Loading text overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/90 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500 animate-pulse" />
              <TextShimmer className="text-sm font-medium" duration={2}>
                {`Finding nearby ${type}...`}
              </TextShimmer>
            </div>
          </div>

          {/* Map controls skeleton */}
          <div className="absolute bottom-4 right-4 space-y-2">
            <div className="w-8 h-8 bg-border rounded shadow-sm animate-pulse" />
            <div className="w-8 h-8 bg-border rounded shadow-sm animate-pulse" />
          </div>
        </div>

        {/* List preview area */}
        <div className="h-[38%] bg-card border-t border-border px-4 sm:px-6 py-3 overflow-hidden">
          <div className="mx-auto max-w-3xl space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-16 w-20 sm:h-20 sm:w-28 rounded-md bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                    <div className="h-5 w-12 rounded-full bg-muted animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Modern code interpreter components
const LineNumbers = memo(({ count }: { count: number }) => (
  <div className="hidden sm:block select-none w-8 sm:w-10 shrink-0 border-r border-border bg-muted/50 py-0">
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        className="text-[10px] h-5 flex items-center justify-end text-muted-foreground pr-2 font-mono"
      >
        {i + 1}
      </div>
    ))}
  </div>
));
LineNumbers.displayName = 'LineNumbers';

const StatusBadge = memo(({ status }: { status: 'running' | 'completed' | 'error' }) => {
  if (status === 'completed') return null;

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1 text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-md text-[9px] font-medium">
        <XCircle className="h-2.5 w-2.5" />
        <span className="hidden sm:inline">Error</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10">
      <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
      <span className="hidden sm:inline text-[9px] font-medium text-primary">Running</span>
    </div>
  );
});
StatusBadge.displayName = 'StatusBadge';

const CodeBlock = memo(({ code }: { code: string; language: string }) => {
  const lines = code.split('\n');
  return (
    <div className="flex bg-muted/30">
      <LineNumbers count={lines.length} />
      <div className="overflow-x-auto w-full">
        <pre className="py-0 px-2 sm:px-3 m-0 font-mono text-[11px] sm:text-xs leading-5 text-foreground">
          {code}
        </pre>
      </div>
    </div>
  );
});
CodeBlock.displayName = 'CodeBlock';

const OutputBlock = memo(({ output, error }: { output?: string; error?: string }) => {
  if (!output && !error) return null;

  return (
    <div
      className={cn(
        'font-mono text-[11px] sm:text-xs leading-5 py-0 px-2 sm:px-3',
        error
          ? 'bg-destructive/10 text-destructive'
          : 'bg-muted/50 text-foreground/80',
      )}
    >
      <pre className="whitespace-pre-wrap overflow-x-auto">{error || output}</pre>
    </div>
  );
});

OutputBlock.displayName = 'OutputBlock';

export function CodeInterpreterView({
  code,
  output,
  language = 'python',
  title,
  status,
  error,
}: {
  code: string;
  output?: string;
  language?: string;
  title?: string;
  status?: 'running' | 'completed' | 'error';
  error?: string;
}) {
  // Set initial state based on status - expanded while running, collapsed when complete
  const [isExpanded, setIsExpanded] = useState(status !== 'completed');

  // Update expanded state when status changes
  useEffect(() => {
    // If status changes to completed, collapse the code section
    if (status === 'completed' && (output || error)) {
      setIsExpanded(false);
    }
    // Keep expanded during running or error states
    else if (status === 'running' || status === 'error') {
      setIsExpanded(true);
    }
  }, [status, output, error]);

  return (
    <div className="group overflow-hidden bg-card rounded-lg border border-border shadow-sm transition-all duration-200 hover:shadow">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between px-2.5 sm:px-3 py-2 bg-muted/50 border-b border-border gap-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 rounded-md bg-muted">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <div className="text-[9px] font-medium font-mono text-muted-foreground uppercase">
              {language}
            </div>
          </div>
          <h3 className="text-xs font-medium text-foreground truncate max-w-40 sm:max-w-xs">
            {title || 'Code Execution'}
          </h3>
          <StatusBadge status={status || 'completed'} />
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
          <CopyButton text={code} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform duration-200', isExpanded ? 'rotate-180' : '')}
            />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div>
          <div className="max-w-full overflow-x-auto max-h-60 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            <CodeBlock code={code} language={language} />
          </div>
          {(output || error) && (
            <>
              <div className="border-t border-border px-2.5 sm:px-3 py-1.5 bg-muted/50">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {error ? 'Error Output' : 'Execution Result'}
                </div>
              </div>
              <div className="max-w-full overflow-x-auto max-h-60 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <OutputBlock output={output} error={error} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Missing icon reference in CollapsibleSection

// Missing icon reference in CollapsibleSection
const Check = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const CopyButton = memo(({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className={cn(
        'h-7 w-7 transition-colors duration-150',
        copied
          ? 'text-green-500'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
});
CopyButton.displayName = 'CopyButton';
