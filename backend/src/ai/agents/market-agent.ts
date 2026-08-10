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
      IntentCategory.MARKET_INFORMATION,
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
        output: `I couldn't identify a valid company name or stock ticker from your request. Please specify a ticker or company (e.g., NVDA or Microsoft).`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const options = {
      includeQuote: true,
      includeProfile: true,
      includeMetrics: true,
      includeNews:
        intent === IntentCategory.FINANCIAL_NEWS ||
        intent === IntentCategory.MARKET_INFORMATION,
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

    const comparisonFacts = this.buildComparisonFacts(contexts);

    const formattedContexts = contexts
      .map((ctx) => this.formatMarketContext(ctx))
      .join('\n\n---\n\n');

    return `[RETRIEVED FINANCIAL DATA - AUTHORITATIVE SOURCE FOR COMPARISON]\n\n${comparisonFacts}\n\n---\n\n${formattedContexts}`;
  }

  private buildComparisonFacts(contexts: FinancialContext[]): string {
    const validContexts = contexts.filter((c) => !c.error && c.symbol);
    if (validContexts.length < 2) return '';

    const lines: string[] = [];
    lines.push(`[COMPARISON SUMMARY & MATHEMATICAL FACTS - AUTHORITATIVE & UNCOMPROMISING]`);
    lines.push(`Note for LLM: Use these exact mathematical facts when comparing. Never invert or contradict these relations.`);

    // 1. Market Capitalization Comparison
    const caps = validContexts
      .map((c) => ({
        symbol: c.symbol,
        name: c.companyName || c.symbol,
        rawMillion: c.profile?.marketCapitalization ?? c.metrics?.marketCap ?? null,
      }))
      .filter((item): item is { symbol: string; name: string; rawMillion: number } => typeof item.rawMillion === 'number' && !isNaN(item.rawMillion) && item.rawMillion > 0);

    if (caps.length >= 2) {
      lines.push(``);
      lines.push(`Metric: Market Capitalization`);
      caps.forEach((c) => {
        lines.push(`  - ${c.symbol}: Raw Value = ${c.rawMillion.toLocaleString()} Million USD | Display Value = ${this.formatMarketCap(c.rawMillion)}`);
      });

      const sortedCaps = [...caps].sort((a, b) => b.rawMillion - a.rawMillion);
      const largest = sortedCaps[0];
      const smallest = sortedCaps[sortedCaps.length - 1];

      if (largest.rawMillion > smallest.rawMillion) {
        lines.push(`  Mathematical Fact: ${largest.symbol} (${this.formatMarketCap(largest.rawMillion)}) HAS A LARGER MARKET CAPITALIZATION THAN ${smallest.symbol} (${this.formatMarketCap(smallest.rawMillion)}).`);
        lines.push(`  Mathematical Relation: ${sortedCaps.map((c) => `${c.symbol} (${this.formatMarketCap(c.rawMillion)})`).join(' > ')}`);
      } else {
        lines.push(`  Mathematical Fact: ${caps.map((c) => c.symbol).join(' and ')} have equal market capitalization.`);
      }
    }

    // 2. Valuation (P/E Ratio) Comparison
    const pes = validContexts
      .map((c) => ({
        symbol: c.symbol,
        pe: c.metrics?.peRatio ?? null,
      }))
      .filter((item): item is { symbol: string; pe: number } => typeof item.pe === 'number' && !isNaN(item.pe) && item.pe > 0);

    if (pes.length >= 2) {
      lines.push(``);
      lines.push(`Metric: Price-to-Earnings (P/E) Ratio`);
      pes.forEach((p) => {
        lines.push(`  - ${p.symbol}: P/E = ${p.pe}`);
      });

      const sortedPEs = [...pes].sort((a, b) => b.pe - a.pe);
      const highestPE = sortedPEs[0];
      const lowestPE = sortedPEs[sortedPEs.length - 1];

      if (highestPE.pe > lowestPE.pe) {
        lines.push(`  Mathematical Fact: ${highestPE.symbol} (P/E ${highestPE.pe}) TRADES AT A HIGHER P/E MULTIPLE THAN ${lowestPE.symbol} (P/E ${lowestPE.pe}). ${lowestPE.symbol} HAS THE LOWER P/E RATIO.`);
        lines.push(`  Mathematical Relation: ${sortedPEs.map((p) => `${p.symbol} (${p.pe})`).join(' > ')}`);
      } else {
        lines.push(`  Mathematical Fact: ${pes.map((p) => p.symbol).join(' and ')} have equal P/E ratios.`);
      }
    }

    // 3. Current Share Price Comparison
    const prices = validContexts
      .map((c) => ({
        symbol: c.symbol,
        price: c.quote?.currentPrice ?? null,
      }))
      .filter((item): item is { symbol: string; price: number } => typeof item.price === 'number' && !isNaN(item.price));

    if (prices.length >= 2) {
      lines.push(``);
      lines.push(`Metric: Share Price`);
      prices.forEach((p) => {
        lines.push(`  - ${p.symbol}: Current Price = $${p.price}`);
      });
      const sortedPrices = [...prices].sort((a, b) => b.price - a.price);
      if (sortedPrices[0].price > sortedPrices[sortedPrices.length - 1].price) {
        lines.push(`  Mathematical Relation: ${sortedPrices.map((p) => `${p.symbol} ($${p.price})`).join(' > ')}`);
        lines.push(`  Important Note: A higher nominal share price DOES NOT mean a company has a larger market capitalization or is a better investment.`);
      }
    }

    return lines.join('\n');
  }

  private extractTargetFromMessage(message: string): string | null {
    const rawMatches = message.match(/(\$[A-Za-z0-9]{1,15}|\b[A-Za-z0-9]{1,15}\b)/g);
    if (rawMatches) {
      const EXCLUDED = new Set([
        'WHAT', 'WHATS', 'TELL', 'SHOW', 'ME', 'IS', 'IT', 'THE', 'AND', 'FOR',
        'OF', 'IN', 'ON', 'AT', 'TO', 'MY', 'WE', 'YOU', 'HE', 'SHE', 'THEY',
        'PRICE', 'STOCK', 'STOCKS', 'VALUE', 'INFO', 'OVERVIEW', 'RATIO',
        'PE', 'EPS', 'EBITDA', 'NEWS', 'LATEST', 'CURRENT', 'MARKET', 'DATA',
        'WHY', 'DID', 'MOVE', 'FALL', 'RISE', 'CAUSED', 'THAT', 'ITS', 'HIGH',
        'VALUATION', 'REVENUE', 'COMPARE', 'VERSUS', 'VS'
      ]);
      for (const raw of rawMatches) {
        const candidate = raw.replace('$', '').trim();
        const upper = candidate.toUpperCase();
        const isExplicit = raw.startsWith('$');
        if (isExplicit) {
          return candidate;
        }
        if (upper === 'AI') {
          const isExplicitAi =
            /\b(ai (stock|stocks|shares?|ticker|quote|price|valuation|metrics|p\/e|pe)|(price|quote|valuation|p\/e|pe|metrics|financials) (of|for|on) ai|c3\.?ai)\b/i.test(message);
          if (isExplicitAi) return candidate;
        } else if (upper.length > 1 && !EXCLUDED.has(upper)) {
          return candidate;
        }
      }
    }
    return null;
  }

  private formatMarketCap(valueInMillions: number | undefined | null): string {
    if (typeof valueInMillions !== 'number' || isNaN(valueInMillions) || valueInMillions <= 0) {
      return 'N/A';
    }
    if (valueInMillions >= 1_000_000) {
      const trillionVal = (valueInMillions / 1_000_000).toFixed(3).replace(/\.?0+$/, '');
      return `$${trillionVal} Trillion ($${valueInMillions.toLocaleString()} Million USD)`;
    }
    if (valueInMillions >= 1_000) {
      const billionVal = (valueInMillions / 1_000).toFixed(2);
      return `$${billionVal} Billion ($${valueInMillions.toLocaleString()} Million USD)`;
    }
    return `$${valueInMillions.toFixed(2)} Million USD`;
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
      const changeSign = ctx.quote.change >= 0 ? '+' : '';
      const percentSign = ctx.quote.percentChange >= 0 ? '+' : '';
      lines.push(`[AUTHORITATIVE PRICE & MOVEMENT DATA]`);
      lines.push(`  - Current Price: $${ctx.quote.currentPrice}`);
      lines.push(`  - Official Previous Close: $${ctx.quote.previousClose}`);
      lines.push(`  - Day Open: $${ctx.quote.open}`);
      lines.push(`  - Official Day Change: ${changeSign}$${ctx.quote.change} (${percentSign}${ctx.quote.percentChange}% vs Previous Close)`);
      lines.push(`  - Day High: $${ctx.quote.high}`);
      lines.push(`  - Day Low: $${ctx.quote.low}`);
    }

    const rawCap = ctx.profile?.marketCapitalization ?? ctx.metrics?.marketCap;
    lines.push(`[AUTHORITATIVE FINANCIAL METRICS]`);
    if (rawCap !== undefined && rawCap !== null) {
      lines.push(`  - Market Cap: ${this.formatMarketCap(rawCap)}`);
    }
    if (ctx.metrics?.peRatio !== undefined && ctx.metrics?.peRatio !== null) {
      lines.push(`  - P/E Ratio: ${ctx.metrics.peRatio}`);
    }
    if (ctx.metrics?.fiftyTwoWeekHigh !== undefined && ctx.metrics?.fiftyTwoWeekLow !== undefined) {
      lines.push(`  - 52-Week Range: $${ctx.metrics.fiftyTwoWeekLow} - $${ctx.metrics.fiftyTwoWeekHigh}`);
    }

    lines.push(`[AUTHORITATIVE NEWS CONTEXT - FACTUAL & UNBIASED]`);
    lines.push(`Note for LLM: Retaining retrieved news items as factual company context. News relevance does NOT establish price-movement causality. Do NOT claim an article caused or contributed to today's movement unless explicit market reaction text is reported in the article. Do NOT use causal opening phrasing such as "The daily price movement of [TICKER] can be attributed to the following news items:". ALWAYS use neutral opening phrasing such as "The following retrieved news items provide context about [TICKER]'s recent activity:".`);
    if (ctx.news && ctx.news.length > 0) {
      ctx.news.slice(0, 3).forEach((item, index) => {
        const fullText = `${item.headline || ''} ${item.summary || ''}`;
        const hasExplicitMarketReaction = /\b(shares|stock|price) (rose|surged|jumped|fell|dropped|sank|tumbled|gained|lost|slid|climbed|soared|dipped|reacted|plunged|moved)\b/i.test(fullText);
        lines.push(`  Article ${index + 1}: ${item.headline} (${item.source || 'News'})`);
        if (item.summary) lines.push(`    Summary: ${item.summary.slice(0, 150)}...`);
        lines.push(`    Reported Causality to Today's Movement: ${hasExplicitMarketReaction ? 'EXPLICIT MARKET REACTION REPORTED IN ARTICLE' : 'NOT ESTABLISHED IN ARTICLE (Company/Business Context Only)'}`);
      });
    } else {
      lines.push(`  - Recent News: None available in retrieved context.`);
    }

    lines.push(`Data Source: Finnhub API | Timestamp: ${ctx.retrievedAt}`);
    return lines.join('\n');
  }
}
