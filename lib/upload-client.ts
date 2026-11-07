import { upload } from '@vercel/blob/client';
import {
  formatBytes,
  LIBRARY_PDF_MAX_BYTES,
  LIBRARY_PDF_MAX_LABEL,
  libraryPathnamePrefix,
} from '@/lib/upload-limits';

/** An upload failure with a message that is safe to show to the user. */
export class UploadError extends Error {}

/** Returns a user-facing problem with the file, or null if it can be uploaded. */
export function validateLibraryPdf(file: { name: string; type: string; size: number }): string | null {
  const isPdf = file.type === 'application/pdf' || (file.type === '' && /\.pdf$/i.test(file.name));
  if (!isPdf) return `"${file.name}" isn't a PDF. Only PDF files are supported.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > LIBRARY_PDF_MAX_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)}. PDFs must be under ${LIBRARY_PDF_MAX_LABEL}.`;
  }
  return null;
}

/** Reduces an arbitrary filename to the safe characters the token endpoint accepts. */
export function safeBlobName(fileName: string): string {
  const base = fileName
    .replace(/\.pdf$/i, '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return `${base || 'paper'}.pdf`;
}

/** Files above this size are sent in parallel chunks, which also retries failed parts. */
const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024;

/**
 * Uploads a PDF straight from the browser to blob storage and returns its URL. The file never
 * passes through our server, so Cloud Run's 32 MB request limit doesn't apply.
 */
export async function uploadLibraryPdf(
  file: File,
  userId: string,
  options: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {},
): Promise<string> {
  const problem = validateLibraryPdf(file);
  if (problem) throw new UploadError(problem);

  try {
    const blob = await upload(`${libraryPathnamePrefix(userId)}${safeBlobName(file.name)}`, file, {
      access: 'public',
      handleUploadUrl: '/api/upload/token',
      contentType: 'application/pdf',
      multipart: file.size > MULTIPART_THRESHOLD_BYTES,
      onUploadProgress: ({ percentage }) => options.onProgress?.(Math.round(percentage)),
      abortSignal: options.signal,
    });
    return blob.url;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new UploadError('Upload cancelled.');
    console.error('[upload] Direct upload failed:', error);
    throw new UploadError('The upload failed. Check your connection and try again.');
  }
}
