import { describe, expect, test } from 'bun:test';
import { validateLibraryUploadPath } from './library-upload-policy';

describe('validateLibraryUploadPath', () => {
  test('allows a flat PDF in the user\'s own folder', () => {
    expect(validateLibraryUploadPath('library/user-1/paper.pdf', 'user-1')).toBeNull();
    expect(validateLibraryUploadPath('library/user-1/My-Paper_v2.PDF', 'user-1')).toBeNull();
  });

  test('refuses another user\'s folder and the shared cleanup prefix', () => {
    expect(validateLibraryUploadPath('library/user-2/paper.pdf', 'user-1')).not.toBeNull();
    expect(validateLibraryUploadPath('mplx/public.pdf', 'user-1')).not.toBeNull();
    expect(validateLibraryUploadPath('library/user-10/paper.pdf', 'user-1')).not.toBeNull();
  });

  test('refuses path traversal and nested folders', () => {
    expect(validateLibraryUploadPath('library/user-1/../user-2/paper.pdf', 'user-1')).not.toBeNull();
    expect(validateLibraryUploadPath('library/user-1/sub/paper.pdf', 'user-1')).not.toBeNull();
    expect(validateLibraryUploadPath('library/user-1/..%2Fpaper.pdf', 'user-1')).not.toBeNull();
  });

  test('refuses non-PDF names, empty names, and overlong names', () => {
    expect(validateLibraryUploadPath('library/user-1/script.html', 'user-1')).not.toBeNull();
    expect(validateLibraryUploadPath('library/user-1/.pdf', 'user-1')).not.toBeNull();
    expect(validateLibraryUploadPath('library/user-1/', 'user-1')).not.toBeNull();
    expect(validateLibraryUploadPath(`library/user-1/${'a'.repeat(200)}.pdf`, 'user-1')).not.toBeNull();
  });
});
