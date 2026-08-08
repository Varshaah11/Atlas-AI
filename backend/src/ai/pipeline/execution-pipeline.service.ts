import { Injectable, Inject } from '@nestjs/common';
import { AgentResult } from '../agents/agent.types';
import {
  CONTEXT_BUILDER_TOKEN,
  IContextBuilderService,
} from '../context/interfaces/context-builder.interface';
import { IntentCategory } from '../conversation/conversation.types';
import { ILLMProvider, LLM_PROVIDER_TOKEN } from '../interfaces/llm-provider.interface';
import { ExecutionContext } from '../orchestrator/execution-context';
import { GENERAL_CHAT_SYSTEM_PROMPT } from '../prompts';
import { AppLogger } from '@/common/logger/logger.service';
import { FinanceService } from '@/finance/finance.service';
import { FinancialContext } from '@/finance/interfaces/financial-context.interface';
import { MemoryService } from '@/memory/memory.service';

export interface FinancialDataResult {
  isError: boolean;
  errorMessage?: string;
  promptContext?: string;
}

@Injectable()
export class ExecutionPipelineService {
  constructor(
    @Inject(CONTEXT_BUILDER_TOKEN) private readonly contextBuilder: IContextBuilderService,
    @Inject(LLM_PROVIDER_TOKEN) private readonly llmProvider: ILLMProvider,
    private readonly financeService: FinanceService,
    private readonly memoryService: MemoryService,
    private readonly logger: AppLogger,
  ) {}

  async executePipeline(context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();
    const { task, conversationHistory, userId, conversationId } = context;

    this.logger.log(
      `ExecutionPipeline executing task ${task.id} [Intent: ${task.intent}] for User ${userId} in Conversation ${conversationId}`,
      'ExecutionPipelineService',
    );

    // Retrieve user preferences and long-term memories prior to inference
    const memoryPrompt = await this.memoryService.buildMemoryPromptContext(userId);
    if (memoryPrompt) {
      this.logger.log(
        `Retrieved long-term user memory context for User ${userId}`,
        'ExecutionPipelineService',
      );
    }

    // Check if task intent is a financial intent
    const isFinancialIntent = [
      IntentCategory.STOCK_PRICE,
      IntentCategory.COMPANY_RESEARCH,
      IntentCategory.FINANCIAL_METRICS,
      IntentCategory.FINANCIAL_NEWS,
      IntentCategory.STOCK_COMPARISON,
      IntentCategory.COMPANY_COMPARISON,
    ].includes(task.intent as IntentCategory);

    if (isFinancialIntent) {
      this.logger.log(
        `[Pipeline] ${task.intent} → Financial Intent detected. Retrieving financial data via FinanceService...`,
        'ExecutionPipelineService',
      );

      const finDataResult = await this.retrieveFinancialDataResult(task);

      // Deterministic Error Short-Circuit for Invalid Tickers / Unresolved Data
      if (finDataResult.isError && finDataResult.errorMessage) {
        this.logger.log(
          `[Pipeline] Financial data error for ${task.intent}: "${finDataResult.errorMessage}". Returning deterministic error response directly (bypassing Groq).`,
          'ExecutionPipelineService',
        );

        return {
          agentName: 'ExecutionPipelineService',
          success: true,
          output: finDataResult.errorMessage,
          executionTimeMs: Date.now() - startTime,
          metadata: {
            intent: task.intent,
            financialError: true,
          },
        };
      }

      // Valid financial context retrieved: append financial context & user memory to user prompt
      let fullUserPrompt = `${task.message}\n\n${finDataResult.promptContext}`;
      if (memoryPrompt) {
        fullUserPrompt += `\n\n${memoryPrompt}`;
      }

      const preparedContext = this.contextBuilder.buildContext(conversationHistory, fullUserPrompt);

      this.logger.log(
        `[Pipeline] Valid financial context and user memory attached. Sending prompt to Groq...`,
        'ExecutionPipelineService',
      );
      const llmResult = await this.llmProvider.generateResponse(preparedContext);

      // Asynchronously trigger non-blocking user memory update
      void this.extractAndUpdateMemoryAsync(userId, task.message, llmResult.text);

      const totalPipelineTimeMs = Date.now() - startTime;
      return {
        agentName: 'ExecutionPipelineService',
        success: true,
        output: llmResult.text,
        executionTimeMs: totalPipelineTimeMs,
        metadata: {
          llmExecutionMs: llmResult.executionTimeMs,
          messageCount: preparedContext.messageCount,
          intent: task.intent,
        },
      };
    } else {
      // Non-financial intent (e.g. GENERAL_CHAT): Skip FinanceService and Finnhub completely!
      this.logger.log(
        `[Pipeline] ${task.intent} → Non-financial intent. Skipping FinanceService & Finnhub. Sending request directly to Groq...`,
        'ExecutionPipelineService',
      );

      const fullUserPrompt = memoryPrompt
        ? `${memoryPrompt}\n\n[CURRENT USER MESSAGE]\n${task.message}`
        : task.message;

      const preparedContext = this.contextBuilder.buildContext(
        conversationHistory,
        fullUserPrompt,
        GENERAL_CHAT_SYSTEM_PROMPT,
      );
      const llmResult = await this.llmProvider.generateResponse(preparedContext);

      // Asynchronously trigger non-blocking user memory update
      void this.extractAndUpdateMemoryAsync(userId, task.message, llmResult.text);

      const totalPipelineTimeMs = Date.now() - startTime;
      return {
        agentName: 'ExecutionPipelineService',
        success: true,
        output: llmResult.text,
        executionTimeMs: totalPipelineTimeMs,
        metadata: {
          llmExecutionMs: llmResult.executionTimeMs,
          messageCount: preparedContext.messageCount,
          intent: task.intent,
        },
      };
    }
  }

  private async extractAndUpdateMemoryAsync(
    userId: string,
    userMessage: string,
    assistantOutput: string,
  ): Promise<void> {
    try {
      const textLower = userMessage.toLowerCase();

      // Skip quick greetings, short messages, or simple commands
      if (
        userMessage.length < 12 ||
        /^(hi|hello|hey|thanks|thank you|good morning|help)$/i.test(textLower.trim())
      ) {
        return;
      }

      // Preference signal check to avoid unnecessary LLM calls
      const hasPreferenceSignals =
        /\b(prefer|invest|portfolio|style|risk|tolerance|follow|like|stocks|sectors|ticker|conservative|aggressive|growth|moderate|tech|technology|healthcare)\b/i.test(
          userMessage,
        );

      if (!hasPreferenceSignals) {
        return;
      }

      const extractionPrompt = `Analyze the user's message and extract durable long-term preferences or facts about the user.
Return ONLY a JSON object in this format (no markdown codeblocks, no extra text):
{
  "preferences": {
    "investmentStyle": "conservative | growth | aggressive | null",
    "riskTolerance": "low | moderate | high | null",
    "preferredSectors": ["sector1"],
    "preferredTickers": ["TICKER1"]
  },
  "memories": [
    {
      "memory": "Durable factual statement about the user",
      "category": "PREFERENCE | INTEREST | GOAL | PROFILE | FINANCIAL_CONTEXT",
      "importance": 0.8
    }
  ]
}

User Message: "${userMessage}"
Assistant Response: "${assistantOutput}"`;

      const extractionContext = this.contextBuilder.buildContext([], extractionPrompt);
      const extractionResult = await this.llmProvider.generateResponse(extractionContext);

      const cleanText = extractionResult.text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleanText);

      if (parsed.preferences) {
        await this.memoryService.updateUserPreferences(userId, parsed.preferences);
      }

      if (Array.isArray(parsed.memories)) {
        for (const mem of parsed.memories) {
          if (mem.memory && typeof mem.memory === 'string') {
            await this.memoryService.saveMemory(
              userId,
              mem.memory,
              mem.category || 'PROFILE',
              typeof mem.importance === 'number' ? mem.importance : 0.6,
            );
          }
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `Background memory extraction skipped or failed for User ${userId}: ${error.message}`,
        'ExecutionPipelineService',
      );
    }
  }

  private async retrieveFinancialDataResult(task: any): Promise<FinancialDataResult> {
    const intent = task.intent as IntentCategory;
    const entities = task.entities || {};

    try {
      if (
        intent === IntentCategory.STOCK_COMPARISON ||
        intent === IntentCategory.COMPANY_COMPARISON
      ) {
        const comparisonContext = await this.retrieveComparisonData(task);
        return { isError: false, promptContext: comparisonContext };
      }

      // Single ticker / company retrieval
      const targetQuery =
        entities.tickers?.[0] ||
        entities.companies?.[0] ||
        this.extractTargetFromMessage(task.message);

      if (!targetQuery) {
        return {
          isError: true,
          errorMessage: `I couldn't identify a valid company name or stock ticker from your request. Please specify a ticker or company (e.g., AAPL or Microsoft).`,
        };
      }

      const options = {
        includeQuote:
          intent === IntentCategory.STOCK_PRICE ||
          intent === IntentCategory.COMPANY_RESEARCH ||
          intent === IntentCategory.FINANCIAL_METRICS,
        includeProfile: true,
        includeMetrics:
          intent === IntentCategory.FINANCIAL_METRICS || intent === IntentCategory.COMPANY_RESEARCH,
        includeNews:
          intent === IntentCategory.FINANCIAL_NEWS || intent === IntentCategory.COMPANY_RESEARCH,
      };

      const finContext = await this.financeService.getFinancialContext(targetQuery, options);

      if (finContext.error) {
        return {
          isError: true,
          errorMessage: finContext.error,
        };
      }

      return {
        isError: false,
        promptContext: this.formatFinancialContext(finContext),
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to retrieve financial data for task ${task.id}: ${error.message}`,
        error.stack,
        'ExecutionPipelineService',
      );
      return {
        isError: true,
        errorMessage: `I couldn't retrieve financial data right now. Please try again in a moment.`,
      };
    }
  }

  private async retrieveComparisonData(task: any): Promise<string> {
    const entities = task.entities || {};
    let targets: string[] = [];

    if (entities.tickers && entities.tickers.length > 0) {
      targets.push(...entities.tickers);
    }
    if (entities.companies && entities.companies.length > 0) {
      targets.push(...entities.companies);
    }

    // Deduplicate targets
    targets = Array.from(new Set(targets));

    if (targets.length < 2) {
      // Parse message for "X vs Y" or "Compare X and Y"
      const match = task.message.match(/compare\s+([^and|vs]+)\s+(?:and|vs\.?|versus)\s+(.+)/i);
      if (match) {
        targets = [match[1].trim(), match[2].trim()];
      }
    }

    if (targets.length === 0) {
      return `[FINANCIAL DATA STATUS]\nCould not extract target companies to compare from the user prompt.`;
    }

    const contexts = await Promise.all(
      targets.slice(0, 3).map((target) =>
        this.financeService.getFinancialContext(target, {
          includeQuote: true,
          includeProfile: true,
          includeMetrics: true,
          includeNews: false,
        }),
      ),
    );

    const formattedContexts = contexts
      .map((ctx) => this.formatFinancialContext(ctx))
      .join('\n\n---\n\n');

    return `[RETRIEVED FINANCIAL DATA - AUTHORITATIVE SOURCE FOR COMPARISON]\n\n${formattedContexts}`;
  }

  private extractTargetFromMessage(message: string): string | null {
    // 1. Check explicit ticker matches with optional $ prefix up to 15 chars
    const tickerMatch = message.match(/\b\$?([A-Za-z0-9]{1,15})\b/);
    if (tickerMatch) {
      const candidate = tickerMatch[1].trim();
      const upper = candidate.toUpperCase();
      if (
        !['WHAT', 'WHATS', 'TELL', 'SHOW', 'ME', 'IS', 'IT', 'THE', 'AND', 'FOR'].includes(upper)
      ) {
        return candidate;
      }
    }

    const match = message.match(/\b([a-zA-Z0-9\s]{2,20})\b/);
    return match ? match[1].trim() : null;
  }

  private formatFinancialContext(ctx: FinancialContext): string {
    if (ctx.error) {
      return `[FINANCIAL DATA STATUS]\nSymbol: ${ctx.symbol}\nStatus: ${ctx.error}`;
    }

    const lines: string[] = [];
    lines.push(`[RETRIEVED FINANCIAL DATA - AUTHORITATIVE SOURCE]`);
    lines.push(`Symbol: ${ctx.symbol}`);
    if (ctx.companyName) lines.push(`Company Name: ${ctx.companyName}`);
    if (ctx.profile?.industry) lines.push(`Industry: ${ctx.profile.industry}`);
    if (ctx.profile?.exchange) lines.push(`Exchange: ${ctx.profile.exchange}`);
    if (ctx.profile?.country) lines.push(`Country: ${ctx.profile.country}`);

    if (ctx.quote) {
      lines.push(`Current Price: $${ctx.quote.currentPrice}`);
      lines.push(`Daily Change: $${ctx.quote.change} (${ctx.quote.percentChange}%)`);
      lines.push(`Day High / Low: $${ctx.quote.high} / $${ctx.quote.low}`);
      lines.push(`Open / Previous Close: $${ctx.quote.open} / $${ctx.quote.previousClose}`);
    }

    if (ctx.metrics) {
      lines.push(`Financial Metrics:`);
      if (ctx.metrics.marketCap !== undefined)
        lines.push(`  - Market Cap: $${ctx.metrics.marketCap}M`);
      if (ctx.metrics.peRatio !== undefined) lines.push(`  - P/E Ratio: ${ctx.metrics.peRatio}`);
      if (ctx.metrics.fiftyTwoWeekHigh !== undefined)
        lines.push(`  - 52-Week High: $${ctx.metrics.fiftyTwoWeekHigh}`);
      if (ctx.metrics.fiftyTwoWeekLow !== undefined)
        lines.push(`  - 52-Week Low: $${ctx.metrics.fiftyTwoWeekLow}`);
    }

    if (ctx.news && ctx.news.length > 0) {
      lines.push(`Recent News:`);
      ctx.news.forEach((item, index) => {
        lines.push(`  ${index + 1}. ${item.headline} (${item.source || 'News'})`);
        if (item.summary) lines.push(`     Summary: ${item.summary.slice(0, 150)}...`);
      });
    }

    lines.push(`Data Source: Finnhub API | Timestamp: ${ctx.retrievedAt}`);
    return lines.join('\n');
  }
}
