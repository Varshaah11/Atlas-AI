import { Controller, Get, Inject } from '@nestjs/common';
import { ILLMProvider, LLM_PROVIDER_TOKEN } from '@/ai/interfaces/llm-provider.interface';
import { PrismaService } from '@/database/prisma.service';
import { FinanceService } from '@/finance/finance.service';
import { APP_CONSTANTS } from '@/shared/constants/app.constants';
import { ApiResponse, createApiResponse } from '@/shared/interfaces';
import { TelegramService } from '@/telegram/telegram.service';

export interface SystemStats {
  totalUsers: number;
  totalConversations: number;
}

export interface HealthCheckData {
  status: 'ok' | 'degraded';
  version: string;
  environment: string;
  database: 'connected' | 'disconnected';
  telegram: 'connected' | 'disconnected';
  groq: 'connected' | 'disconnected';
  finnhub: 'connected' | 'disconnected';
  stats: SystemStats;
  uptimeSeconds: number;
}

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    @Inject(LLM_PROVIDER_TOKEN) private readonly llmProvider: ILLMProvider,
    private readonly financeService: FinanceService,
  ) {}

  @Get()
  async checkHealth(): Promise<ApiResponse<HealthCheckData>> {
    const isDbConnected = await this.prisma.isHealthy();
    const isTelegramHealthy = this.telegramService.isHealthy();
    const isGroqHealthy = await this.llmProvider.isHealthy();
    const isFinnhubHealthy = await this.financeService.isHealthy();

    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    let totalUsers = 0;
    let totalConversations = 0;

    if (isDbConnected) {
      try {
        [totalUsers, totalConversations] = await Promise.all([
          this.prisma.user.count(),
          this.prisma.conversation.count(),
        ]);
      } catch {
        // Fallback to 0 if count query fails
      }
    }

    const isSystemOk = isDbConnected;

    const healthData: HealthCheckData = {
      status: isSystemOk ? 'ok' : 'degraded',
      version: APP_CONSTANTS.APP_VERSION,
      environment: process.env.NODE_ENV || 'development',
      database: isDbConnected ? 'connected' : 'disconnected',
      telegram: isTelegramHealthy ? 'connected' : 'disconnected',
      groq: isGroqHealthy ? 'connected' : 'disconnected',
      finnhub: isFinnhubHealthy ? 'connected' : 'disconnected',
      stats: {
        totalUsers,
        totalConversations,
      },
      uptimeSeconds,
    };

    return createApiResponse(
      isSystemOk,
      isSystemOk
        ? 'Atlas AI health check completed successfully.'
        : 'System health check completed with service warnings.',
      healthData,
    );
  }
}
