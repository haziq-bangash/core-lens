import { describe, expect, test } from 'bun:test';
import { isTrustedBlobUrl } from './blob-url';

describe('isTrustedBlobUrl', () => {
  test('accepts https URLs on the Vercel Blob domain', () => {
    expect(isTrustedBlobUrl('https://abc123.public.blob.vercel-storage.com/library/u1/paper-x.pdf')).toBe(true);
  });

  test('rejects other hosts, including look-alikes', () => {
    expect(isTrustedBlobUrl('https://example.com/paper.pdf')).toBe(false);
    expect(isTrustedBlobUrl('https://blob.vercel-storage.com.evil.com/paper.pdf')).toBe(false);
    expect(isTrustedBlobUrl('https://evilblob.vercel-storage.com.attacker.io/x')).toBe(false);
    expect(isTrustedBlobUrl('https://attacker.io/?u=https://a.blob.vercel-storage.com/x')).toBe(false);
  });

  test('rejects non-https schemes and internal addresses', () => {
    expect(isTrustedBlobUrl('http://abc.public.blob.vercel-storage.com/x.pdf')).toBe(false);
    expect(isTrustedBlobUrl('http://169.254.169.254/computeMetadata/v1/')).toBe(false);
    expect(isTrustedBlobUrl('http://metadata.google.internal/')).toBe(false);
    expect(isTrustedBlobUrl('file:///etc/passwd')).toBe(false);
  });

  test('rejects garbage', () => {
    expect(isTrustedBlobUrl('')).toBe(false);
    expect(isTrustedBlobUrl('not a url')).toBe(false);
  });
});
