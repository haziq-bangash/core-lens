import { put, del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { serverEnv } from '@/env/server';
import { auth } from '@/lib/auth';
import { isDeletableUploadUrl, signDeleteToken, verifyDeleteToken } from '@/lib/upload-delete-token';

// File validation schema
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 50 * 1024 * 1024, {
      message: 'File size should be less than 50MB',
    })
    .refine(
      (file) => {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        return validTypes.includes(file.type);
      },
      {
        message: 'File type should be JPEG, PNG, GIF or PDF',
      },
    ),
});

export async function POST(request: NextRequest) {
  // Check for authentication but don't require it
  let isAuthenticated = false;
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    isAuthenticated = !!session;
  } catch (error) {
    console.warn('Error checking authentication:', error);
    // Continue as unauthenticated
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  // Validate file
  const validatedFile = FileSchema.safeParse({ file });
  if (!validatedFile.success) {
    const errorMessage = validatedFile.error.cause as string;

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  try {
    // Use a different prefix for authenticated vs unauthenticated uploads
    const prefix = isAuthenticated ? 'auth' : 'public';

    const blob = await put(`mplx/${prefix}.${file.name.split('.').pop()}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return NextResponse.json({
      name: file.name,
      contentType: file.type,
      url: blob.url,
      size: file.size,
      authenticated: isAuthenticated,
      // Proof that the caller uploaded this file; required to delete it later.
      deleteToken: signDeleteToken(blob.url, serverEnv.BETTER_AUTH_SECRET),
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

/**
 * Deletes a chat attachment (used when the user removes a draft attachment before sending).
 *
 * Anyone can call this route, including guests, and blob URLs are not secret, so authentication
 * can't decide who may delete a file. The caller must present the delete token issued when the
 * file was uploaded, and only `mplx/` chat attachments can be deleted this way.
 */
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const url = body?.url;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }

  if (!isDeletableUploadUrl(url)) {
    return NextResponse.json({ error: 'This file cannot be deleted' }, { status: 400 });
  }

  if (!verifyDeleteToken(url, body?.token, serverEnv.BETTER_AUTH_SECRET)) {
    return NextResponse.json({ error: 'Not allowed to delete this file' }, { status: 403 });
  }

  try {
    await del(url);
    return NextResponse.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
