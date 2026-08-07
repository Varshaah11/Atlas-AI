import { Injectable } from '@nestjs/common';
import { Conversation, ConversationStatus } from '@prisma/client';
import { IConversationService } from '../interfaces/conversation-service.interface';
import { AppLogger } from '@/common/logger/logger.service';
import { PrismaService } from '@/database/prisma.service';
import { APP_CONSTANTS } from '@/shared/constants/app.constants';

@Injectable()
export class ConversationService implements IConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async getOrCreateActiveConversation(userId: string): Promise<Conversation> {
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        userId,
        status: ConversationStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          title: APP_CONSTANTS.DEFAULT_CONVERSATION_TITLE,
          status: ConversationStatus.ACTIVE,
        },
      });
      this.logger.log(
        `Created new active conversation ${conversation.id} for user ${userId}`,
        'ConversationService',
      );
    }

    return conversation;
  }

  async closeConversation(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.ARCHIVED },
    });
    this.logger.log(`Closed conversation ${conversationId}`, 'ConversationService');
  }
}
