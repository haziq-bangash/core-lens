import { describe, expect, test } from 'bun:test';
import { isDeletableUploadUrl, signDeleteToken, verifyDeleteToken } from './upload-delete-token';

const SECRET = 'test-secret-test-secret-test-secret';
const URL_A = 'https://store1.public.blob.vercel-storage.com/mplx/auth.png-Ab12Cd';
const URL_B = 'https://store1.public.blob.vercel-storage.com/mplx/auth.png-Zz99Yy';

describe('delete tokens', () => {
  test('accepts the token that was issued for that exact URL', () => {
    expect(verifyDeleteToken(URL_A, signDeleteToken(URL_A, SECRET), SECRET)).toBe(true);
  });

  test('rejects a token issued for a different file', () => {
    expect(verifyDeleteToken(URL_B, signDeleteToken(URL_A, SECRET), SECRET)).toBe(false);
  });

  test('rejects tokens signed with another secret', () => {
    expect(verifyDeleteToken(URL_A, signDeleteToken(URL_A, 'some-other-secret'), SECRET)).toBe(false);
  });

  test('rejects missing, empty, malformed, truncated and non-string tokens without throwing', () => {
    const good = signDeleteToken(URL_A, SECRET);
    for (const bad of [undefined, null, '', 'abc', good.slice(0, -1), good + '0', 123, {}, []]) {
      expect(verifyDeleteToken(URL_A, bad, SECRET)).toBe(false);
    }
  });

  test('tokens are deterministic per URL and differ across URLs', () => {
    expect(signDeleteToken(URL_A, SECRET)).toBe(signDeleteToken(URL_A, SECRET));
    expect(signDeleteToken(URL_A, SECRET)).not.toBe(signDeleteToken(URL_B, SECRET));
  });
});

describe('isDeletableUploadUrl', () => {
  test('allows chat attachments in our storage', () => {
    expect(isDeletableUploadUrl(URL_A)).toBe(true);
  });

  test('refuses library papers, other prefixes and the store root', () => {
    expect(isDeletableUploadUrl('https://store1.public.blob.vercel-storage.com/library/u1/paper.pdf')).toBe(false);
    expect(isDeletableUploadUrl('https://store1.public.blob.vercel-storage.com/other/file.png')).toBe(false);
    expect(isDeletableUploadUrl('https://store1.public.blob.vercel-storage.com/')).toBe(false);
  });

  test('refuses path tricks and foreign hosts', () => {
    expect(isDeletableUploadUrl('https://store1.public.blob.vercel-storage.com/mplxfoo/x.png')).toBe(false);
    expect(isDeletableUploadUrl('https://example.com/mplx/x.png')).toBe(false);
    expect(isDeletableUploadUrl('not a url')).toBe(false);
  });

  test('refuses dot-segment tricks that would escape the mplx/ prefix', () => {
    expect(isDeletableUploadUrl('https://store1.public.blob.vercel-storage.com/mplx/../library/u1/paper.pdf')).toBe(false);
    expect(isDeletableUploadUrl('https://store1.public.blob.vercel-storage.com/mplx/%2e%2e/library/u1/paper.pdf')).toBe(false);
    expect(isDeletableUploadUrl('https://store1.public.blob.vercel-storage.com/mplx/%2E%2E/%2E%2E/x')).toBe(false);
  });
});
