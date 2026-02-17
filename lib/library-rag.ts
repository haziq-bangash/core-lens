import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { PageIndexRAG, type DocumentIndex, type PageContent } from '@/lib/page-index-rag';
import type { CitationSource } from '@/lib/types';

/**
 * Two-stage cross-document RAG for library-wide search.
 *
 * Stage 1 — Document Selection:
 *   Uses paper metadata (title, abstract, tags) to select the most relevant
 *   papers for a query. Fast because only metadata is examined.
 *
 * Stage 2 — Deep Search:
 *   Runs PageIndexRAG.retrieveContextWithCitations on selected papers.
 *   Merges results across papers with a global token budget.
 */

interface PaperMeta {
  paperId: string;
  title: string;
  abstract?: string | null;
  tags?: string[];
  index: {
    id: string;
    treeIndex: any;
    pageContents: PageContent[];
    fileName: string;
    fileUrl: string | null;
  };
}

const PaperRankingSchema = z.object({
  selectedPaperIds: z
    .array(z.string())
    .describe('IDs of the most relevant papers for the query, ordered by relevance'),
});

export class LibraryRAG {
  private maxPapers: number;

  constructor(options?: { maxPapers?: number }) {
    this.maxPapers = options?.maxPapers ?? 5;
  }

  /**
   * Stage 1: Select the most relevant papers based on metadata.
   */
  private async selectRelevantPapers(
    query: string,
    papers: PaperMeta[],
  ): Promise<PaperMeta[]> {
    // If we have few papers, skip LLM selection and search them all
    if (papers.length <= this.maxPapers) {
      return papers;
    }

    // Build a concise metadata summary for the LLM
    const paperSummaries = papers.map((p, i) => {
      const parts = [`[${p.paperId}] "${p.title}"`];
      if (p.abstract) parts.push(`Abstract: ${p.abstract.slice(0, 200)}...`);
      if (p.tags?.length) parts.push(`Tags: ${p.tags.join(', ')}`);
      return parts.join('\n  ');
    });

    const prompt = `Given the following research question, select the ${this.maxPapers} most relevant papers to search for answers. Return ONLY their paper IDs.

Question: ${query}

Papers:
${paperSummaries.join('\n\n')}

Select the ${this.maxPapers} most relevant paper IDs for this question.`;

    try {
      const model = new ChatOpenAI({
        model: 'gpt-4.1-mini',
        temperature: 0,
      });

      const structured = model.withStructuredOutput(PaperRankingSchema);
      const result = await structured.invoke(prompt);

      const selectedIds = new Set(result.selectedPaperIds);
      const selected = papers.filter((p) => selectedIds.has(p.paperId));

      // If LLM returned valid results, use them; otherwise fall back to first N
      return selected.length > 0 ? selected.slice(0, this.maxPapers) : papers.slice(0, this.maxPapers);
    } catch (error) {
      console.warn('[LibraryRAG] Paper selection failed, using first N papers:', error);
      return papers.slice(0, this.maxPapers);
    }
  }

  /**
   * Stage 2: Deep search across selected papers.
   */
  private async deepSearch(
    query: string,
    papers: PaperMeta[],
  ): Promise<{
    results: Array<{
      paperId: string;
      paperTitle: string;
      fileName: string;
      fileUrl: string | null;
      context: string;
    }>;
    citations: CitationSource[];
  }> {
    const allResults: Array<{
      paperId: string;
      paperTitle: string;
      fileName: string;
      fileUrl: string | null;
      context: string;
    }> = [];
    const allCitations: CitationSource[] = [];
    let citationCounter = 1;

    for (const paper of papers) {
      try {
        const rag = new PageIndexRAG();
        rag.loadIndexWithPages(
          paper.index.treeIndex as DocumentIndex,
          paper.index.pageContents,
        );

        const { context, citations } = await rag.retrieveContextWithCitations(
          query,
          paper.paperId,
          paper.title,
        );

        rag.dispose();

        if (context.trim()) {
          // Assign global citation keys
          const mappedCitations: CitationSource[] = citations.map((c) => ({
            ...c,
            citationKey: `[${citationCounter++}]`,
          }));

          allCitations.push(...mappedCitations);
          allResults.push({
            paperId: paper.paperId,
            paperTitle: paper.title,
            fileName: paper.index.fileName,
            fileUrl: paper.index.fileUrl,
            context,
          });
        }
      } catch (error) {
        console.error(`[LibraryRAG] Failed to search paper "${paper.title}":`, error);
      }
    }

    return { results: allResults, citations: allCitations };
  }

  /**
   * Full two-stage search: select relevant papers, then deep search them.
   */
  async search(
    query: string,
    papers: PaperMeta[],
  ): Promise<{
    results: Array<{
      paperId: string;
      paperTitle: string;
      fileName: string;
      fileUrl: string | null;
      context: string;
    }>;
    citations: CitationSource[];
    totalPapersSearched: number;
    totalPapersAvailable: number;
  }> {
    if (papers.length === 0) {
      return {
        results: [],
        citations: [],
        totalPapersSearched: 0,
        totalPapersAvailable: 0,
      };
    }

    // Stage 1: Select relevant papers
    const selectedPapers = await this.selectRelevantPapers(query, papers);

    // Stage 2: Deep search selected papers
    const { results, citations } = await this.deepSearch(query, selectedPapers);

    return {
      results,
      citations,
      totalPapersSearched: selectedPapers.length,
      totalPapersAvailable: papers.length,
    };
  }
}

export type { PaperMeta };
