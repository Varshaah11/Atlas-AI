import { Controller, Post, Body, Inject, UseGuards, Req } from '@nestjs/common';
import {
  IConversationGateway,
  CONVERSATION_GATEWAY_TOKEN,
} from './interfaces/conversation-gateway.interface';
import { WebAuthGuard } from '@/common/guards/web-auth.guard';

@Controller('chat')
@UseGuards(WebAuthGuard)
export class ChatController {
  constructor(
    @Inject(CONVERSATION_GATEWAY_TOKEN)
    private readonly conversationGateway: IConversationGateway,
  ) {}

  @Post('message')
  async sendMessage(
    @Req() req: any,
    @Body('messageText') messageText: string,
  ): Promise<{ success: boolean; output: string }> {
    const user = req.user;

    const reply = await this.conversationGateway.handleIncomingMessage({
      userData: {
        telegramId: user.telegramId,
        username: user.username || undefined,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      },
      messageText: messageText || '',
    });

    return {
      success: true,
      output: reply,
    };
  }
}
