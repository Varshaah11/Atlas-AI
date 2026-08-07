import { ExtractedEntities, IntentCategory } from '../conversation/conversation.types';

export interface ConversationTask {
  id: string;
  conversationId: string;
  userId: string;
  intent: IntentCategory;
  message: string;
  entities: ExtractedEntities;
  needsClarification: boolean;
  clarificationQuestion?: string;
  createdAt: string;
}
