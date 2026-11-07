import 'server-only';

import { CronExpressionParser } from 'cron-parser';
import { getUserById, recordLookoutRun } from '@/lib/db/queries';
import type { lookout as lookoutTable } from '@/lib/db/schema';
import { LOOKOUT_FREQUENCIES, type LookoutFrequency } from '@/lib/lookout-frequencies';
import { sendLookoutDigestEmail, type DigestPaper } from '@/lib/email';
import { getDoi, searchPapers, type SemanticScholarPaper } from '@/lib/semantic-scholar';

type Lookout = typeof lookoutTable.$inferSelect;

/** The first run looks back this far so a brand-new Lookout has something to show. */
const FIRST_RUN_LOOKBACK_DAYS = 30;
/** Later runs re-check a day before the last run; already-sent papers are filtered out separately. */
const OVERLAP_MS = 24 * 60 * 60 * 1000;
const SEARCH_LIMIT = 25;
const MAX_PAPERS_PER_DIGEST = 10;

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function cronForFrequency(frequency: LookoutFrequency): string {
  return LOOKOUT_FREQUENCIES[frequency].cron;
}

export function computeNextRun(cron: string, timezone: string, from: Date = new Date()): Date {
  return CronExpressionParser.parse(cron, { currentDate: from, tz: timezone }).next().toDate();
}

const toDateParam = (date: Date) => date.toISOString().slice(0, 10);

/** Failed scheduled runs retry after this long, up to MAX_CONSECUTIVE_RETRIES times in a row. */
const RETRY_AFTER_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_RETRIES = 3;

/**
 * Belt and braces for the API-side date filter: never include a paper dated before `since`.
 * Papers with only a year are kept when that year is the same as or after `since`'s year.
 */
function isPublishedSince(paper: SemanticScholarPaper, since: Date): boolean {
  if (paper.publicationDate) return paper.publicationDate >= toDateParam(since);
  if (paper.year) return paper.year >= since.getUTCFullYear();
  return false;
}

function trailingErrors(history: Array<{ status?: string }>): number {
  let count = 0;
  for (let i = history.length - 1; i >= 0 && history[i].status === 'error'; i--) count++;
  return count;
}

function toDigestPaper(paper: SemanticScholarPaper): DigestPaper {
  const doi = getDoi(paper);
  return {
    title: paper.title,
    authors: paper.authors?.map((a) => a.name) ?? [],
    year: paper.year,
    venue: paper.venue || null,
    abstract: paper.abstract ?? null,
    citationCount: paper.citationCount ?? null,
    url: doi ? `https://doi.org/${doi}` : `https://www.semanticscholar.org/paper/${paper.paperId}`,
    pdfUrl: paper.openAccessPdf?.url ?? null,
  };
}

export interface LookoutRunResult {
  status: 'success' | 'error';
  newPapers: number;
  emailed: boolean;
  error?: string;
}

/**
 * Runs one Lookout: finds papers matching its topic published since the last run, drops the
 * ones already sent, and emails a digest if anything new turned up.
 *
 * `manual` runs (the "Run now" button and the first run after creating a Lookout) leave the
 * schedule untouched; scheduled runs advance `nextRunAt`.
 */
export async function runLookout(lookout: Lookout, { manual = false }: { manual?: boolean } = {}): Promise<LookoutRunResult> {
  const startedAt = new Date();
  const nextRunAt = manual ? lookout.nextRunAt : computeNextRun(lookout.cronSchedule, lookout.timezone, startedAt);

  try {
    const user = await getUserById(lookout.userId);
    if (!user) throw new Error('Lookout owner no longer exists');

    const history = (lookout.runHistory ?? []) as Array<{ paperIds?: string[] }>;
    const alreadySent = new Set(history.flatMap((run) => run.paperIds ?? []));

    const since = lookout.lastRunAt
      ? new Date(lookout.lastRunAt.getTime() - OVERLAP_MS)
      : new Date(startedAt.getTime() - FIRST_RUN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const { papers } = await searchPapers(lookout.prompt, {
      limit: SEARCH_LIMIT,
      publicationDateOrYear: `${toDateParam(since)}:`,
    });

    const fresh = papers
      .filter((paper) => paper.title && !alreadySent.has(paper.paperId) && isPublishedSince(paper, since))
      // Papers without an abstract make poor digest entries; keep them only as a fallback.
      .sort((a, b) => Number(Boolean(b.abstract)) - Number(Boolean(a.abstract)))
      .slice(0, MAX_PAPERS_PER_DIGEST);

    let emailed = false;
    if (fresh.length > 0) {
      await sendLookoutDigestEmail({
        to: user.email,
        name: user.name,
        topic: lookout.prompt,
        papers: fresh.map(toDigestPaper),
      });
      emailed = true;
    }

    await recordLookoutRun({
      id: lookout.id,
      runAt: startedAt,
      nextRunAt,
      status: 'success',
      duration: Date.now() - startedAt.getTime(),
      paperIds: fresh.map((paper) => paper.paperId),
      newPapers: fresh.length,
      keepStatus: manual,
    });

    return { status: 'success', newPapers: fresh.length, emailed };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[lookouts] Run failed for ${lookout.id}:`, error);

    // Always release the claim, otherwise one broken run would be retried by every scheduler tick.
    // Transient failures (e.g. Semantic Scholar rate limits) retry soon rather than skipping a
    // whole day or week; after a few failures in a row we fall back to the normal schedule.
    const failuresSoFar = trailingErrors((lookout.runHistory ?? []) as Array<{ status?: string }>);
    const retryAt =
      !manual && failuresSoFar < MAX_CONSECUTIVE_RETRIES ? new Date(startedAt.getTime() + RETRY_AFTER_MS) : null;

    await recordLookoutRun({
      id: lookout.id,
      runAt: startedAt,
      nextRunAt: retryAt && retryAt < nextRunAt ? retryAt : nextRunAt,
      status: 'error',
      error: message.slice(0, 300),
      duration: Date.now() - startedAt.getTime(),
      keepStatus: manual,
    }).catch((recordError) => console.error('[lookouts] Failed to record failed run:', recordError));

    return { status: 'error', newPapers: 0, emailed: false, error: message };
  }
}
