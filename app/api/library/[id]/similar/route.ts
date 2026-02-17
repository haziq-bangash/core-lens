import { NextRequest, NextResponse } from 'next/server';

import { getLightweightUser } from '@/app/actions';
import { getPaperById } from '@/lib/db/queries';
import { searchPapers, getRecommendations, type SemanticScholarPaper } from '@/lib/semantic-scholar';

// GET /api/library/[id]/similar — find similar papers
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const paper = await getPaperById(id);

  if (!paper || paper.userId !== lightweightUser.userId) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  try {
    let results: SemanticScholarPaper[] = [];

    // Strategy 1: If paper has a DOI, use Semantic Scholar recommendations
    if (paper.doi) {
      try {
        results = await getRecommendations([`DOI:${paper.doi}`], { limit: 10 });
      } catch (e) {
        console.warn('[Similar] DOI-based recommendations failed, falling back to keyword search', e);
      }
    }

    // Strategy 2: Fall back to keyword search using title + key terms from abstract
    if (results.length === 0 && paper.title) {
      const query = paper.title.slice(0, 200);
      const { papers } = await searchPapers(query, { limit: 10 });
      // Filter out the paper itself
      results = papers.filter((p) => {
        const pDoi = p.externalIds?.DOI;
        if (paper.doi && pDoi === paper.doi) return false;
        if (p.title.toLowerCase() === paper.title.toLowerCase()) return false;
        return true;
      });
    }

    return NextResponse.json({
      papers: results.map((p) => ({
        paperId: p.paperId,
        title: p.title,
        authors: p.authors?.map((a) => a.name) ?? [],
        year: p.year,
        abstract: p.abstract,
        doi: p.externalIds?.DOI ?? null,
        venue: p.venue,
        citationCount: p.citationCount,
        openAccessPdfUrl: p.openAccessPdf?.url ?? null,
      })),
    });
  } catch (error) {
    console.error('[Similar] Error finding similar papers:', error);
    return NextResponse.json({ error: 'Failed to find similar papers' }, { status: 500 });
  }
}
