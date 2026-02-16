import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import isEqual from 'fast-deep-equal';
import { ReasoningUIPart, DataUIPart, isStaticToolUIPart } from 'ai';
import { ReasoningPartView } from '@/components/reasoning-part';
import { MarkdownRenderer } from '@/components/markdown';
import { ChatTextHighlighter } from '@/components/chat-text-highlighter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { deleteTrailingMessages, generateSpeech, branchOutChat } from '@/app/actions';
import { toast } from 'sonner';
import { Wave } from '@foobar404/wave';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ShareButton } from '@/components/share';
import { HugeiconsIcon } from '@/components/ui/hugeicons';
import { RepeatIcon, Copy01Icon, CpuIcon, SplitIcon } from '@hugeicons/core-free-icons';
import { ChatMessage, CustomUIDataTypes, DataQueryCompletionPart, DataExtremeSearchPart } from '@/lib/types';
import { UseChatHelpers } from '@ai-sdk/react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import Fuse from "fuse.js";
import { pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

// Tool-specific components (eagerly loaded for better UX)
import { SearchLoadingState } from '@/components/tool-invocation-list-view';
import {
  XCircle,
  Loader2,
  Clock,
  Globe,
  TextIcon,
  Pause,
  Play as PlayIcon,
  Info,
  Code,
  FileText,
  FileCode,
  Download,
  Clock as PhosphorClockIcon,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  Sigma as SigmaIcon,
  Copy,
  ExternalLink,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getModelConfig } from '@/ai/providers';
import { ComprehensiveUserData } from '@/lib/user-data-server';

import MultiSearch from '@/components/multi-search';
import AcademicPapersCard from '@/components/academic-papers';
import { ExtremeSearch } from '@/components/extreme-search';
import { RetrieveResults } from '@/components/retrieve-results';
import { useDataStream } from '../data-stream-provider';
import { Dialog, DialogClose, DialogContent } from '../ui/dialog';

// Error component for tool errors
const ToolErrorDisplay = ({ errorText, toolName }: { errorText: string; toolName: string }) => (
  <div className="w-full my-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-900 dark:text-red-100">{toolName} failed</h3>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1">{errorText}</p>
        </div>
      </div>
    </div>
  </div>
);

interface MessagePartRendererProps {
  part: ChatMessage['parts'][number];
  messageIndex: number;
  partIndex: number;
  parts: ChatMessage['parts'][number][];
  message: ChatMessage;
  status: string;
  hasActiveToolInvocations: boolean;
  reasoningVisibilityMap: Record<string, boolean>;
  reasoningFullscreenMap: Record<string, boolean>;
  setReasoningVisibilityMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setReasoningFullscreenMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  messages: ChatMessage[];
  user?: ComprehensiveUserData;
  isOwner?: boolean;
  selectedVisibilityType?: 'public' | 'private';
  chatId?: string;
  onVisibilityChange?: (visibility: 'public' | 'private') => void;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  setSuggestedQuestions: (questions: string[]) => void;
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  onHighlight?: (text: string) => void;
  annotations?: DataUIPart<CustomUIDataTypes>[];
}

export const MessagePartRenderer = memo<MessagePartRendererProps>(
  ({
    part,
    messageIndex,
    partIndex,
    parts,
    message,
    status,
    hasActiveToolInvocations,
    reasoningVisibilityMap,
    reasoningFullscreenMap,
    setReasoningVisibilityMap,
    setReasoningFullscreenMap,
    messages,
    user,
    isOwner,
    selectedVisibilityType,
    chatId,
    onVisibilityChange,
    setMessages,
    setSuggestedQuestions,
    regenerate,
    onHighlight,
    annotations,
  }) => {
    useDataStream();
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isBranchingOut, setIsBranchingOut] = useState(false);
    const router = useRouter();
    const queryClient = useQueryClient();

    // Handle text parts
    if (part.type === 'text') {
      // Check if there are any reasoning parts in the message
      const hasReasoningParts = parts.some((p) => p.type === 'reasoning');

      // For empty text parts in a streaming message, show loading animation only if no tool invocations and no reasoning parts are present
      if (
        (!part.text || part.text.trim() === '') &&
        (status === 'streaming' || status === 'submitted') &&
        !hasActiveToolInvocations &&
        !hasReasoningParts
      ) {
        return (
          <div
            key={`${messageIndex}-${partIndex}-loading`}
            className="flex flex-col min-h-[calc(100vh-18rem)] m-0! p-0! mt-4!"
          >
            <div className="flex space-x-2 ml-8 mt-2">
              <div
                className="w-2 h-2 rounded-full bg-muted-foreground dark:bg-muted-foreground animate-bounce"
                style={{ animationDelay: '0ms' }}
              ></div>
              <div
                className="w-2 h-2 rounded-full bg-muted-foreground dark:bg-muted-foreground animate-bounce"
                style={{ animationDelay: '150ms' }}
              ></div>
              <div
                className="w-2 h-2 rounded-full bg-muted-foreground dark:bg-muted-foreground animate-bounce"
                style={{ animationDelay: '300ms' }}
              ></div>
            </div>
          </div>
        );
      }

      // Skip empty text parts entirely for non-streaming states, but allow them during streaming with active tool invocations
      if (!part.text || part.text.trim() === '') {
        // Only skip if we're not streaming or if there are no active tool invocations
        if (status !== 'streaming' || !hasActiveToolInvocations) {
          return null;
        }
        // If we're streaming with active tool invocations, don't render anything for empty text but don't block other parts
        return <div key={`${messageIndex}-${partIndex}-empty`}></div>;
      }

      // Pre-compute metadata presentation values
      const meta = message?.metadata;
      const modelConfig = meta?.model ? getModelConfig(meta.model) : null;
      const modelLabel = modelConfig?.label ?? meta?.model ?? null;
      const tokenTotal = (meta?.totalTokens ?? (meta?.inputTokens ?? 0) + (meta?.outputTokens ?? 0)) || null;
      const inputCount = meta?.inputTokens ?? null;
      const outputCount = meta?.outputTokens ?? null;

      // Detect text sandwiched between step-start and tool-invocation
      const prevPart = parts[partIndex - 1];
      const nextPart = parts[partIndex + 1];
      if (prevPart?.type === 'step-start' && nextPart?.type.includes('tool-')) {
        return null;
      }

      // Detect text sandwiched between reasoning and tool-invocation
      if (prevPart?.type === 'reasoning' && nextPart?.type.includes('tool-')) {
        return null;
      }

      // Skip text parts that are ONLY <|im_end|> after a tool call
      const hasToolInvocationBefore = parts.slice(0, partIndex).some((p) => p.type.includes('tool-'));
      if (hasToolInvocationBefore && part.text.trim() === '<|im_end|>') {
        return null;
      }

      // Determine if this is the last assistant message
      const isLastAssistantMessage = messageIndex === messages.length - 1 && message.role === 'assistant';

      // Show action buttons when:
      // 1. Status is ready (no streaming happening), OR
      // 2. This is NOT the last assistant message (previous messages keep their buttons)
      const shouldShowActionButtons = status === 'ready' || !isLastAssistantMessage;

      // Clean the text by removing box markers and special tokens
      const cleanText = part.text
        .replace(/<\|begin_of_box\|>/g, '')
        .replace(/<\|end_of_box\|>/g, '')
        .replace(/<\|im_end\|>/g, '');

      return (
        <div key={`${messageIndex}-${partIndex}-text`} className="mt-2">
          <div>
            <ChatTextHighlighter onHighlight={onHighlight} removeHighlightOnClick={true}>
              <MarkdownRenderer content={cleanText} />
            </ChatTextHighlighter>
          </div>

          {/* Action buttons below the text */}
          {shouldShowActionButtons && (
            <div className="flex items-center justify-between mt-3 mb-4">
              {/* Left side - Action buttons */}
              <div className="flex items-center -ml-1.5">
                {/* Rewrite button - only for owners or unauthenticated users on private chats, and only on last assistant message */}
                {((user && isOwner) || (!user && selectedVisibilityType === 'private')) && isLastAssistantMessage && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isRegenerating}
                          onClick={async () => {
                            if (isRegenerating) return;

                            try {
                              setIsRegenerating(true);
                              const lastUserMessage = messages.findLast((m) => m.role === 'user');
                              if (!lastUserMessage) return;

                              if (user && lastUserMessage.id) {
                                await deleteTrailingMessages({
                                  id: lastUserMessage.id,
                                });
                              }

                              const newMessages = [];
                              for (let i = 0; i < messages.length; i++) {
                                newMessages.push(messages[i]);
                                if (messages[i].id === lastUserMessage.id) {
                                  break;
                                }
                              }

                              setMessages(newMessages);
                              setSuggestedQuestions([]);
                              await regenerate();
                            } catch (error) {
                              console.error('Error in reload:', error);
                            } finally {
                              setIsRegenerating(false);
                            }
                          }}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                          <HugeiconsIcon icon={RepeatIcon} size={16} color="currentColor" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={4}>Try Again</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Share button */}
                {onVisibilityChange && (
                  <ShareButton
                    chatId={chatId || null}
                    selectedVisibilityType={selectedVisibilityType || 'private'}
                    onVisibilityChange={async (visibility) => {
                      await Promise.resolve(onVisibilityChange(visibility));
                    }}
                    isOwner={isOwner}
                    user={user}
                    variant="icon"
                    size="sm"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  />
                )}

                {/* Copy button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(cleanText);
                          toast.success('Copied to clipboard');
                        }}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <HugeiconsIcon icon={Copy01Icon} size={16} color="currentColor" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>Copy</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Branch Out button - only for owners or unauthenticated users on private chats, and only on assistant messages */}
                {((user && isOwner) || (!user && selectedVisibilityType === 'private')) &&
                  message.role === 'assistant' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isBranchingOut}
                            onClick={async () => {
                              if (isBranchingOut) return;

                              try {
                                setIsBranchingOut(true);

                                // Find the corresponding user message (the one before this assistant message)
                                const currentMessageIndex = messages.findIndex((m) => m.id === message.id);
                                if (currentMessageIndex === -1) {
                                  toast.error('Could not find message');
                                  return;
                                }

                                // Find the last user message before this assistant message
                                let userMessage: ChatMessage | undefined;
                                for (let i = currentMessageIndex - 1; i >= 0; i--) {
                                  if (messages[i].role === 'user') {
                                    userMessage = messages[i];
                                    break;
                                  }
                                }

                                if (!userMessage) {
                                  toast.error('Could not find corresponding user message');
                                  return;
                                }

                                // Branch out the chat
                                const result = await branchOutChat({
                                  userMessage: userMessage as any,
                                  assistantMessage: message as any,
                                });

                                if (result.success && result.chatId) {
                                  // Invalidate recent chats cache to show the new chat in sidebar
                                  if (user?.id) {
                                    queryClient.refetchQueries({ queryKey: ['recent-chats', user.id] });
                                  }
                                  toast.success('Chat branched out successfully');
                                  await new Promise((resolve) => setTimeout(resolve, 100));
                                  // Navigate to the new chat
                                  router.push(`/search/${result.chatId}`);
                                } else {
                                  toast.error(result.error || 'Failed to branch out chat');
                                }
                              } catch (error) {
                                console.error('Error branching out chat:', error);
                                toast.error('Failed to branch out chat');
                              } finally {
                                setIsBranchingOut(false);
                              }
                            }}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          >
                            {isBranchingOut ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <HugeiconsIcon icon={SplitIcon} size={16} color="currentColor" className="rotate-90" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={4}>Branch Out</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                {/* Export dropdown */}
                {message.role === 'assistant' && (
                  <DropdownMenu>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={4}>Export</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <DropdownMenuContent className="min-w-35" align="start" sideOffset={4}>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onClick={async () => {
                          try {
                            const textParts = (message.parts || [])
                              .filter((p) => p.type === 'text' && (p as any).text)
                              .map((p: any) => String(p.text).trim())
                              .filter((s: string) => s.length > 0);
                            const content = textParts.join('\n\n');
                            if (!content) {
                              toast.error('Nothing to export from assistant message');
                              return;
                            }

                            const payload = {
                              title: 'Contract Lens AI',
                              content,
                              meta: {
                                modelLabel: modelLabel || null,
                                createdAt: (message as any)?.createdAt || Date.now(),
                              },
                            };

                            const res = await fetch('/api/export/pdf', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload),
                            });
                            if (!res.ok) {
                              const errText = await res.text();
                              throw new Error(errText || 'Failed to generate PDF');
                            }
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `contract-lens-export-${message.id || Date.now()}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                            toast.success('PDF downloaded');
                          } catch (e) {
                            console.error('Export PDF error:', e);
                            toast.error('Failed to export PDF');
                          }
                        }}
                      >
                        <FileText className="h-4 w-4" />
                        <span>PDF</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onClick={() => {
                          try {
                            const textParts = (message.parts || [])
                              .filter((p) => p.type === 'text' && (p as any).text)
                              .map((p: any) => String(p.text).trim())
                              .filter((s: string) => s.length > 0);
                            const content = textParts.join('\n\n');
                            if (!content) {
                              toast.error('Nothing to export from assistant message');
                              return;
                            }

                            const links: { text: string; url: string }[] = [];
                            const seen = new Set<string>();

                            const inlineLinkRegex = /\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g;
                            let m: RegExpExecArray | null;
                            while ((m = inlineLinkRegex.exec(content)) !== null) {
                              const text = m[1];
                              const url = m[2].replace(/[.,;:]+$/, '');
                              if (!seen.has(url)) {
                                seen.add(url);
                                links.push({ text, url });
                              }
                            }

                            const bareUrlRegex = /(?:^|\s)(https?:\/\/[^\s)]+)(?=$|\s)/g;
                            while ((m = bareUrlRegex.exec(content)) !== null) {
                              const url = m[1].replace(/[.,;:]+$/, '');
                              if (!seen.has(url)) {
                                seen.add(url);
                                links.push({ text: url, url });
                              }
                            }

                            const references =
                              links.length > 0
                                ? '\n\n## References\n\n' + links.map((l) => `- [${l.text}](${l.url})`).join('\n')
                                : '';

                            const finalMd = content + references;

                            const blob = new Blob([finalMd], { type: 'text/markdown;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `contract-lens-export-${message.id || Date.now()}.md`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                            toast.success('Markdown downloaded');
                          } catch (e) {
                            console.error('Export Markdown error:', e);
                            toast.error('Failed to export Markdown');
                          }
                        }}
                      >
                        <FileCode className="h-4 w-4" />
                        <span>Markdown</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Right side - Message metadata */}
              {meta && (
                <HoverCard openDelay={0} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation lg:pointer-events-auto"
                      onTouchStart={() => { }}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent
                    className="w-72 max-w-[calc(100vw-2rem)]"
                    side="top"
                    align="end"
                    sideOffset={8}
                    alignOffset={-8}
                    avoidCollisions={true}
                    collisionPadding={16}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        <h4 className="font-semibold text-sm">Response Info</h4>
                      </div>

                      {modelLabel && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Model</span>
                          <div className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-lg px-2 py-1">
                            <HugeiconsIcon icon={CpuIcon} size={12} />
                            {modelLabel}
                          </div>
                        </div>
                      )}

                      {typeof meta.completionTime === 'number' && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Generation Time</span>
                          <div className="flex items-center gap-1 text-xs">
                            <PhosphorClockIcon className="h-3 w-3" />
                            {meta.completionTime.toFixed(1)}s
                          </div>
                        </div>
                      )}

                      {(inputCount != null || outputCount != null) && (
                        <div className="space-y-2">
                          <span className="text-sm text-muted-foreground">Token Usage</span>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {inputCount != null && (
                              <div className="flex items-center justify-between bg-muted rounded-lg px-2 py-1">
                                <span className="flex items-center gap-1">
                                  <ArrowLeftIcon className="h-3 w-3" />
                                  Input
                                </span>
                                <span className="font-medium">{inputCount.toLocaleString()}</span>
                              </div>
                            )}
                            {outputCount != null && (
                              <div className="flex items-center justify-between bg-muted rounded-lg px-2 py-1">
                                <span className="flex items-center gap-1">
                                  <ArrowRightIcon className="h-3 w-3" />
                                  Output
                                </span>
                                <span className="font-medium">{outputCount.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                          {tokenTotal != null && (
                            <div className="flex items-center justify-between bg-accent rounded-lg px-2 py-1 text-xs">
                              <span className="flex items-center gap-1 font-medium">
                                <SigmaIcon className="h-3 w-3" />
                                Total
                              </span>
                              <span className="font-semibold">{tokenTotal.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              )}
            </div>
          )}
        </div>
      );
    }

    // Handle reasoning parts
    if (part.type === 'reasoning') {
      // If previous part is also reasoning, skip rendering to avoid duplicate sections
      const prevPart = parts[partIndex - 1];
      if (prevPart && prevPart.type === 'reasoning') {
        return null;
      }

      // Merge consecutive reasoning parts into a single block
      let nextIndex = partIndex;
      const mergedTexts: string[] = [];
      while (nextIndex < parts.length && parts[nextIndex]?.type === 'reasoning') {
        const r = parts[nextIndex] as unknown as ReasoningUIPart;
        if (typeof r.text === 'string' && r.text.length > 0) {
          mergedTexts.push(r.text);
        }
        nextIndex += 1;
      }

      const mergedPart: ReasoningUIPart = { ...(part as ReasoningUIPart), text: mergedTexts.join('\n\n') };

      const sectionKey = `${messageIndex}-${partIndex}`;
      const hasParallelToolInvocation = parts.some((p: ChatMessage['parts'][number]) => p.type.startsWith('tool-'));
      const isComplete = parts.some(
        (p: ChatMessage['parts'][number], i: number) =>
          i > partIndex && (p.type === 'text' || p.type.startsWith('tool-')),
      );
      const parallelTool = hasParallelToolInvocation
        ? (parts.find((p: ChatMessage['parts'][number]) => p.type.includes('tool-'))?.type.split('-')[1] ?? null)
        : null;

      const isExpanded = reasoningVisibilityMap[sectionKey] ?? !isComplete;
      const isFullscreen = reasoningFullscreenMap[sectionKey] ?? false;

      const setIsExpanded = (v: boolean) => setReasoningVisibilityMap((prev) => ({ ...prev, [sectionKey]: v }));
      const setIsFullscreen = (v: boolean) => setReasoningFullscreenMap((prev) => ({ ...prev, [sectionKey]: v }));

      return (
        <ReasoningPartView
          key={sectionKey}
          part={mergedPart}
          sectionKey={sectionKey}
          parallelTool={parallelTool}
          isExpanded={isExpanded}
          isFullscreen={isFullscreen}
          setIsExpanded={setIsExpanded}
          setIsFullscreen={setIsFullscreen}
        />
      );
    }

    // Handle step-start parts
    if (part.type === 'step-start') {
      const firstStepStartIndex = parts.findIndex((p) => p.type === 'step-start');
      if (partIndex === firstStepStartIndex) {
        return (
          <div key={`${messageIndex}-${partIndex}-step-start-logo`} className="p-0 py-1.5" />
        );
      }
      return <div key={`${messageIndex}-${partIndex}-step-start`}></div>;
    }

    // Handle tool parts with new granular states system
    if (isStaticToolUIPart(part)) {
      // Check if this part has the new state system
      if ('state' in part && part.state) {
        switch (part.type) {
          case 'tool-web_search':
            switch (part.state) {
              case 'input-streaming':
              case 'input-available':
              case 'output-available':
                return (
                  <MultiSearch
                    key={`${messageIndex}-${partIndex}-tool`}
                    result={part.output || null}
                    args={part.input ? part.input : {}}
                    annotations={annotations as DataQueryCompletionPart[]}
                  />
                );
            }
            break;

          case 'tool-datetime':
            switch (part.state) {
              case 'input-streaming':
                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="text-sm text-neutral-500">
                    Preparing time request...
                  </div>
                );
              case 'input-available':
                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="flex items-center gap-3 py-4 px-2">
                    <div className="h-5 w-5 relative">
                      <div className="absolute inset-0 rounded-full border-2 border-neutral-300 dark:border-neutral-700 border-t-blue-500 dark:border-t-blue-400 animate-spin" />
                    </div>
                    <span className="text-neutral-700 dark:text-neutral-300 text-sm font-medium">
                      Fetching current time...
                    </span>
                  </div>
                );
              case 'output-available':
                // Live Clock component that updates every second
                const LiveClock = memo(() => {
                  const [time, setTime] = useState(() => new Date());
                  const timerRef = useRef<NodeJS.Timeout | null>(null);

                  useEffect(() => {
                    // Sync with the nearest second
                    const now = new Date();
                    const delay = 1000 - now.getMilliseconds();

                    // Initial sync
                    const timeout = setTimeout(() => {
                      setTime(new Date());

                      // Then start the interval
                      timerRef.current = setInterval(() => {
                        setTime(new Date());
                      }, 1000);
                    }, delay);

                    return () => {
                      clearTimeout(timeout);
                      if (timerRef.current) {
                        clearInterval(timerRef.current);
                      }
                    };
                  }, []);

                  // Format the time according to the specified timezone
                  const timezone = part.output.timezone || new Intl.DateTimeFormat().resolvedOptions().timeZone;
                  const formatter = new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    hour12: true,
                    timeZone: timezone,
                  });

                  const formattedParts = formatter.formatToParts(time);
                  const timeParts = {
                    hour: formattedParts.find((part) => part.type === 'hour')?.value || '12',
                    minute: formattedParts.find((part) => part.type === 'minute')?.value || '00',
                    second: formattedParts.find((part) => part.type === 'second')?.value || '00',
                    dayPeriod: formattedParts.find((part) => part.type === 'dayPeriod')?.value || 'AM',
                  };

                  return (
                    <div className="mt-3">
                      <div className="flex items-baseline">
                        <div className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter tabular-nums text-neutral-900 dark:text-white">
                          {timeParts.hour.padStart(2, '0')}
                        </div>
                        <div className="mx-1 sm:mx-2 text-4xl sm:text-5xl md:text-6xl font-light text-neutral-400 dark:text-neutral-500">
                          :
                        </div>
                        <div className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter tabular-nums text-neutral-900 dark:text-white">
                          {timeParts.minute.padStart(2, '0')}
                        </div>
                        <div className="mx-1 sm:mx-2 text-4xl sm:text-5xl md:text-6xl font-light text-neutral-400 dark:text-neutral-500">
                          :
                        </div>
                        <div className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter tabular-nums text-neutral-900 dark:text-white">
                          {timeParts.second.padStart(2, '0')}
                        </div>
                        <div className="ml-2 sm:ml-4 text-xl sm:text-2xl font-light self-center text-neutral-400 dark:text-neutral-500">
                          {timeParts.dayPeriod}
                        </div>
                      </div>
                    </div>
                  );
                });

                LiveClock.displayName = 'LiveClock';

                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="w-full my-6">
                    <div className="bg-white dark:bg-neutral-950 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
                      <div className="p-4 sm:p-6">
                        <div className="flex flex-col gap-4 sm:gap-6">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 tracking-wider uppercase">
                                Current Time
                              </h3>
                              <div className="bg-neutral-100 dark:bg-neutral-800 rounded px-2 py-1 text-xs text-neutral-600 dark:text-neutral-300 font-medium flex items-center gap-1.5">
                                <PhosphorClockIcon className="h-3 w-3 text-blue-500" />
                                {part.output.timezone || new Intl.DateTimeFormat().resolvedOptions().timeZone}
                              </div>
                            </div>
                            <LiveClock />
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                              {part.output.formatted?.date}
                            </p>
                          </div>

                          {/* Compact Technical Details */}
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {part.output.formatted?.iso_local && (
                              <div className="bg-neutral-50 dark:bg-neutral-900 rounded p-3">
                                <div className="text-neutral-500 dark:text-neutral-400 mb-1">Local</div>
                                <div className="font-mono text-neutral-700 dark:text-neutral-300 text-[11px]">
                                  {part.output.formatted.iso_local}
                                </div>
                              </div>
                            )}

                            {part.output.timestamp && (
                              <div className="bg-neutral-50 dark:bg-neutral-900 rounded p-3">
                                <div className="text-neutral-500 dark:text-neutral-400 mb-1">Timestamp</div>
                                <div className="font-mono text-neutral-700 dark:text-neutral-300 text-[11px]">
                                  {part.output.timestamp}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
            }
            break;

          case 'tool-extreme_search':
            switch (part.state) {
              case 'input-streaming':
                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="text-sm text-neutral-500">
                    Preparing extreme search...
                  </div>
                );
              case 'input-available':
              case 'output-available':
                return (
                  <ExtremeSearch
                    key={`${messageIndex}-${partIndex}-tool`}
                    // @ts-ignore - Complex type intersection resolved to never
                    toolInvocation={{ toolName: 'extreme_search', input: part.input, result: part.output }}
                    annotations={
                      (annotations?.filter(
                        (annotation) => annotation.type === 'data-extreme_search',
                      ) as DataExtremeSearchPart[]) || []
                    }
                  />
                );
            }
            break;

          case 'tool-academic_search':
            switch (part.state) {
              case 'input-streaming':
              case 'input-available':
              case 'output-available':
                const academicSearchInput = (part as any).input;
                const academicSearchOutput = (part as any).output;
                return (
                  <AcademicPapersCard
                    key={`${messageIndex}-${partIndex}-tool`}
                    response={academicSearchOutput || null}
                    args={academicSearchInput ? academicSearchInput : {}}
                    annotations={annotations as DataQueryCompletionPart[]}
                  />
                );
            }
            break;

          case 'tool-retrieve':
            switch (part.state) {
              case 'input-streaming':
                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="text-sm text-neutral-500">
                    Preparing content retrieval...
                  </div>
                );
              case 'input-available':
                return (
                  <div
                    key={`${messageIndex}-${partIndex}-tool`}
                    className="border border-neutral-200 rounded-xl my-4 overflow-hidden dark:border-neutral-800 bg-white dark:bg-neutral-900"
                  >
                    <div className="h-36 bg-neutral-50 dark:bg-neutral-800/50 animate-pulse relative overflow-hidden">
                      <div className="absolute inset-0 bg-linear-to-b from-transparent to-white/10 dark:to-black/10" />
                    </div>
                    <div className="p-4">
                      <div className="flex gap-3">
                        <div className="relative w-12 h-12 shrink-0 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse">
                          <Globe className="h-5 w-5 text-neutral-300 dark:text-neutral-700 absolute inset-0 m-auto" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="space-y-2">
                            <div className="h-6 w-full bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-md" />
                            <div className="flex gap-2">
                              <div className="h-4 w-24 bg-violet-100 dark:bg-violet-900/30 animate-pulse rounded-md" />
                              <div className="h-4 w-32 bg-emerald-100 dark:bg-emerald-900/30 animate-pulse rounded-md" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="h-3 w-full bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-md" />
                            <div className="h-3 w-4/5 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-md" />
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <div className="h-4 w-24 bg-blue-100 dark:bg-blue-900/30 animate-pulse rounded-md" />
                            <div className="h-4 w-32 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-md" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-neutral-200 dark:border-neutral-800">
                      <div className="p-3 flex items-center gap-2">
                        <div className="h-4 w-4 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded" />
                        <div className="h-4 w-28 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-md" />
                      </div>
                    </div>
                  </div>
                );
              case 'output-available':
                // Handle error responses
                if (part.output && 'error' in part.output && part.output.error && !part.output.results?.length) {
                  return (
                    <div
                      key={`${messageIndex}-${partIndex}-tool`}
                      className="border border-red-200 dark:border-red-500 rounded-xl my-4 p-4 bg-red-50 dark:bg-red-950/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                          <Globe className="h-4 w-4 text-red-600 dark:text-red-300" />
                        </div>
                        <div>
                          <div className="text-red-700 dark:text-red-300 text-sm font-medium">
                            Error retrieving content
                          </div>
                          <div className="text-red-600/80 dark:text-red-400/80 text-xs mt-1">{String(part.output.error)}</div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Use the new RetrieveResults component for both single and multi-URL
                return <RetrieveResults key={`${messageIndex}-${partIndex}-tool`} result={part.output} />;
            }
            break;

          case 'tool-pdf_search':
            switch (part.state) {
              case 'input-streaming':
                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="text-sm text-neutral-500">
                    Preparing PDF search...
                  </div>
                );
              case 'input-available':
                return (
                  <SearchLoadingState
                    key={`${messageIndex}-${partIndex}-tool`}
                    icon={FileText}
                    text={`Searching PDFs for "${(part.input as any)?.query ?? '...'}"...`}
                    color="red"
                  />
                );
              case 'output-available': {
                const pdfOutput = part.output as {
                  results: { fileName: string; fileUrl?: string; context: string }[];
                  totalDocuments: number;
                  message: string;
                } | null;

                if (!pdfOutput || pdfOutput.results.length === 0) {
                  return (
                    <div
                      key={`${messageIndex}-${partIndex}-tool`}
                      className="w-full my-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950"
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100">
                              No results found
                            </h3>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                              {pdfOutput?.message ?? 'No indexed PDF documents found in this chat.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Try to match fileUrls from message attachments if not in tool output
                const pdfAttachments = messages.flatMap((m) =>
                  (m.parts ?? [])
                    .filter((p): p is { type: 'file'; url: string; name: string; mediaType: string } =>
                      typeof p === 'object' &&
                      p !== null &&
                      'type' in p &&
                      (p as any).type === 'file' &&
                      (p as any).mediaType === 'application/pdf'
                    )
                );

                const getFileUrl = (result: { fileName: string; fileUrl?: string }) => {
                  if (result.fileUrl) return result.fileUrl;
                  const match = pdfAttachments.find((a) => a.name === result.fileName);
                  return match?.url ?? null;
                };

                return (
                  <PdfSearchResults
                    key={`${messageIndex}-${partIndex}-tool`}
                    results={pdfOutput.results}
                    totalDocuments={pdfOutput.totalDocuments}
                    message={pdfOutput.message}
                    getFileUrl={getFileUrl}
                  />
                );
              }
              case 'output-error':
                return (
                  <ToolErrorDisplay
                    key={`${messageIndex}-${partIndex}-tool`}
                    errorText={(part as any).errorText}
                    toolName="PDF Search"
                  />
                );
            }
            break;

        }
      } else {
        // Legacy tool invocation without state - show as loading or fallback
        console.warn('Legacy tool part without state:', part);
        return (
          <div
            key={`${messageIndex}-${partIndex}-tool-legacy`}
            className="my-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg"
          >
            <h3 className="font-medium mb-2">Tool: Unknown</h3>
            <pre className="text-xs overflow-auto">{JSON.stringify(part, null, 2)}</pre>
          </div>
        );
      }
    }

    // Log unhandled part types for debugging
    console.log(
      'Unhandled part type:',
      typeof part === 'object' && part !== null && 'type' in part ? part.type : 'unknown',
      part,
    );

    return null;
  },
  (prevProps: MessagePartRendererProps, nextProps: MessagePartRendererProps) => {
    const areEqual =
      isEqual(prevProps.part, nextProps.part) &&
      prevProps.messageIndex === nextProps.messageIndex &&
      prevProps.partIndex === nextProps.partIndex &&
      isEqual(prevProps.parts, nextProps.parts) &&
      isEqual(prevProps.message, nextProps.message) &&
      prevProps.status === nextProps.status &&
      prevProps.hasActiveToolInvocations === nextProps.hasActiveToolInvocations &&
      isEqual(prevProps.reasoningVisibilityMap, nextProps.reasoningVisibilityMap) &&
      isEqual(prevProps.reasoningFullscreenMap, nextProps.reasoningFullscreenMap) &&
      prevProps.user?.id === nextProps.user?.id &&
      prevProps.isOwner === nextProps.isOwner &&
      prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
      prevProps.chatId === nextProps.chatId &&
      isEqual(prevProps.annotations, nextProps.annotations);

    return areEqual;
  },
);

// Code Context tool component
const CodeContextTool: React.FC<{ args: any; result: any }> = ({ args, result }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!result) {
    return (
      <div className="group my-2 p-3 rounded-md border border-neutral-200/60 dark:border-neutral-700/60 bg-neutral-50/30 dark:bg-neutral-900/30">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-md bg-neutral-600 flex items-center justify-center opacity-80">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="h-2.5 w-20 bg-neutral-300 dark:bg-neutral-600 rounded-sm animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const responseText = result?.response || result;
  const shouldShowAccordion = responseText && responseText.length > 500;
  const previewText = shouldShowAccordion ? responseText.slice(0, 400) + '...' : responseText;

  return (
    <div className="group my-2 rounded-md border border-neutral-200/60 dark:border-neutral-700/60 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm hover:border-neutral-300 dark:hover:border-neutral-600 transition-all duration-200">
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center">
            <Code className="w-2.5 h-2.5 text-white" />
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">Code Context</span>
                <span className="text-neutral-400">•</span>
                <span className="text-neutral-500 dark:text-neutral-400 truncate max-w-50">
                  {args ? args.query : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Copy button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(responseText);
                    toast.success('Code context copied to clipboard');
                  }}
                  className="h-6 w-6 p-0 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <HugeiconsIcon
                    icon={Copy01Icon}
                    size={12}
                    color="currentColor"
                    strokeWidth={2}
                    className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  />
                </Button>

                {/* Metadata badges */}
                {result?.resultsCount !== undefined && (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-0 text-xs px-2 py-0.5"
                    >
                      {result.resultsCount} results
                    </Badge>
                    {result.outputTokens && (
                      <Badge
                        variant="secondary"
                        className="rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-0 text-xs px-2 py-0.5"
                      >
                        {result.outputTokens} tokens
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
              {shouldShowAccordion ? (
                <Accordion
                  type="single"
                  collapsible
                  value={isExpanded ? 'context' : ''}
                  onValueChange={(value) => setIsExpanded(!!value)}
                >
                  <AccordionItem value="context" className="border-0">
                    <div className="space-y-2">
                      <div className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed wrap-break-word">
                        {!isExpanded && previewText}
                      </div>
                      <AccordionTrigger className="py-2 hover:no-underline text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                        {isExpanded ? 'Show less' : 'Show full context'}
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
                        <div className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed wrap-break-word whitespace-pre-wrap pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60">
                          {responseText}
                        </div>
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                </Accordion>
              ) : (
                <div className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed wrap-break-word whitespace-pre-wrap">
                  {responseText}
                </div>
              )}

              {/* Footer metadata */}
              {result?.searchTime && (
                <div className="flex items-center gap-2 pt-2 border-t border-neutral-200/30 dark:border-neutral-700/30">
                  <Clock className="w-3 h-3 text-neutral-400" />
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Search completed in {(result.searchTime / 1000).toFixed(2)}s
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Translation tool component with audio features
const TranslationTool: React.FC<{ args: any; result: any }> = ({ args, result }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveRef = useRef<Wave | null>(null);

  useEffect(() => {
    const _audioRef = audioRef.current;
    return () => {
      if (_audioRef) {
        _audioRef.pause();
        _audioRef.src = '';
      }
    };
  }, []);

  useEffect(() => {
    if (audioUrl && audioRef.current && canvasRef.current) {
      waveRef.current = new Wave(audioRef.current, canvasRef.current);
      waveRef.current.addAnimation(
        new waveRef.current.animations.Lines({
          lineWidth: 3,
          lineColor: 'rgb(82, 82, 91)',
          count: 80,
          mirroredY: true,
        }),
      );
    }
  }, [audioUrl]);

  const handlePlayPause = async () => {
    if (!audioUrl && !isGeneratingAudio) {
      setIsGeneratingAudio(true);
      try {
        const { audio } = await generateSpeech(result.translatedText);
        setAudioUrl(audio);
        setIsGeneratingAudio(false);
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
          }
        }, 100);
      } catch (error) {
        console.error('Error generating speech:', error);
        setIsGeneratingAudio(false);
      }
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (!result) {
    return (
      <div className="group my-2 p-3 rounded-md border border-neutral-200/60 dark:border-neutral-700/60 bg-neutral-50/30 dark:bg-neutral-900/30">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-md bg-neutral-600 flex items-center justify-center opacity-80">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="h-2.5 w-20 bg-neutral-300 dark:bg-neutral-600 rounded-sm animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group my-2 rounded-md border border-neutral-200/60 dark:border-neutral-700/60 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm hover:border-neutral-300 dark:hover:border-neutral-600 transition-all duration-200">
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-5 h-5 rounded-md bg-neutral-600 flex items-center justify-center">
            <TextIcon className="w-2.5 h-2.5 text-white" />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-neutral-900 dark:text-neutral-100">Translation</span>
              <span className="text-neutral-400">•</span>
              <span className="text-neutral-500 dark:text-neutral-400">
                {result.detectedLanguage} → {args ? args.to : ''}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="group/text">
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 opacity-70">
                  {result.detectedLanguage}
                </div>
                <div className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed wrap-break-word">
                  {args ? args.text : ''}
                </div>
              </div>

              <div className="group/text">
                <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1 opacity-70">
                  {args ? args.to : ''}
                </div>
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-relaxed wrap-break-word">
                  {result.translatedText}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handlePlayPause}
                disabled={isGeneratingAudio}
                className={cn(
                  'w-5 h-5 rounded-sm flex items-center justify-center transition-all duration-150',
                  isPlaying
                    ? 'bg-neutral-700 text-white shadow-sm'
                    : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
                )}
              >
                {isGeneratingAudio ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-2.5 h-2.5" />
                ) : (
                  <PlayIcon className="w-2.5 h-2.5" />
                )}
              </button>

              <div className="flex-1 h-5 bg-neutral-100/80 dark:bg-neutral-800/80 rounded-sm overflow-hidden">
                {!audioUrl && !isGeneratingAudio && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-full h-0.5 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  width="800"
                  height="40"
                  className="w-full h-full"
                  style={{ imageRendering: 'crisp-edges' }}
                />
              </div>

              <span className="text-xs text-neutral-400 dark:text-neutral-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                {isGeneratingAudio ? '...' : audioUrl ? '●' : '○'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
};

const PdfSearchResults = memo(function PdfSearchResults({
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


MessagePartRenderer.displayName = 'MessagePartRenderer';
