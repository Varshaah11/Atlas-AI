import { ConfigService } from '@nestjs/config';
import { ConversationTask } from './conversation-task';
import { AppLogger } from '@/common/logger/logger.service';
import { ChatMessageContext } from '@/shared/interfaces';

export interface ExecutionContext {
  conversationId: string;
  userId: string;
  conversationHistory: ChatMessageContext[];
  metadata: Record<string, unknown>;
  task: ConversationTask;
  services: {
    logger: AppLogger;
    config: ConfigService;
  };
}
