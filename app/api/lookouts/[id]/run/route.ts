import { NextRequest, NextResponse } from 'next/server';

import { getLightweightUser } from '@/app/actions';
import { getLookoutById } from '@/lib/db/queries';
import { runLookout } from '@/lib/lookouts';

const MIN_SECONDS_BETWEEN_MANUAL_RUNS = 60;

// POST /api/lookouts/[id]/run — "Run now": send a digest immediately without moving the schedule
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getLightweightUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const lookout = await getLookoutById({ id });
  if (!lookout || lookout.userId !== user.userId) {
    return NextResponse.json({ error: 'Lookout not found' }, { status: 404 });
  }

  if (lookout.status === 'running') {
    return NextResponse.json({ error: 'This Lookout is already running.' }, { status: 409 });
  }

  // Each run hits Semantic Scholar and sends an email, so keep a click-happy user from hammering both.
  if (lookout.lastRunAt && Date.now() - lookout.lastRunAt.getTime() < MIN_SECONDS_BETWEEN_MANUAL_RUNS * 1000) {
    return NextResponse.json({ error: 'Please wait a minute before running this again.' }, { status: 429 });
  }

  const result = await runLookout(lookout, { manual: true });

  if (result.status === 'error') {
    return NextResponse.json({ error: 'The search failed. Please try again shortly.' }, { status: 502 });
  }

  return NextResponse.json({ newPapers: result.newPapers, emailed: result.emailed });
}
