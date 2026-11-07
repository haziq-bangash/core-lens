'use client';

import React from 'react';
import { ChevronDown, Copy, Download, Quote } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { citeKeys, formatCitation, toBibtex, toRis, type CitablePaper, type CitationStyle } from '@/lib/citations';

type ExportFormat = 'bibtex' | 'ris';

const FORMATS: Record<ExportFormat, { label: string; extension: string; mime: string; render: (p: CitablePaper[]) => string }> = {
  bibtex: { label: 'BibTeX (.bib)', extension: 'bib', mime: 'application/x-bibtex', render: toBibtex },
  ris: { label: 'RIS (.ris)', extension: 'ris', mime: 'application/x-research-info-systems', render: toRis },
};

function downloadTextFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error('Could not copy to the clipboard');
  }
}

/** Cite menu for a single paper: copy a formatted citation or download a reference file. */
export function CitePaperMenu({ paper }: { paper: CitablePaper }) {
  const download = (format: ExportFormat) => {
    const { extension, mime, render } = FORMATS[format];
    downloadTextFile(`${citeKeys([paper])[0]}.${extension}`, render([paper]), mime);
  };

  const copyCitation = (style: CitationStyle) =>
    copyToClipboard(formatCitation(paper, style), `${style.toUpperCase()} citation copied`);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Quote className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Cite</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Copy citation</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => copyCitation('apa')}>
          <Copy className="mr-2 h-4 w-4" />
          APA 7
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyCitation('mla')}>
          <Copy className="mr-2 h-4 w-4" />
          MLA 9
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyToClipboard(toBibtex([paper]), 'BibTeX copied')}>
          <Copy className="mr-2 h-4 w-4" />
          BibTeX
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Download</DropdownMenuLabel>
        {(Object.keys(FORMATS) as ExportFormat[]).map((format) => (
          <DropdownMenuItem key={format} onClick={() => download(format)}>
            <Download className="mr-2 h-4 w-4" />
            {FORMATS[format].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Export menu for the library list: downloads whatever papers are currently shown. */
export function ExportLibraryMenu({ papers }: { papers: CitablePaper[] }) {
  const download = (format: ExportFormat) => {
    const { extension, mime, render } = FORMATS[format];
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`core-lens-library-${date}.${extension}`, render(papers), mime);
    toast.success(`Exported ${papers.length} ${papers.length === 1 ? 'paper' : 'papers'}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 hidden sm:inline-flex" disabled={papers.length === 0}>
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Export {papers.length} {papers.length === 1 ? 'paper' : 'papers'}
        </DropdownMenuLabel>
        {(Object.keys(FORMATS) as ExportFormat[]).map((format) => (
          <DropdownMenuItem key={format} onClick={() => download(format)}>
            {FORMATS[format].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
