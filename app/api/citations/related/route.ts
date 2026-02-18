import { NextRequest, NextResponse } from 'next/server';
import { searchPapers } from '@/lib/semantic-scholar';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query');
  const paperId = req.nextUrl.searchParams.get('paperId');

  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  try {
    const { papers, total } = await searchPapers(query, { limit: 6 });

    // Filter out the source paper if paperId provided
    const filtered = paperId
      ? papers.filter((p) => p.paperId !== paperId)
      : papers;

    return NextResponse.json({
      papers: filtered.slice(0, 5),
      total,
    });
  } catch (error) {
    console.error('[citations/related] Search failed:', error);
    return NextResponse.json({ error: 'Failed to search for related papers' }, { status: 500 });
  }
}
