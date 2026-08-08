import { Injectable, OnModuleInit } from '@nestjs/common';
import { IntentCategory } from '../conversation/conversation.types';
import { ConversationTask } from '../orchestrator/conversation-task';
import { ExecutionContext } from '../orchestrator/execution-context';
import { AgentRegistryService } from './agent-registry.service';
import { AgentCapability, AgentResult } from './agent.types';
import { BaseAgent } from './base-agent.interface';
import { AppLogger } from '@/common/logger/logger.service';
import { FinanceService } from '@/finance/finance.service';
import { FinancialContext } from '@/finance/interfaces/financial-context.interface';

@Injectable()
export class MarketAgent implements BaseAgent, OnModuleInit {
  readonly name = 'MarketAgent';
  readonly capabilities = [AgentCapability.MARKET_DATA];

  constructor(
    private readonly financeService: FinanceService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.agentRegistry.registerAgent(this);
  }

  canHandle(task: ConversationTask): boolean {
    return [
      IntentCategory.STOCK_PRICE,
      IntentCategory.FINANCIAL_METRICS,
      IntentCategory.FINANCIAL_NEWS,
      IntentCategory.STOCK_COMPARISON,
      IntentCategory.COMPANY_COMPARISON,
    ].includes(task.intent as IntentCategory);
  }

  async execute(context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();
    const { task } = context;
    const intent = task.intent as IntentCategory;

    this.logger.log(
      `MarketAgent executing ${intent} for Task ${task.id} [Query: "${task.message}"]`,
      'MarketAgent',
    );

    if (
      intent === IntentCategory.STOCK_COMPARISON ||
      intent === IntentCategory.COMPANY_COMPARISON
    ) {
      const comparisonContext = await this.retrieveComparisonData(task);
      return {
        agentName: this.name,
        success: true,
        output: comparisonContext,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const targetQuery =
      task.entities?.tickers?.[0] ||
      task.entities?.companies?.[0] ||
      this.extractTargetFromMessage(task.message);

    if (!targetQuery) {
      return {
        agentName: this.name,
        success: false,
        output: `I couldn't identify a valid company name or stock ticker from your request. Please specify a ticker or company (e.g., AAPL or Microsoft).`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const options = {
      includeQuote:
        intent === IntentCategory.STOCK_PRICE ||
        intent === IntentCategory.FINANCIAL_METRICS ||
        intent === IntentCategory.COMPANY_RESEARCH,
      includeProfile: true,
      includeMetrics: intent === IntentCategory.FINANCIAL_METRICS,
      includeNews: intent === IntentCategory.FINANCIAL_NEWS,
    };

    const finContext = await this.financeService.getFinancialContext(targetQuery, options);

    if (finContext.error) {
      return {
        agentName: this.name,
        success: false,
        output: finContext.error,
        executionTimeMs: Date.now() - startTime,
        metadata: { financialError: true },
      };
    }

    const formattedContext = this.formatMarketContext(finContext);

    return {
      agentName: this.name,
      success: true,
      output: formattedContext,
      executionTimeMs: Date.now() - startTime,
      metadata: { symbol: finContext.symbol },
    };
  }

  private async retrieveComparisonData(task: ConversationTask): Promise<string> {
    const entities = task.entities || {};
    let targets: string[] = [];

    if (entities.tickers && entities.tickers.length > 0) {
      targets.push(...entities.tickers);
    }
    if (entities.companies && entities.companies.length > 0) {
      targets.push(...entities.companies);
    }

    targets = Array.from(new Set(targets));

    if (targets.length < 2) {
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
      .map((ctx) => this.formatMarketContext(ctx))
      .join('\n\n---\n\n');

    return `[RETRIEVED FINANCIAL DATA - AUTHORITATIVE SOURCE FOR COMPARISON]\n\n${formattedContexts}`;
  }

  private extractTargetFromMessage(message: string): string | null {
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

  private formatMarketContext(ctx: FinancialContext): string {
    if (ctx.error) {
      return `[FINANCIAL DATA STATUS]\nSymbol: ${ctx.symbol}\nStatus: ${ctx.error}`;
    }

    const lines: string[] = [];
    lines.push(`[RETRIEVED FINANCIAL DATA - AUTHORITATIVE SOURCE]`);
    lines.push(`Symbol: ${ctx.symbol}`);
    if (ctx.companyName) lines.push(`Company Name: ${ctx.companyName}`);
    if (ctx.profile?.industry) lines.push(`Industry: ${ctx.profile.industry}`);
    if (ctx.profile?.exchange) lines.push(`Exchange: ${ctx.profile.exchange}`);

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
