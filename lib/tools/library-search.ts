import { tool } from 'ai';
import { z } from 'zod';
import { type PageContent } from '@/lib/page-index-rag';
import {
  getReadyDocumentIndicesByUserId,
  getReadyDocumentIndicesByPaperIds,
  getPaperById,
  getTagsByPaperId,
} from '@/lib/db/queries';
import { LibraryRAG, type PaperMeta } from '@/lib/library-rag';
import type { ChatMessage } from '@/lib/types';
import type { UIMessageStreamWriter } from 'ai';

export function createLibrarySearchTool(userId: string, dataStream: UIMessageStreamWriter<ChatMessage>, defaultPaperIds?: string[]) {
  return tool({
    description:
      'Search across research papers in the user\'s library. Use this when the user asks questions about their uploaded papers or research documents.',
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant information in the library'),
      paperIds: z
        .array(z.string())
        .optional()
        .describe('Optional: specific paper IDs to search within. If omitted, searches all papers.'),
      maxPapers: z
        .number()
        .optional()
        .describe('Maximum number of papers to search across (default: 5)'),
    }),
    execute: async ({ query, paperIds, maxPapers }) => {
      const effectiveMaxPapers = maxPapers ?? 5;
      // Use explicit paperIds from LLM, fall back to defaultPaperIds from @mentions
      const effectivePaperIds = paperIds?.length ? paperIds : defaultPaperIds;

      // Fetch document indices
      const indices = effectivePaperIds?.length
        ? await getReadyDocumentIndicesByPaperIds(effectivePaperIds)
        : await getReadyDocumentIndicesByUserId(userId);

      if (indices.length === 0) {
        return {
          results: [],
          totalPapersSearched: 0,
          message: 'No indexed papers found in your library.',
        };
      }

      // Build PaperMeta array for LibraryRAG
      const papers: PaperMeta[] = [];

      for (const idx of indices) {
        if (!idx.treeIndex || !idx.pageContents) continue;

        const paperRecord = idx.paperId
          ? await getPaperById(idx.paperId)
          : null;
        const tags = idx.paperId
          ? (await getTagsByPaperId(idx.paperId)).map((t) => t.tag)
          : [];

        papers.push({
          paperId: idx.paperId || idx.id,
          title: paperRecord?.title || idx.fileName,
          abstract: paperRecord?.abstract,
          tags,
          index: {
            id: idx.id,
            treeIndex: idx.treeIndex,
            pageContents: idx.pageContents as PageContent[],
            fileName: idx.fileName,
            fileUrl: idx.fileUrl,
          },
        });
      }

      // Use LibraryRAG for two-stage cross-document search
      const libraryRag = new LibraryRAG({ maxPapers: effectiveMaxPapers });
      const { results, citations, totalPapersSearched, totalPapersAvailable } =
        await libraryRag.search(query, papers);

      // Emit citations via data stream
      if (citations.length > 0) {
        dataStream.write({
          type: 'data-citations',
          data: { citations },
        } as any);
      }

      return {
        results: results.map((r) => ({
          fileName: r.fileName,
          context: r.context,
          fileUrl: r.fileUrl,
          paperTitle: r.paperTitle,
        })),
        citations,
        totalPapersSearched,
        totalPapersAvailable,
        message: results.length > 0
          ? `Found relevant content in ${results.length} paper(s) (searched ${totalPapersSearched} of ${totalPapersAvailable} total). Citations are numbered [1], [2], etc.`
          : 'No relevant content found for your query.',
      };
    },
  });
}
