import { Injectable } from '@nestjs/common';
import { PreparedLLMContext } from './context/interfaces/context-builder.interface';
import { ILLMProvider, LLMExecutionResult } from './interfaces/llm-provider.interface';
import { GroqService } from './groq.service';
import { CerebrasService } from './cerebras.service';
import { AppLogger } from '@/common/logger/logger.service';

@Injectable()
export class FallbackLLMProvider implements ILLMProvider {
  constructor(
    private readonly groqService: GroqService,
    private readonly cerebrasService: CerebrasService,
    private readonly logger: AppLogger,
  ) {}

  async isHealthy(): Promise<boolean> {
    return (await this.groqService.isHealthy()) || (await this.cerebrasService.isHealthy());
  }

  async generateResponse(context: PreparedLLMContext): Promise<LLMExecutionResult> {
    this.logger.log('[LLM] Groq request started', 'FallbackLLMProvider');

    try {
      const result = await this.groqService.generateResponse(context);

      const isRateLimitedOrError =
        /temporarily rate limited|unable to access the market intelligence engine|an error occurred while processing your financial analysis/i.test(
          result.text,
        );

      if (!isRateLimitedOrError) {
        this.logger.log('[LLM] Groq request succeeded', 'FallbackLLMProvider');
        return result;
      }

      this.logger.warn(
        `[LLM] Groq returned rate limit or provider error. Falling back to Cerebras...`,
        'FallbackLLMProvider',
      );
    } catch (error: any) {
      this.logger.warn(
        `[LLM] Groq request failed: ${error.message}. Falling back to Cerebras...`,
        'FallbackLLMProvider',
      );
    }

    if (await this.cerebrasService.isHealthy()) {
      try {
        this.logger.log('[LLM] Falling back to Cerebras', 'FallbackLLMProvider');
        const fallbackResult = await this.cerebrasService.generateResponse(context);
        this.logger.log('[LLM] Cerebras fallback succeeded', 'FallbackLLMProvider');
        return fallbackResult;
      } catch (fallbackError: any) {
        this.logger.error(
          `[LLM] Cerebras fallback also failed: ${fallbackError.message}`,
          fallbackError.stack,
          'FallbackLLMProvider',
        );
      }
    } else {
      this.logger.warn(
        '[LLM] Cerebras fallback provider is unconfigured or unhealthy.',
        'FallbackLLMProvider',
      );
    }

    return {
      text: 'The AI analysis service is temporarily rate limited by the LLM providers. Please wait a moment and try again.',
      executionTimeMs: 0,
    };
  }
}
