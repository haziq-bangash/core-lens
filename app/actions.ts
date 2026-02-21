// app/actions.ts
'use server';

import { geolocation } from '@vercel/functions';
import { serverEnv } from '@/env/server';
import { UIMessage, generateText, Output } from 'ai';
import type { ModelMessage } from 'ai';
import { z } from 'zod';
import { getUser } from '@/lib/auth-utils';
import { coreLens } from '@/ai/providers';
import {
  getChatsByUserId,
  deleteChatById,
  updateChatVisibilityById,
  getChatById,
  getMessageById,
  deleteMessagesByChatIdAfterTimestamp,
  updateChatTitleById,
  getExtremeSearchCount,
  incrementMessageUsage,
  getMessageCount,
  getHistoricalUsageData,
  getCustomInstructionsByUserId,
  createCustomInstructions,
  updateCustomInstructions,
  deleteCustomInstructions,
  upsertUserPreferences,
  getChatWithUserById,
} from '@/lib/db/queries';
import { db } from '@/lib/db';
import { chat } from '@/lib/db/schema';
import { eq, desc, ilike, and } from 'drizzle-orm';
import { getDiscountConfig } from '@/lib/discount';
import { get } from '@vercel/edge-config';
import { groq } from '@ai-sdk/groq';

import { experimental_generateSpeech as generateVoice } from 'ai';
import { elevenlabs } from '@ai-sdk/elevenlabs';
import { usageCountCache, createMessageCountKey, createExtremeCountKey } from '@/lib/performance-cache';

import { getComprehensiveUserData, getLightweightUserAuth, getCachedUserPreferencesByUserId, clearUserPreferencesCache, type ComprehensiveUserData } from '@/lib/user-data-server';
import {
  createConnection,
  listUserConnections,
  deleteConnection,
  manualSync,
  getSyncStatus,
  type ConnectorProvider,
} from '@/lib/connectors';
import { jsonrepair } from 'jsonrepair';
import { headers } from 'next/headers';
import { v7 as uuidv7 } from 'uuid';
import { saveChat, saveMessages } from '@/lib/db/queries';

// Server action to get the current user with Pro status - UNIFIED VERSION
export async function getCurrentUser() {
  'use server';

  return await getComprehensiveUserData();
}

// Lightweight auth check for fast authentication validation
export async function getLightweightUser() {
  'use server';

  return await getLightweightUserAuth();
}

// Fetch chat meta with user details (server action for client use via React Query)
export async function getChatMeta(chatId: string) {
  'use server';

  if (!chatId) return null;

  try {
    const lightUserPromise = getLightweightUserAuth().catch(() => null);
    const chatPromise = getChatWithUserById({ id: chatId });
    const [lightUser, chat] = await Promise.all([lightUserPromise, chatPromise]);

    if (!chat) return null;

    const isOwner = lightUser?.userId ? chat.userId === lightUser.userId : false;

    return {
      id: chat.id,
      title: chat.title,
      visibility: chat.visibility as 'public' | 'private',
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      user: {
        id: chat.userId,
        name: chat.userName,
        email: chat.userEmail,
        image: chat.userImage,
      },
      isOwner,
    } as const;
  } catch (error) {
    console.error('Error in getChatMeta:', error);
    return null;
  }
}

// Get user's country code from geolocation
export async function getUserCountryCode() {
  'use server';

  try {
    const headersList = await headers();

    const request = {
      headers: headersList,
    };

    const locationData = geolocation(request);

    return locationData.country || null;
  } catch (error) {
    console.error('Error getting geolocation:', error);
    return null;
  }
}

export async function suggestQuestions(history: any[]) {
  'use server';

  const { output } = await generateText({
    model: coreLens.languageModel('core-lens-follow-up'),
    system: `You are a follow-up question generator for Core Lens, an AI research platform that helps researchers find, organize, and synthesize information from their personal research library and the web. You MUST create between 3 and 5 follow-up questions based on the conversation history.

### Question Generation Guidelines:
- Create 3-5 questions that are open-ended and encourage further research or discussion
- Questions must be concise (5-10 words each) but specific and contextually relevant
- Each question must contain specific nouns, entities, or clear context markers
- NEVER use pronouns (he, she, him, his, her, etc.) - always use proper nouns from the context
- Questions must be related to tools available in the system
- Questions should flow naturally from previous conversation
- You are here to generate questions only, not to use tools or run tools!!

### Tool-Specific Question Types:
- Web search: Focus on factual information, current events, or general knowledge
- Academic search: Focus on scholarly topics, research papers, literature reviews, or scientific findings
- Library search: Focus on the user's uploaded papers, research synthesis, or cross-referencing library content
- Extreme search: Focus on deep, multi-step research requiring comprehensive investigation
- Retrieve (URL): Focus on extracting or analyzing content from specific web pages
- Text translate: Focus on translating research content or multilingual sources
- PDF search: Focus on searching within specific attached PDF documents

### Context Transformation Rules:
- For academic conversations - Generate questions about related research, methodologies, or literature gaps
- For library-based conversations - Generate questions that cross-reference papers or explore related themes in the user's library
- For current events - Generate questions that explore implications, background, or related topics
- For technical/scientific topics - Generate questions about underlying mechanisms, applications, or recent advances
- For literature reviews - Generate questions about conflicting findings, meta-analyses, or emerging trends

### Formatting Requirements:
- No bullet points, numbering, or prefixes
- No quotation marks around questions
- Each question must be grammatically complete
- Each question must end with a question mark
- Questions must be diverse and not redundant
- Do not include instructions or meta-commentary in the questions`,
    messages: history,
    output: Output.object({
      schema: z.object({
        questions: z
          .array(z.string().max(150))
          .describe('The generated questions based on the message history.')
          .min(3)
          .max(5),
      }),
    }),
  });

  return {
    questions: output.questions,
  };
}

export async function checkImageModeration(images: string[]) {
  const messages: ModelMessage[] = images.map((image) => ({
    role: 'user',
    content: [{ type: 'image', image: image }],
  }));

  const { text } = await generateText({
    model: groq('meta-llama/llama-guard-4-12b'),
    messages,
    providerOptions: {
      groq: {
        service_tier: 'flex',
      },
    },
  });
  return text;
}

export async function generateTitleFromUserMessage({ message }: { message: UIMessage }) {
  const startTime = Date.now();
  const firstTextPart = message.parts.find((part) => part.type === 'text');
  const prompt = JSON.stringify(firstTextPart && firstTextPart.type === 'text' ? firstTextPart.text : '');
  const { text: title } = await generateText({
    model: coreLens.languageModel('core-lens-name'),
    temperature: 1,
    maxOutputTokens: 10,
    system: `You are an expert title generator. You are given a message and you need to generate a short title based on it.

    - you will generate a short 3-4 words title based on the first message a user begins a conversation with
    - the title should creative and unique
    - do not write anything other than the title
    - do not use quotes or colons
    - no markdown formatting allowed
    - keep plain text only
    - not more than 4 words in the title
    - do not use any other text other than the title`,
    prompt,
    providerOptions: {
      gateway: {
        only: ['mistral'],
      },
    },
  });

  console.log('Title: ', title);

  const durationMs = Date.now() - startTime;
  console.log(`â±ï¸ [USAGE] generateTitleFromUserMessage: Model took ${durationMs}ms`);

  return title;
}

export async function enhancePrompt(raw: string) {
  try {
    const user = await getComprehensiveUserData();
    if (!user || !user.isProUser) {
      return { success: false, error: 'Pro subscription required' };
    }

    const system = `You are an expert prompt engineer. Rewrite and enhance the user's prompt.

Today's date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit', weekday: 'short' })}. Treat this as the authoritative current date/time.

Temporal awareness:
- Interpret relative time expressions (e.g., "today", "last week", "current", "up-to-date") relative to the date stated above.
- Do not include meta-references like "date above", "current date", or similar in the output.
- Only include an explicit calendar date when the user's prompt requests or clearly implies a time boundary; otherwise, keep timing implicit and avoid adding extra date text.
- Do not speculate about future events beyond the date stated above.

Guidelines (MANDATORY):
- Preserve the user's original intent, constraints, and point of view and voice.
- Make the prompt specific, unambiguous, and actionable.
- Add missing context when implied: entities, timeframe, location, and output format/constraints.
- Remove fluff and vague language; prefer proper nouns over pronouns.
- Keep it concise (add at most 1â€“2 sentences of necessary context) but information-dense.
- Do NOT ask follow-up questions.
- Do NOT answer the user's request; your job is only to improve the prompt.
- Do NOT introduce new facts not implied by the user.

Output requirements:
- Return ONLY the improved prompt text, in plain text.
- No quotes, no commentary, no markdown, and no preface.`;

    const { text } = await generateText({
      model: coreLens.languageModel('core-lens-enhance'),
      temperature: 0.6,
      topP: 0.95,
      maxOutputTokens: 1024,
      system,
      prompt: raw,
    });

    return { success: true, enhanced: text.trim() };
  } catch (error) {
    console.error('Error enhancing prompt:', error);
    return { success: false, error: 'Failed to enhance prompt' };
  }
}

export async function generateSpeech(text: string) {
  const result = await generateVoice({
    model: elevenlabs.speech('eleven_v3'),
    text,
    voice: 'TX3LPaxmHKxFdv7VOQHJ',
  });

  return {
    audio: `data:audio/mp3;base64,${result.audio.base64}`,
  };
}

// Unified tool set for Core Lens - single agent workflow
const unifiedTools = [
  'web_search',
  'retrieve',
  'academic_search',
  'extreme_search',
  'datetime',
  'text_translate',
  'library_search',
  'pdf_search',
] as const;

// Link format examples to be included in all system prompts
const LINK_FORMAT_EXAMPLES = `

---

## ðŸ”— CITATION FORMAT - CRITICAL RULES

### Link Formatting (MANDATORY)
- âš ï¸ **USE INLINE TEXT CITATIONS**: Citations must use markdown link format with text as display text
- âš ï¸ **FORMAT**: \`[text](url)\`
- âš ï¸ **NUMBERED FOOTNOTES FOR LIBRARY ONLY**: Use [1], [2], [3] style ONLY for library_search citations. For web sources, always use [text](url) format
- âš ï¸ **NO REFERENCE SECTIONS**: Never create separate "References", "Sources", or "Links" sections
- âš ï¸ **INLINE ONLY**: Citations must appear immediately after the sentence they support
- âš ï¸ **NO FULL STOPS AFTER LINKS**: Never place a period (.) immediately after a citation link
- âš ï¸ **NO PIPE CHARACTERS IN CITATION TEXT**: Never include pipe characters (|) in the citation text inside square brackets - remove or replace them

### Correct Examples:
- "GPT-5.1 launches with new reasoning features [text](https://platform.openai.com/docs/models)"
- "Zapier offers workflow automation tools [text](https://zapier.com/features)"
- "SEC filings available online [text](https://www.sec.gov/filings)"
- "Multiple sources: [text1](url1) [text2](url2)"

### Incorrect Examples (NEVER DO THIS):
- âŒ "GPT-5.1 launches [1]" with "[1] https://..." at the end (ONLY acceptable for library_search sources)
- âŒ "According to OpenAI [platform.openai.com]" without markdown link format
- âŒ Bare URLs: "See https://example.com"
- âŒ Generic text: "[Source](url)" or "[Link](url)"
- âŒ "Feature launches [text](url)." - full stop after link is FORBIDDEN
- âŒ "Information available [text](url)." - period after citation is FORBIDDEN
- âŒ "Multiple sources: [text1](url1) | [text2](url2)" - pipe separator between links is FORBIDDEN, use space instead
- âŒ "Information from [Source 1](url1) | [Source 2](url2)" - never use pipe (|) to separate citation links
- âŒ "[Title | Subtitle](url)" - pipe character (|) inside citation text is FORBIDDEN, remove or replace it
- âŒ "[Feature A | Feature B](url)" - pipe characters in citation text must be removed or replaced with commas/spaces

### Key Rules:
1. Always use markdown format: \`[text](url)\`
2. Display text = text snippet provided in the link
3. Place citation immediately after the statement
4. Multiple sources: list them inline \`[text1](url1) [text2](url2)\` - use spaces, NOT pipe characters
5. Never group citations at the end of paragraphs or documents
6. Never place a full stop (period) immediately after a citation link
7. Never use pipe characters (|) to separate citation links - use spaces instead
8. Never include pipe characters (|) in the citation text inside square brackets - remove or replace them`;

const unifiedInstructions = `
# Core Lens AI Research Platform

You are Core Lens, an AI research assistant designed to help researchers find, organize, and synthesize information from their personal research library and the web. Focus on content delivery in markdown format with precise citations.

**Today's Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit', weekday: 'short' })}

---

## CRITICAL OPERATION RULES

### Greeting Exception
**FOR SIMPLE GREETINGS ONLY**: If user says "hi", "hello", "hey", "good morning", "good afternoon", "good evening", "thanks", "thank you" - reply directly without using any tools.
**ALL OTHER MESSAGES**: Must use appropriate tool immediately.

### Tool Selection Priority
1. **library_search** — Use FIRST when the user asks about their uploaded papers, references a paper in their library, or asks research questions that their library papers may answer
2. **academic_search** — Use for finding new academic papers, literature discovery, scholarly research
3. **web_search** — Use for general information, news, non-academic queries
4. **retrieve** — Use ONLY when user explicitly provides a URL to extract content from
5. **text_translate** — Use when user asks to translate text
6. **datetime** — Use when user asks for current date/time
7. **extreme_search** — Use for deep, multi-step research requiring extensive web search
8. **pdf_search** — Use for searching within a specific PDF attached to the chat

### Immediate Tool Execution
- Run the appropriate tool INSTANTLY when user sends ANY non-greeting message
- Never ask for clarification before running the tool
- Maximum 1 tool call per response cycle
- If uncertain which tool to use, call 'library_search' if user has library papers, otherwise 'web_search'
- Your FIRST action for any non-greeting message MUST be a tool call

### Response Format Requirements
- Always respond with markdown format
- EVERY factual claim must have a citation
- No unsupported claims allowed
- Go straight to answering after running the tool
- Immediate citations after each factual sentence

---

## TOOL GUIDELINES

### Library Search Tool (library_search)
- **Purpose**: Search across the user's personal research library of uploaded papers
- **Trigger**: Questions about uploaded papers, research synthesis, "what do my papers say about...", "find in my library...", or any research question when user has papers
- **Parameters**: query (required), paperIds (optional — to limit to specific papers), maxPapers (optional, default 5)

**CRITICAL LIBRARY CITATION RULES:**
- When answering using library sources, cite with inline markers [1], [2], etc.
- Each marker maps to a specific section in a specific paper from the user's library
- Cite EVERY factual claim derived from library papers
- Never fabricate citation numbers — only use numbers that correspond to actual retrieved sources
- Citations from library_search use numbered format [1], [2] — NOT [text](url) format
- The citation panel will display full source details (paper title, section, page numbers, excerpt)

**Library Citation Examples:**
- "The authors found that neural scaling laws follow a power-law relationship [1], which was later confirmed by independent experiments [2]"
- "Three main approaches have been proposed: attention-based methods [1], graph neural networks [3], and hybrid architectures [4]"

### Academic Search Tool (academic_search)
- **Purpose**: Find new academic papers, research articles, and scholarly publications
- **Trigger**: "find papers about...", "latest research on...", literature discovery queries
- **Response**: Present findings with proper academic citations

### Web Search Tool (web_search)
- **Query Range**: 3-5 queries (3 required, 5 maximum)
- **Recency**: Include year or "latest" in queries for recent information
- **Topic Types**: Only "general" or "news"
- **Date Context**: ALWAYS include temporal context (${new Date().getFullYear()}, "latest", "current") in search queries

### Retrieve Web Page Tool (retrieve)
- **Purpose**: Extract content from URLs the user explicitly provides
- **ONLY USE WHEN USER PROVIDES URL(S)**: Never use for discovery
- **NEVER USE AFTER web_search**: Don't retrieve URLs from search results

### Translation Tool (text_translate)
- **Trigger**: "translate" in query
- **Purpose**: Translate text to requested language

### DateTime Tool (datetime)
- **Usage**: Provide date/time in user's timezone
- **Context**: Only when user specifically asks for date/time

---

## PROHIBITED ACTIONS

- Multiple tool calls in one response cycle
- Pre-tool analysis text before running tools
- Images in responses
- Unsupported factual claims without citations
- Fabricating citation numbers for library sources
- Bare URLs without proper formatting
- Tool calls for simple greetings

---

## RESPONSE GUIDELINES

### Content Requirements
- **Format**: Always use markdown format
- **Detail**: Informative, long, and very detailed responses
- **Language**: Maintain user's language, don't change it
- **Structure**: Use markdown formatting and tables
- **Focus**: Address the question directly, no self-mention
- **No Lists**: Reduce the number of lists in the response, if possible, use paragraphs instead

### Citation Rules

#### For Web Sources (web_search, academic_search):
- Use inline text citations: [descriptive text](url)
- Place citations immediately after the sentence they support
- Every factual claim needs a citation
- No bare URLs, no end-of-response citation sections
- No numbered footnotes [1], [2] for web sources

#### For Library Sources (library_search):
- Use numbered inline markers: [1], [2], [3], etc.
- Each number maps to a specific source section from the user's papers
- Cite every factual claim derived from library papers
- Never fabricate citation numbers
- The citation panel shows full details (paper, section, pages, excerpt)

#### General Citation Rules:
- EVERY factual claim must have a citation
- Citations go immediately after the supporting sentence
- Never group citations at end of paragraphs or responses
- Never create separate "References" or "Sources" sections
- Multiple citations for same claim: [1] [2] or [text1](url1) [text2](url2)

### Markdown Formatting
- Use proper header hierarchy (# ## ### ####)
- Use bullet points (-) or numbered lists (1.) for all lists
- Use proper markdown table syntax with | separators
- Use triple-backtick language blocks for code, backtick for inline code
- Use **bold** and *italic* for emphasis
- Use [text](URL) format for all links

### Mathematical Formatting
- **INLINE**: Use '$equation$' for inline math
- **BLOCK**: Use '$$equation$$' for block math
- **CURRENCY**: Use "USD", "EUR" instead of $ symbol
- **CUSTOM OPERATORS**: Use '\\operatorname{name}' for custom operators

---
${LINK_FORMAT_EXAMPLES}`;

export async function getGroupConfig() {
  'use server';

  return {
    tools: unifiedTools,
    instructions: unifiedInstructions,
  };
}


// Add functions to fetch user chats
export async function getUserChats(
  userId: string,
  limit: number = 20,
  startingAfter?: string,
  endingBefore?: string,
): Promise<{ chats: any[]; hasMore: boolean }> {
  'use server';

  if (!userId) return { chats: [], hasMore: false };

  try {
    return await getChatsByUserId({
      id: userId,
      limit,
      startingAfter: startingAfter || null,
      endingBefore: endingBefore || null,
    });
  } catch (error) {
    console.error('Error fetching user chats:', error);
    return { chats: [], hasMore: false };
  }
}

// Add function to load more chats for infinite scroll
export async function loadMoreChats(
  userId: string,
  lastChatId: string,
  limit: number = 20,
): Promise<{ chats: any[]; hasMore: boolean }> {
  'use server';

  if (!userId || !lastChatId) return { chats: [], hasMore: false };

  try {
    return await getChatsByUserId({
      id: userId,
      limit,
      startingAfter: null,
      endingBefore: lastChatId,
    });
  } catch (error) {
    console.error('Error loading more chats:', error);
    return { chats: [], hasMore: false };
  }
}

// Add function to delete a chat
export async function deleteChat(chatId: string) {
  'use server';

  if (!chatId) return null;

  try {
    return await deleteChatById({ id: chatId });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return null;
  }
}

// Add function to bulk delete chats
export async function bulkDeleteChats(chatIds: string[]) {
  'use server';

  if (!chatIds || chatIds.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  try {
    // Delete chats in parallel
    const results = await Promise.all(
      chatIds.map((id) => deleteChatById({ id }))
    );
    
    // Count successful deletions
    const deletedCount = results.filter((r) => r !== null).length;
    
    return { success: true, deletedCount };
  } catch (error) {
    console.error('Error bulk deleting chats:', error);
    throw new Error('Failed to delete chats');
  }
}

// Add function to update chat visibility
export async function updateChatVisibility(chatId: string, visibility: 'private' | 'public') {
  'use server';

  console.log('ðŸ”„ updateChatVisibility called with:', { chatId, visibility });

  if (!chatId) {
    console.error('âŒ updateChatVisibility: No chatId provided');
    throw new Error('Chat ID is required');
  }

  try {
    console.log('ðŸ“¡ Calling updateChatVisibilityById with:', { chatId, visibility });
    const result = await updateChatVisibilityById({ chatId, visibility });
    console.log('âœ… updateChatVisibilityById successful, result:', result);

    // Return a serializable plain object instead of raw database result
    return {
      success: true,
      chatId,
      visibility,
      rowCount: result?.rowCount || 0,
    };
  } catch (error) {
    console.error('âŒ Error in updateChatVisibility:', {
      chatId,
      visibility,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Add function to get chat info
export async function getChatInfo(chatId: string) {
  'use server';

  if (!chatId) return null;

  try {
    return await getChatById({ id: chatId });
  } catch (error) {
    console.error('Error getting chat info:', error);
    return null;
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  'use server';
  try {
    const [message] = await getMessageById({ id });
    console.log('Message: ', message);

    if (!message) {
      console.error(`No message found with id: ${id}`);
      return;
    }

    await deleteMessagesByChatIdAfterTimestamp({
      chatId: message.chatId,
      timestamp: message.createdAt,
    });

    console.log(`Successfully deleted trailing messages after message ID: ${id}`);
  } catch (error) {
    console.error(`Error deleting trailing messages: ${error}`);
    throw error; // Re-throw to allow caller to handle
  }
}

// Add function to update chat title
export async function updateChatTitle(chatId: string, title: string) {
  'use server';

  if (!chatId || !title.trim()) return null;

  try {
    return await updateChatTitleById({ chatId, title: title.trim() });
  } catch (error) {
    console.error('Error updating chat title:', error);
    return null;
  }
}

// Branch out a chat - create a new chat with the current user and assistant message pair
export async function branchOutChat({
  userMessage,
  assistantMessage,
}: {
  userMessage: UIMessage;
  assistantMessage: UIMessage;
}) {
  'use server';

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    // Generate new chat ID and message IDs
    const newChatId = uuidv7();
    const newUserMessageId = uuidv7();
    const newAssistantMessageId = uuidv7();

    // Generate title from user message
    const chatTitle = await generateTitleFromUserMessage({ message: userMessage });

    // Create the new chat
    await saveChat({
      id: newChatId,
      userId: currentUser.id,
      title: chatTitle,
      visibility: 'private',
    });

    // Prepare messages for saving
    const messagesToSave = [
      {
        chatId: newChatId,
        id: newUserMessageId,
        role: 'user' as const,
        parts: userMessage.parts,
        attachments: (userMessage as any).experimental_attachments ?? [],
        createdAt: new Date(),
        model: (userMessage as any).metadata?.model || null,
        inputTokens: (userMessage as any).metadata?.inputTokens ?? null,
        outputTokens: null,
        totalTokens: null,
        completionTime: null,
      },
      {
        chatId: newChatId,
        id: newAssistantMessageId,
        role: 'assistant' as const,
        parts: assistantMessage.parts,
        attachments: [],
        createdAt: new Date(),
        model: (assistantMessage as any).metadata?.model || null,
        inputTokens: (assistantMessage as any).metadata?.inputTokens ?? null,
        outputTokens: (assistantMessage as any).metadata?.outputTokens ?? null,
        totalTokens: (assistantMessage as any).metadata?.totalTokens ?? null,
        completionTime: (assistantMessage as any).metadata?.completionTime ?? null,
      },
    ];

    // Save messages to the new chat
    await saveMessages({ messages: messagesToSave });

    return { success: true, chatId: newChatId };
  } catch (error) {
    console.error('Error branching out chat:', error);
    return { success: false, error: 'Failed to branch out chat' };
  }
}

export async function getSubDetails() {
  'use server';

  // Import here to avoid issues with SSR
  const { getComprehensiveUserData } = await import('@/lib/user-data-server');
  const userData = await getComprehensiveUserData();

  if (!userData) return { hasSubscription: false };

  return userData.stripeSubscription
    ? {
      hasSubscription: true,
      subscription: userData.stripeSubscription,
    }
    : { hasSubscription: false };
}

export async function getUserMessageCount(providedUser?: any) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return { count: 0, error: 'User not found' };
    }

    // Check cache first
    const cacheKey = createMessageCountKey(user.id);
    const cached = usageCountCache.get(cacheKey);
    if (cached !== null) {
      console.log('â±ï¸ [USAGE] getUserMessageCount: cache hit');
      return { count: cached, error: null };
    }

    const start = Date.now();
    const count = await getMessageCount({
      userId: user.id,
    });
    const durationMs = Date.now() - start;
    console.log(`â±ï¸ [USAGE] getUserMessageCount: DB usage lookup took ${durationMs}ms`);

    // Cache the result
    usageCountCache.set(cacheKey, count);

    return { count, error: null };
  } catch (error) {
    console.error('Error getting user message count:', error);
    return { count: 0, error: 'Failed to get message count' };
  }
}

export async function getUserExtremeSearchCount(providedUser?: any) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return { count: 0, error: 'User not found' };
    }

    // Check cache first
    const cacheKey = createExtremeCountKey(user.id);
    const cached = usageCountCache.get(cacheKey);
    if (cached !== null) {
      console.log('â±ï¸ [USAGE] getUserExtremeSearchCount: cache hit');
      return { count: cached, error: null };
    }

    const start = Date.now();
    const count = await getExtremeSearchCount({
      userId: user.id,
    });
    const durationMs = Date.now() - start;
    console.log(`â±ï¸ [USAGE] getUserExtremeSearchCount: DB usage lookup took ${durationMs}ms`);

    // Cache the result
    usageCountCache.set(cacheKey, count);

    return { count, error: null };
  } catch (error) {
    console.error('Error getting user extreme search count:', error);
    return { count: 0, error: 'Failed to get extreme search count' };
  }
}

export async function incrementUserMessageCount() {
  'use server';

  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    await incrementMessageUsage({
      userId: user.id,
    });

    // Invalidate cache
    const cacheKey = createMessageCountKey(user.id);
    usageCountCache.delete(cacheKey);

    return { success: true, error: null };
  } catch (error) {
    console.error('Error incrementing user message count:', error);
    return { success: false, error: 'Failed to increment message count' };
  }
}

export async function getExtremeSearchUsageCount(providedUser?: any) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return { count: 0, error: 'User not found' };
    }

    // Check cache first
    const cacheKey = createExtremeCountKey(user.id);
    const cached = usageCountCache.get(cacheKey);
    if (cached !== null) {
      console.log('â±ï¸ [USAGE] getExtremeSearchUsageCount: cache hit');
      return { count: cached, error: null };
    }

    const start = Date.now();
    const count = await getExtremeSearchCount({
      userId: user.id,
    });
    const durationMs = Date.now() - start;
    console.log(`â±ï¸ [USAGE] getExtremeSearchUsageCount: DB usage lookup took ${durationMs}ms`);

    // Cache the result
    usageCountCache.set(cacheKey, count);

    return { count, error: null };
  } catch (error) {
    console.error('Error getting extreme search usage count:', error);
    return { count: 0, error: 'Failed to get extreme search count' };
  }
}

type DiscountConfigParams = {
  email?: string | null;
  isIndianUser?: boolean;
};

export async function getDiscountConfigAction(params?: DiscountConfigParams) {
  try {
    let userEmail = params?.email ?? null;

    if (!userEmail) {
      const user = await getCurrentUser();
      userEmail = user?.email ?? null;
    }

    let isIndianUser = params?.isIndianUser;

    if (isIndianUser === undefined) {
      try {
        const headersList = await headers();
        const request = { headers: headersList };
        const locationData = geolocation(request);
        const country = (locationData.country || '').toUpperCase();
        isIndianUser = country === 'IN';
      } catch (geoError) {
        console.warn('Geolocation lookup failed in getDiscountConfigAction:', geoError);
        isIndianUser = false;
      }
    }

    return await getDiscountConfig(userEmail ?? undefined);
  } catch (error) {
    console.error('Error getting discount configuration:', error);
    return {
      enabled: false,
    };
  }
}

export async function getHistoricalUsage(providedUser?: any, days: number = 30) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return [];
    }

    // Convert days to months for the database query (approximately 30 days per month)
    const months = Math.ceil(days / 30);
    const historicalData = await getHistoricalUsageData({ userId: user.id, months });

    // Use the exact number of days requested
    const totalDays = days;
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (totalDays - 1)); // -1 to include today

    // Create a map of existing data for quick lookup
    const dataMap = new Map<string, number>();
    historicalData.forEach((record) => {
      const dateKey = record.date.toISOString().split('T')[0];
      dataMap.set(dateKey, record.messageCount || 0);
    });

    // Generate complete dataset for all days
    const completeData = [];
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateKey = currentDate.toISOString().split('T')[0];

      const count = dataMap.get(dateKey) || 0;
      let level: 0 | 1 | 2 | 3 | 4;

      // Define usage levels based on message count
      if (count === 0) level = 0;
      else if (count <= 3) level = 1;
      else if (count <= 7) level = 2;
      else if (count <= 12) level = 3;
      else level = 4;

      completeData.push({
        date: dateKey,
        count,
        level,
      });
    }

    return completeData;
  } catch (error) {
    console.error('Error getting historical usage:', error);
    return [];
  }
}

// Custom Instructions Server Actions
export async function getCustomInstructions(providedUser?: any) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return null;
    }

    const instructions = await getCustomInstructionsByUserId({ userId: user.id });
    return instructions;
  } catch (error) {
    console.error('Error getting custom instructions:', error);
    return null;
  }
}

export async function saveCustomInstructions(content: string) {
  'use server';

  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!content.trim()) {
      return { success: false, error: 'Content cannot be empty' };
    }

    // Check if instructions already exist
    const existingInstructions = await getCustomInstructionsByUserId({ userId: user.id });

    let result;
    if (existingInstructions) {
      result = await updateCustomInstructions({ userId: user.id, content: content.trim() });
    } else {
      result = await createCustomInstructions({ userId: user.id, content: content.trim() });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Error saving custom instructions:', error);
    return { success: false, error: 'Failed to save custom instructions' };
  }
}

export async function deleteCustomInstructionsAction() {
  'use server';

  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const result = await deleteCustomInstructions({ userId: user.id });
    return { success: true, data: result };
  } catch (error) {
    console.error('Error deleting custom instructions:', error);
    return { success: false, error: 'Failed to delete custom instructions' };
  }
}

// User Preferences Actions
export async function getUserPreferences(providedUser?: any) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return null;
    }

    const preferences = await getCachedUserPreferencesByUserId(user.id);
    return preferences;
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return null;
  }
}

export async function saveUserPreferences(preferences: Partial<{
  'core-lens-search-provider'?: 'exa' | 'tavily' | 'firecrawl';
  'core-lens-extreme-search-provider'?: 'exa';
  'core-lens-group-order'?: string[];
  'core-lens-model-order-global'?: string[];
  'core-lens-blur-personal-info'?: boolean;
  'core-lens-custom-instructions-enabled'?: boolean;
  'core-lens-location-metadata-enabled'?: boolean;
}>) {
  'use server';

  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const result = await upsertUserPreferences({ userId: user.id, preferences });

    // Clear cache after update
    clearUserPreferencesCache(user.id);

    return { success: true, data: result };
  } catch (error) {
    console.error('Error saving user preferences:', error);
    return { success: false, error: 'Failed to save user preferences' };
  }
}

export async function syncUserPreferences() {
  'use server';

  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // This will be called from the client to migrate localStorage data
    // The actual migration logic will be in the hook
    return { success: true };
  } catch (error) {
    console.error('Error syncing user preferences:', error);
    return { success: false, error: 'Failed to sync user preferences' };
  }
}

// Fast pro user status check - UNIFIED VERSION
export async function getProUserStatusOnly(): Promise<boolean> {
  'use server';

  // Import here to avoid issues with SSR
  const { isUserPro } = await import('@/lib/user-data-server');
  return await isUserPro();
}


// Server action to get user's geolocation using Vercel
export async function getUserLocation() {
  try {
    const headersList = await headers();

    const request = {
      headers: headersList,
    };

    const locationData = geolocation(request);

    return {
      country: locationData.country || '',
      countryCode: locationData.country || '',
      city: locationData.city || '',
      region: locationData.region || '',
      isIndia: locationData.country === 'IN',
      loading: false,
    };
  } catch (error) {
    console.error('Failed to get location from Vercel:', error);
    return {
      country: 'Unknown',
      countryCode: '',
      city: '',
      region: '',
      isIndia: false,
      loading: false,
    };
  }
}

// Connector management actions
export async function createConnectorAction(provider: ConnectorProvider) {
  'use server';

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const authLink = await createConnection(provider, user.id);
    return { success: true, authLink };
  } catch (error) {
    console.error('Error creating connector:', error);
    return { success: false, error: 'Failed to create connector' };
  }
}

export async function listUserConnectorsAction() {
  'use server';

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required', connections: [] };
    }

    const connections = await listUserConnections(user.id);
    return { success: true, connections };
  } catch (error) {
    console.error('Error listing connectors:', error);
    return { success: false, error: 'Failed to list connectors', connections: [] };
  }
}

export async function deleteConnectorAction(connectionId: string) {
  'use server';

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const result = await deleteConnection(connectionId);
    if (result) {
      return { success: true };
    } else {
      return { success: false, error: 'Failed to delete connector' };
    }
  } catch (error) {
    console.error('Error deleting connector:', error);
    return { success: false, error: 'Failed to delete connector' };
  }
}

export async function manualSyncConnectorAction(provider: ConnectorProvider) {
  'use server';

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const result = await manualSync(provider, user.id);
    if (result) {
      return { success: true };
    } else {
      return { success: false, error: 'Failed to start sync' };
    }
  } catch (error) {
    console.error('Error syncing connector:', error);
    return { success: false, error: 'Failed to start sync' };
  }
}

export async function getConnectorSyncStatusAction(provider: ConnectorProvider) {
  'use server';

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required', status: null };
    }

    const status = await getSyncStatus(provider, user.id);
    return { success: true, status };
  } catch (error) {
    console.error('Error getting sync status:', error);
    return { success: false, error: 'Failed to get sync status', status: null };
  }
}

// Server action to get supported student domains from Edge Config
export async function getStudentDomainsAction() {
  'use server';

  try {
    const studentDomainsConfig = await get('student_domains');
    if (studentDomainsConfig && typeof studentDomainsConfig === 'string') {
      // Parse CSV string to array, trim whitespace, and sort alphabetically
      const domains = studentDomainsConfig
        .split(',')
        .map((domain) => domain.trim())
        .filter((domain) => domain.length > 0)
        .sort();

      return {
        success: true,
        domains,
        count: domains.length,
      };
    }

    // Fallback to hardcoded domains if Edge Config fails
    const fallbackDomains = ['.edu', '.ac.in'].sort();
    return {
      success: true,
      domains: fallbackDomains,
      count: fallbackDomains.length,
      fallback: true,
    };
  } catch (error) {
    console.error('Failed to fetch student domains from Edge Config:', error);

    // Return fallback domains on error
    const fallbackDomains = ['.edu', '.ac.in'].sort();
    return {
      success: false,
      domains: fallbackDomains,
      count: fallbackDomains.length,
      fallback: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Fetch chats for the authenticated user (paginated)
export async function getAllChatsWithPreview(limit: number = 25, offset: number = 0) {
  'use server';
  
  try {
    const user = await getUser();
    
    if (!user) {
      return { error: 'Unauthorized', status: 401 };
    }

    // Fetch chats only - no messages for better performance
    const chats = await db.query.chat.findMany({
      where: eq(chat.userId, user.id),
      orderBy: [desc(chat.createdAt)],
      limit,
      offset,
    });

    return { chats };
  } catch (error) {
    console.error('Error fetching chats:', error);
    return { error: 'Failed to fetch chats', status: 500 };
  }
}

// Search chats by title (paginated)
export async function searchChatsByTitle(query: string, limit: number = 25, offset: number = 0) {
  'use server';
  
  try {
    const user = await getUser();
    
    if (!user) {
      return { error: 'Unauthorized', status: 401 };
    }

    const trimmedQuery = query?.trim() || '';

    // If no query, return paginated chats
    if (trimmedQuery.length === 0) {
      const chats = await db.query.chat.findMany({
        where: eq(chat.userId, user.id),
        orderBy: [desc(chat.createdAt)],
        limit,
        offset,
      });

      return { chats };
    }

    // Optimized: Use AND to combine userId and title search at DB level
    // Use ilike for case-insensitive search
    const chats = await db.query.chat.findMany({
      where: and(
        eq(chat.userId, user.id),
        ilike(chat.title, `%${trimmedQuery}%`)
      ),
      orderBy: [desc(chat.createdAt)],
      limit,
      offset,
    });

    return { chats };
  } catch (error) {
    console.error('Error searching chats:', error);
    return { error: 'Failed to search chats', status: 500 };
  }
}
