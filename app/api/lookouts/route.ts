import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';

import { getLightweightUser } from '@/app/actions';
import { LOOKOUT_LIMITS } from '@/lib/constants';
import { countActiveLookoutsByUserId, createLookout, getLookoutById, getLookoutsByUserId } from '@/lib/db/queries';
import { LOOKOUT_FREQUENCY_KEYS } from '@/lib/lookout-frequencies';
import { computeNextRun, cronForFrequency, isValidTimezone, runLookout } from '@/lib/lookouts';

const CreateBodySchema = z.object({
  prompt: z.string().trim().min(3, 'Describe a topic to watch').max(300, 'Keep the topic under 300 characters'),
  frequency: z.enum(LOOKOUT_FREQUENCY_KEYS),
  timezone: z.string().refine(isValidTimezone, 'Unknown timezone'),
});

// GET /api/lookouts — list the user's Lookouts
export async function GET() {
  const user = await getLightweightUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const lookouts = await getLookoutsByUserId({ userId: user.userId });

  return NextResponse.json({
    lookouts: lookouts.map(({ runHistory, ...rest }) => {
      const history = (runHistory ?? []) as Array<{ status: string; newPapers?: number; error?: string }>;
      const lastRun = history.at(-1);
      return {
        ...rest,
        lastRun: lastRun ? { status: lastRun.status, newPapers: lastRun.newPapers ?? 0, error: lastRun.error } : null,
        totalPapersSent: history.reduce((sum, run) => sum + (run.newPapers ?? 0), 0),
      };
    }),
    limit: user.isProUser ? LOOKOUT_LIMITS.PRO : LOOKOUT_LIMITS.FREE,
  });
}

// POST /api/lookouts — create a Lookout and run it once straight away
export async function POST(req: NextRequest) {
  const user = await getLightweightUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const parsed = CreateBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  const limit = user.isProUser ? LOOKOUT_LIMITS.PRO : LOOKOUT_LIMITS.FREE;
  if ((await countActiveLookoutsByUserId({ userId: user.userId })) >= limit) {
    return NextResponse.json(
      {
        error: user.isProUser
          ? `You can keep up to ${limit} Lookouts.`
          : `Free accounts can keep ${limit} Lookouts. Upgrade to Pro for up to ${LOOKOUT_LIMITS.PRO}.`,
      },
      { status: 403 },
    );
  }

  const { prompt, frequency, timezone } = parsed.data;
  const cronSchedule = cronForFrequency(frequency);

  const created = await createLookout({
    userId: user.userId,
    title: prompt.length > 60 ? `${prompt.slice(0, 57)}…` : prompt,
    prompt,
    frequency,
    cronSchedule,
    timezone,
    nextRunAt: computeNextRun(cronSchedule, timezone),
  });

  // Send a first digest right away so the user sees it working (doesn't move the schedule).
  after(async () => {
    const fresh = await getLookoutById({ id: created.id });
    if (fresh) await runLookout(fresh, { manual: true });
  });

  return NextResponse.json({ lookout: created }, { status: 201 });
}
