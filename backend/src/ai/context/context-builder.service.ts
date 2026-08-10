import { Injectable } from '@nestjs/common';
import { ATLAS_SYSTEM_PROMPT } from '../prompts';
import {
  IContextBuilderService,
  PreparedLLMContext,
  PreparedContent,
} from './interfaces/context-builder.interface';
import { ChatMessageContext } from '@/shared/interfaces';

@Injectable()
export class ContextBuilderService implements IContextBuilderService {
  buildContext(
    history: ChatMessageContext[],
    currentPrompt: string,
    systemInstructionOverride?: string,
    historyWindowLimit = 6,
  ): PreparedLLMContext {
    const systemInstruction = systemInstructionOverride || ATLAS_SYSTEM_PROMPT;

    // Enforce sliding window on conversation history
    let recentHistory = history.slice(-historyWindowLimit);

    // Prevent user message duplication if history already ends with the current user turn
    if (recentHistory.length > 0 && recentHistory[recentHistory.length - 1].role === 'user') {
      recentHistory = recentHistory.slice(0, -1);
    }

    const contents: PreparedContent[] = [];

    // Format history turns for LLM multi-turn conversation format
    for (const msg of recentHistory) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: msg.content }],
      });
    }

    // Append current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: currentPrompt }],
    });

    return {
      systemInstruction,
      contents,
      messageCount: recentHistory.length + 1,
    };
  }
}
