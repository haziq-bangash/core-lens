import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

import { auth } from '@/lib/auth';
import { validateLibraryUploadPath } from '@/lib/library-upload-policy';
import { LIBRARY_PDF_MAX_BYTES } from '@/lib/upload-limits';

/**
 * Issues short-lived tokens that let the browser upload a library PDF straight to Vercel Blob.
 *
 * Going through our server instead hits Cloud Run's 32 MB request limit and buffers the whole
 * file in memory. The token is scoped: signed-in users only, PDFs only, a size cap, and a
 * pathname that must live under the caller's own `library/<userId>/` prefix.
 *
 * Deliberately no `onUploadCompleted`: the SDK would then require a public callback URL (it can
 * only infer one on Vercel) and throw on Cloud Run. The client creates the paper record itself
 * once the upload resolves, so the callback isn't needed.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const userId = session.user.id;
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // The pathname comes from the browser, so don't trust it.
        const refusal = validateLibraryUploadPath(pathname, userId);
        if (refusal) throw new Error(refusal);

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: LIBRARY_PDF_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId }),
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    // Validation failures are the caller's problem, not a server fault.
    const message = error instanceof Error ? error.message : 'Upload could not be authorised';
    console.warn('[upload] Token request rejected:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
