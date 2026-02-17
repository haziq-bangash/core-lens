'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS, $convertToMarkdownString, $convertFromMarkdownString } from '@lexical/markdown';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  LexicalEditor,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
} from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';
import { $createHeadingNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Type,
  ChevronDown,
  Heading1,
  Heading2,
  Pilcrow,
  Save,
  X,
  Undo2,
  Redo2,
  SlidersHorizontal,
  ChevronRight,
  Check,
  Maximize2,
  Minimize2,
  Wand2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MarkdownRenderer } from '@/components/markdown';

// ---------- Theme ----------
const editorTheme = {
  paragraph: 'mb-1.5 text-sm leading-relaxed text-foreground',
  heading: {
    h1: 'text-2xl font-bold mb-3 text-foreground',
    h2: 'text-lg font-semibold mb-2 text-foreground',
    h3: 'text-base font-semibold mb-1.5 text-foreground',
  },
  list: {
    ul: 'list-disc ml-5 mb-2 text-sm',
    ol: 'list-decimal ml-5 mb-2 text-sm',
    listitem: 'mb-0.5',
  },
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-muted px-1 py-0.5 rounded text-[13px] font-mono',
  },
  link: 'text-blue-600 dark:text-blue-400 underline cursor-pointer',
  quote: 'border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground my-2',
};

// ---------- Load initial Markdown plugin ----------
function LoadInitialMarkdownPlugin({ markdown }: { markdown: string }) {
  const [editor] = useLexicalComposerContext();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || !markdown) return;
    loaded.current = true;

    editor.update(() => {
      const root = $getRoot();
      if (root.getTextContent().trim()) return;
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    });
  }, [editor, markdown]);

  return null;
}

// ---------- Citation formats & Languages ----------
const CITATION_FORMATS = [
  'Numbered',
  'APA (7th edition)',
  'MLA (9th edition)',
  'Harvard',
  'Chicago',
  'IEEE',
  'CSE',
  'ACS',
  'Vancouver',
  'ASA',
  'AMA',
  'OSCOLA',
] as const;

const LANGUAGES = [
  'English (US)',
  'English (UK)',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
] as const;

// ---------- Floating Bottom Toolbar ----------
function ToolbarButton({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        'inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:text-foreground transition-colors',
        active && 'text-foreground bg-muted'
      )}
    >
      {children}
    </button>
  );
}

interface FloatingToolbarProps {
  citationFormat: string;
  onCitationFormatChange: (fmt: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  spellCheck: boolean;
  onSpellCheckChange: (v: boolean) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

function FloatingToolbar({
  citationFormat,
  onCitationFormatChange,
  language,
  onLanguageChange,
  spellCheck,
  onSpellCheckChange,
  isFullscreen,
  onToggleFullscreen,
}: FloatingToolbarProps) {
  const [editor] = useLexicalComposerContext();

  const format = useCallback(
    (type: 'bold' | 'italic' | 'underline' | 'strikethrough') => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
    },
    [editor]
  );

  const setBlockType = useCallback(
    (type: 'paragraph' | 'h1' | 'h2') => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        if (type === 'paragraph') {
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          $setBlocksType(selection, () => $createHeadingNode(type));
        }
      });
    },
    [editor]
  );

  return (
    <div className="flex items-center gap-0.5 rounded-xl border bg-background/95 backdrop-blur shadow-lg px-2 py-1.5">
      {/* Block type dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md h-8 px-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <Type className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="min-w-36">
          <DropdownMenuItem onSelect={() => setBlockType('paragraph')}>
            <Pilcrow className="h-4 w-4 mr-2" />
            Paragraph
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setBlockType('h1')}>
            <Heading1 className="h-4 w-4 mr-2" />
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setBlockType('h2')}>
            <Heading2 className="h-4 w-4 mr-2" />
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
          >
            <List className="h-4 w-4 mr-2" />
            Bullet List
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
          >
            <ListOrdered className="h-4 w-4 mr-2" />
            Numbered List
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton onClick={() => format('bold')}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => format('italic')}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => format('underline')}>
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => format('strikethrough')}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Settings popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-64 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="divide-y">
            {/* Citation format */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between w-full px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="text-muted-foreground">Citation format</span>
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    {citationFormat}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-48 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="space-y-0.5 max-h-[260px] overflow-y-auto">
                  {CITATION_FORMATS.map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => onCitationFormatChange(fmt)}
                      className="flex items-center justify-between w-full rounded-md px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                    >
                      <span>{fmt}</span>
                      {citationFormat === fmt && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Language */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between w-full px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="text-muted-foreground">Language</span>
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    {language}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-48 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="space-y-0.5 max-h-[260px] overflow-y-auto">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => onLanguageChange(lang)}
                      className="flex items-center justify-between w-full rounded-md px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                    >
                      <span>{lang}</span>
                      {language === lang && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Spellcheck */}
            <div className="flex items-center justify-between px-4 py-2.5">
              <Label htmlFor="toolbar-spellcheck" className="text-sm text-muted-foreground font-normal cursor-pointer">
                Spellcheck
              </Label>
              <Switch
                id="toolbar-spellcheck"
                checked={spellCheck}
                onCheckedChange={onSpellCheckChange}
                className="scale-90"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Fullscreen toggle */}
      <ToolbarButton onClick={onToggleFullscreen}>
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </ToolbarButton>
    </div>
  );
}

// ---------- Helper plugin to capture editor ref ----------
function EditorRefPlugin({ editorRef }: { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return null;
}

// ---------- Main component ----------
// ---------- Plugin: insert markdown content ----------
function InsertMarkdownPlugin({ markdown, onInserted }: { markdown: string | null; onInserted: () => void }) {
  const [editor] = useLexicalComposerContext();
  const inserted = useRef(false);

  useEffect(() => {
    if (!markdown || inserted.current) return;
    inserted.current = true;
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    });
    onInserted();
  }, [editor, markdown, onInserted]);

  // Reset when markdown clears
  useEffect(() => {
    if (!markdown) inserted.current = false;
  }, [markdown]);

  return null;
}

interface NotesEditorProps {
  initialContent: string;
  onSave: (markdown: string) => void;
  onCancel: () => void;
  isSaving?: boolean;
  isMobile?: boolean;
  spellCheck?: boolean;
  onSpellCheckChange?: (v: boolean) => void;
  citationFormat?: string;
  onCitationFormatChange?: (fmt: string) => void;
  language?: string;
  onLanguageChange?: (lang: string) => void;
  onGenerate?: () => void;
  isGenerating?: boolean;
  generatedContent?: string | null;
  onGeneratedContentInserted?: () => void;
}

export function NotesEditor({
  initialContent,
  onSave,
  onCancel,
  isSaving,
  isMobile,
  spellCheck = true,
  onSpellCheckChange,
  citationFormat = 'Numbered',
  onCitationFormatChange,
  language = 'English (US)',
  onLanguageChange,
  onGenerate,
  isGenerating,
  generatedContent,
  onGeneratedContentInserted,
}: NotesEditorProps) {
  const editorRef = useRef<LexicalEditor | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const handleSave = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.update(() => {
      const markdown = $convertToMarkdownString(TRANSFORMERS);
      onSave(markdown);
    });
  }, [onSave]);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen]);

  const initialConfig = {
    namespace: 'PaperNotes',
    theme: editorTheme,
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, CodeNode, CodeHighlightNode],
    onError: (error: Error) => console.error('Lexical error:', error),
    editable: true,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <EditorRefPlugin editorRef={editorRef} />
      <div
        className={cn(
          'relative flex flex-col',
          isFullscreen
            ? 'fixed inset-0 z-50 bg-background p-6'
            : 'min-h-[350px]'
        )}
      >
        {/* Top bar: Generate + Save/Cancel */}
        <div className={cn(
          'flex items-center justify-between z-10',
          isMobile && !isFullscreen
            ? 'sticky top-0 bg-background pb-1'
            : 'absolute top-0 left-0 right-0'
        )} style={isFullscreen ? { position: 'absolute', top: '1.5rem', left: '1.5rem', right: '1.5rem' } : undefined}>
          <div>
            {onGenerate && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                onClick={onGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {isGenerating ? 'Generating...' : 'Generate'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onCancel}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Writing area */}
        <div className={cn(
          'flex-1',
          isMobile && !isFullscreen ? 'pb-16' : 'pt-8 pb-16',
          isFullscreen && 'max-w-3xl mx-auto w-full overflow-y-auto'
        )}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="outline-none text-sm leading-relaxed min-h-[200px]"
                spellCheck={spellCheck}
              />
            }
            placeholder={
              <div className={cn(
                'absolute left-0 text-sm select-none',
                isFullscreen ? 'top-8 max-w-3xl mx-auto' : isMobile ? 'top-0' : 'top-8'
              )}>
                <span className="text-muted-foreground/40 pointer-events-none">Start writing...</span>
                {onGenerate && !isGenerating && (
                  <button
                    type="button"
                    onClick={onGenerate}
                    className="ml-1 text-muted-foreground/60 hover:text-foreground transition-colors underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-foreground/50"
                  >
                    or generate with AI
                  </button>
                )}
                {isGenerating && (
                  <span className="ml-1 text-muted-foreground/60 inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> generating...
                  </span>
                )}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>

        {/* Bottom toolbar */}
        <div className={cn(
          'flex justify-center py-3 bg-gradient-to-t from-background via-background to-transparent',
          isFullscreen
            ? 'fixed bottom-0 left-0 right-0 z-50'
            : isMobile
              ? 'sticky bottom-0 left-0 right-0 z-10'
              : 'absolute bottom-0 left-0 right-0'
        )}>
          <FloatingToolbar
            citationFormat={citationFormat}
            onCitationFormatChange={onCitationFormatChange ?? (() => {})}
            language={language}
            onLanguageChange={onLanguageChange ?? (() => {})}
            spellCheck={spellCheck}
            onSpellCheckChange={onSpellCheckChange ?? (() => {})}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((v) => !v)}
          />
        </div>
      </div>

      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <LoadInitialMarkdownPlugin markdown={initialContent} />
      {generatedContent && onGeneratedContentInserted && (
        <InsertMarkdownPlugin markdown={generatedContent} onInserted={onGeneratedContentInserted} />
      )}
    </LexicalComposer>
  );
}

// ---------- Read-only rendered Markdown ----------
export function NotesDisplay({ content }: { content: string }) {
  if (!content) return null;
  return (
    <div className="text-sm">
      <MarkdownRenderer content={content} />
    </div>
  );
}
