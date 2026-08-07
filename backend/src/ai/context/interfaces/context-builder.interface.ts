import { ChatMessageContext } from '@/shared/interfaces';

export interface PreparedContentPart {
  text: string;
}

export interface PreparedContent {
  role: 'user' | 'model';
  parts: PreparedContentPart[];
}

export interface PreparedLLMContext {
  systemInstruction: string;
  contents: PreparedContent[];
  messageCount: number;
}

export interface IContextBuilderService {
  buildContext(
    history: ChatMessageContext[],
    currentPrompt: string,
    systemInstructionOverride?: string,
    historyWindowLimit?: number,
  ): PreparedLLMContext;
}

export const CONTEXT_BUILDER_TOKEN = 'CONTEXT_BUILDER_TOKEN';
