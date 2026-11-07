import { NextRequest, NextResponse } from 'next/server';

import { serverEnv } from '@/env/server';
import { claimDueLookouts } from '@/lib/db/queries';
import { runLookout } from '@/lib/lookouts';

// Cloud Run's default request timeout is 5 minutes; stop starting new runs well before that.
const TIME_BUDGET_MS = 4 * 60 * 1000;
// Semantic Scholar's unauthenticated tier is ~1 request/second.
const DELAY_BETWEEN_RUNS_MS = 1100;
const BATCH_SIZE = 20;

// GET /api/cron/lookouts — called by Cloud Scheduler (e.g. hourly) with `Authorization: Bearer $CRON_SECRET`
export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${serverEnv.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const startedAt = Date.now();
  const claimed = await claimDueLookouts({ limit: BATCH_SIZE });

  let succeeded = 0;
  let failed = 0;
  let digestsSent = 0;
  let skipped = 0;

  for (const [index, lookout] of claimed.entries()) {
    // Out of time: leave the rest claimed-but-unrun. They're reclaimed after the stuck timeout.
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      skipped = claimed.length - index;
      break;
    }

    const result = await runLookout(lookout);
    if (result.status === 'success') succeeded++;
    else failed++;
    if (result.emailed) digestsSent++;

    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_RUNS_MS));
  }

  return NextResponse.json({ claimed: claimed.length, succeeded, failed, digestsSent, skipped });
}
