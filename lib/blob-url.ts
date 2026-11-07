/**
 * Only URLs that point at our Vercel Blob store may be fetched and indexed by the server.
 * Without this check, a signed-in user could make the server request any URL (internal
 * services, cloud metadata endpoints, other sites) by sending it as a "file URL".
 */
export function isTrustedBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}
