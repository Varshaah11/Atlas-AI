import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { BriefingFrequency, NotificationLog, ScheduledBriefing } from '@prisma/client';
import { UpdateBriefingConfigDto } from './dto/update-briefing-config.dto';
import { GroqService } from '@/ai/groq.service';
import { MARKET_BRIEFING_SYSTEM_PROMPT } from '@/ai/prompts/atlas-system.prompt';
import { AppLogger } from '@/common/logger/logger.service';
import { PrismaService } from '@/database/prisma.service';
import { FinanceService } from '@/finance/finance.service';
import { TelegramService } from '@/telegram/telegram.service';
import { IUserService, USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';

const MAX_BRIEFING_SYMBOLS = 10;

@Injectable()
export class BriefingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly groqService: GroqService,
    private readonly telegramService: TelegramService,
    @Inject(USER_SERVICE_TOKEN) private readonly userService: IUserService,
    private readonly logger: AppLogger,
  ) {}

  async getConfig(userId: string): Promise<ScheduledBriefing> {
    let config = await this.prisma.scheduledBriefing.findUnique({
      where: { userId },
    });

    if (!config) {
      config = await this.prisma.scheduledBriefing.create({
        data: {
          userId,
          frequency: BriefingFrequency.DAILY_MORNING,
          preferredTime: '08:00',
          symbols: [],
          includeNews: true,
          includeSec: true,
          deliverTelegram: true,
          enabled: true,
        },
      });
      this.logger.log(`Created default ScheduledBriefing for user ${userId}`, 'BriefingsService');
    }

    return config;
  }

  async updateConfig(userId: string, dto: UpdateBriefingConfigDto): Promise<ScheduledBriefing> {
    await this.getConfig(userId);

    let processedSymbols: string[] | undefined = undefined;

    if (dto.symbols !== undefined && dto.symbols !== null) {
      if (!Array.isArray(dto.symbols)) {
        throw new BadRequestException('symbols must be an array of stock ticker strings.');
      }

      if (dto.symbols.length > MAX_BRIEFING_SYMBOLS) {
        throw new BadRequestException(
          `Maximum of ${MAX_BRIEFING_SYMBOLS} tracked symbols allowed per briefing.`,
        );
      }

      const resolvedList: string[] = [];
      for (const sym of dto.symbols) {
        if (!sym || typeof sym !== 'string' || sym.trim().length === 0) {
          throw new BadRequestException('All symbol entries must be non-empty strings.');
        }

        const resolved = await this.financeService.resolveTicker(sym);
        if (!resolved) {
          throw new BadRequestException(`Invalid or unresolvable stock symbol: "${sym}".`);
        }
        resolvedList.push(resolved.toUpperCase());
      }

      // Deduplicate symbols while maintaining order
      processedSymbols = Array.from(new Set(resolvedList));
    }

    const updated = await this.prisma.scheduledBriefing.upsert({
      where: { userId },
      update: {
        ...(dto.frequency ? { frequency: dto.frequency } : {}),
        ...(dto.preferredTime ? { preferredTime: dto.preferredTime } : {}),
        ...(processedSymbols !== undefined ? { symbols: processedSymbols } : {}),
        ...(dto.includeNews !== undefined ? { includeNews: dto.includeNews } : {}),
        ...(dto.includeSec !== undefined ? { includeSec: dto.includeSec } : {}),
        ...(dto.deliverTelegram !== undefined ? { deliverTelegram: dto.deliverTelegram } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
      create: {
        userId,
        frequency: dto.frequency ?? BriefingFrequency.DAILY_MORNING,
        preferredTime: dto.preferredTime ?? '08:00',
        symbols: processedSymbols ?? [],
        includeNews: dto.includeNews ?? true,
        includeSec: dto.includeSec ?? true,
        deliverTelegram: dto.deliverTelegram ?? true,
        enabled: dto.enabled ?? true,
      },
    });

    this.logger.log(`Updated ScheduledBriefing config for user ${userId}`, 'BriefingsService');
    return updated;
  }

  async triggerNow(userId: string): Promise<{
    success: boolean;
    briefing: string;
    deliveredToTelegram: boolean;
    config: ScheduledBriefing;
  }> {
    const config = await this.getConfig(userId);

    let symbolsToFetch: string[] = config.symbols;

    // Fallback to UserPreference.preferredTickers if briefing symbols array is empty
    if (!symbolsToFetch || symbolsToFetch.length === 0) {
      const userPref = await this.prisma.userPreference.findUnique({ where: { userId } });
      if (userPref && userPref.preferredTickers && userPref.preferredTickers.length > 0) {
        symbolsToFetch = userPref.preferredTickers;
      }
    }

    if (!symbolsToFetch || symbolsToFetch.length === 0) {
      throw new BadRequestException(
        'No tracked stock symbols configured. Please add stock symbols to your briefing configuration.',
      );
    }

    const activeSymbols = symbolsToFetch.slice(0, MAX_BRIEFING_SYMBOLS);

    // Fetch financial context in parallel using existing FinanceService methods
    const contextResults = await Promise.all(
      activeSymbols.map((symbol) =>
        this.financeService.getFinancialContext(symbol, {
          includeQuote: true,
          includeProfile: true,
          includeNews: config.includeNews,
          includeMetrics: true,
          includeSecFilings: config.includeSec,
        }),
      ),
    );

    const contextPayload = JSON.stringify(contextResults, null, 2);
    const userPrompt = `Generate a comprehensive executive market briefing for the following tracked companies:\n\n[RELEVANT FINANCIAL CONTEXT]:\n${contextPayload}`;

    const llmResponse = await this.groqService.generateResponse({
      systemInstruction: MARKET_BRIEFING_SYSTEM_PROMPT,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      messageCount: 1,
    });

    const briefingText = llmResponse.text;

    // Resolve Telegram identity for outbound delivery
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    let deliveredToTelegram = false;
    let deliveryError: string | null = null;

    if (config.deliverTelegram && user) {
      const targetTelegramId = await this.userService.getTelegramChatId(user);
      if (targetTelegramId) {
        try {
          deliveredToTelegram = await this.telegramService.sendNotification(
            targetTelegramId,
            briefingText,
          );
          if (!deliveredToTelegram) {
            deliveryError = 'Telegram bot notification delivery failed or bot is unconfigured.';
          }
        } catch (err: any) {
          deliveredToTelegram = false;
          deliveryError = err.message || 'Error occurred while delivering Telegram notification.';
        }
      } else {
        deliveryError = 'User has no linked Telegram chat ID.';
      }
    }

    // Persist NotificationLog record
    await this.prisma.notificationLog.create({
      data: {
        userId,
        type: 'BRIEFING',
        title: 'Atlas AI Market Briefing',
        content: briefingText,
        channel: deliveredToTelegram ? 'TELEGRAM' : 'WEB',
        delivered: config.deliverTelegram ? deliveredToTelegram : true,
        error: deliveryError,
      },
    });

    // Update lastDeliveredAt timestamp on config
    await this.prisma.scheduledBriefing.update({
      where: { userId },
      data: { lastDeliveredAt: new Date() },
    });

    this.logger.log(
      `Triggered briefing for user ${userId} (Delivered to Telegram: ${deliveredToTelegram})`,
      'BriefingsService',
    );

    return {
      success: true,
      briefing: briefingText,
      deliveredToTelegram,
      config,
    };
  }

  async getHistory(userId: string, limit = 20): Promise<NotificationLog[]> {
    return this.prisma.notificationLog.findMany({
      where: {
        userId,
        type: 'BRIEFING',
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });
  }
}
