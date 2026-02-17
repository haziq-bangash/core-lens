import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getLightweightUser } from '@/app/actions';
import { getPaperById, updatePaper, deletePaper, getTagsByPaperId, getCollectionsByPaperId } from '@/lib/db/queries';

const UpdateBodySchema = z.object({
  title: z.string().min(1).optional(),
  authors: z.array(z.string()).optional(),
  abstract: z.string().optional(),
  year: z.number().optional(),
  doi: z.string().optional(),
  journal: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/library/[id] — get single paper with tags
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const paperRecord = await getPaperById(id);

  if (!paperRecord || paperRecord.userId !== lightweightUser.userId) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const [tags, collections] = await Promise.all([
    getTagsByPaperId(id),
    getCollectionsByPaperId(id),
  ]);

  return NextResponse.json({
    paper: paperRecord,
    tags: tags.map((t) => t.tag),
    collections,
  });
}

// PATCH /api/library/[id] — update paper metadata
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = UpdateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await updatePaper({ id, ...parsed.data });
  return NextResponse.json({ paper: updated });
}

// DELETE /api/library/[id] — delete paper
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getPaperById(id);

  if (!existing || existing.userId !== lightweightUser.userId) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  await deletePaper(id);
  return NextResponse.json({ message: 'Paper deleted' });
}
