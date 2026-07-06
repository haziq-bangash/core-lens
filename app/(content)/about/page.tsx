'use client';

import { Brain, Search, ArrowUpRight, GraduationCap, Eye, Filter, X, Library, FileText, Globe, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useRouter } from 'next/navigation';
import { GithubLogoIcon, XLogoIcon } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import {
  ProAccordion,
  ProAccordionItem,
  ProAccordionTrigger,
  ProAccordionContent,
} from '@/components/ui/pro-accordion';
import { models } from '@/ai/providers';
import { VercelLogo } from '@/components/logos/vercel-logo';
import { ExaLogo } from '@/components/logos/exa-logo';
import { ElevenLabsLogo } from '@/components/logos/elevenlabs-logo';
import { PRICING, SEARCH_LIMITS } from '@/lib/constants';

import { ThemeSwitcher } from '@/components/theme-switcher';
import { CoreLensLogo } from '@/components/logos/core-lens-logo';
import { getSearchGroups } from '@/lib/utils';

export default function AboutPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [openCategory, setOpenCategory] = useState(false);
  const [openCapabilities, setOpenCapabilities] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);
  const visibleGroups = useMemo(
    () =>
      getSearchGroups().filter(
        (g) => g.show && !['extreme', 'connectors', 'memory'].includes(g.id as string),
      ),
    [],
  );
  const [selectedGroup, setSelectedGroup] = useState<string>(visibleGroups[0]?.id || 'web');

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('query')?.toString();
    if (query) {
      const params = new URLSearchParams({ q: query, group: String(selectedGroup) });
      router.push(`/?${params.toString()}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/95 border-b border-t border-border">
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-12 items-center h-16 border-x border-border">
            <div className="col-span-6 flex items-center h-full pl-4 border-border">
              <Link href="/" className="flex items-center gap-2 group">
                <CoreLensLogo className="size-7 transition-transform group-hover:scale-110" />
                <span className="text-2xl font-normal tracking-tighter font-be-vietnam-pro">Core Lens</span>
              </Link>
            </div>

            <div className="col-span-6 flex items-center justify-end gap-2 h-full px-4">
              <div className="block">
                <ThemeSwitcher />
              </div>

              <div className="w-px h-6 bg-border hidden sm:block" />

              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-none h-8 md:h-9 px-3 md:px-4"
                onClick={() => router.push('/')}
              >
                <span>Start Researching</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-border bg-muted/30">
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-12 border-l border-r border-border">
            {/* Hero Content */}
            <div className="col-span-12 lg:col-span-8 bg-card p-10 border-r border-b border-border">
              <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/30">
                <span className="text-xs font-medium text-primary uppercase tracking-wider">Open Source</span>
              </div>
              <h2 className="text-4xl font-bold text-foreground mb-6 tracking-tight">
                Your AI Research Assistant
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Core Lens helps you find, read, and cite research papers faster. Ask a question in plain language
                and get grounded answers drawn from the live web, academic databases, and your own uploaded papers
                &mdash; complete with inline citations you can trace back to the source.
              </p>

              <form onSubmit={handleSearch} className="mb-6">
                <div className="mb-4 border border-border bg-background flex flex-col">
                  <div className="px-4 pt-3">
                    <textarea
                      name="query"
                      placeholder="What are the latest findings on CRISPR gene therapy for sickle cell disease?"
                      rows={2}
                      className="w-full leading-6 text-base bg-transparent focus:outline-none placeholder:text-muted-foreground resize-none"
                    />
                  </div>
                  <div className="border-t border-border flex items-stretch h-12">
                    <div className="flex sm:hidden pl-2 pr-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="px-3 text-sm flex items-center justify-center text-muted-foreground hover:bg-accent/50 transition-colors border-r border-border"
                          >
                            <span className="truncate max-w-32">
                              {visibleGroups.find((g) => g.id === selectedGroup)?.name || 'Mode'}
                            </span>
                            <ArrowUpRight className="h-4 w-4 opacity-60 ml-2" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" sideOffset={6} className="p-0 w-64 rounded-none">
                          <Command className="rounded-none border-0">
                            <CommandInput placeholder="Search modes..." className="h-9" />
                            <CommandList className="max-h-60">
                              <CommandEmpty>No mode found.</CommandEmpty>
                              <CommandGroup heading="Search Mode">
                                {visibleGroups.map((g) => (
                                  <CommandItem
                                    key={g.id}
                                    value={g.id}
                                    onSelect={() => setSelectedGroup(g.id)}
                                    className="text-sm rounded-none"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{g.name}</span>
                                      <span className="text-xs text-muted-foreground">{g.description}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="hidden sm:flex sm:w-48 md:w-56">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex-1 px-3 text-sm flex items-center justify-between text-muted-foreground hover:bg-accent/50 transition-colors border-r border-border"
                          >
                            <span className="truncate">
                              {visibleGroups.find((g) => g.id === selectedGroup)?.name || 'Mode'}
                            </span>
                            <ArrowUpRight className="h-4 w-4 opacity-60" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" sideOffset={6} className="p-0 w-64 rounded-none">
                          <Command className="rounded-none border-0">
                            <CommandInput placeholder="Search modes..." className="h-9" />
                            <CommandList className="max-h-60">
                              <CommandEmpty>No mode found.</CommandEmpty>
                              <CommandGroup heading="Search Mode">
                                {visibleGroups.map((g) => (
                                  <CommandItem
                                    key={g.id}
                                    value={g.id}
                                    onSelect={() => setSelectedGroup(g.id)}
                                    className="text-sm rounded-none"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{g.name}</span>
                                      <span className="text-xs text-muted-foreground">{g.description}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex-1" />
                    <div className="w-auto sm:w-40 md:w-44 border-l border-border">
                      <button
                        type="submit"
                        className="w-full h-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors px-4"
                      >
                        Search
                      </button>
                    </div>
                  </div>
                </div>
              </form>
              <div className="grid grid-cols-1 gap-px bg-border">
                <Link
                  href="/"
                  className="flex items-center justify-center h-11 gap-2 px-6 border border-border hover:border-primary hover:bg-accent transition-colors rounded-none group/link"
                >
                  <span className="font-medium">Try Now &mdash; No Sign-up Required</span>
                  <ArrowUpRight className="h-4 w-4 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform duration-300" />
                </Link>
              </div>
            </div>

            {/* What Researchers Use It For */}
            <div className="col-span-12 lg:col-span-4 bg-card p-8 border-b border-border group">
              <h3 className="text-lg font-semibold mb-6 group-hover:text-primary transition-colors">What Researchers Use It For</h3>
              <div className="grid grid-cols-1 gap-px bg-border">
                <div className="bg-background p-4 group/stat hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2.5 mb-1">
                    <Search className="size-4 text-primary" />
                    <p className="text-sm font-medium group-hover/stat:text-foreground transition-colors">
                      Literature Reviews
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6.5">
                    Find and compare papers across topics in seconds, not hours.
                  </p>
                </div>
                <div className="bg-background p-4 group/stat hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2.5 mb-1">
                    <FileText className="size-4 text-primary" />
                    <p className="text-sm font-medium group-hover/stat:text-foreground transition-colors">
                      Paper Analysis
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6.5">
                    Upload PDFs, ask questions, and get answers with page-level citations.
                  </p>
                </div>
                <div className="bg-background p-4 group/stat hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2.5 mb-1">
                    <Globe className="size-4 text-primary" />
                    <p className="text-sm font-medium group-hover/stat:text-foreground transition-colors">
                      Fact-Checking &amp; Verification
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6.5">
                    Cross-reference claims against live web sources and academic papers.
                  </p>
                </div>
                <div className="bg-background p-4 group/stat hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2.5 mb-1">
                    <MessageSquare className="size-4 text-primary" />
                    <p className="text-sm font-medium group-hover/stat:text-foreground transition-colors">
                      Research Q&amp;A
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6.5">
                    Ask follow-up questions in a conversation &mdash; it remembers your context.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-b border-border">
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-12 border-l border-r border-border">
            <div className="col-span-12 bg-card p-6 border-b border-border">
              <h2 className="text-2xl font-semibold mb-2">How It Works</h2>
              <p className="text-muted-foreground">
                Ask a question. Core Lens figures out the rest.
              </p>
            </div>

            <div className="col-span-12 grid grid-cols-12">
              <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-card p-6 border-r border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="w-10 h-10 bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300 text-sm font-bold text-primary">
                  1
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  You Ask
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                  Type your research question in plain language. It can be broad (&ldquo;summarize recent work on
                  transformer architectures&rdquo;) or specific (&ldquo;what does Table 3 in my uploaded paper show?&rdquo;).
                </p>
              </div>

              <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-card p-6 border-r border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="w-10 h-10 bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300 text-sm font-bold text-primary">
                  2
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  It Plans &amp; Searches
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                  The AI breaks your question into steps, then searches the live web, academic databases, and your
                  personal library for relevant sources.
                </p>
              </div>

              <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-card p-6 border-r border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="w-10 h-10 bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300 text-sm font-bold text-primary">
                  3
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  You Get Cited Answers
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                  Every claim links back to its source &mdash; a web page, a paper, or a specific page in your PDF.
                  Click a citation to read the original passage.
                </p>
              </div>

              <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-card p-6 border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="w-10 h-10 bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300 text-sm font-bold text-primary">
                  4
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  Keep Going
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                  Ask follow-ups, upload more papers, save sources to your library, or set up a Lookout to monitor a
                  topic automatically over time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Capabilities */}
      <section className="border-b border-border">
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-12 border-l border-r border-border">
            <div className="col-span-12 bg-card p-6 border-b border-border">
              <h2 className="text-2xl font-semibold mb-2">Built for the Research Workflow</h2>
              <p className="text-muted-foreground">
                Not just a chatbot. A workspace for finding, reading, and building on scholarship.
              </p>
            </div>

            <div className="col-span-12 grid grid-cols-12">
              <div className="col-span-12 md:col-span-6 bg-card p-8 border-r border-b border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="w-12 h-12 bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                  <Library className="h-6 w-6 text-primary group-hover:rotate-6 transition-transform duration-300" />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  Personal Research Library
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors mb-3">
                  Upload PDFs or import papers from Semantic Scholar. Your library is indexed so the AI can search
                  across all your papers at once and cite specific pages.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Upload PDFs &amp; import by DOI / Semantic Scholar URL</li>
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Full-text search across your entire library</li>
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> @mention specific papers in conversations</li>
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Page-level citations linked to in-app PDF viewer</li>
                </ul>
              </div>

              <div className="col-span-12 md:col-span-6 bg-card p-8 border-b border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="w-12 h-12 bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                  <Search className="h-6 w-6 text-primary group-hover:rotate-6 transition-transform duration-300" />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  Academic &amp; Web Search
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors mb-3">
                  Search the live web and academic databases in one place. The AI picks the right source type
                  automatically, or you can guide it.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Live web search via Exa for up-to-date information</li>
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Academic search for papers, preprints, and citations</li>
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Extreme Search for deep, multi-step research tasks</li>
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> URL retrieval to extract content from any web page</li>
                </ul>
              </div>

              <div className="col-span-12 md:col-span-6 bg-card p-8 border-r border-b border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="w-12 h-12 bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                  <Brain className="h-6 w-6 text-primary group-hover:rotate-6 transition-transform duration-300" />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  Inline Citations &amp; Source Viewer
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors mb-3">
                  Every answer is grounded. Numbered citations link to exact passages. Click any citation to read the
                  source excerpt, jump to the PDF page, or discover related papers.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Clickable [1] [2] markers inline with the answer</li>
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Source excerpt, PDF view, and related papers in one panel</li>
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Find Related Papers from any citation via Semantic Scholar</li>
                </ul>
              </div>

              <div className="col-span-12 md:col-span-6 bg-card p-8 border-b border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="w-12 h-12 bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                  <Eye className="h-6 w-6 text-primary group-hover:rotate-6 transition-transform duration-300" />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  Lookouts &mdash; Automated Monitoring
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors mb-3">
                  Set up a Lookout on any topic and get regular updates when new information appears. Useful for
                  tracking new publications, policy changes, or emerging findings in your area.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Schedule recurring research on any topic</li>
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Get notified when new sources appear</li>
                  <li className="flex items-start gap-2"><span className="text-primary mt-0.5">&bull;</span> Pro feature &mdash; included with your subscription</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Powered By */}
      <section className="border-b border-border">
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-12 border-l border-r border-border">
            <div className="col-span-12 bg-card p-6 border-b border-border">
              <h2 className="text-2xl font-semibold mb-2">Powered By</h2>
              <p className="text-muted-foreground">The infrastructure behind Core Lens</p>
            </div>

            <div className="col-span-12 grid grid-cols-12">
              <div className="col-span-12 md:col-span-4 bg-card p-8 text-center border-r border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="mb-6 flex justify-center group-hover:scale-110 transition-transform duration-300">
                  <VercelLogo />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">Vercel AI SDK</h3>
                <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                  Routes queries across {models.length}+ AI models from OpenAI, Anthropic, Google, and more.
                </p>
              </div>

              <div className="col-span-12 md:col-span-4 bg-card p-8 text-center border-r border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="mb-6 flex justify-center group-hover:scale-110 transition-transform duration-300">
                  <ExaLogo />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">Exa Search</h3>
                <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                  Real-time web and academic retrieval so answers reflect the latest published work.
                </p>
              </div>

              <div className="col-span-12 md:col-span-4 bg-card p-8 text-center group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="mb-6 flex justify-center group-hover:scale-110 transition-transform duration-300">
                  <ElevenLabsLogo />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  ElevenLabs Voice
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                  Listen to answers read aloud with natural voice synthesis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Models Section */}
      <section className="border-b border-border">
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-12 border-l border-r border-border">
            <div className="col-span-12 bg-card p-6 border-b border-border">
              <h2 className="text-2xl font-semibold mb-2">Choose Your AI Model</h2>
              <p className="text-muted-foreground">
                {models.length}+ models from OpenAI, Anthropic, Google, xAI, and others. Switch models mid-conversation
                &mdash; your research keeps flowing.
              </p>
            </div>

            {/* Filter Controls */}
            <div className="col-span-12 bg-card p-4 border-b border-border">
              <div className="grid grid-cols-12 gap-px bg-border">
                <Popover open={openCategory} onOpenChange={setOpenCategory}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCategory}
                      className="col-span-12 sm:col-span-4 justify-between rounded-none border-0 bg-background"
                    >
                      {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
                      <ArrowUpRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[92.5vw] sm:w-70 p-0 rounded-none border border-border bg-card shadow-none">
                    <Command className="rounded-none bg-background">
                      <CommandInput
                        placeholder="Search categories..."
                        className="h-10 rounded-none border-0 bg-background"
                      />
                      <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          {[
                            { value: 'all', label: 'All Categories' },
                            { value: 'Free', label: 'Free' },
                            { value: 'Pro', label: 'Pro' },
                            { value: 'Experimental', label: 'Experimental' },
                          ].map((category) => (
                            <CommandItem
                              key={category.value}
                              value={category.value}
                              onSelect={(currentValue) => {
                                setSelectedCategory(currentValue);
                                setOpenCategory(false);
                              }}
                              className="h-10 px-3 rounded-none"
                            >
                              {category.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Popover open={openCapabilities} onOpenChange={setOpenCapabilities}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCapabilities}
                      className="col-span-12 sm:col-span-4 justify-between rounded-none border-0 bg-background"
                    >
                      {selectedCapabilities.length === 0
                        ? 'All Capabilities'
                        : selectedCapabilities.length === 1
                          ? selectedCapabilities[0]
                          : `${selectedCapabilities.length} selected`}
                      <ArrowUpRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[92.5vw] sm:w-70 p-0 rounded-none border border-border bg-card shadow-none">
                    <Command className="rounded-none bg-background">
                      <CommandInput placeholder="Search capabilities..." className="h-10 rounded-none bg-background" />
                      <CommandList>
                        <CommandEmpty>No capability found.</CommandEmpty>
                        <CommandGroup>
                          {[
                            { value: 'vision', label: 'Vision' },
                            { value: 'reasoning', label: 'Reasoning' },
                            { value: 'pdf', label: 'PDF' },
                          ].map((capability) => (
                            <CommandItem
                              key={capability.value}
                              value={capability.value}
                              onSelect={(currentValue) => {
                                setSelectedCapabilities((prev) =>
                                  prev.includes(currentValue)
                                    ? prev.filter((item) => item !== currentValue)
                                    : [...prev, currentValue],
                                );
                              }}
                              className="h-10 px-3 rounded-none"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-2.5 h-2.5 ${
                                    selectedCapabilities.includes(capability.value) ? 'bg-primary' : 'bg-muted'
                                  }`}
                                />
                                {capability.label}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {(selectedCategory !== 'all' || selectedCapabilities.length > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory('all');
                      setSelectedCapabilities([]);
                    }}
                    className="col-span-12 sm:col-span-4 text-muted-foreground hover:text-foreground rounded-none border-0 bg-background h-9"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Models Grid */}
            <div className="col-span-12 grid grid-cols-12 border-b border-border">
              {(() => {
                const filteredModels = models.filter((model) => {
                  const categoryMatch = selectedCategory === 'all' || model.category === selectedCategory;
                  const capabilityMatch =
                    selectedCapabilities.length === 0 ||
                    selectedCapabilities.some((capability) => {
                      if (capability === 'vision') return model.vision;
                      if (capability === 'reasoning') return model.reasoning;
                      if (capability === 'pdf') return model.pdf;
                      return false;
                    });
                  return categoryMatch && capabilityMatch;
                });

                const groupedModels = filteredModels.reduce(
                  (acc, model) => {
                    const category = model.category;
                    if (!acc[category]) {
                      acc[category] = [];
                    }
                    acc[category].push(model);
                    return acc;
                  },
                  {} as Record<string, typeof models>,
                );

                const groupOrder = ['Free', 'Experimental', 'Pro'];
                const orderedGroupEntries = groupOrder
                  .filter((category) => groupedModels[category] && groupedModels[category].length > 0)
                  .map((category) => [category, groupedModels[category]] as const);

                const sortedModels = orderedGroupEntries.flatMap(([_, categoryModels]) => categoryModels);

                if (sortedModels.length === 0) {
                  return (
                    <div className="col-span-12 bg-card p-12 text-center border-b border-border">
                      <div className="w-16 h-16 mx-auto mb-4 bg-muted flex items-center justify-center">
                        <Filter className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">No models found</h3>
                      <p className="text-muted-foreground mb-4">Try adjusting your filters to see more models</p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedCategory('all');
                          setSelectedCapabilities([]);
                        }}
                        className="rounded-none"
                      >
                        Clear all filters
                      </Button>
                    </div>
                  );
                }

                const modelsToShow = showAllModels ? sortedModels : sortedModels.slice(0, 12);

                return (
                  <>
                    {modelsToShow.map((model: any) => (
                      <div
                        key={model.value}
                        className="col-span-12 md:col-span-6 lg:col-span-4 bg-card p-6 group relative overflow-hidden hover:bg-card/90 transition-all duration-300 border-r border-b border-border"
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                          <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                        </div>
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {model.label}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="text-xs group-hover:bg-primary/10 group-hover:text-primary transition-colors"
                          >
                            {model.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 group-hover:text-foreground/80 transition-colors">
                          {model.description}
                        </p>
                        <div className="flex flex-wrap gap-px">
                          {model.vision && (
                            <span className="text-xs font-mono text-muted-foreground border border-border px-2 py-1 group-hover:border-primary/50 group-hover:text-foreground/80 transition-all duration-200 hover:scale-105 hover:border-primary cursor-default">
                              Vision
                            </span>
                          )}
                          {model.reasoning && (
                            <span className="text-xs font-mono text-muted-foreground border border-border px-2 py-1 group-hover:border-primary/50 group-hover:text-foreground/80 transition-all duration-200 hover:scale-105 hover:border-primary cursor-default">
                              Reasoning
                            </span>
                          )}
                          {model.pdf && (
                            <span className="text-xs font-mono text-muted-foreground border border-border px-2 py-1 group-hover:border-primary/50 group-hover:text-foreground/80 transition-all duration-200 hover:scale-105 hover:border-primary cursor-default">
                              PDF
                            </span>
                          )}
                          {model.fast && (
                            <span className="text-xs font-mono text-muted-foreground border border-border px-2 py-1 group-hover:border-primary/50 group-hover:text-foreground/80 transition-all duration-200 hover:scale-105 hover:border-primary cursor-default">
                              Fast
                            </span>
                          )}
                          {model.isNew && (
                            <span className="text-xs font-mono text-muted-foreground border border-border px-2 py-1 group-hover:border-primary/50 group-hover:text-foreground/80 transition-all duration-200 hover:scale-105 hover:border-primary cursor-default">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {sortedModels.length > 12 && (
                      <div className="col-span-12 flex justify-center py-6 bg-card">
                        <Button
                          variant="outline"
                          onClick={() => setShowAllModels(!showAllModels)}
                          className="rounded-none"
                        >
                          {showAllModels ? (
                            <>
                              Show Less
                              <ArrowUpRight className="ml-2 h-4 w-4 rotate-180" />
                            </>
                          ) : (
                            <>
                              Show More ({sortedModels.length - 12} more)
                              <ArrowUpRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="col-span-12 bg-card p-6">
              <div className="grid grid-cols-12 gap-px bg-border">
                <div className="col-span-12 md:col-span-8 bg-background p-4">
                  <p className="text-sm text-muted-foreground">
                    {models.length} models available &mdash; switch anytime, even mid-conversation
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Free models included at no cost. Pro unlocks the full catalog.</p>
                </div>
                <div className="col-span-12 md:col-span-4 bg-background p-4 flex items-center justify-center">
                  <Button
                    onClick={() => router.push('/')}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-6 py-2.5 w-full rounded-none"
                  >
                    Start Researching
                    <ArrowUpRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="border-b border-border">
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-12 border-l border-r border-border">
            <div className="col-span-12 bg-card p-6 border-b border-border">
              <h2 className="text-2xl font-semibold mb-2">Pricing</h2>
              <p className="text-muted-foreground">Start for free. Upgrade when you need more.</p>
            </div>

            <div className="col-span-12 grid grid-cols-12">
              {/* Free Plan */}
              <div className="col-span-12 md:col-span-6 bg-card p-8 flex flex-col border-b border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">Free</h3>
                  <p className="text-muted-foreground mb-4 group-hover:text-foreground/80 transition-colors">
                    Try Core Lens with no commitment
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-baseline transition-colors duration-200">
                      <span className="text-3xl font-light tracking-tight">$0</span>
                      <span className="text-muted-foreground ml-2">/month</span>
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-2xl font-medium text-muted-foreground">{'\u20B9'}0</span>
                      <span className="text-muted-foreground ml-2 text-sm">/month</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-primary/60 mt-2 shrink-0"></div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      {SEARCH_LIMITS.DAILY_SEARCH_LIMIT} research queries per day
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-primary/60 mt-2 shrink-0"></div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      Free-tier AI models (GPT-4o Mini, Gemini Flash, etc.)
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-primary/60 mt-2 shrink-0"></div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      Web &amp; academic search with citations
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-primary/60 mt-2 shrink-0"></div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      Search history saved across sessions
                    </span>
                  </li>
                </ul>

                <Button
                  variant="outline"
                  className="w-full border-border hover:border-primary hover:bg-primary/5 rounded-none transition-colors duration-200"
                  onClick={() => router.push('/')}
                >
                  Get Started
                </Button>
              </div>

              {/* Pro Plan */}
              <div className="col-span-12 md:col-span-6 bg-card p-8 flex flex-col border-l border-b border-border group relative overflow-hidden hover:bg-card/95 transition-all duration-300">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-px bg-primary animate-reveal-line" />
                </div>
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">Pro</h3>
                    <Badge
                      variant="secondary"
                      className="text-xs group-hover:bg-primary/20 group-hover:text-primary transition-colors"
                    >
                      For Serious Research
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-4 group-hover:text-foreground/80 transition-colors">
                    Unlimited access for active researchers
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-baseline transition-colors duration-200">
                      <span className="text-3xl font-light tracking-tight">${PRICING.PRO_MONTHLY}</span>
                      <span className="text-muted-foreground ml-2">/month</span>
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-2xl font-medium text-muted-foreground">{'\u20B9'}{PRICING.PRO_MONTHLY_INR}</span>
                      <span className="text-muted-foreground ml-2 text-sm">(excl. GST)/month</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-primary mt-2 shrink-0"></div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      Unlimited research queries
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-primary mt-2 shrink-0"></div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      All {models.length}+ AI models (Claude, GPT-4o, Gemini Pro, Grok, etc.)
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-primary mt-2 shrink-0"></div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      PDF upload &amp; library with full-text search
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-primary mt-2 shrink-0"></div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      Extreme Search for deep multi-step research
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-primary mt-2 shrink-0"></div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      Lookout automated topic monitoring
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-primary mt-2 shrink-0"></div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      Priority support
                    </span>
                  </li>
                </ul>

                <Button
                  className="w-full rounded-none transition-colors duration-200"
                  onClick={() => router.push('/pricing')}
                >
                  Upgrade to Pro
                </Button>
              </div>
            </div>

            {/* Student Discount */}
            <div className="col-span-12 bg-card p-6 border-border">
              <div className="grid grid-cols-12 gap-px bg-border">
                <div className="col-span-12 md:col-span-8 bg-background p-6 text-center md:text-left">
                  <div className="w-10 h-10 bg-primary/10 flex items-center justify-center mx-auto md:mx-0 mb-3">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Student &amp; Academic Discount</h3>
                  <p className="text-sm text-muted-foreground">
                    Sign up with your university email (.edu, .ac.uk, .ac.in, etc.) and get Pro for just $5/month.
                    The discount is applied automatically &mdash; no verification forms needed.
                  </p>
                </div>
                <div className="col-span-12 md:col-span-4 bg-background p-6 flex items-center justify-center">
                  <Button
                    onClick={() => router.push('/pricing')}
                    variant="outline"
                    size="sm"
                    className="rounded-none w-full"
                  >
                    Get Student Pricing
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-b border-border">
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-12 border-l border-r border-border">
            <div className="col-span-12 bg-card p-6 border-b border-border">
              <h2 className="text-2xl font-semibold mb-2">Frequently Asked Questions</h2>
              <p className="text-muted-foreground">Common questions from researchers</p>
            </div>

            <div className="col-span-12 bg-card p-6 border-b border-border">
              <ProAccordion type="single" collapsible className="w-full">
                <ProAccordionItem value="item-1">
                  <ProAccordionTrigger>What is Core Lens?</ProAccordionTrigger>
                  <ProAccordionContent>
                    Core Lens is an AI research assistant that helps you find, read, and cite information faster.
                    Ask a question in plain language and get an answer grounded in live web sources, academic papers, and
                    your own uploaded PDFs &mdash; with inline citations linking back to the original material.
                  </ProAccordionContent>
                </ProAccordionItem>

                <ProAccordionItem value="item-2">
                  <ProAccordionTrigger>How is this different from ChatGPT or Perplexity?</ProAccordionTrigger>
                  <ProAccordionContent>
                    Core Lens is built specifically for research. It has a personal paper library with full-text search,
                    page-level PDF citations, academic search, Extreme Search for deep multi-step research, and Lookout for
                    automated topic monitoring. You can also @mention specific papers from your library in conversations.
                  </ProAccordionContent>
                </ProAccordionItem>

                <ProAccordionItem value="item-3">
                  <ProAccordionTrigger>Can I upload my own papers?</ProAccordionTrigger>
                  <ProAccordionContent>
                    Yes. Upload any PDF to your research library, or import papers directly from Semantic Scholar by URL
                    or DOI. Once indexed, the AI can search across all your papers and cite specific sections with page numbers.
                  </ProAccordionContent>
                </ProAccordionItem>

                <ProAccordionItem value="item-4">
                  <ProAccordionTrigger>Is there a student discount?</ProAccordionTrigger>
                  <ProAccordionContent>
                    Yes. Students with university email addresses (.edu, .ac.in, .ac.uk, etc.) get Pro for $5/month instead
                    of $15/month. The discount is applied automatically at checkout &mdash; no verification required.
                  </ProAccordionContent>
                </ProAccordionItem>

                <ProAccordionItem value="item-5">
                  <ProAccordionTrigger>How accurate are the citations?</ProAccordionTrigger>
                  <ProAccordionContent>
                    Every numbered citation links to a specific source &mdash; a web page, an academic paper, or a page in
                    your uploaded PDF. You can click any citation to read the original excerpt, open the PDF at that page,
                    or find related papers. The AI is designed to cite rather than fabricate, but you should always verify
                    critical claims.
                  </ProAccordionContent>
                </ProAccordionItem>

                <ProAccordionItem value="item-6">
                  <ProAccordionTrigger>Can I cancel my subscription anytime?</ProAccordionTrigger>
                  <ProAccordionContent>
                    Yes, you can cancel your Pro subscription at any time. Your access continues until the end of your
                    current billing period.
                  </ProAccordionContent>
                </ProAccordionItem>

                <ProAccordionItem value="item-7">
                  <ProAccordionTrigger>What AI models are available?</ProAccordionTrigger>
                  <ProAccordionContent>
                    Core Lens gives you access to {models.length}+ models from OpenAI (GPT-4o, o3), Anthropic (Claude),
                    Google (Gemini), xAI (Grok), and more. Free users get access to a selection of fast, capable models.
                    Pro unlocks the full catalog, including reasoning models and those with vision and PDF capabilities.
                  </ProAccordionContent>
                </ProAccordionItem>

                <ProAccordionItem value="item-8">
                  <ProAccordionTrigger>Is Core Lens open source?</ProAccordionTrigger>
                  <ProAccordionContent>
                    Yes. Core Lens is open source and available on GitHub. You can self-host it, contribute, or inspect
                    how it works under the hood.
                  </ProAccordionContent>
                </ProAccordionItem>
              </ProAccordion>
            </div>

            <div className="col-span-12 bg-card p-6 border-border">
              <div className="grid grid-cols-12 gap-px bg-border">
                <div className="col-span-12 md:col-span-8 bg-background p-4">
                  <p className="text-sm font-medium text-foreground mb-1">Ready to get started?</p>
                  <p className="text-xs text-muted-foreground">
                    Have more questions?{' '}
                    <a href="mailto:haziqbangash@core-lens.ai" className="text-primary hover:text-primary/80 transition-colors">
                      Contact us
                    </a>
                  </p>
                </div>
                <div className="col-span-12 md:col-span-4 bg-background p-4 grid grid-cols-2">
                  <Button
                    onClick={() => router.push('/')}
                    size="sm"
                    className="rounded-none border-0 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Start now
                    <Search className="ml-1 h-3 w-3" />
                  </Button>
                  <Button
                    onClick={() => router.push('/pricing')}
                    variant="outline"
                    size="sm"
                    className="rounded-none border-0"
                  >
                    View pricing
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-12 border-l border-r border-border">
            <div className="col-span-12 md:col-span-8 bg-card p-4 md:p-6 border-r border-b border-border">
              <div className="flex items-center gap-3">
                <CoreLensLogo className="size-8" />
                <p className="text-sm text-muted-foreground">
                  &copy; {new Date().getFullYear()} Core Lens. All rights reserved.
                </p>
              </div>
            </div>
            <div className="col-span-12 md:col-span-4 bg-card p-0 border-b border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border h-full">
                <Link
                  href="/terms"
                  className="flex items-center justify-center h-12 text-sm text-muted-foreground hover:text-foreground transition-colors border-r md:border-r-0 md:border-0 border-border"
                >
                  Terms
                </Link>
                <Link
                  href="/privacy-policy"
                  className="flex items-center justify-center h-12 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy
                </Link>
                <Link
                  href="https://x.com/core-lensai"
                  className="flex items-center justify-center h-12 text-muted-foreground hover:text-foreground transition-colors border-r md:border-r-0 md:border-0 border-border"
                  target="_blank"
                >
                  <XLogoIcon className="h-4 w-4" />
                </Link>
                <Link
                  href="https://git.new/core-lens"
                  className="flex items-center justify-center h-12 text-muted-foreground hover:text-foreground transition-colors"
                  target="_blank"
                >
                  <GithubLogoIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
