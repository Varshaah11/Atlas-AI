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
export class ResearchAgent implements BaseAgent, OnModuleInit {
  readonly name = 'ResearchAgent';
  readonly capabilities = [AgentCapability.COMPANY_RESEARCH];

  constructor(
    private readonly financeService: FinanceService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.agentRegistry.registerAgent(this);
  }

  canHandle(task: ConversationTask): boolean {
    return (
      task.intent === IntentCategory.COMPANY_RESEARCH || task.intent === IntentCategory.SEC_FILINGS
    );
  }

  async execute(context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();
    const { task } = context;
    const intent = task.intent as IntentCategory;

    this.logger.log(
      `ResearchAgent executing task ${task.id} [Intent: ${intent}] [Query: "${task.message}"]`,
      'ResearchAgent',
    );

    const targetQuery =
      // For SEC filings we prioritize ticker symbols to enable CIK resolution
      (intent === IntentCategory.SEC_FILINGS && task.entities?.tickers?.[0]) ||
      task.entities?.tickers?.[0] ||
      task.entities?.companies?.[0] ||
      this.extractTargetFromMessage(task.message);

    if (!targetQuery) {
      return {
        agentName: this.name,
        success: false,
        output: `I couldn't identify a valid company name or stock ticker for company research or SEC filings. Please specify a company or symbol (e.g., Microsoft or AAPL).`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Determine target form filters based on message text
    const textLower = task.message.toLowerCase();
    const requestedForms: string[] = [];
    if (/\b(10-k|10k)\b/i.test(textLower)) requestedForms.push('10-K');
    if (/\b(10-q|10q)\b/i.test(textLower)) requestedForms.push('10-Q');
    if (/\b(8-k|8k)\b/i.test(textLower)) requestedForms.push('8-K');

    if (intent === IntentCategory.SEC_FILINGS || requestedForms.length > 0) {
      this.logger.log(
        `[SEC] Specific SEC Filing query detected for "${targetQuery}". Filtering forms: [${requestedForms.join(', ') || 'ALL'}]`,
        'ResearchAgent',
      );

      // Resolve ticker (or company name) to ensure CIK resolution
      const resolvedTicker = await this.financeService.resolveTicker(targetQuery);
      const queryForSec = resolvedTicker || targetQuery;
      this.logger.log(
        `[SEC] Using ticker "${queryForSec}" for SEC filings request (original target: "${targetQuery}")`,
        'ResearchAgent',
      );

      const secFilings = await this.financeService.getRecentSecFilings(
        queryForSec,
        requestedForms.length > 0 ? requestedForms : ['10-K', '10-Q', '8-K'],
      );

      if (secFilings.error || !secFilings.recentFilings || secFilings.recentFilings.length === 0) {
        this.logger.warn(
          `[SEC] No SEC filings found for ${targetQuery}: ${secFilings.error}`,
          'ResearchAgent',
        );
        return {
          agentName: this.name,
          success: false,
          output:
            secFilings.error ||
            `I couldn't retrieve the requested SEC filing data for ${targetQuery} right now. Please try again.`,
          executionTimeMs: Date.now() - startTime,
          metadata: { financialError: true },
        };
      }

      this.logger.log(
        `[SEC] Injecting ${secFilings.recentFilings.length} SEC EDGAR records into pipeline context`,
        'ResearchAgent',
      );

      const secFormattedContext = this.formatSecOnlyContext(secFilings, targetQuery);

      return {
        agentName: this.name,
        success: true,
        output: secFormattedContext,
        executionTimeMs: Date.now() - startTime,
        metadata: {
          symbol: secFilings.ticker || targetQuery,
          cik: secFilings.cik,
          latestForm: secFilings.recentFilings[0]?.form,
          latestFilingDate: secFilings.recentFilings[0]?.filingDate,
          latestAccessionNumber: secFilings.recentFilings[0]?.accessionNumber,
        },
      };
    }

    // General Company Research: Retrieve profile, quote, metrics, news, and recent SEC filings
    const finContext = await this.financeService.getFinancialContext(targetQuery, {
      includeQuote: true,
      includeProfile: true,
      includeMetrics: true,
      includeNews: true,
      includeSecFilings: true,
    });

    if (finContext.error) {
      return {
        agentName: this.name,
        success: false,
        output: finContext.error,
        executionTimeMs: Date.now() - startTime,
        metadata: { financialError: true },
      };
    }

    const formattedContext = this.formatResearchContext(finContext);

    return {
      agentName: this.name,
      success: true,
      output: formattedContext,
      executionTimeMs: Date.now() - startTime,
      metadata: {
        symbol: finContext.symbol,
        hasSecFilings: !!finContext.secFilings?.recentFilings?.length,
      },
    };
  }

  private extractTargetFromMessage(message: string): string | null {
    const rawMatches = message.match(/(\$[A-Za-z0-9]{1,15}|\b[A-Za-z0-9]{1,15}\b)/g);
    if (rawMatches) {
      const EXCLUDED = new Set([
        'TELL', 'ABOUT', 'SHOW', 'ME', 'RESEARCH', 'COMPANY', 'INFO', 'OVERVIEW',
        'WHAT', 'WHATS', 'IS', 'IT', 'THE', 'MOST', 'RECENT', 'FILING', 'DATE',
        'ACCESSION', 'NUMBER', 'AND', 'FOR', 'OF', 'IN', 'ON', 'AT', 'TO'
      ]);
      for (const raw of rawMatches) {
        const candidate = raw.replace('$', '').trim();
        const upper = candidate.toUpperCase();
        const isExplicit = raw.startsWith('$');
        if (isExplicit) {
          return candidate;
        }
        if (upper.length > 1 && !EXCLUDED.has(upper)) {
          return candidate;
        }
      }
    }
    const match = message.match(/\b([a-zA-Z0-9\s]{2,20})\b/);
    return match ? match[1].trim() : null;
  }

  private formatSecOnlyContext(secFilings: any, targetQuery: string): string {
    const lines: string[] = [];
    lines.push(`[RETRIEVED SEC EDGAR OFFICIAL FILINGS - AUTHORITATIVE SOURCE]`);
    lines.push(`Company: ${secFilings.companyName || targetQuery.toUpperCase()}`);
    lines.push(`Ticker: ${secFilings.ticker || targetQuery.toUpperCase()}`);
    lines.push(`CIK: ${secFilings.cik}`);
    lines.push(`Total Retrieved Filings: ${secFilings.recentFilings.length}`);
    lines.push(``);

    secFilings.recentFilings.forEach((filing: any, index: number) => {
      lines.push(`Filing ${index + 1}:`);
      lines.push(`  - Form: ${filing.form}`);
      lines.push(`  - Filing Date: ${filing.filingDate}`);
      lines.push(`  - Accession Number: ${filing.accessionNumber}`);
      if (filing.primaryDocument) lines.push(`  - Primary Document: ${filing.primaryDocument}`);
      if (filing.documentUrl) lines.push(`  - SEC Document URL: ${filing.documentUrl}`);
      lines.push(``);
    });

    lines.push(`Data Source: Official SEC EDGAR System | Timestamp: ${secFilings.retrievedAt}`);
    return lines.join('\n');
  }

  private formatResearchContext(ctx: FinancialContext): string {
    const lines: string[] = [];
    lines.push(`[RETRIEVED AUTHORITATIVE COMPANY RESEARCH CONTEXT]`);
    lines.push(`Symbol: ${ctx.symbol}`);
    if (ctx.companyName) lines.push(`Company Name: ${ctx.companyName}`);
    if (ctx.profile?.industry) lines.push(`Industry: ${ctx.profile.industry}`);
    if (ctx.profile?.exchange) lines.push(`Exchange: ${ctx.profile.exchange}`);
    if (ctx.profile?.country) lines.push(`Country: ${ctx.profile.country}`);

    if (ctx.quote) {
      lines.push(`Current Price: $${ctx.quote.currentPrice}`);
      lines.push(`Daily Change: $${ctx.quote.change} (${ctx.quote.percentChange}%)`);
      lines.push(`Day High / Low: $${ctx.quote.high} / $${ctx.quote.low}`);
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
      lines.push(`Recent Relevant Company News:`);
      ctx.news.forEach((item, index) => {
        lines.push(`  ${index + 1}. ${item.headline} (${item.source || 'News'})`);
        if (item.summary) lines.push(`     Summary: ${item.summary.slice(0, 150)}...`);
      });
    }

    if (ctx.secFilings && ctx.secFilings.recentFilings && ctx.secFilings.recentFilings.length > 0) {
      lines.push(`[RETRIEVED SEC EDGAR OFFICIAL FILINGS]`);
      lines.push(`CIK: ${ctx.secFilings.cik}`);
      ctx.secFilings.recentFilings.forEach((filing, index) => {
        lines.push(
          `  ${index + 1}. Form ${filing.form} | Date: ${filing.filingDate} | Accession: ${filing.accessionNumber}`,
        );
        if (filing.documentUrl) lines.push(`     URL: ${filing.documentUrl}`);
      });
    } else {
      lines.push(`[SEC EDGAR OFFICIAL FILINGS]`);
      lines.push(`No recent 10-K, 10-Q, or 8-K filings available.`);
    }

    lines.push(`Data Source: Finnhub API & Official SEC EDGAR | Timestamp: ${ctx.retrievedAt}`);
    return lines.join('\n');
  }
}
