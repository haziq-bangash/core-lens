/**
 * Limits for research-library PDF uploads. Safe to import from client and server code.
 *
 * Indexing downloads the whole PDF into memory and parses it, which can take several times the
 * file size. 64 MB is safe on the current 1 GiB Cloud Run instance; raise this together with the
 * service's memory (`--memory`) if you need bigger files.
 */
export const LIBRARY_PDF_MAX_BYTES = 64 * 1024 * 1024;
export const LIBRARY_PDF_MAX_LABEL = '64 MB';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The filename part of a library blob path: flat, safe characters, ending in .pdf. Shared by the browser and the token route. */
export const LIBRARY_FILENAME_PATTERN = /^[A-Za-z0-9._-]{1,120}\.pdf$/i;

/** Blob pathname for a user's library PDF; the server only issues tokens for paths in this shape. */
export const libraryPathnamePrefix = (userId: string) => `library/${userId}/`;
