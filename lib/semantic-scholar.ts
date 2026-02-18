const BASE_URL = 'https://api.semanticscholar.org/graph/v1';
const RECOMMENDATIONS_URL = 'https://api.semanticscholar.org/recommendations/v1/papers';

const FIELDS = 'paperId,title,authors,year,abstract,venue,citationCount,openAccessPdf,externalIds';

interface SemanticScholarPaper {
  paperId: string;
  title: string;
  authors?: { authorId: string; name: string }[];
  year?: number;
  abstract?: string;
  venue?: string;
  citationCount?: number;
  openAccessPdf?: { url: string };
  externalIds?: Record<string, string>;
}

/** Extract DOI from externalIds (Semantic Scholar removed top-level doi field). */
function getDoi(paper: SemanticScholarPaper): string | undefined {
  return paper.externalIds?.DOI ?? undefined;
}

interface SearchResult {
  total: number;
  offset: number;
  data: SemanticScholarPaper[];
}

interface RecommendationResult {
  recommendedPapers: SemanticScholarPaper[];
}

async function fetchWithRetry(url: string, options?: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SEMANTIC_SCHOLAR_API_KEY
          ? { 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY }
          : {}),
        ...options?.headers,
      },
    });

    if (res.ok) return res;

    // Rate limited — wait and retry
    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Semantic Scholar API error ${res.status}: ${text}`);
    }
  }

  throw new Error('Unexpected end of retry loop');
}

/**
 * Search for papers by keyword query.
 */
export async function searchPapers(
  query: string,
  options?: { limit?: number; offset?: number; year?: string },
): Promise<{ papers: SemanticScholarPaper[]; total: number }> {
  const params = new URLSearchParams({
    query,
    fields: FIELDS,
    limit: String(options?.limit ?? 10),
    offset: String(options?.offset ?? 0),
  });

  if (options?.year) {
    params.set('year', options.year);
  }

  const res = await fetchWithRetry(`${BASE_URL}/paper/search?${params}`);
  const data: SearchResult = await res.json();

  return {
    papers: data.data ?? [],
    total: data.total ?? 0,
  };
}

/**
 * Get citation-graph-based paper recommendations.
 * Accepts 1-100 positive paper IDs and optional negative examples.
 */
export async function getRecommendations(
  positivePaperIds: string[],
  options?: { negativePaperIds?: string[]; limit?: number },
): Promise<SemanticScholarPaper[]> {
  const res = await fetchWithRetry(
    `${RECOMMENDATIONS_URL}?fields=${FIELDS}&limit=${options?.limit ?? 10}`,
    {
      method: 'POST',
      body: JSON.stringify({
        positivePaperIds,
        negativePaperIds: options?.negativePaperIds ?? [],
      }),
    },
  );

  const data: RecommendationResult = await res.json();
  return data.recommendedPapers ?? [];
}

/**
 * Get paper metadata by DOI.
 */
export async function getPaperByDoi(doi: string): Promise<SemanticScholarPaper | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/paper/DOI:${encodeURIComponent(doi)}?fields=${FIELDS}`);
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Get paper metadata by Semantic Scholar paper ID.
 */
export async function getPaperById(paperId: string): Promise<SemanticScholarPaper | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/paper/${encodeURIComponent(paperId)}?fields=${FIELDS}`);
    return await res.json();
  } catch {
    return null;
  }
}

export { getDoi };
export type { SemanticScholarPaper };
