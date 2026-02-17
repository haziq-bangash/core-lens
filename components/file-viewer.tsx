import Fuse from "fuse.js";
import { Copy, ExternalLink, FileText, Loader2, X } from "lucide-react";
import { pdfjs } from "react-pdf";
import { Dialog, DialogClose, DialogContent } from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { memo, useCallback, useState } from "react";
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export const PdfSearchResults = memo(function PdfSearchResults({
  results,
  totalDocuments,
  message,
  getFileUrl,
}: {
  results: { fileName: string; fileUrl?: string; context: string }[];
  totalDocuments: number;
  message: string;
  getFileUrl: (result: { fileName: string; fileUrl?: string }) => string | null;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState('');

  const handleOpenPdf = useCallback(
    async (result: { fileName: string; fileUrl?: string; context: string }) => {
      const url = getFileUrl(result);
      if (!url) {
        toast.error('PDF URL not available');
        return;
      }

      setViewerFileName(result.fileName);
      setViewerOpen(true);

      // Try to find the page where the excerpt lives
      try {
        const { page } = await returnHighlightIndices(url, result.context);
        // Append #page=N to scroll the <object> PDF viewer to that page
        setViewerUrl(page ? `${url}#page=${page}` : url);
      } catch (error) {
        console.error('[pdf_search] Highlight index error:', error);
        setViewerUrl(url);
      }
    },
    [getFileUrl],
  );

  return (
    <>
      <div className="w-full my-4 rounded-2xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="text-sm font-semibold truncate">PDF Search Results</h3>
                <span className="text-xs text-muted-foreground">{message}</span>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {totalDocuments} doc{totalDocuments !== 1 ? 's' : ''} indexed
            </span>
          </div>
        </div>

        {/* Results */}
        <div className="p-3 space-y-1">
          {results.map((result, index) => (
            <button
              key={index}
              onClick={() => handleOpenPdf(result)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
            >
              <div className="shrink-0 w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <FileText className="h-4 w-4 text-red-500 dark:text-red-400" />
              </div>
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="text-sm font-medium truncate max-w-[250px] group-hover:text-foreground">
                  {result.fileName}
                </span>
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {result.context.slice(0, 120)}...
                </span>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* PDF Viewer Dialog — same as your existing one */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="p-0 bg-background sm:max-w-3xl w-[90vw] max-h-[85vh] overflow-hidden">
          <div className="flex flex-col h-full max-h-[85vh]">
            <header className="p-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (viewerUrl) {
                      navigator.clipboard.writeText(viewerUrl.split('#')[0]);
                      toast.success('File URL copied to clipboard');
                    }
                  }}
                  className="h-8 w-8 rounded-md text-muted-foreground"
                  title="Copy link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <a
                  href={viewerUrl ?? '#'}
                  target="_blank"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <DialogClose className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </DialogClose>
            </header>

            <div className="flex-1 overflow-auto">
              <div className="w-full h-[60vh] flex flex-col rounded-md overflow-hidden border border-border mx-1">
                <div className="bg-muted py-1.5 px-2 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-red-500 dark:text-red-400" />
                    <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                      {viewerFileName}
                    </span>
                  </div>
                </div>
                <div className="flex-1 w-full bg-white">
                  {viewerUrl ? (
                    <object
                      data={viewerUrl}
                      type="application/pdf"
                      className="w-full h-full"
                    >
                      <div className="flex flex-col items-center justify-center w-full h-full bg-muted">
                        <FileText className="h-12 w-12 text-red-500 dark:text-red-400 mb-4" />
                        <p className="text-muted-foreground text-sm mb-2">
                          PDF cannot be displayed directly
                        </p>
                        <a
                          href={viewerUrl}
                          target="_blank"
                          className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-md hover:bg-red-600 transition-colors"
                        >
                          Open PDF
                        </a>
                      </div>
                    </object>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <footer className="border-t border-border p-2">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span className="truncate max-w-[70%]">{viewerFileName}</span>
              </div>
            </footer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

interface WordData {
  text: string;
  pdfWordIndex: number;
  wordIdx: number;
  pageNum: number; // Track which page for better results
}

interface SearchResult {
  text: string;
  minRange: number;
  maxRange: number;
  startWordIdx: number;
  endWordIdx: number;
  pageNum: number; // Include page info
  score?: number; // Optional score for sorting
}

interface HighlightResult {
  returnObject: {
    min: number;
    item: SearchResult;
  };
  page: number;
  allMatches?: SearchResult[]; // Optional: return all matches
}

export const returnHighlightIndices = async (
  file: string | File,
  searchKey: string,
  options: {
    threshold?: number;
    returnAllMatches?: boolean;
    maxResults?: number;
  } = {}
): Promise<HighlightResult> => {
  const {
    threshold = 0.7,
    returnAllMatches = false,
    maxResults = 10,
  } = options;

  let preview: string;
  let revokePreview = false;

  if (typeof file === "string") {
    preview = file;
  } else {
    preview = URL.createObjectURL(file);
    revokePreview = true;
  }

  try {
    const pdf = await pdfjs.getDocument(preview).promise;
    const pageCount = pdf.numPages;

    let pageFound = -1;
    const allMatches: SearchResult[] = [];

    const currentObject = {
      min: 5,
      item: {
        text: "",
        endWordIdx: -1,
        maxRange: -1,
        minRange: -1,
        startWordIdx: -1,
        pageNum: -1,
      },
    };

    // Normalize search string once
    const searchString = normalizeSearchString(searchKey);
    const searchWords = searchString.split(" ");
    const lenSearchString = searchWords.length;
    const firstWord = searchWords[0];

    // Early return if search is empty
    if (!firstWord || lenSearchString === 0) {
      return { returnObject: currentObject, page: pageFound };
    }

    // Process pages in batches for better performance
    const BATCH_SIZE = 5;
    for (
      let batchStart = 1;
      batchStart <= pageCount;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, pageCount);
      const batchPromises = [];

      for (let i = batchStart; i <= batchEnd; i++) {
        batchPromises.push(
          processPage(
            pdf,
            i,
            firstWord,
            searchString,
            lenSearchString,
            threshold
          )
        );
      }

      try {
        const batchResults = await Promise.all(batchPromises);

        for (const result of batchResults) {
          if (result.matches.length > 0) {
            allMatches.push(...result.matches);

            // Update best match
            for (const match of result.matches) {
              if (currentObject.min > (match.score ?? 0)) {
                currentObject.min = match.score ?? 0;
                currentObject.item = {
                  text: match.text,
                  endWordIdx: match.endWordIdx,
                  maxRange: match.maxRange,
                  minRange: match.minRange,
                  startWordIdx: match.startWordIdx,
                  pageNum: match.pageNum,
                };
                pageFound = result.pageNum;
              }
            }
          }
        }
      } catch (error) {
        console.warn(
          `Error processing batch ${batchStart}-${batchEnd}:`,
          error
        );
        // Fallback to individual page processing
        for (let i = batchStart; i <= batchEnd; i++) {
          try {
            const result = await processPage(
              pdf,
              i,
              firstWord,
              searchString,
              lenSearchString,
              threshold
            );
            if (result.matches.length > 0) {
              allMatches.push(...result.matches);

              for (const match of result.matches) {
                if (currentObject.min > (match.score ?? 0)) {
                  currentObject.min = match.score ?? 0;
                  currentObject.item = {
                    text: match.text,
                    endWordIdx: match.endWordIdx,
                    maxRange: match.maxRange,
                    minRange: match.minRange,
                    startWordIdx: match.startWordIdx,
                    pageNum: match.pageNum,
                  };
                  pageFound = i;
                }
              }
            }
          } catch (pageError) {
            console.warn(`Error processing page ${i}:`, pageError);
          }
        }
      }
    }

    // Sort all matches by score
    allMatches.sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

    const result: HighlightResult = {
      returnObject: currentObject,
      page: pageFound,
    };

    if (returnAllMatches) {
      result.allMatches = allMatches.slice(0, maxResults);
    }

    return result;
  } catch (error) {
    console.error("Error in returnHighlightIndices:", error);
    return {
      returnObject: {
        min: 5,
        item: {
          text: "",
          endWordIdx: -1,
          maxRange: -1,
          minRange: -1,
          startWordIdx: -1,
          pageNum: -1,
        },
      },
      page: -1,
    };
  } finally {
    if (revokePreview) {
      URL.revokeObjectURL(preview);
    }
  }
};

// Normalize search string with caching
const searchStringCache = new Map<string, string>();
function normalizeSearchString(searchKey: string): string {
  if (searchStringCache.has(searchKey)) {
    return searchStringCache.get(searchKey)!;
  }

  const normalized = searchKey
    .replace(/\s{2,}/g, " ")
    .replace(/\t/g, " ")
    .toLowerCase()
    .trim()
    .replace(/(\r\n|\n|\r)/g, "");

  // Limit cache size
  if (searchStringCache.size > 100) {
    searchStringCache.clear();
  }

  searchStringCache.set(searchKey, normalized);
  return normalized;
}

// Process a single page
async function processPage(
  pdf: pdfjs.PDFDocumentProxy,
  pageNum: number,
  firstWord: string,
  searchString: string,
  lenSearchString: number,
  threshold: number
): Promise<{
  pageNum: number;
  matches: (SearchResult & { score?: number })[];
}> {
  try {
    const pageData = await pdf.getPage(pageNum);
    const textContent = await pageData.getTextContent();
    const wordsData: WordData[] = [];

    let pdfWordIndex = 0;

    // More efficient word extraction
    for (const item of textContent.items) {
      if ("str" in item && item.str.trim()) {
        // Use regex for better word splitting
        const words = item.str.match(/\S+/g) || [];
        words.forEach((text, wordIdx) => {
          const cleanText = text.toLowerCase().replace(/[^\w]/g, "");
          if (cleanText.length > 0) {
            wordsData.push({
              text: cleanText,
              pdfWordIndex,
              wordIdx,
              pageNum,
            });
          }
        });
      }
      pdfWordIndex++;
    }

    // Clean up page data
    pageData.cleanup();

    if (wordsData.length === 0) {
      return { pageNum, matches: [] };
    }

    // Generate search candidates using your original logic
    const searchData = generateDirectSearchData(
      firstWord,
      wordsData,
      lenSearchString
    );

    if (searchData.length === 0) {
      return { pageNum, matches: [] };
    }

    // Use Fuse with your original settings but add some optimizations
    const fuse = new Fuse(searchData, {
      isCaseSensitive: false,
      shouldSort: true,
      includeScore: true,
      keys: ["text"],
      ignoreLocation: true,
      threshold,
      // Add some performance optimizations
      distance: 100,
      minMatchCharLength: Math.max(1, Math.floor(searchString.length * 0.1)),
    });

    const result = fuse.search(searchString);
    const matches: (SearchResult & { score?: number })[] = [];

    for (const fuseResult of result) {
      matches.push({
        ...fuseResult.item,
        pageNum,
        score: fuseResult.score,
      });
    }

    return { pageNum, matches };
  } catch (error) {
    console.error(`Error processing page ${pageNum}:`, error);
    return { pageNum, matches: [] };
  }
}

// Your original search data generation logic (kept mostly the same)
interface SearchStrings {
  text: string;
  minRange: number;
  maxRange: number;
  startWordIdx: number;
  endWordIdx: number;
}

function generateDirectSearchData(
  startString: string,
  words: WordData[],
  n: number
): SearchStrings[] {
  const searchStrings: SearchStrings[] = [];
  const searchStrings2: SearchStrings[] = [];

  // Early exit for performance
  if (words.length < n || n <= 0) {
    return [];
  }

  for (let i = 0; i <= words.length - n; i++) {
    const currentWord = words[i];

    if (!currentWord) continue;

    if (currentWord.text === startString) {
      // Exact match - highest priority
      const text = words
        .slice(i, i + n)
        .map((w) => w.text)
        .join(" ");

      const minRange = words[i]?.pdfWordIndex ?? 0;
      const maxRange = words[i + n - 1]?.pdfWordIndex ?? 0;
      const startWordIdx = words[i]?.wordIdx ?? 0;
      const endWordIdx = words[i + n - 1]?.wordIdx ?? 0;

      searchStrings.push({
        text,
        minRange,
        maxRange,
        startWordIdx,
        endWordIdx,
      });
    } else if (
      startString.includes(currentWord.text) ||
      currentWord.text.includes(startString)
    ) {
      // Partial match - secondary priority
      const text = words
        .slice(i, i + n)
        .map((w) => w.text)
        .join(" ");

      const minRange = words[i]?.pdfWordIndex ?? 0;
      const maxRange = words[i + n - 1]?.pdfWordIndex ?? 0;
      const startWordIdx = words[i]?.wordIdx ?? 0;
      const endWordIdx = words[i + n - 1]?.wordIdx ?? 0;

      searchStrings2.push({
        text,
        minRange,
        maxRange,
        startWordIdx,
        endWordIdx,
      });
    }
  }

  // Return exact matches first, then partial matches
  if (searchStrings.length > 0) {
    return searchStrings;
  }

  // Limit partial matches for performance
  return searchStrings2.slice(0, 100);
}

// Utility function for getting all matches
export const highlightAllMatches = async (
  file: string | File,
  searchKey: string,
  maxResults: number = 10
): Promise<SearchResult[]> => {
  try {
    const result = await returnHighlightIndices(file, searchKey, {
      returnAllMatches: true,
      maxResults,
    });

    return result.allMatches || [];
  } catch (error) {
    console.error("Error in highlightAllMatches:", error);
    return [];
  }
};