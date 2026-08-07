import { Injectable, Inject } from '@nestjs/common';
import { IChatService, CHAT_SERVICE_TOKEN } from '../interfaces/chat-service.interface';
import { IConversationGateway } from '../interfaces/conversation-gateway.interface';
import { AppLogger } from '@/common/logger/logger.service';
import { ProcessMessageDto } from '@/shared/interfaces';

@Injectable()
export class ConversationGateway implements IConversationGateway {
  constructor(
    @Inject(CHAT_SERVICE_TOKEN) private readonly chatService: IChatService,
    private readonly logger: AppLogger,
  ) {}

  async handleIncomingMessage(dto: ProcessMessageDto): Promise<string> {
    const { userData, messageText } = dto;

    if (!userData || !userData.telegramId) {
      this.logger.warn('Gateway received request without valid user data.', 'ConversationGateway');
      return 'Unable to process your request due to missing user credentials.';
    }

    // Input Validation: Check for empty or whitespace-only messages
    const normalizedText = messageText ? messageText.trim() : '';

    if (!normalizedText) {
      this.logger.warn(
        `Received empty message from Telegram User ${userData.telegramId}`,
        'ConversationGateway',
      );
      return 'Please provide a valid text query or question for financial analysis.';
    }

    this.logger.debug(
      `Gateway validated and normalized request for User ${userData.telegramId}`,
      'ConversationGateway',
    );

    // Forward validated request to ChatService orchestrator
    return this.chatService.processMessage({
      userData,
      messageText: normalizedText,
    });
  }
}
