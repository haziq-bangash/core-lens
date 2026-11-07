'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { BellRing, Loader2, Mail, Pause, Play, Plus, Trash2, Zap } from 'lucide-react';

import { AppSidebar } from '@/components/app-sidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/contexts/user-context';
import { LOOKOUT_FREQUENCIES, LOOKOUT_FREQUENCY_KEYS, type LookoutFrequency } from '@/lib/lookout-frequencies';
import { cn } from '@/lib/utils';

interface LookoutItem {
  id: string;
  title: string;
  prompt: string;
  frequency: string;
  timezone: string;
  status: 'active' | 'paused' | 'running' | 'archived';
  nextRunAt: string;
  createdAt: string;
  lastRunAt: string | null;
  lastRun: { status: string; newPapers: number; error?: string } | null;
  totalPapersSent: number;
}

const EXAMPLE_TOPICS = [
  'CRISPR base editing off-target effects',
  'Retrieval-augmented generation evaluation',
  'Long COVID biomarkers',
  'Perovskite solar cell stability',
];

/** A brand-new Lookout sends its first digest in the background; treat it as pending for a couple of minutes. */
const FIRST_RUN_WINDOW_MS = 2 * 60 * 1000;
const isFirstRunPending = (item: Pick<LookoutItem, 'lastRunAt' | 'createdAt' | 'status'>) =>
  item.status !== 'paused' && !item.lastRunAt && Date.now() - new Date(item.createdAt).getTime() < FIRST_RUN_WINDOW_MS;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? 'Something went wrong');
  return body as T;
}

export function LookoutsPage() {
  const { user, isProUser } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [draftTopic, setDraftTopic] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LookoutItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['lookouts'],
    queryFn: () => request<{ lookouts: LookoutItem[]; limit: number }>('/api/lookouts'),
    enabled: !!user,
    // The first digest is sent in the background right after creating, so refresh while anything runs.
    refetchInterval: (query) =>
      query.state.data?.lookouts.some((l) => l.status === 'running' || isFirstRunPending(l)) ? 3000 : false,
  });

  const lookouts = data?.lookouts ?? [];
  const limit = data?.limit ?? 0;
  const atLimit = limit > 0 && lookouts.length >= limit;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['lookouts'] });

  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'paused' }) =>
      request(`/api/lookouts/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const runNow = useMutation({
    mutationFn: (id: string) => request<{ newPapers: number; emailed: boolean }>(`/api/lookouts/${id}/run`, { method: 'POST' }),
    onSuccess: (result) => {
      toast.success(
        result.emailed
          ? `Sent a digest with ${result.newPapers} new ${result.newPapers === 1 ? 'paper' : 'papers'}.`
          : 'No new papers right now. We’ll email you when something turns up.',
      );
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => request(`/api/lookouts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Lookout deleted');
      setDeleteTarget(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = (topic = '') => {
    setDraftTopic(topic);
    setCreateOpen(true);
  };

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <BellRing className="size-8 text-primary" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">Lookouts</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Pick a topic and get an email whenever new papers appear on it.
          </p>
          <Button onClick={() => router.push('/sign-in')} size="lg">
            Sign in to get started
          </Button>
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
      <div className="flex min-h-screen w-full flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <SidebarTrigger className="size-8" />
          <h1 className="text-lg font-semibold">Lookouts</h1>
          {limit > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {lookouts.length} / {limit}
            </span>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => openCreate()}
            disabled={atLimit}
            title={atLimit ? `You've reached your limit of ${limit} Lookouts` : undefined}
          >
            <Plus className="size-4" />
            <span className="max-sm:sr-only">New Lookout</span>
          </Button>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-8">
          <p className="mb-6 text-sm text-muted-foreground">
            A Lookout watches a research topic and emails you a digest of new papers on a schedule, so you
            don&apos;t have to keep searching.
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : lookouts.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
                <BellRing className="size-6 text-primary" />
              </div>
              <h2 className="mb-1 text-base font-semibold">No Lookouts yet</h2>
              <p className="mx-auto mb-5 max-w-sm text-sm text-muted-foreground">
                Start with a topic you follow. Here are a few ideas:
              </p>
              <div className="mb-6 flex flex-wrap justify-center gap-2">
                {EXAMPLE_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => openCreate(topic)}
                    className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {topic}
                  </button>
                ))}
              </div>
              <Button onClick={() => openCreate()} className="gap-1.5">
                <Plus className="size-4" />
                Create your first Lookout
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {lookouts.map((item) => (
                <LookoutCard
                  key={item.id}
                  item={item}
                  isRunning={runNow.isPending && runNow.variables === item.id}
                  isToggling={toggle.isPending && toggle.variables?.id === item.id}
                  onRun={() => runNow.mutate(item.id)}
                  onToggle={() =>
                    toggle.mutate({ id: item.id, status: item.status === 'paused' ? 'active' : 'paused' })
                  }
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
            </ul>
          )}

          {atLimit && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              You&apos;ve reached your limit of {limit} Lookouts.
              {!isProUser && ' Upgrade to Pro to keep more.'}
            </p>
          )}
        </main>
      </div>

      <CreateLookoutDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialTopic={draftTopic}
        email={user.email}
        onCreated={() => {
          setCreateOpen(false);
          refresh();
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Lookout?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll stop receiving digests for &ldquo;{deleteTarget?.title}&rdquo;. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface LookoutCardProps {
  item: LookoutItem;
  isRunning: boolean;
  isToggling: boolean;
  onRun: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function LookoutCard({ item, isRunning, isToggling, onRun, onToggle, onDelete }: LookoutCardProps) {
  const isPaused = item.status === 'paused';
  const firstRunPending = isFirstRunPending(item);
  const isBusy = item.status === 'running' || isRunning || firstRunPending;
  const frequency = LOOKOUT_FREQUENCIES[item.frequency as LookoutFrequency];

  let lastRunText = firstRunPending ? 'Sending your first digest…' : 'Not run yet';
  if (item.lastRunAt && item.lastRun) {
    const when = formatDistanceToNow(new Date(item.lastRunAt), { addSuffix: true });
    lastRunText =
      item.lastRun.status === 'error'
        ? `Last run failed ${when}`
        : `${item.lastRun.newPapers} new ${item.lastRun.newPapers === 1 ? 'paper' : 'papers'} ${when}`;
  }

  return (
    <li className={cn('rounded-xl border bg-card/50 p-4 transition-colors', isPaused && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium leading-snug">{item.prompt}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[11px]">
              {frequency?.label ?? item.frequency}
            </Badge>
            {isPaused ? (
              <Badge variant="outline" className="text-[11px]">
                Paused
              </Badge>
            ) : isBusy ? (
              <Badge variant="outline" className="gap-1 text-[11px]">
                <Loader2 className="size-3 animate-spin" />
                {firstRunPending ? 'First digest' : 'Searching'}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onToggle}
            disabled={isToggling || isBusy}
            aria-label={isPaused ? 'Resume Lookout' : 'Pause Lookout'}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete Lookout"
            title="Delete"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p className={cn(item.lastRun?.status === 'error' && 'text-destructive')}>{lastRunText}</p>
          {!isPaused && (
            <p>
              Next digest{' '}
              {new Date(item.nextRunAt).toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onRun} disabled={isBusy}>
          {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
          Run now
        </Button>
      </div>
    </li>
  );
}

interface CreateLookoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTopic: string;
  email?: string;
  onCreated: () => void;
}

function CreateLookoutDialog({ open, onOpenChange, initialTopic, email, onCreated }: CreateLookoutDialogProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [frequency, setFrequency] = useState<LookoutFrequency>('weekly');
  const [prevOpen, setPrevOpen] = useState(open);

  // Reset to the requested topic each time the dialog opens.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setTopic(initialTopic);
  }

  const create = useMutation({
    mutationFn: () =>
      request('/api/lookouts', {
        method: 'POST',
        body: JSON.stringify({
          prompt: topic,
          frequency,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      }),
    onSuccess: () => {
      toast.success('Lookout created. Your first digest is on its way.');
      onCreated();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const trimmed = topic.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>New Lookout</DialogTitle>
          <DialogDescription>Describe what you want to follow. Be specific for better matches.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed.length >= 3) create.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="lookout-topic">Topic</Label>
            <Textarea
              id="lookout-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              maxLength={300}
              rows={3}
              placeholder="e.g. graph neural networks for drug discovery"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lookout-frequency">How often</Label>
            <Select value={frequency} onValueChange={(value) => setFrequency(value as LookoutFrequency)}>
              <SelectTrigger id="lookout-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOOKOUT_FREQUENCY_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {LOOKOUT_FREQUENCIES[key].label} · {LOOKOUT_FREQUENCIES[key].description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {email && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="size-3.5 shrink-0" />
              Digests are sent to {email} at 8:00 in your local time.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={trimmed.length < 3 || create.isPending}>
              {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create Lookout
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
