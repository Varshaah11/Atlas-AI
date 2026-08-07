import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { PreparedLLMContext } from './context/interfaces/context-builder.interface';
import { ILLMProvider, LLMExecutionResult } from './interfaces/llm-provider.interface';
import { AppLogger } from '@/common/logger/logger.service';

@Injectable()
export class GroqService implements ILLMProvider, OnModuleInit {
  private groq: Groq | null = null;
  private readonly modelName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.modelName = this.configService.get<string>('GROQ_MODEL') || 'llama-3.3-70b-versatile';
  }

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'GROQ_API_KEY missing. LLM provider will run in fallback mode.',
        'GroqService',
      );
      return;
    }

    this.groq = new Groq({
      apiKey,
    });

    this.logger.log(
      `Groq API client initialized successfully. Model: ${this.modelName}`,
      'GroqService',
    );
  }

  async isHealthy(): Promise<boolean> {
    return !!this.groq;
  }

  async generateResponse(context: PreparedLLMContext): Promise<LLMExecutionResult> {
    const startTime = Date.now();

    if (!this.groq) {
      this.logger.warn('Groq client not initialized. Returning fallback response.', 'GroqService');

      return {
        text: 'I am currently unable to access the market intelligence engine (Groq API key unconfigured). Please contact your administrator.',
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
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

      const completion = await this.groq.chat.completions.create({
        messages,
        model: this.modelName,
        temperature: 0.2,
      });

      const executionTimeMs = Date.now() - startTime;
      const responseText = completion.choices[0]?.message?.content;

      return {
        text: responseText ?? 'Unable to generate financial analysis response at this time.',
        executionTimeMs,
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;

      this.logger.error(
        `Error executing Groq LLM query: ${error.message}`,
        error.stack,
        'GroqService',
      );

      return {
        text: 'An error occurred while processing your financial analysis request. Please try again.',
        executionTimeMs,
      };
    }
  }
}
