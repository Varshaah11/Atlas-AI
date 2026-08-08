import { Module } from '@nestjs/common';
import { ConversationGateway } from './gateways/conversation.gateway';
import { CHAT_SERVICE_TOKEN } from './interfaces/chat-service.interface';
import { CONVERSATION_GATEWAY_TOKEN } from './interfaces/conversation-gateway.interface';
import { CONVERSATION_SERVICE_TOKEN } from './interfaces/conversation-service.interface';
import { MESSAGE_SERVICE_TOKEN } from './interfaces/message-service.interface';
import { ChatService } from './services/chat.service';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { AIModule } from '@/ai/ai.module';
import { AppLogger } from '@/common/logger/logger.service';
import { UsersModule } from '@/users/users.module';

@Module({
  imports: [UsersModule, AIModule],
  providers: [
    AppLogger,
    ConversationGateway,
    ChatService,
    ConversationService,
    MessageService,
    {
      provide: CONVERSATION_GATEWAY_TOKEN,
      useExisting: ConversationGateway,
    },
    {
      provide: CHAT_SERVICE_TOKEN,
      useExisting: ChatService,
    },
    {
      provide: CONVERSATION_SERVICE_TOKEN,
      useExisting: ConversationService,
    },
    {
      provide: MESSAGE_SERVICE_TOKEN,
      useExisting: MessageService,
    },
  ],
  exports: [
    ConversationGateway,
    CONVERSATION_GATEWAY_TOKEN,
    ChatService,
    CHAT_SERVICE_TOKEN,
    ConversationService,
    CONVERSATION_SERVICE_TOKEN,
    MessageService,
    MESSAGE_SERVICE_TOKEN,
  ],
})
export class ChatModule {}
