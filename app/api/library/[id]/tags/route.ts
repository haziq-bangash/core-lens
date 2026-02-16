import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getLightweightUser } from '@/app/actions';
import { addTagToPaper, removeTagFromPaper, getPaperById } from '@/lib/db/queries';

const TagBodySchema = z.object({
  tag: z.string().min(1).max(50),
});

// POST /api/library/[id]/tags — add tag to paper
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
  const parsed = TagBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const record = await addTagToPaper({ paperId: id, tag: parsed.data.tag });
  return NextResponse.json({ tag: record });
}

// DELETE /api/library/[id]/tags — remove tag from paper
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = TagBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  await removeTagFromPaper({ paperId: id, tag: parsed.data.tag });
  return NextResponse.json({ message: 'Tag removed' });
}
