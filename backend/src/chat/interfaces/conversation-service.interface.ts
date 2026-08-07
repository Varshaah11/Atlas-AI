import { Conversation } from '@prisma/client';

export interface IConversationService {
  getOrCreateActiveConversation(userId: string): Promise<Conversation>;
  closeConversation(conversationId: string): Promise<void>;
}

export const CONVERSATION_SERVICE_TOKEN = 'CONVERSATION_SERVICE_TOKEN';
