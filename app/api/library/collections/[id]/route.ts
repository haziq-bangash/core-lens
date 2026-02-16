import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getLightweightUser } from '@/app/actions';
import { updateCollection, deleteCollection, getPapersByCollectionId } from '@/lib/db/queries';

const UpdateBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

// GET /api/library/collections/[id] — get collection with papers
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const papers = await getPapersByCollectionId(id);

  return NextResponse.json({ papers });
}

// PATCH /api/library/collections/[id] — update collection
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await updateCollection({ id, ...parsed.data });
  return NextResponse.json({ collection: record });
}

// DELETE /api/library/collections/[id] — delete collection
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  await deleteCollection(id);
  return NextResponse.json({ message: 'Collection deleted' });
}
