import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { after } from 'next/server';
import { put } from '@vercel/blob';

import { getLightweightUser } from '@/app/actions';
import { createPaper, saveDocumentIndex } from '@/lib/db/queries';
import { processAndIndexPaperPdf } from '@/lib/pdf-processing';
import { getPaperByDoi, type SemanticScholarPaper } from '@/lib/semantic-scholar';

const ImportSchema = z.object({
  doi: z.string().optional(),
  url: z.string().url().optional(),
}).refine((data) => data.doi || data.url, {
  message: 'Either doi or url must be provided',
});

// POST /api/library/import — import a paper by DOI or URL
export async function POST(req: NextRequest) {
  const lightweightUser = await getLightweightUser();
  if (!lightweightUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { doi, url } = parsed.data;

  try {
    let metadata: SemanticScholarPaper | null = null;

    // Look up metadata from Semantic Scholar
    if (doi) {
      metadata = await getPaperByDoi(doi);
    }

    if (!metadata && !url) {
      return NextResponse.json(
        { error: 'Could not find paper metadata. Try providing a direct PDF URL instead.' },
        { status: 404 },
      );
    }

    // Create the paper record with metadata
    const title = metadata?.title || 'Imported Paper';
    const authors = metadata?.authors?.map((a) => a.name) ?? [];
    const year = metadata?.year ?? undefined;
    const abstract = metadata?.abstract ?? undefined;
    const journal = metadata?.venue ?? undefined;
    const resolvedDoi = metadata?.doi || doi || undefined;

    // Try to get open access PDF
    const pdfUrl = metadata?.openAccessPdf?.url || url || null;

    const paper = await createPaper({
      userId: lightweightUser.userId,
      title,
      authors,
      abstract,
      year,
      doi: resolvedDoi,
      journal,
      status: pdfUrl ? 'pending' : 'ready', // If no PDF, mark as ready (metadata only)
    });

    // If we have a PDF URL, download and index it
    if (pdfUrl) {
      after(async () => {
        try {
          // Download the PDF
          const pdfResponse = await fetch(pdfUrl, {
            headers: {
              'User-Agent': 'ContractLens/1.0 (Research Platform; mailto:support@contractlens.ai)',
            },
          });

          if (!pdfResponse.ok) {
            throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
          }

          const pdfBuffer = await pdfResponse.arrayBuffer();
          const fileName = `${title.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

          // Upload to Vercel Blob
          const blob = await put(`mplx/library/${fileName}`, new Uint8Array(pdfBuffer), {
            access: 'public',
            addRandomSuffix: true,
          });

          // Process and index the PDF
          await processAndIndexPaperPdf({
            paperId: paper.id,
            fileUrl: blob.url,
            fileName,
            fileSizeMb: pdfBuffer.byteLength / (1024 * 1024),
            saveDocumentIndex,
          });
        } catch (error) {
          console.error('[Import] Failed to download/index PDF:', error);
          // Paper stays with whatever status processAndIndexPaperPdf left it in
        }
      });
    }

    return NextResponse.json({
      paper,
      hasPdf: !!pdfUrl,
      message: pdfUrl
        ? 'Paper imported. PDF is being downloaded and indexed.'
        : 'Paper metadata imported (no open access PDF available).',
    });
  } catch (error) {
    console.error('[Import] Error importing paper:', error);
    return NextResponse.json({ error: 'Failed to import paper' }, { status: 500 });
  }
}
