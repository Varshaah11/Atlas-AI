import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import {
  IConversationGateway,
  CONVERSATION_GATEWAY_TOKEN,
} from '@/chat/interfaces/conversation-gateway.interface';
import { AppLogger } from '@/common/logger/logger.service';
import { DocumentIngestionService } from '@/documents/document-ingestion.service';
import { IUserService, USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';
import { normalizeTelegramText } from './telegram.utils';

@Injectable()
export class TelegramService implements OnApplicationBootstrap, OnModuleDestroy {
  private bot: Telegraf | null = null;
  private isBotActive = false;

  constructor(
    private readonly configService: ConfigService,

    @Inject(CONVERSATION_GATEWAY_TOKEN)
    private readonly conversationGateway: IConversationGateway,

    @Inject(USER_SERVICE_TOKEN)
    private readonly userService: IUserService,

    private readonly documentIngestionService: DocumentIngestionService,

    private readonly logger: AppLogger,
  ) { }

  async onApplicationBootstrap() {
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
        this.logger.error(`Telegraf runtime error: ${err}`, '', 'TelegramService');
      });

      this.bot.on('text', async (ctx) => {
        await this.handleTextMessage(ctx);
      });

      this.bot.on('document', async (ctx) => {
        await this.handleDocumentMessage(ctx);
      });

      // Remove any existing webhook before starting polling
      await this.bot.telegram.deleteWebhook({
        drop_pending_updates: true,
      });

      // Launch long polling asynchronously so it does not block NestJS app.listen()
      this.bot
        .launch({
          dropPendingUpdates: true,
        })
        .then(() => {
          this.logger.log('Telegram bot polling loop stopped.', 'TelegramService');
        })
        .catch((err: any) => {
          this.isBotActive = false;
          this.logger.error(
            `Telegram bot polling error: ${err.message}`,
            err.stack,
            'TelegramService',
          );
        });

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

  async handleTextMessage(ctx: any): Promise<void> {
    try {
      const from = ctx.from;
      const messageText = ctx.message?.text;

      if (!from) return;

      const trimmedText = messageText ? messageText.trim() : '';

      // Intercept deep-link account linking command: /start link_<TOKEN> or /link <TOKEN>
      if (trimmedText.startsWith('/start link_') || trimmedText.startsWith('/link ')) {
        const rawToken = trimmedText.startsWith('/start link_')
          ? trimmedText.substring(12).trim()
          : trimmedText.substring(6).trim();

        if (rawToken) {
          const linkResult = await this.userService.consumeTelegramLinkToken(
            rawToken,
            from.id.toString(),
          );
          await ctx.reply(linkResult.message);
          return;
        }
      }

      await ctx.sendChatAction('typing');

      const reply = await this.conversationGateway.handleIncomingMessage({
        userData: {
          telegramId: from.id.toString(),
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
        },
        messageText,
      });

      const formattedReply = normalizeTelegramText(reply);
      await ctx.reply(formattedReply);

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
  }

  async handleDocumentMessage(ctx: any): Promise<void> {
    try {
      const from = ctx.from;
      const doc = ctx.message?.document;

      if (!from || !doc) return;

      // 1. Accept ONLY MIME type: application/pdf
      if (doc.mime_type !== 'application/pdf') {
        this.logger.warn(
          `Rejected non-PDF file upload from Telegram User ${from.id}: ${doc.mime_type}`,
          'TelegramService',
        );
        await ctx.reply('❌ Only PDF documents are supported. Please upload a PDF file.');
        return;
      }

      // 2. Enforce DOCUMENT_MAX_FILE_SIZE_MB (Default: 10 MB)
      const maxMb = Number(this.configService.get<string>('DOCUMENT_MAX_FILE_SIZE_MB') ?? '10');
      const maxSizeBytes = maxMb * 1024 * 1024;

      if (doc.file_size && doc.file_size > maxSizeBytes) {
        this.logger.warn(
          `Rejected oversized PDF upload from Telegram User ${from.id}: ${doc.file_size} bytes (max: ${maxSizeBytes} bytes)`,
          'TelegramService',
        );
        await ctx.reply(`❌ File exceeds the maximum allowed size of ${maxMb}MB.`);
        return;
      }

      // 3. Resolve Telegram user to database User ID
      const user = await this.userService.getOrCreateUser({
        telegramId: from.id.toString(),
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
      });

      // 4. Save files under DOCUMENT_STORAGE_PATH (Default: ./data/documents) with a UUID-based stored filename
      const storageDir =
        this.configService.get<string>('DOCUMENT_STORAGE_PATH') ?? './data/documents';
      await fs.promises.mkdir(storageDir, { recursive: true });

      const storedFilename = `${crypto.randomUUID()}.pdf`;
      const filePath = path.join(storageDir, storedFilename);
      const originalFilename = doc.file_name || 'document.pdf';

      // 5. Download document from Telegram link
      const fileLink = await ctx.telegram.getFileLink(doc.file_id);
      const response = await fetch(fileLink.href || fileLink.toString());

      if (!response.ok) {
        throw new Error(`Failed to download file from Telegram: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.promises.writeFile(filePath, buffer);

      // 6. Immediately reply
      await ctx.reply("📄 I received your document. I'm processing it now.");

      // 7. Ingestion runs asynchronously so the Telegram handler does not block
      void (async () => {
        try {
          await this.documentIngestionService.ingest(user.id, filePath, originalFilename);
          await ctx.reply('✅ Your document is ready. You can now ask questions about it.');
        } catch (err: any) {
          this.logger.error(
            `Document ingestion failed for user ${user.id} (file: ${originalFilename}): ${err.message}`,
            err.stack,
            'TelegramService',
          );
          await ctx.reply(
            "❌ I couldn't process that PDF. Please make sure it contains readable text.",
          );
        }
      })();
    } catch (error: any) {
      this.logger.error(
        `Error handling Telegram document message: ${error.message}`,
        error.stack,
        'TelegramService',
      );
      await ctx.reply(
        "❌ I couldn't process that PDF. Please make sure it contains readable text.",
      );
    }
  }

  /**
   * Sends an outbound proactive notification to a user's Telegram account.
   *
   * @param telegramId Target user's Telegram ID
   * @param text Message text to deliver
   * @returns true if delivered successfully, false if delivery fails or bot is unconfigured
   */
  async sendNotification(telegramId: string, text: string): Promise<boolean> {
    if (!telegramId || typeof telegramId !== 'string' || telegramId.trim().length === 0) {
      this.logger.warn(
        'sendNotification called with invalid or empty telegramId',
        'TelegramService',
      );
      return false;
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      this.logger.warn(
        `sendNotification called with empty text for user ${telegramId}`,
        'TelegramService',
      );
      return false;
    }

    if (!this.bot) {
      this.logger.warn(
        `Cannot send notification to ${telegramId}: Telegram bot is not initialized or configured.`,
        'TelegramService',
      );
      return false;
    }

    const cleanTelegramId = telegramId.trim();
    const cleanText = text.trim();

    if (cleanTelegramId.startsWith('web-')) {
      this.logger.warn(
        `Cannot send Telegram notification to synthetic web identity '${cleanTelegramId}'. User has no linked Telegram chat ID.`,
        'TelegramService',
      );
      return false;
    }

    try {
      const formattedText = normalizeTelegramText(cleanText);
      await this.bot.telegram.sendMessage(cleanTelegramId, formattedText);
      this.logger.log(
        `Successfully sent Telegram notification to user ${cleanTelegramId}`,
        'TelegramService',
      );
      return true;
    } catch (err: any) {
      this.logger.error(
        `Failed to send Telegram notification to user ${cleanTelegramId}: ${err.message}`,
        err.stack,
        'TelegramService',
      );
      return false;
    }
  }

  isHealthy(): boolean {
    return this.isBotActive;
  }

  async onModuleDestroy() {
    if (this.bot) {
      this.bot.stop('SIGINT');
      this.isBotActive = false;

      this.logger.log('Telegram bot stopped gracefully.', 'TelegramService');
    }
  }
}
