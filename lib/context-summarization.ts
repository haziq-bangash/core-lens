/**
 * Context Summarization
 *
 * Summarizes older conversation history into a compact context block
 * to stay within model token windows during long conversations.
 *
 * Strategy:
 * 1. Keep the most recent N messages intact (for immediate context)
 * 2. Summarize all earlier messages into a single "conversation summary" block
 * 3. Prepend the summary as a system-level context message
 * 4. Still apply pruneMessages for tool call cleanup on the kept messages
 */

import {
  generateText,
  Output,
  type ModelMessage,
  convertToModelMessages,
  pruneMessages,
} from 'ai';
import { coreLens } from '@/ai/providers';
import { z } from 'zod';

/**
 * Estimate rough token count from messages.
 * Uses a simple heuristic: ~4 chars per token for English text.
 */
function estimateTokenCount(messages: ModelMessage[]): number {
  let charCount = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      charCount += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ('text' in part && typeof part.text === 'string') {
          charCount += part.text.length;
        } else if ('result' in part) {
          charCount += JSON.stringify(part.result).length;
        }
      }
    }
  }
  return Math.ceil(charCount / 4);
}

/**
 * Extract text content from model messages for summarization.
 * Strips tool results and images, keeping only text content.
 */
function extractTextForSummary(messages: ModelMessage[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : msg.role;

    if (typeof msg.content === 'string') {
      parts.push(`${role}: ${msg.content}`);
    } else if (Array.isArray(msg.content)) {
      const textParts: string[] = [];
      for (const part of msg.content) {
        if ('text' in part && typeof part.text === 'string') {
          textParts.push(part.text);
        } else if ('toolName' in part) {
          // Include tool call name but not full args/results to keep summary concise
          textParts.push(`[Used tool: ${part.toolName}]`);
        }
      }
      if (textParts.length > 0) {
        parts.push(`${role}: ${textParts.join(' ')}`);
      }
    }
  }

  return parts.join('\n');
}

const summarySchema = z.object({
  summary: z
    .string()
    .describe(
      'A concise summary of the conversation so far. Include key topics discussed, important facts/findings mentioned, user preferences expressed, and any conclusions reached. Max 300 words.'
    ),
  keyEntities: z
    .array(z.string())
    .max(10)
    .describe(
      'Key entities mentioned: paper titles, author names, specific topics, URLs, or technical terms that may be referenced later.'
    ),
});

/**
 * Generate a summary of older conversation messages.
 */
async function generateConversationSummary(
  messages: ModelMessage[]
): Promise<{ summary: string; keyEntities: string[] }> {
  const conversationText = extractTextForSummary(messages);

  // Truncate if the conversation text itself is very long (> ~12k tokens worth)
  const maxChars = 48_000;
  const truncatedText =
    conversationText.length > maxChars
      ? conversationText.slice(0, maxChars) + '\n\n[...earlier messages truncated...]'
      : conversationText;

  const { output } = await generateText({
    model: coreLens.languageModel('core-lens-follow-up'),
    system: `You are a conversation summarizer for Core Lens, an AI research platform. Your job is to create a concise but comprehensive summary of a conversation that will be used as context for continuing the conversation.

Rules:
- Capture the main topics, questions asked, and answers provided
- Note any specific papers, authors, or research topics discussed
- Note any user preferences or requirements expressed
- Include key facts, findings, or conclusions reached
- Keep the summary concise (max 300 words) but preserve critical context
- Use neutral, factual language
- Do NOT include greetings or pleasantries in the summary`,
    prompt: `Summarize this conversation:\n\n${truncatedText}`,
    output: Output.object({
      schema: summarySchema,
    }),
  });

  return {
    summary: output.summary,
    keyEntities: output.keyEntities,
  };
}

// Configuration
const RECENT_MESSAGES_TO_KEEP = 6; // Keep last 6 messages intact (3 exchanges)
const SUMMARIZATION_THRESHOLD = 14; // Start summarizing after 14 messages
const TOKEN_ESTIMATE_THRESHOLD = 20_000; // Also trigger if estimated tokens > 20k

export interface SummarizedContext {
  messages: ModelMessage[];
  wasSummarized: boolean;
  summaryText?: string;
}

/**
 * Process conversation messages with context summarization.
 *
 * For short conversations: just converts and prunes normally.
 * For long conversations: summarizes older messages and prepends
 * a summary block, keeping only recent messages intact.
 */
export async function summarizeContext(
  uiMessages: any[]
): Promise<SummarizedContext> {
  const messageCount = uiMessages.length;

  // Convert all messages to model format
  const allModelMessages = await convertToModelMessages(uiMessages);

  // Estimate token usage
  const estimatedTokens = estimateTokenCount(allModelMessages);

  const shouldSummarize =
    messageCount > SUMMARIZATION_THRESHOLD ||
    estimatedTokens > TOKEN_ESTIMATE_THRESHOLD;

  // Short conversation: just prune tool calls and return
  if (!shouldSummarize) {
    if (messageCount > 10) {
      const pruned = pruneMessages({
        reasoning: 'none',
        messages: allModelMessages,
        toolCalls: 'before-last-3-messages',
        emptyMessages: 'remove',
      });
      return { messages: pruned, wasSummarized: false };
    }
    return { messages: allModelMessages, wasSummarized: false };
  }

  console.log(
    `📝 Context summarization triggered: ${messageCount} messages, ~${estimatedTokens} estimated tokens`
  );

  // Split: older messages to summarize, recent messages to keep
  const splitIndex = allModelMessages.length - RECENT_MESSAGES_TO_KEEP;
  const olderMessages = allModelMessages.slice(0, splitIndex);
  const recentMessages = allModelMessages.slice(splitIndex);

  try {
    // Generate summary of older messages
    const { summary, keyEntities } = await generateConversationSummary(olderMessages);

    const summaryText = [
      '## Previous Conversation Summary',
      '',
      summary,
      '',
      keyEntities.length > 0
        ? `**Key entities mentioned:** ${keyEntities.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Construct the summarized message list:
    // 1. A system-style user message with the summary
    // 2. Recent messages (pruned of old tool calls)
    const summaryMessage: ModelMessage = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `[CONTEXT FROM EARLIER IN THIS CONVERSATION]\n\n${summaryText}\n\n[END OF CONTEXT SUMMARY - The conversation continues below with the most recent messages.]`,
        },
      ],
    };

    // Acknowledge the summary so the model doesn't try to respond to it
    const summaryAck: ModelMessage = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Understood, I have the context from our earlier conversation. Let me continue from where we left off.',
        },
      ],
    };

    // Prune tool calls from recent messages
    const prunedRecent = pruneMessages({
      reasoning: 'none',
      messages: recentMessages,
      toolCalls: 'before-last-3-messages',
      emptyMessages: 'remove',
    });

    const finalMessages = [summaryMessage, summaryAck, ...prunedRecent];

    console.log(
      `✅ Summarized ${olderMessages.length} older messages into ~${summary.length} chars, keeping ${prunedRecent.length} recent messages. Total: ${finalMessages.length} messages`
    );

    return {
      messages: finalMessages,
      wasSummarized: true,
      summaryText: summary,
    };
  } catch (error) {
    console.error('⚠️ Context summarization failed, falling back to pruning:', error);

    // Fallback: just prune like before
    const pruned = pruneMessages({
      reasoning: 'none',
      messages: allModelMessages,
      toolCalls: 'before-last-3-messages',
      emptyMessages: 'remove',
    });

    return { messages: pruned, wasSummarized: false };
  }
}
