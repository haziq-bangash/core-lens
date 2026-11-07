'use client';

import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useUser } from '@/contexts/user-context';
import { UploadError, uploadLibraryPdf, validateLibraryPdf } from '@/lib/upload-client';
import { LIBRARY_PDF_MAX_LABEL } from '@/lib/upload-limits';
import { cn } from '@/lib/utils';

interface LibraryUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
  collectionId?: string | null;
}

interface UploadProgress {
  index: number;
  total: number;
  name: string;
  percent: number;
  stage: 'uploading' | 'saving';
}

export function LibraryUploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
  collectionId,
}: LibraryUploadDialogProps) {
  const { user } = useUser();
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isUploading = progress !== null;

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!user?.id || files.length === 0) return;

      // Check everything up front so problems are reported together instead of mid-way through.
      const valid: File[] = [];
      for (const file of files) {
        const problem = validateLibraryPdf(file);
        if (problem) toast.error(problem);
        else valid.push(file);
      }
      if (valid.length === 0) return;

      const controller = new AbortController();
      abortRef.current = controller;
      let added = 0;

      // One at a time: parallel uploads fight for bandwidth and make progress meaningless.
      for (const [index, file] of valid.entries()) {
        if (controller.signal.aborted) break;
        setProgress({ index, total: valid.length, name: file.name, percent: 0, stage: 'uploading' });

        try {
          const fileUrl = await uploadLibraryPdf(file, user.id, {
            signal: controller.signal,
            onProgress: (percent) => setProgress((prev) => (prev ? { ...prev, percent } : prev)),
          });

          setProgress((prev) => (prev ? { ...prev, percent: 100, stage: 'saving' } : prev));

          const res = await fetch('/api/library', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileUrl,
              fileName: file.name,
              fileSizeMb: file.size / (1024 * 1024),
              ...(collectionId ? { collectionId } : {}),
            }),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new UploadError(body?.error || 'Could not add the paper to your library.');
          }

          added++;
        } catch (error) {
          if (controller.signal.aborted) break;
          toast.error(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`);
        }
      }

      abortRef.current = null;
      setProgress(null);

      if (added > 0) {
        // Once, after the whole queue: the parent closes this dialog on completion, which would
        // otherwise hide the progress of every file after the first.
        onUploadComplete();
        toast.success(
          added === 1
            ? `"${valid[0].name}" added to your library. Indexing in the background.`
            : `${added} papers added to your library. Indexing in the background.`,
        );
      }
    },
    [user?.id, onUploadComplete, collectionId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isUploading) return;
      void uploadFiles(Array.from(e.dataTransfer.files));
    },
    [uploadFiles, isUploading],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void uploadFiles(Array.from(e.target.files || []));
      // Reset so choosing the same file again still fires onChange
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [uploadFiles],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Research Paper</DialogTitle>
          <DialogDescription>
            Upload PDFs to add them to your research library. Metadata is extracted automatically.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!isUploading) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          )}
        >
          {progress ? (
            <div className="w-full space-y-3" role="status" aria-live="polite">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium" title={progress.name}>
                  {progress.name}
                </p>
                {progress.total > 1 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {progress.index + 1} of {progress.total}
                  </span>
                )}
              </div>

              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progress.stage === 'saving' ? 'Adding to your library…' : `Uploading… ${progress.percent}%`}</span>
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-1 text-sm font-medium">Drop PDFs here or click to browse</p>
              <p className="text-xs text-muted-foreground">PDF files up to {LIBRARY_PDF_MAX_LABEL} each</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => fileInputRef.current?.click()}>
                <FileText className="mr-2 h-4 w-4" />
                Choose Files
              </Button>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
}
