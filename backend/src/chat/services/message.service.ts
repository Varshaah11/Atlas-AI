import { Injectable } from '@nestjs/common';
import { Message, MessageRole } from '@prisma/client';
import { IMessageService } from '../interfaces/message-service.interface';
import { AppLogger } from '@/common/logger/logger.service';
import { PrismaService } from '@/database/prisma.service';
import { APP_CONSTANTS } from '@/shared/constants/app.constants';
import { ChatMessageContext } from '@/shared/interfaces';

@Injectable()
export class MessageService implements IMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async saveMessage(conversationId: string, role: MessageRole, content: string): Promise<Message> {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role,
        content,
      },
    });

    this.logger.debug(
      `Saved ${role} message [ID: ${message.id}] for conversation ${conversationId}`,
      'MessageService',
    );

    return message;
  }

  async getConversationHistory(
    conversationId: string,
    limit = APP_CONSTANTS.MAX_HISTORY_CONTEXT_MESSAGES,
  ): Promise<ChatMessageContext[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return messages
      .filter((m) => m.role === MessageRole.USER || m.role === MessageRole.ASSISTANT)
      .map((m) => ({
        role: m.role === MessageRole.USER ? 'user' : 'assistant',
        content: m.content,
      }));
  }
}
