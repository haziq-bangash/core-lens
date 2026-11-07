import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getLightweightUser } from '@/app/actions';
import { deleteLookout, getLookoutById, updateLookout, updateLookoutStatus } from '@/lib/db/queries';
import { isLookoutFrequency, LOOKOUT_FREQUENCY_KEYS } from '@/lib/lookout-frequencies';
import { computeNextRun, cronForFrequency, isValidTimezone } from '@/lib/lookouts';

const UpdateBodySchema = z.object({
  status: z.enum(['active', 'paused']).optional(),
  prompt: z.string().trim().min(3).max(300).optional(),
  frequency: z.enum(LOOKOUT_FREQUENCY_KEYS).optional(),
  timezone: z.string().refine(isValidTimezone, 'Unknown timezone').optional(),
});

async function getOwnedLookout(id: string, userId: string) {
  const record = await getLookoutById({ id });
  return record && record.userId === userId ? record : null;
}

// PATCH /api/lookouts/[id] — pause/resume or edit
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getLightweightUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getOwnedLookout(id, user.userId);
  if (!existing) {
    return NextResponse.json({ error: 'Lookout not found' }, { status: 404 });
  }

  const parsed = UpdateBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  const { status, prompt, frequency, timezone } = parsed.data;

  // Content/schedule edits: recompute the cron and the next run.
  if (prompt !== undefined || frequency !== undefined || timezone !== undefined) {
    const nextFrequency = frequency ?? (isLookoutFrequency(existing.frequency) ? existing.frequency : 'weekly');
    const nextTimezone = timezone ?? existing.timezone;
    const cronSchedule = cronForFrequency(nextFrequency);

    await updateLookout({
      id,
      ...(prompt !== undefined && { prompt, title: prompt.length > 60 ? `${prompt.slice(0, 57)}…` : prompt }),
      frequency: nextFrequency,
      cronSchedule,
      timezone: nextTimezone,
      nextRunAt: computeNextRun(cronSchedule, nextTimezone),
    });
  }

  if (status !== undefined && status !== existing.status) {
    // A run in progress owns the status; don't let a click race it.
    if (existing.status === 'running') {
      return NextResponse.json({ error: 'This Lookout is running right now. Try again in a moment.' }, { status: 409 });
    }

    if (status === 'active') {
      // Resuming re-arms the schedule from now so a long pause doesn't trigger an instant run.
      await updateLookout({ id, nextRunAt: computeNextRun(existing.cronSchedule, existing.timezone) });
    }
    await updateLookoutStatus({ id, status });
  }

  return NextResponse.json({ lookout: await getLookoutById({ id }) });
}

// DELETE /api/lookouts/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getLightweightUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  if (!(await getOwnedLookout(id, user.userId))) {
    return NextResponse.json({ error: 'Lookout not found' }, { status: 404 });
  }

  await deleteLookout({ id });
  return NextResponse.json({ success: true });
}
