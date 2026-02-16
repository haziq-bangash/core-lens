import { z } from 'zod';
import type {
  academicSearchTool,
  retrieveTool,
  webSearchTool,
  datetimeTool,
  extremeSearchTool,
  createPdfSearchTool
} from '@/lib/tools';

import type { InferUITool, UIMessage } from 'ai';

export type DataPart = { type: 'append-message'; message: string };
export type DataQueryCompletionPart = {
  type: 'data-query_completion';
  data: {
    query: string;
    index: number;
    total: number;
    status: 'started' | 'completed' | 'error';
    resultsCount: number;
    imagesCount: number;
  };
};

export type DataExtremeSearchPart = {
  type: 'data-extreme_search';
  data:
    | {
        kind: 'plan';
        status: { title: string };
        plan?: Array<{ title: string; todos: string[] }>;
      }
    | {
        kind: 'query';
        queryId: string;
        query: string;
        status: 'started' | 'reading_content' | 'completed' | 'error';
      }
    | {
        kind: 'source';
        queryId: string;
        source: { title: string; url: string; favicon?: string };
      }
    | {
        kind: 'content';
        queryId: string;
        content: { title: string; url: string; text: string; favicon?: string };
      }
    | {
        kind: 'code';
        codeId: string;
        title: string;
        code: string;
        status: 'running' | 'completed' | 'error';
        result?: string;
        charts?: any[];
      }
    | {
        kind: 'x_search';
        xSearchId: string;
        query: string;
        startDate: string;
        endDate: string;
        handles?: string[];
        status: 'started' | 'completed' | 'error';
        result?: {
          content: string;
          citations: any[];
          sources: Array<{ text: string; link: string; title?: string }>;
          dateRange: string;
          handles: string[];
        };
      };
};

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
  model: z.string(),
  completionTime: z.number().nullable(),
  inputTokens: z.number().nullable(),
  outputTokens: z.number().nullable(),
  totalTokens: z.number().nullable(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type academicSearchTool = InferUITool<ReturnType<typeof academicSearchTool>>;
type retrieveTool = InferUITool<typeof retrieveTool>;
type webSearch = InferUITool<ReturnType<typeof webSearchTool>>;
type extremeSearch = InferUITool<ReturnType<typeof extremeSearchTool>>;
type datetimeTool = InferUITool<typeof datetimeTool>;
type searchPDFTool = InferUITool<ReturnType<typeof createPdfSearchTool>>;

// type mcpSearchTool = InferUITool<typeof mcpSearchTool>;

export type ChatTools = {
  web_search: webSearch;
  academic_search: academicSearchTool;
  retrieve: retrieveTool;
  datetime: datetimeTool;
  extreme_search: extremeSearch;
  pdf_search: searchPDFTool;
};

export type CustomUIDataTypes = {
  appendMessage: string;
  id: string;
  'message-annotations': any;
  query_completion: {
    query: string;
    index: number;
    total: number;
    status: 'started' | 'completed' | 'error';
    resultsCount: number;
    imagesCount: number;
  };
  extreme_search: DataExtremeSearchPart['data'];
  chat_title: { title: string };
};

export type ChatMessage = UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>;

export interface Attachment {
  name: string;
  url: string;
  contentType?: string;
  mediaType?: string;
}

export enum MessageTypeEnum {
  TRANSCRIPT = 'transcript',
  FUNCTION_CALL = 'function-call',
  FUNCTION_CALL_RESULT = 'function-call-result',
  ADD_MESSAGE = 'add-message',
}

export enum MessageRoleEnum {
  USER = 'user',
  SYSTEM = 'system',
  ASSISTANT = 'assistant',
}

export enum TranscriptMessageTypeEnum {
  PARTIAL = 'partial',
  FINAL = 'final',
}

export interface TranscriptMessage extends BaseMessage {
  type: MessageTypeEnum.TRANSCRIPT;
  role: MessageRoleEnum;
  transcriptType: TranscriptMessageTypeEnum;
  transcript: string;
}

export interface FunctionCallMessage extends BaseMessage {
  type: MessageTypeEnum.FUNCTION_CALL;
  functionCall: {
    name: string;
    parameters: any;
  };
}

export interface FunctionCallResultMessage extends BaseMessage {
  type: MessageTypeEnum.FUNCTION_CALL_RESULT;
  functionCallResult: {
    forwardToClientEnabled?: boolean;
    result: any;
    [a: string]: any;
  };
}

export interface BaseMessage {
  type: MessageTypeEnum;
}

export type Message = TranscriptMessage | FunctionCallMessage | FunctionCallResultMessage;

export type AssistantOverrides = {
  assistantName: string;
  industry: string;
  voiceId: string;
  companyName: string;
  ageGroup: string;
  targetCountry: string;
  language: string;
  serviceOrProduct: string;
  questions: string;
};
