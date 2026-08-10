import { Message, MessageRole } from '@prisma/client';
import { ChatMessageContext } from '@/shared/interfaces';

export interface IMessageService {
  saveMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<Message>;
  getConversationHistory(conversationId: string, limit?: number): Promise<ChatMessageContext[]>;
}

export const MESSAGE_SERVICE_TOKEN = 'MESSAGE_SERVICE_TOKEN';
