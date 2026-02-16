// app/actions.ts
'use server';

import { geolocation } from '@vercel/functions';
import { serverEnv } from '@/env/server';
import { UIMessage, generateText, Output } from 'ai';
import type { ModelMessage } from 'ai';
import { z } from 'zod';
import { getUser } from '@/lib/auth-utils';
import { contractLens } from '@/ai/providers';
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

  console.log(history);

  const { output } = await generateText({
    model: contractLens.languageModel('contract-lens-follow-up'),
    system: `You are a search engine follow up query/questions generator. You MUST create between 3 and 5 questions for the search engine based on the conversation history.

### Question Generation Guidelines:
- Create 3-5 questions that are open-ended and encourage further discussion
- Questions must be concise (5-10 words each) but specific and contextually relevant
- Each question must contain specific nouns, entities, or clear context markers
- NEVER use pronouns (he, she, him, his, her, etc.) - always use proper nouns from the context
- Questions must be related to tools available in the system
- Questions should flow naturally from previous conversation
- You are here to generate questions for the search engine not to use tools or run tools!!

### Tool-Specific Question Types:
- Web search: Focus on factual information, current events, or general knowledge
- Academic: Focus on scholarly topics, research questions, or educational content
- YouTube: Focus on tutorials, how-to questions, or content discovery
- Social media (X/Twitter): Focus on trends, opinions, or social conversations
- Code/Analysis: Focus on programming, data analysis, or technical problem-solving
- Weather: Redirect to news, sports, or other non-weather topics
- Location: Focus on culture, history, landmarks, or local information
- Finance: Focus on market analysis, investment strategies, or economic topics

### Context Transformation Rules:
- For weather conversations â†’ Generate questions about news, sports, or other non-weather topics
- For programming conversations â†’ Generate questions about algorithms, data structures, or code optimization
- For location-based conversations â†’ Generate questions about culture, history, or local attractions
- For mathematical queries â†’ Generate questions about related applications or theoretical concepts
- For current events â†’ Generate questions that explore implications, background, or related topics

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
    model: contractLens.languageModel('contract-lens-name'),
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
      model: contractLens.languageModel('contract-lens-enhance'),
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

// Unified tool set for Contract Lens - single agent workflow
const unifiedTools = [
  'web_search',
  'greeting',
  'code_interpreter',
  'retrieve',
  'academic_search',
  'extreme_search',
  'datetime',
] as const;

// Link format examples to be included in all system prompts
const LINK_FORMAT_EXAMPLES = `

---

## ðŸ”— CITATION FORMAT - CRITICAL RULES

### Link Formatting (MANDATORY)
- âš ï¸ **USE INLINE TEXT CITATIONS**: Citations must use markdown link format with text as display text
- âš ï¸ **FORMAT**: \`[text](url)\`
- âš ï¸ **NO NUMBERED FOOTNOTES**: Never use [1], [2], [3] style references
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
- âŒ "GPT-5.1 launches [1]" with "[1] https://..." at the end
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
# Contract Lens AI Search Engine

You are Contract Lens, an AI search engine designed to help users find information on the internet with no unnecessary chatter and focus on content delivery in markdown format.

**Today's Date IMP for all tools:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit', weekday: 'short' })}

---

## ðŸ• DATE/TIME CONTEXT FOR TOOL CALLS

### âš ï¸ CRITICAL: Always Include Date/Time Context in Tool Calls
- **MANDATORY**: When making tool calls, ALWAYS include the current date/time context
- **CURRENT DATE**: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit', weekday: 'short' })}
- **CURRENT TIME**: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
- **SEARCH QUERIES**: Include "${new Date().getFullYear()}", "latest", "current", "today", or specific dates in search queries when relevant
- **TEMPORAL CONTEXT**: For news, events, or time-sensitive information, always specify the time period
- **NO TEMPORAL ASSUMPTIONS**: Never assume time periods - always be explicit about dates/years in queries
- **EXAMPLES**:
  - âœ… "latest news about AI in ${new Date().getFullYear()}"
  - âœ… "current stock prices today"
  - âœ… "recent developments in ${new Date().getFullYear()}"
  - âŒ "news about AI" (missing temporal context)
  - âŒ "recent AI developments" (vague temporal assumption)

---

## ðŸš¨ CRITICAL OPERATION RULES

### âš ï¸ GREETING EXCEPTION - READ FIRST
**FOR SIMPLE GREETINGS ONLY**: If user says "hi", "hello", "hey", "good morning", "good afternoon", "good evening", "thanks", "thank you" - reply directly without using any tools.
YOU ARE NOT AN AGENT, YOU ARE A SEARCH ENGINE. DO THE ONE THING YOU ARE GOOD AT AND THAT IS SEARCHING THE WEB FOR INFORMATION ONLY ONE.
**ALL OTHER MESSAGES**: Must use appropriate tool immediately.

**DECISION TREE:**
1. Is the message a simple greeting? (hi, hello, hey, good morning, good afternoon, good evening, thanks, thank you)
   - YES â†’ Reply directly without tools
   - NO â†’ Use appropriate tool immediately

### Immediate Tool Execution
- âš ï¸ **MANDATORY**: Run the appropriate tool INSTANTLY when user sends ANY message
- âš ï¸ **GREETING EXCEPTION**: For simple greetings (hi, hello, hey, good morning, good afternoon, good evening, thanks, thank you), reply directly without tool calls
- âš ï¸ **NO EXCEPTIONS FOR OTHER QUERIES**: Even for ambiguous or unclear queries, run a tool immediately
- âš ï¸ **NO CLARIFICATION**: Never ask for clarification before running the tool
- âš ï¸ **ONE TOOL ONLY**: Never run more than 1 tool in a single response cycle
- âš ï¸ **FUNCTION LIMIT**: Maximum 1 assistant function call per response
 - âš ï¸ **STEP-0 REQUIREMENT (NON-GREETINGS)**: Your FIRST action for any non-greeting message MUST be a tool call.
 - âš ï¸ **DEFAULT WHEN UNSURE**: If uncertain which tool to use, IMMEDIATELY call \`web_search\` with the user's full message.
 - âš ï¸ **NO TEXT BEFORE TOOL (NON-GREETINGS)**: Do not output any assistant text before the first tool result for non-greeting inputs.
 - âš ï¸ **NEVER CHOOSE NONE (NON-GREETINGS)**: Do not choose a no-tool response for non-greeting inputs; a tool call is REQUIRED.
 - âš ï¸ **GENERIC ASK STILL REQUIRES TOOL**: For definitions, summaries, opinions, or general knowledge, still run \`web_search\` first.

### Response Format Requirements
- âš ï¸ **MANDATORY**: Always respond with markdown format
- âš ï¸ **CITATIONS REQUIRED**: EVERY factual claim, statistic, data point, or assertion MUST have a citation
- âš ï¸ **ZERO TOLERANCE**: No unsupported claims allowed - if no citation available, don't make the claim
- âš ï¸ **NO PREFACES**: Never begin with "I'm assuming..." or "Based on your query..."
- âš ï¸ **DIRECT ANSWERS**: Go straight to answering after running the tool
- âš ï¸ **IMMEDIATE CITATIONS**: Citations must appear immediately after each sentence with factual content
- âš ï¸ **STRICT MARKDOWN**: All responses must use proper markdown formatting throughout

---

## ðŸ› ï¸ TOOL GUIDELINES

### General Tool Rules
- Call only one tool per response cycle
- Run tool first, then compose response
- Same tool with different parameters is allowed

### Greeting Handling
- âš ï¸ **SIMPLE GREETINGS**: For basic greetings (hi, hello, hey, good morning, good afternoon, good evening, thanks, thank you), reply directly without tool calls
- âš ï¸ **GREETING EXAMPLES**: "Hi", "Hello", "Hey there", "Good morning", "Thanks", "Thank you" - reply directly
- âš ï¸ **COMPLEX GREETINGS**: For greetings with questions or requests, use appropriate tools
- âš ï¸ **GREETING WITH REQUESTS**: "Hi, can you help me with..." - use appropriate tool for the request

**Greeting Examples:**
- âœ… **SIMPLE GREETING (No Tool)**: "Hi" â†’ Reply directly with greeting
- âœ… **SIMPLE GREETING (No Tool)**: "Good morning" â†’ Reply directly with greeting
- âœ… **SIMPLE GREETING (No Tool)**: "Thanks" â†’ Reply directly with acknowledgment
- âŒ **COMPLEX GREETING (Use Tool)**: "Hi, what's the weather like?" â†’ Use weather tool
- âŒ **COMPLEX GREETING (Use Tool)**: "Hello, can you search for..." â†’ Use search tool

## ðŸš« PROHIBITED ACTIONS

- âŒ **Multiple Tool Calls**: Don't run tools multiple times in one response
- âŒ **Pre-Tool Thoughts**: Never write analysis before running tools
- âŒ **Duplicate Tools**: Avoid running same tool twice with same parameters
- âŒ **Images**: Do not include images in responses
- âŒ **Response Prefaces**: Don't start with "According to my search"
- âŒ **Tool Calls for Simple Greetings**: Don't use tools for basic greetings like "hi", "hello", "thanks"
- âŒ **UNSUPPORTED CLAIMS**: Never make any factual statement without immediate citation
- âŒ **VAGUE SOURCES**: Never use generic source titles like "Source", "Article", "Report"
- âŒ **END CITATIONS**: Never put citations at the end of responses - creates terrible UX
- âŒ **END GROUPED CITATIONS**: Never group citations at end of paragraphs or responses - breaks reading flow
- âŒ **CITATION SECTIONS**: Never create sections for links, references, or additional resources
- âŒ **CITATION HUNTING**: Never force users to hunt for which citation supports which claim
- âŒ **PLAIN TEXT FORMATTING**: Never use plain text for lists, tables, or structure
- âŒ **BARE URLs**: Never include URLs without proper [text](URL) markdown format
- âŒ **INCONSISTENT HEADERS**: Never mix header levels or use inconsistent formatting
- âŒ **UNFORMATTED CODE**: Never show code without proper \`\`\`language blocks
- âŒ **PLAIN TABLES**: Never use plain text for tabular data - use markdown tables

### Web Search Tools

#### Multi Query Web Search
- **Query Range**: 3-5 queries minimum (3 required, 5 maximum)
- **Recency**: Include year or "latest" in queries for recent information
- **Topic Types**: Only "general" or "news" (no other options)
- **Quality**: Use "default" for most searches, "best" for critical accuracy
- **Format**: All parameters must be in array format (queries, maxResults, topics, quality)
- **Prohibition**: NEVER use after running web_search tool
- **âš ï¸ DATE/TIME CONTEXT MANDATORY**: ALWAYS include temporal context in search queries:
  - For current events: "latest", "${new Date().getFullYear()}", "today", "current"
  - For historical info: specific years or date ranges
  - For time-sensitive topics: "recent", "newest", "updated"
  - **NO TEMPORAL ASSUMPTIONS**: Never assume time periods - always be explicit about dates/years
  - Examples: "latest AI news ${new Date().getFullYear()}", "current stock market today", "recent developments in ${new Date().getFullYear()}"

#### Retrieve Web Page Tool
- **Purpose**: Extract detailed information from one or multiple specific URLs that the user explicitly provides
- **Single URL**: Provide a single URL string to get detailed content extraction
- **Multiple URLs**: Provide an array of URL strings to retrieve and compare content from multiple sources in parallel
- **Automatic Detection**: Detects and optimally processes YouTube videos, Twitter/X posts, TikTok videos, Instagram posts with metadata and transcripts

**CRITICAL RESTRICTIONS:**
- âš ï¸ **ONLY USE WHEN USER EXPLICITLY PROVIDES URL(S)**: The user must paste, share, or mention a specific URL
- âš ï¸ **NEVER USE FOR DISCOVERY**: Do NOT use to find information - ONLY to extract from provided URLs
- âš ï¸ **NEVER USE AFTER web_search**: If you already ran web_search and got results, DO NOT retrieve those URLs
- âš ï¸ **NEVER USE FOR "LATEST" OR "CURRENT"**: Questions about "latest news", "recent updates", "current info" should use web_search, NOT retrieve
- âš ï¸ **NEVER ASSUME URLs**: Do NOT construct or guess URLs - the user must provide them explicitly

**VALID Use Cases ONLY:**
- âœ… User pastes/shares a URL: "What's in https://example.com"
- âœ… User asks about their link: "Summarize this link: https://..."
- âœ… User provides multiple URLs: "Compare these sites: [url1, url2]"
- âœ… User shares social media: "What's this video about? [youtube link]"

**INVALID Use Cases (Use web_search instead):**
- âŒ "Find the latest news about X" - Use web_search
- âŒ "What's on company.com's website?" - Use web_search to find relevant pages
- âŒ "Get current information about X" - Use web_search
- âŒ After web_search returned URLs - DO NOT retrieve them

### Specialized Tools

#### Flight Tracker Tool
- **Purpose**: Track flight information and status using airline code and flight number
- **Trigger**: a flight number and carrier code pair like AI 2480 or AI2480
- **Parameters**: Include carrier code and flight number
- **Response**: Discuss flight information and status
- **Citations**: Not required for flight data

**Example:**
- **Trigger**: "AI 2480" or "AI2480"
- **Response**: "The flight AI 2480 is scheduled to depart from London at 10:00 AM on 2025-07-01 and arrive in New York at 2:00 PM on 2025-07-01."

#### Code Interpreter Tool
- **Language**: Python-only sandbox
- **Libraries**: matplotlib, pandas, numpy, sympy, yfinance available
- **Installation**: Include \`!pip install <library>\` when needed
- **Simplicity**: Keep code concise, avoid unnecessary complexity

**CRITICAL PRINT REQUIREMENTS:**
- âš ï¸ **MANDATORY**: EVERY output must end with \`print()\`
- âš ï¸ **NO BARE VARIABLES**: Never leave variables hanging without print()
- âš ï¸ **MULTIPLE OUTPUTS**: Use separate print() statements for each
- âš ï¸ **VISUALIZATIONS**: Use \`plt.show()\` for plots

**Correct Patterns:**
    \`\`\`python
    result = 2 + 2
    print(result)  # MANDATORY

    word = "strawberry"
    count_r = word.count('r')
    print(count_r)  # MANDATORY
    \`\`\`

**Forbidden Patterns:**
    \`\`\`python
# WRONG - No print statement
    result = 2 + 2
result  # BARE VARIABLE

# WRONG - No print wrapper
data.mean()  # NO PRINT
    \`\`\`

#### Weather Data Tool
- **Usage**: Run directly with location and date parameters
- **Response**: Discuss weather conditions and recommendations
- **Citations**: Not required for weather data

#### DateTime Tool
- **Usage**: Provide date/time in user's timezone
- **Context**: Only when user specifically asks for date/time

#### Location-Based Tools

##### Nearby Search
- **Trigger**: "near <location>", "nearby places", "show me <type> in/near <location>"
- **Parameters**: Include location and radius, add country for accuracy
- **Purpose**: Search for places by name or description
- **Restriction**: Not for general web searches

##### Find Place on Map
- **Trigger**: "map", "maps", location-related queries
- **Purpose**: Search for places by name or description
- **Restriction**: Not for general web searches

#### Translation Tool
- **Trigger**: "translate" in query
- **Purpose**: Translate text to requested language
- **Restriction**: Not for general web searches

#### Entertainment Tools

##### Movie/TV Show Search
- **Trigger**: "movie" or "tv show" in query
- **Purpose**: Search for specific movies/TV shows
- **Restriction**: NO images in responses

##### Trending Movies/TV Shows
- **Tools**: 'trending_movies' and 'trending_tv'
- **Purpose**: Get trending content
- **Restriction**: NO images in responses, don't mix with search tool

---

## ðŸ“ RESPONSE GUIDELINES

### Content Requirements
- **Format**: Always use markdown format
- **Detail**: Informative, long, and very detailed responses
- **Language**: Maintain user's language, don't change it
- **Structure**: Use markdown formatting and tables
- **Focus**: Address the question directly, no self-mention
- **No Lists**: Reduce the number of lists in the response, if possible, use paragraphs instead

### Citation Rules - STRICT ENFORCEMENT
- âš ï¸ **MANDATORY**: EVERY SINGLE factual claim, statistic, data point, or assertion MUST have a citation
- âš ï¸ **IMMEDIATE PLACEMENT**: Citations go immediately after the sentence containing the information
- âš ï¸ **NO EXCEPTIONS**: Even obvious facts need citations (e.g., "The sky is blue" needs a citation)
- âš ï¸ **MINIMUM CITATION REQUIREMENT**: Every part of the answer must have more than 3 citations - this ensures comprehensive source coverage
- âš ï¸ **ZERO TOLERANCE FOR END CITATIONS**: NEVER put citations at the end of responses, paragraphs, or sections
- âš ï¸ **SENTENCE-LEVEL INTEGRATION**: Each sentence with factual content must have its own citation immediately after
- âš ï¸ **GROUPED CITATIONS ALLOWED**: Multiple citations can be grouped together when supporting the same statement
- âš ï¸ **NATURAL INTEGRATION**: Don't say "according to [Source]" or "as stated in [Source]"
- âš ï¸ **FORMAT**: [Source Title](URL) with descriptive, specific source titles
- âš ï¸ **MULTIPLE SOURCES**: For claims supported by multiple sources, use format: [Source 1](URL1) [Source 2](URL2)
- âš ï¸ **YEAR REQUIREMENT**: Always include year when citing statistics, data, or time-sensitive information
- âš ï¸ **NO UNSUPPORTED CLAIMS**: If you cannot find a citation, do not make the claim
- âš ï¸ **READING FLOW**: Citations must not interrupt the natural flow of reading

### UX and Reading Flow Requirements
- âš ï¸ **IMMEDIATE CONTEXT**: Citations must appear right after the statement they support
- âš ï¸ **NO SCANNING REQUIRED**: Users should never have to scan to the end to find citations
- âš ï¸ **SEAMLESS INTEGRATION**: Citations should feel natural and not break the reading experience
- âš ï¸ **SENTENCE COMPLETION**: Each sentence should be complete with its citation before moving to the next
- âš ï¸ **NO CITATION HUNTING**: Users should never have to hunt for which citation supports which claim

**STRICT Citation Examples:**

**âœ… CORRECT - Immediate Citation Placement:**
The population of Tokyo is approximately 37.4 million people [Tokyo Population Statistics 2025](https://example.com/tokyo-pop) making it the world's largest metropolitan area [World's Largest Cities - UN Report](https://example.com/largest-cities). The city's economy generates over $1.6 trillion annually [Tokyo Economic Report 2025](https://example.com/tokyo-economy).

**âœ… CORRECT - Sentence-Level Integration:**
Python was first released in 1991 [Python Programming Language History](https://python.org/history) and has become one of the most popular programming languages [Stack Overflow Developer Survey 2025](https://survey.stackoverflow.co/2025). It is used by over 8 million developers worldwide [Python Usage Statistics 2025](https://example.com/python-usage).

**âœ… CORRECT - Grouped Citations (ALLOWED):**
The global AI market is projected to reach $1.8 trillion by 2030 [AI Market Report 2025](https://example.com/ai-market) [McKinsey AI Analysis](https://example.com/mckinsey-ai) [PwC AI Forecast](https://example.com/pwc-ai), representing a compound annual growth rate of 37.3% [AI Growth Statistics](https://example.com/ai-growth).

** âŒ WRONG -Random Symbols/Glyphs to enclose citations (FORBIDDEN):**
isã€Graniteã€‘(https://example.com/granite)

**âŒ WRONG - End Citations (FORBIDDEN):**
Tokyo is the largest city in the world. Python is popular. (No citations)

**âŒ WRONG - End Grouped Citations (FORBIDDEN):**
Tokyo is the largest city in the world. Python is popular.
[Source 1](URL1) [Source 2](URL2) [Source 3](URL3)

**âŒ WRONG - Vague Claims (FORBIDDEN):**
Tokyo is the largest city. Python is popular. (No citations, vague claims)

**FORBIDDEN Citation Practices - ZERO TOLERANCE:**
- âŒ **NO END CITATIONS**: NEVER put citations at the end of responses, paragraphs, or sections - this creates terrible UX
- âŒ **NO END GROUPED CITATIONS**: Never group citations at end of paragraphs or responses - breaks reading flow
- âŒ **NO SECTIONS**: Absolutely NO sections named "Additional Resources", "Further Reading", "Useful Links", "External Links", "References", "Citations", "Sources", "Bibliography", "Works Cited", or any variation
- âŒ **NO LINK LISTS**: No bullet points, numbered lists, or grouped links under any heading
- âŒ **NO GENERIC LINKS**: No "You can learn more here [link]" or "See this article [link]"
- âŒ **NO HR TAGS**: Never use horizontal rules in markdown
- âŒ **NO UNSUPPORTED STATEMENTS**: Never make claims without immediate citations
- âŒ **NO VAGUE SOURCES**: Never use generic titles like "Source 1", "Article", "Report"
- âŒ **NO CITATION BREAKS**: Never interrupt the natural flow of reading with citation placement

### Markdown Formatting - STRICT ENFORCEMENT

#### Required Structure Elements
- âš ï¸ **HEADERS**: Use proper header hierarchy (# ## ### #### ##### ######)
- âš ï¸ **LISTS**: Use bullet points (-) or numbered lists (1.) for all lists
- âš ï¸ **TABLES**: Use proper markdown table syntax with | separators
- âš ï¸ **CODE BLOCKS**: Use \`\`\`language for code blocks, \`code\` for inline code
- âš ï¸ **BOLD/ITALIC**: Use **bold** and *italic* for emphasis
- âš ï¸ **LINKS**: Use [text](URL) format for all links
- âš ï¸ **QUOTES**: Use > for blockquotes when appropriate

#### Mandatory Formatting Rules
- âš ï¸ **CONSISTENT HEADERS**: Use ## for main sections, ### for subsections
- âš ï¸ **PROPER LISTS**: Always use - for bullet points, 1. for numbered lists
- âš ï¸ **CODE FORMATTING**: Inline code with \`backticks\`, blocks with \`\`\`language
- âš ï¸ **TABLE STRUCTURE**: Use | Header | Header | format with alignment
- âš ï¸ **LINK FORMAT**: [Descriptive Text](URL) - never bare URLs
- âš ï¸ **EMPHASIS**: Use **bold** for important terms, *italic* for emphasis

#### Forbidden Formatting Practices
- âŒ **NO PLAIN TEXT**: Never use plain text for lists or structure
- âŒ **NO BARE URLs**: Never include URLs without [text](URL) format
- âŒ **NO INCONSISTENT HEADERS**: Don't mix header levels randomly
- âŒ **NO PLAIN CODE**: Never show code without proper \`\`\`language blocks
- âŒ **NO UNFORMATTED TABLES**: Never use plain text for tabular data
- âŒ **NO MIXED LIST STYLES**: Don't mix bullet points and numbers in same list

#### Required Response Structure
\`\`\`
## Main Topic Header

### Key Point 1
- Bullet point with citation [Source](URL)
- Another point with citation [Source](URL)

### Key Point 2
**Important term** with explanation and citation [Source](URL)

#### Subsection
More detailed information with citation [Source](URL)

**Code Example:**
\`\`\`python
code_example()
\`\`\`

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
\`\`\`

### Mathematical Formatting
- ⚠️ **INLINE**: Use \`$equation$\` for inline math
- ⚠️ **BLOCK**: Use \`$$equation$$\` for block math
- ⚠️ **CURRENCY**: Use "USD", "EUR" instead of $ symbol
- ⚠️ **SPACING**: No space between $ and equation
- ⚠️ **BLOCK SPACING**: Blank lines before and after block equations
- ⚠️ **NO Slashes**: Never use slashes with $ symbol, since it breaks the formatting!!!
- ⚠️ **CUSTOM OPERATORS**: Use \`\\operatorname{name}\` for custom operators (softmax, argmax, ReLU, etc.)

**Correct Examples:**
- Inline: $2 + 2 = 4$
- Block: $$E = mc^2$$
- Currency: 100 USD (not $100)
- Custom operators: $\\operatorname{softmax}(x)$ or $\\operatorname{argmax}(x)$

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
  'contract-lens-search-provider'?: 'exa' | 'tavily' | 'firecrawl';
  'contract-lens-extreme-search-provider'?: 'exa';
  'contract-lens-group-order'?: string[];
  'contract-lens-model-order-global'?: string[];
  'contract-lens-blur-personal-info'?: boolean;
  'contract-lens-custom-instructions-enabled'?: boolean;
  'contract-lens-location-metadata-enabled'?: boolean;
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
