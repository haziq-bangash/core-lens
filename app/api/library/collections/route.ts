import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getLightweightUser } from '@/app/actions';
import { createCollection, getCollectionsByUserId } from '@/lib/db/queries';

const CreateBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

// GET /api/library/collections — list user's collections
export async function GET() {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const collections = await getCollectionsByUserId(lightweightUser.userId);
  return NextResponse.json({ collections });
}

// POST /api/library/collections — create collection
export async function POST(req: NextRequest) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await createCollection({
    userId: lightweightUser.userId,
    ...parsed.data,
  });

  return NextResponse.json({ collection: record });
}
