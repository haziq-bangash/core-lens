import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getLightweightUser } from '@/app/actions';
import { addPaperToCollection, removePaperFromCollection, getPaperById } from '@/lib/db/queries';

const BodySchema = z.object({
  collectionId: z.string().min(1),
});

// POST /api/library/[id]/collections — add paper to collection
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getPaperById(id);
  if (!existing || existing.userId !== lightweightUser.userId) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const record = await addPaperToCollection({
    paperId: id,
    collectionId: parsed.data.collectionId,
  });

  return NextResponse.json({ paperCollection: record });
}

// DELETE /api/library/[id]/collections — remove paper from collection
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  await removePaperFromCollection({
    paperId: id,
    collectionId: parsed.data.collectionId,
  });

  return NextResponse.json({ message: 'Removed from collection' });
}
