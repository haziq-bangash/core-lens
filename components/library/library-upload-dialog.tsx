'use client';

import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface LibraryUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
  collectionId?: string | null;
}

export function LibraryUploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
  collectionId,
}: LibraryUploadDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        toast.error('Only PDF files are supported');
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }

      setIsUploading(true);
      setUploadProgress('Uploading file...');

      try {
        // Step 1: Upload to blob storage
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || 'Upload failed');
        }

        const { url: fileUrl } = await uploadRes.json();

        setUploadProgress('Creating paper record...');

        // Step 2: Create paper and start indexing
        const libraryRes = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl,
            fileName: file.name,
            fileSizeMb: file.size / (1024 * 1024),
            ...(collectionId ? { collectionId } : {}),
          }),
        });

        if (!libraryRes.ok) {
          const err = await libraryRes.json();
          throw new Error(err.error || 'Failed to create paper');
        }

        toast.success(`"${file.name}" added to your library. Processing in background.`);
        onUploadComplete();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
      }
    },
    [onUploadComplete, collectionId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        // Upload files sequentially
        files.forEach((file) => uploadFile(file));
      }
    },
    [uploadFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach((file) => uploadFile(file));
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [uploadFile],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Research Paper</DialogTitle>
          <DialogDescription>
            Upload a PDF to add it to your research library. Metadata will be automatically extracted.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            isUploading && 'pointer-events-none opacity-70',
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-10 w-10 mb-3 text-primary animate-spin" />
              <p className="text-sm font-medium">{uploadProgress}</p>
              <p className="text-xs text-muted-foreground mt-1">This may take a moment...</p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Drop PDF here or click to browse</p>
              <p className="text-xs text-muted-foreground">PDF files up to 50MB</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="h-4 w-4 mr-2" />
                Choose File
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
