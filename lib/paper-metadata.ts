import 'server-only';

import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { PageContent } from './page-index-rag';

const PaperMetadataSchema = z.object({
  title: z.string().describe('The title of the paper/document'),
  authors: z
    .array(z.string())
    .describe('List of author names. Return empty array if not found.'),
  abstract: z
    .string()
    .nullable()
    .describe('The abstract of the paper, or null if not found'),
  year: z
    .number()
    .nullable()
    .describe('Publication year, or null if not found'),
  doi: z
    .string()
    .nullable()
    .describe('DOI identifier (e.g., 10.1234/example), or null if not found'),
  journal: z
    .string()
    .nullable()
    .describe('Journal or conference name, or null if not found'),
});

export type PaperMetadata = z.infer<typeof PaperMetadataSchema>;

export async function extractPaperMetadata(
  pages: PageContent[],
): Promise<PaperMetadata> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set.');
  }

  const llm = new ChatOpenAI({
    model: 'gpt-4.1',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const extractor = llm.withStructuredOutput(PaperMetadataSchema, {
    name: 'paper_metadata_extractor',
  });

  // Use first 3 pages (cover + abstract usually)
  const firstPages = pages
    .slice(0, 3)
    .map((p) => `--- Page ${p.pageNumber} ---\n${p.content}`)
    .join('\n\n');

  const result = await extractor.invoke([
    new SystemMessage(
      'You are an expert at extracting metadata from academic papers and research documents. ' +
        'Extract the title, authors, abstract, publication year, DOI, and journal/conference name from the provided text. ' +
        'If a field is not present in the text, return null for nullable fields or an empty array for authors. ' +
        'For the title, use the actual paper title, not the filename. ' +
        'For DOI, extract only the DOI identifier (e.g., 10.1234/example), not the full URL.',
    ),
    new HumanMessage(
      `Extract metadata from this research document:\n\n${firstPages}`,
    ),
  ]);

  return result;
}
