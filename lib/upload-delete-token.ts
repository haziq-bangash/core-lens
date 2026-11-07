import { createHmac, timingSafeEqual } from 'node:crypto';
import { isTrustedBlobUrl } from '@/lib/blob-url';

/**
 * Proof that the caller is the one who uploaded a chat attachment.
 *
 * Blob URLs are not secret (they appear in shared chats), and guests can upload without an
 * account, so "is logged in" can't decide who may delete a file. Instead the upload response
 * includes an HMAC of the URL that only the uploader receives; deleting requires presenting it.
 * The token is never added to messages, so it never reaches a shared chat.
 */
export function signDeleteToken(url: string, secret: string): string {
  return createHmac('sha256', secret).update(`upload-delete:${url}`).digest('hex');
}

export function verifyDeleteToken(url: string, token: unknown, secret: string): boolean {
  if (typeof token !== 'string' || token.length === 0) return false;

  const expected = Buffer.from(signDeleteToken(url, secret));
  const received = Buffer.from(token);
  // timingSafeEqual throws on different lengths, which would itself leak the length check.
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Chat attachments live under `mplx/`. Library papers (`library/…`) are never deletable here. */
export function isDeletableUploadUrl(value: string): boolean {
  if (!isTrustedBlobUrl(value)) return false;
  try {
    return new URL(value).pathname.startsWith('/mplx/');
  } catch {
    return false;
  }
}
