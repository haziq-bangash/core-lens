import { NextRequest, NextResponse, after } from 'next/server';

import { getLightweightUser } from '@/app/actions';
import {
  getPaperById,
  getDocumentIndexByPaperId,
  saveDocumentIndex,
  updateDocumentIndex,
  updatePaper,
} from '@/lib/db/queries';
import { processAndIndexPaperPdf } from '@/lib/pdf-processing';

// POST /api/library/[id]/reindex — retry processing for a paper that failed or got stuck
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const paperRecord = await getPaperById(id);

  if (!paperRecord || paperRecord.userId !== lightweightUser.userId) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  // Only failed papers can be retried; anything else is either done or still running.
  if (paperRecord.status !== 'failed') {
    return NextResponse.json({ error: 'Only failed papers can be re-indexed' }, { status: 409 });
  }

  if (!paperRecord.fileUrl) {
    return NextResponse.json({ error: 'This paper has no file to re-index' }, { status: 422 });
  }

  const fileName = paperRecord.fileName ?? `${paperRecord.title}.pdf`;
  const fileUrl = paperRecord.fileUrl;

  // Reuse the existing index row if there is one; older papers may not have it.
  const existingIndex = await getDocumentIndexByPaperId(id);
  const documentIndexId =
    existingIndex?.id ??
    (await saveDocumentIndex({ paperId: id, userId: lightweightUser.userId, fileName, fileUrl })).id;

  await Promise.all([
    updatePaper({ id, status: 'pending', error: '' }),
    updateDocumentIndex({ id: documentIndexId, status: 'pending', error: '' }),
  ]);

  after(async () => {
    await processAndIndexPaperPdf({ paperId: id, documentIndexId, fileUrl, fileName });
  });

  return NextResponse.json({ status: 'pending', message: 'Re-indexing started.' });
}
