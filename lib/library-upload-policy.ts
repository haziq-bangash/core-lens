import { LIBRARY_FILENAME_PATTERN, libraryPathnamePrefix } from '@/lib/upload-limits';

/**
 * The browser chooses the blob pathname, so the token endpoint must not trust it. Returns the
 * reason a pathname is refused, or null if the user may upload to it: a flat PDF filename
 * inside the user's own `library/<userId>/` folder.
 */
export function validateLibraryUploadPath(pathname: string, userId: string): string | null {
  const prefix = libraryPathnamePrefix(userId);
  if (!pathname.startsWith(prefix)) return 'Invalid upload path';
  if (!LIBRARY_FILENAME_PATTERN.test(pathname.slice(prefix.length))) return 'Invalid upload path';
  return null;
}
