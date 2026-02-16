import 'server-only';

import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { PageIndexRAG, type PageContent } from './page-index-rag';
import { updateDocumentIndex, updatePaper } from './db/queries';
import { extractPaperMetadata } from './paper-metadata';

/**
 * Downloads a PDF, extracts text, and returns PageContent[].
 */
async function downloadAndExtractPages(fileUrl: string, fileName: string): Promise<PageContent[]> {
  console.log(`[PDF Processing] Downloading ${fileName} from ${fileUrl}`);

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();

  console.log(`[PDF Processing] Extracting text from ${fileName} (${(blob.size / 1024).toFixed(1)}KB)`);

  const loader = new PDFLoader(blob, { splitPages: true });
  const docs = await loader.load();

  if (docs.length === 0) {
    throw new Error('PDF contains no extractable text');
  }

  return docs.map((doc, i) => ({
    pageNumber: (doc.metadata?.loc?.pageNumber ?? i + 1) as number,
    content: doc.pageContent,
  }));
}

/**
 * Downloads a PDF from the given URL, extracts per-page text using LangChain's PDFLoader,
 * indexes it with PageIndexRAG, and persists the tree + page contents to the database.
 */
export async function processAndIndexPdf(params: {
  documentIndexId: string;
  fileUrl: string;
  fileName: string;
}): Promise<void> {
  const { documentIndexId, fileUrl, fileName } = params;

  try {
    await updateDocumentIndex({ id: documentIndexId, status: 'processing' });

    const pages = await downloadAndExtractPages(fileUrl, fileName);

    console.log(`[PDF Processing] Extracted ${pages.length} pages from ${fileName}, starting indexing`);

    // Run PageIndexRAG indexing
    const rag = new PageIndexRAG();
    const tree = await rag.indexDocument(pages, fileName);
    rag.dispose();

    console.log(`[PDF Processing] Indexing complete for ${fileName}: ${tree.structure.length} top-level nodes`);

    // Save to DB
    await updateDocumentIndex({
      id: documentIndexId,
      status: 'ready',
      treeIndex: tree,
      pageContents: pages,
      totalPages: pages.length,
    });

    console.log(`[PDF Processing] Successfully indexed ${fileName}`);
  } catch (error) {
    console.error(`[PDF Processing] Failed to index ${fileName}:`, error);
    await updateDocumentIndex({
      id: documentIndexId,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error during PDF indexing',
    });
  }
}

/**
 * Processes a PDF for the research library: extracts metadata, indexes content,
 * and updates both the paper and document index records.
 */
export async function processAndIndexPaperPdf(params: {
  paperId: string;
  documentIndexId: string;
  fileUrl: string;
  fileName: string;
}): Promise<void> {
  const { paperId, documentIndexId, fileUrl, fileName } = params;

  try {
    // 1. Update statuses
    await updatePaper({ id: paperId, status: 'extracting_metadata' });
    await updateDocumentIndex({ id: documentIndexId, status: 'processing' });

    // 2. Download and extract pages
    const pages = await downloadAndExtractPages(fileUrl, fileName);

    console.log(`[Paper Processing] Extracted ${pages.length} pages from ${fileName}, extracting metadata`);

    // 3. Extract paper metadata using LLM
    try {
      const metadata = await extractPaperMetadata(pages);
      await updatePaper({
        id: paperId,
        title: metadata.title,
        authors: metadata.authors,
        abstract: metadata.abstract ?? undefined,
        year: metadata.year ?? undefined,
        doi: metadata.doi ?? undefined,
        journal: metadata.journal ?? undefined,
        totalPages: pages.length,
      });
      console.log(`[Paper Processing] Metadata extracted for ${fileName}: "${metadata.title}"`);
    } catch (metadataError) {
      console.warn(`[Paper Processing] Metadata extraction failed, continuing with indexing:`, metadataError);
    }

    // 4. Index the document
    await updatePaper({ id: paperId, status: 'indexing' });

    const rag = new PageIndexRAG();
    const tree = await rag.indexDocument(pages, fileName);
    rag.dispose();

    console.log(`[Paper Processing] Indexing complete for ${fileName}: ${tree.structure.length} top-level nodes`);

    // 5. Save indexed data
    await updateDocumentIndex({
      id: documentIndexId,
      status: 'ready',
      treeIndex: tree,
      pageContents: pages,
      totalPages: pages.length,
    });

    // 6. Mark paper as ready
    await updatePaper({ id: paperId, status: 'ready', totalPages: pages.length });

    console.log(`[Paper Processing] Successfully processed ${fileName}`);
  } catch (error) {
    console.error(`[Paper Processing] Failed to process ${fileName}:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during paper processing';
    await updatePaper({ id: paperId, status: 'failed', error: errorMsg });
    await updateDocumentIndex({
      id: documentIndexId,
      status: 'failed',
      error: errorMsg,
    });
  }
}
