import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { after } from 'next/server';

import { getLightweightUser } from '@/app/actions';
import {
  createPaper,
  getPapersByUserId,
  saveDocumentIndex,
} from '@/lib/db/queries';
import { processAndIndexPaperPdf } from '@/lib/pdf-processing';

const UploadBodySchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  fileSizeMb: z.number().optional(),
});

// GET /api/library — list user's papers
export async function GET(req: NextRequest) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const status = searchParams.get('status') || undefined;

  const papers = await getPapersByUserId({
    userId: lightweightUser.userId,
    limit,
    offset,
    status,
  });

  return NextResponse.json({ papers });
}

// POST /api/library — upload a new paper
export async function POST(req: NextRequest) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = UploadBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }

  const { fileUrl, fileName, fileSizeMb } = parsed.data;

  // Create the paper record
  const paperRecord = await createPaper({
    userId: lightweightUser.userId,
    title: fileName.replace(/\.pdf$/i, ''),
    fileName,
    fileUrl,
    fileSizeMb,
  });

  // Create the document index record linked to the paper
  const docIndex = await saveDocumentIndex({
    paperId: paperRecord.id,
    userId: lightweightUser.userId,
    fileName,
    fileUrl,
  });

  // Kick off background processing
  after(async () => {
    await processAndIndexPaperPdf({
      paperId: paperRecord.id,
      documentIndexId: docIndex.id,
      fileUrl,
      fileName,
    });
  });

  return NextResponse.json({
    paper: paperRecord,
    documentIndexId: docIndex.id,
    message: 'Paper upload started. Processing in background.',
  });
}
