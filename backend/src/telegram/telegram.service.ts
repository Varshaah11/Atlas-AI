import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';

import {
  IConversationGateway,
  CONVERSATION_GATEWAY_TOKEN,
} from '@/chat/interfaces/conversation-gateway.interface';

import { AppLogger } from '@/common/logger/logger.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf | null = null;
  private isBotActive = false;

  constructor(
    private readonly configService: ConfigService,

    @Inject(CONVERSATION_GATEWAY_TOKEN)
    private readonly conversationGateway: IConversationGateway,

    private readonly logger: AppLogger,
  ) { }

  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN is not configured. Telegram bot listener disabled.',
        'TelegramService',
      );
      return;
    }

    try {
      this.bot = new Telegraf(token);

      this.bot.catch((err) => {
        this.logger.error(
          `Telegraf runtime error: ${err}`,
          '',
          'TelegramService',
        );
      });

      this.bot.on('text', async (ctx) => {
        try {
          const from = ctx.from;
          const messageText = ctx.message.text;

          if (!from) return;

          await ctx.sendChatAction('typing');

          const reply =
            await this.conversationGateway.handleIncomingMessage({
              userData: {
                telegramId: from.id.toString(),
                username: from.username,
                firstName: from.first_name,
                lastName: from.last_name,
              },
              messageText,
            });

          await ctx.reply(reply);
        } catch (error: any) {
          this.logger.error(
            `Error handling Telegram message: ${error.message}`,
            error.stack,
            'TelegramService',
          );

          await ctx.reply(
            'An unexpected error occurred while processing your query. Please try again.',
          );
        }
      });

      // Remove any existing webhook before starting polling
      await this.bot.telegram.deleteWebhook({
        drop_pending_updates: true,
      });

      // Start long polling
      await this.bot.launch({
        dropPendingUpdates: true,
      });

      process.once('SIGINT', () => this.bot?.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot?.stop('SIGTERM'));

      this.isBotActive = true;

      this.logger.log(
        'Telegram bot successfully launched and listening for updates.',
        'TelegramService',
      );
    } catch (err: any) {
      this.isBotActive = false;

      this.logger.error(
        `Failed to launch Telegram bot: ${err.message}`,
        err.stack,
        'TelegramService',
      );
    }
  }

  isHealthy(): boolean {
    return this.isBotActive;
  }

  async onModuleDestroy() {
    if (this.bot) {
      this.bot.stop('SIGINT');
      this.isBotActive = false;

      this.logger.log(
        'Telegram bot stopped gracefully.',
        'TelegramService',
      );
    }
  }
}