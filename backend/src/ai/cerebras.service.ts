import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PreparedLLMContext } from './context/interfaces/context-builder.interface';
import { ILLMProvider, LLMExecutionResult } from './interfaces/llm-provider.interface';
import { AppLogger } from '@/common/logger/logger.service';

@Injectable()
export class CerebrasService implements ILLMProvider, OnModuleInit {
  private apiKey: string | null = null;
  private readonly modelName: string;
  private readonly baseUrl = 'https://api.cerebras.ai/v1';

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.modelName = this.configService.get<string>('CEREBRAS_MODEL') || 'gpt-oss-120b';
  }

  onModuleInit(): void {
    this.apiKey = this.configService.get<string>('CEREBRAS_API_KEY') || null;

    if (!this.apiKey) {
      this.logger.warn(
        'CEREBRAS_API_KEY missing. Cerebras fallback provider unconfigured.',
        'CerebrasService',
      );
      return;
    }

    this.logger.log(
      `Cerebras API provider initialized successfully. Model: ${this.modelName}`,
      'CerebrasService',
    );
  }

  async isHealthy(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generateResponse(context: PreparedLLMContext): Promise<LLMExecutionResult> {
    const startTime = Date.now();

    if (!this.apiKey) {
      this.logger.warn('Cerebras API key unconfigured.', 'CerebrasService');
      return {
        text: 'Cerebras fallback provider is unconfigured.',
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      const messages = [
        {
          role: 'system',
          content: context.systemInstruction,
        },
      ];

      for (const content of context.contents) {
        const role = content.role === 'model' ? 'assistant' : 'user';
        const textContent = content.parts.map((p) => p.text).join('\n');
        messages.push({
          role,
          content: textContent,
        });
      }

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          temperature: 0.2,
          max_tokens: 1000,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Cerebras API error ${res.status}: ${errText}`);
      }

      const data: any = await res.json();
      const executionTimeMs = Date.now() - startTime;
      const responseText = data.choices?.[0]?.message?.content;

      return {
        text: responseText ?? 'Unable to generate response from Cerebras.',
        executionTimeMs,
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      this.logger.error(
        `Error executing Cerebras LLM query: ${error.message}`,
        error.stack,
        'CerebrasService',
      );
      throw error;
    }
  }
}
