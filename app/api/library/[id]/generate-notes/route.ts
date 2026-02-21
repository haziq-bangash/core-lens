import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText } from 'ai';

import { getLightweightUser } from '@/app/actions';
import { getPaperById, getReadyDocumentIndicesByPaperIds } from '@/lib/db/queries';
import { coreLens } from '@/ai/providers';
import { PageIndexRAG } from '@/lib/page-index-rag';
import type { DocumentIndex, PageContent } from '@/lib/page-index-rag';

const RequestSchema = z.object({
  citationFormat: z.string().default('Numbered'),
  language: z.string().default('English (US)'),
  /** Optional user instructions for what to focus on */
  instructions: z.string().optional(),
});

// POST /api/library/[id]/generate-notes
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const paper = await getPaperById(id);

  if (!paper || paper.userId !== lightweightUser.userId) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  if (paper.status !== 'ready') {
    return NextResponse.json(
      { error: 'Paper must be fully indexed before generating notes' },
      { status: 400 },
    );
  }

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { citationFormat, language, instructions } = parsed.data;

  // Load the document index for this paper
  const docIndices = await getReadyDocumentIndicesByPaperIds([id]);
  if (docIndices.length === 0) {
    return NextResponse.json(
      { error: 'No indexed content available for this paper' },
      { status: 400 },
    );
  }

  const docIndex = docIndices[0];
  const treeIndex = docIndex.treeIndex as DocumentIndex;
  const pageContents = docIndex.pageContents as PageContent[];

  // Build a condensed overview of the paper for the LLM
  // Use the tree structure summaries + abstract for a comprehensive view
  const sectionSummaries = buildSectionOverview(treeIndex);

  // Retrieve detailed content from key sections using RAG
  const rag = new PageIndexRAG();
  rag.loadIndexWithPages(treeIndex, pageContents);

  const [
    mainFindings,
    methodology,
    keyArguments,
  ] = await Promise.all([
    rag.retrieveContext('What are the main findings, results, and conclusions of this paper?'),
    rag.retrieveContext('What methodology, approach, or framework does this paper use?'),
    rag.retrieveContext('What are the key arguments, contributions, and implications of this work?'),
  ]);

  rag.dispose();

  // Build the generation prompt
  const systemPrompt = buildSystemPrompt(citationFormat, language);
  const userPrompt = buildUserPrompt(paper, sectionSummaries, mainFindings, methodology, keyArguments, instructions);

  try {
    const result = await generateText({
      model: coreLens.languageModel('core-lens-gpt-4.1'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 4096,
      temperature: 0.3,
    });

    return NextResponse.json({ notes: result.text });
  } catch (error) {
    console.error('Generate notes error:', error);
    return NextResponse.json(
      { error: 'Failed to generate notes' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSectionOverview(index: DocumentIndex): string {
  const lines: string[] = [];

  function walk(nodes: DocumentIndex['structure'], depth = 0) {
    for (const node of nodes) {
      const indent = '  '.repeat(depth);
      const pages = node.start_index === node.end_index
        ? `p.${node.start_index}`
        : `pp.${node.start_index}-${node.end_index}`;
      lines.push(`${indent}- ${node.title} [${pages}]: ${node.summary || node.prefix_summary || ''}`);
      if (node.nodes.length > 0) {
        walk(node.nodes, depth + 1);
      }
    }
  }

  walk(index.structure);
  return lines.join('\n');
}

function buildSystemPrompt(citationFormat: string, language: string): string {
  return `You are an expert academic research assistant that generates comprehensive, well-structured study notes from research papers.

OUTPUT RULES:
- Write in ${language}.
- Use Markdown formatting (headings, bold, lists, blockquotes).
- Citation format: ${citationFormat}. When referencing specific claims from the paper, use the appropriate citation style inline.
- Be thorough but concise — capture all important points without unnecessary padding.
- Use a clear hierarchical structure with appropriate heading levels.
- Include direct quotes (in blockquotes) for particularly important or well-phrased passages.
- Note any limitations, open questions, or areas for further research mentioned by the authors.

STRUCTURE:
Generate notes with the following sections (adapt headings as appropriate):
1. Overview / TL;DR — 2-3 sentence summary
2. Key Contributions
3. Methodology / Approach
4. Main Findings / Results
5. Discussion & Implications
6. Limitations & Future Work
7. Key Takeaways — bullet points of the most important insights

Do NOT include a title heading — the title is shown separately in the UI.`;
}

function buildUserPrompt(
  paper: { title: string | null; authors: string[] | null; abstract: string | null; year: number | null; journal: string | null },
  sectionOverview: string,
  mainFindings: string,
  methodology: string,
  keyArguments: string,
  instructions?: string,
): string {
  const meta = [
    paper.title && `Title: ${paper.title}`,
    paper.authors?.length && `Authors: ${paper.authors.join(', ')}`,
    paper.year && `Year: ${paper.year}`,
    paper.journal && `Journal: ${paper.journal}`,
  ].filter(Boolean).join('\n');

  const abstractSection = paper.abstract
    ? `\n\nABSTRACT:\n${paper.abstract}`
    : '';

  const instructionsSection = instructions
    ? `\n\nUSER INSTRUCTIONS:\n${instructions}`
    : '';

  return `Generate comprehensive study notes for the following research paper.

PAPER METADATA:
${meta}${abstractSection}

DOCUMENT STRUCTURE & SECTION SUMMARIES:
${sectionOverview}

MAIN FINDINGS & RESULTS (retrieved from paper):
${mainFindings}

METHODOLOGY & APPROACH (retrieved from paper):
${methodology}

KEY ARGUMENTS & CONTRIBUTIONS (retrieved from paper):
${keyArguments}${instructionsSection}

Now generate the notes in Markdown:`;
}
