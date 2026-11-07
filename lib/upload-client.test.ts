import { describe, expect, test } from 'bun:test';
import { LIBRARY_FILENAME_PATTERN } from './upload-limits';
import { safeBlobName, validateLibraryPdf } from './upload-client';

const MB = 1024 * 1024;

describe('validateLibraryPdf', () => {
  test('accepts a normal PDF, including one over the old 32 MB proxy limit', () => {
    expect(validateLibraryPdf({ name: 'a.pdf', type: 'application/pdf', size: 3 * MB })).toBeNull();
    expect(validateLibraryPdf({ name: 'book.pdf', type: 'application/pdf', size: 60 * MB })).toBeNull();
  });

  test('accepts a PDF whose type the browser could not detect', () => {
    expect(validateLibraryPdf({ name: 'scan.PDF', type: '', size: MB })).toBeNull();
  });

  test('rejects non-PDFs, empty files, and files over the limit with a readable reason', () => {
    expect(validateLibraryPdf({ name: 'x.png', type: 'image/png', size: MB })).toContain('PDF');
    expect(validateLibraryPdf({ name: 'x.pdf', type: 'application/pdf', size: 0 })).toContain('empty');
    expect(validateLibraryPdf({ name: 'big.pdf', type: 'application/pdf', size: 65 * MB })).toContain('64 MB');
  });
});

describe('safeBlobName', () => {
  test('keeps simple names and normalises the extension', () => {
    expect(safeBlobName('paper.pdf')).toBe('paper.pdf');
    expect(safeBlobName('Paper.PDF')).toBe('Paper.pdf');
  });

  test('replaces spaces, slashes and unusual characters', () => {
    expect(safeBlobName('My Paper (v2) / final.pdf')).toBe('My-Paper-v2-final.pdf');
    expect(safeBlobName('../../etc/passwd.pdf')).toBe('etc-passwd.pdf');
  });

  test('falls back when nothing safe is left and caps the length', () => {
    expect(safeBlobName('日本語.pdf')).toBe('paper.pdf');
    expect(safeBlobName(`${'a'.repeat(300)}.pdf`).length).toBeLessThanOrEqual(84);
  });

  test('always satisfies the pattern the token endpoint enforces', () => {
    for (const name of ['x.pdf', 'weird name!!.pdf', '...pdf', '日本語.pdf', 'a'.repeat(500) + '.pdf']) {
      expect(LIBRARY_FILENAME_PATTERN.test(safeBlobName(name))).toBe(true);
    }
  });
});
