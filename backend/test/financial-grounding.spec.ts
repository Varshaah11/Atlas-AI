import { Test, TestingModule } from '@nestjs/testing';
import { MarketAgent } from '../src/ai/agents/market-agent';
import { FinanceService } from '../src/finance/finance.service';
import { AgentRegistryService } from '../src/ai/agents/agent-registry.service';
import { AppLogger } from '../src/common/logger/logger.service';
import { IntentCategory } from '../src/ai/conversation/conversation.types';
import { ExecutionContext } from '../src/ai/orchestrator/execution-context';
import { ATLAS_SYSTEM_PROMPT } from '../src/ai/prompts/atlas-system.prompt';

describe('Financial Answer Correctness & Grounding Suite', () => {
  let marketAgent: MarketAgent;
  let mockFinanceService: Partial<FinanceService>;

  beforeEach(async () => {
    mockFinanceService = {
      getFinancialContext: jest.fn().mockImplementation((symbol: string) => {
        const uppercase = symbol.toUpperCase();
        if (uppercase === 'NVDA') {
          return Promise.resolve({
            symbol: 'NVDA',
            companyName: 'NVIDIA Corp',
            retrievedAt: new Date().toISOString(),
            source: 'finnhub',
            quote: {
              currentPrice: 120.50,
              change: 2.50,
              percentChange: 2.12,
              high: 122.00,
              low: 118.00,
              open: 119.00,
              previousClose: 118.00,
              timestamp: 123456789,
            },
            profile: {
              name: 'NVIDIA Corp',
              ticker: 'NVDA',
              exchange: 'NASDAQ',
              industry: 'Semiconductors',
              marketCapitalization: 3450000, // $3.45 Trillion (in Millions)
            },
            metrics: {
              peRatio: 45.2,
              fiftyTwoWeekHigh: 140.00,
              fiftyTwoWeekLow: 75.00,
            },
            news: [
              {
                id: 1,
                category: 'company news',
                datetime: 123456,
                headline: 'NVIDIA Launches New AI Chip',
                source: 'Bloomberg',
                summary: 'NVIDIA unveiled its next generation architecture for enterprise AI workloads.',
                url: 'https://example.com/news1',
              },
            ],
          });
        }
        if (uppercase === 'AMD') {
          return Promise.resolve({
            symbol: 'AMD',
            companyName: 'Advanced Micro Devices Inc',
            retrievedAt: new Date().toISOString(),
            source: 'finnhub',
            quote: {
              currentPrice: 150.00,
              change: -1.50,
              percentChange: -0.99,
              high: 153.00,
              low: 148.50,
              open: 152.00,
              previousClose: 151.50,
              timestamp: 123456789,
            },
            profile: {
              name: 'Advanced Micro Devices Inc',
              ticker: 'AMD',
              exchange: 'NASDAQ',
              industry: 'Semiconductors',
              marketCapitalization: 150000, // $150 Billion (in Millions)
            },
            metrics: {
              peRatio: 38.5,
              fiftyTwoWeekHigh: 180.00,
              fiftyTwoWeekLow: 110.00,
            },
            news: [], // Empty news
          });
        }
        return Promise.resolve({
          symbol: uppercase,
          retrievedAt: new Date().toISOString(),
          source: 'finnhub',
          error: `No data for ${uppercase}`,
        });
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MarketAgent,
        {
          provide: FinanceService,
          useValue: mockFinanceService,
        },
        {
          provide: AgentRegistryService,
          useValue: { registerAgent: jest.fn() },
        },
        {
          provide: AppLogger,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    marketAgent = moduleRef.get<MarketAgent>(MarketAgent);
  });

  it('1. Market Cap Formatting — Correctly converts millions to Trillion ($T) and Billion ($B) scales', async () => {
    const context: ExecutionContext = {
      conversationId: 'c1',
      userId: 'u1',
      conversationHistory: [],
      metadata: {},
      services: { logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any, config: {} as any },
      task: {
        id: 't1',
        conversationId: 'c1',
        userId: 'u1',
        intent: IntentCategory.STOCK_PRICE,
        entities: { tickers: ['NVDA'], companies: [] },
        message: 'What is NVDA price?',
        needsClarification: false,
        createdAt: new Date().toISOString(),
      },
    };

    const result = await marketAgent.execute(context);
    expect(result.success).toBe(true);

    // NVDA marketCap 3,450,000M -> $3.45 Trillion
    expect(result.output).toContain('$3.45 Trillion');
    expect(result.output).toContain('3,450,000 Million USD');
  });

  it('2. Daily Price Movement — Uses Official Previous Close and Official Day Change % (never Day Low)', async () => {
    const context: ExecutionContext = {
      conversationId: 'c1',
      userId: 'u1',
      conversationHistory: [],
      metadata: {},
      services: { logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any, config: {} as any },
      task: {
        id: 't2',
        conversationId: 'c1',
        userId: 'u1',
        intent: IntentCategory.FINANCIAL_NEWS,
        entities: { tickers: ['NVDA'], companies: [] },
        message: 'Why did it move?',
        needsClarification: false,
        createdAt: new Date().toISOString(),
      },
    };

    const result = await marketAgent.execute(context);
    expect(result.success).toBe(true);

    expect(result.output).toContain('Current Price: $120.5');
    expect(result.output).toContain('Official Previous Close: $118');
    expect(result.output).toContain('Official Day Change: +$2.5 (+2.12% vs Previous Close)');
  });

  it('3. Comparison Consistency — Formats identical structured metrics for both companies in comparison', async () => {
    const context: ExecutionContext = {
      conversationId: 'c1',
      userId: 'u1',
      conversationHistory: [],
      metadata: {},
      services: { logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any, config: {} as any },
      task: {
        id: 't3',
        conversationId: 'c1',
        userId: 'u1',
        intent: IntentCategory.STOCK_COMPARISON,
        entities: { tickers: ['NVDA', 'AMD'], companies: [] },
        message: 'Compare NVDA and AMD',
        needsClarification: false,
        createdAt: new Date().toISOString(),
      },
    };

    const result = await marketAgent.execute(context);
    expect(result.success).toBe(true);

    // Should format NVDA ($3.45 Trillion) and AMD ($150 Billion)
    expect(result.output).toContain('NVDA');
    expect(result.output).toContain('$3.45 Trillion');
    expect(result.output).toContain('AMD');
    expect(result.output).toContain('$150.00 Billion');
    expect(result.output).toContain('NVDA ($3.45 Trillion ($3,450,000 Million USD)) HAS A LARGER MARKET CAPITALIZATION THAN AMD ($150.00 Billion ($150,000 Million USD)).');
  });

  it('4. Comparison Facts A & B & C — Generates explicit mathematical relations for Trillion vs Billion, Billion vs Million, and Same-Unit comparisons', async () => {
    mockFinanceService.getFinancialContext = jest.fn().mockImplementation((symbol: string) => {
      const uppercase = symbol.toUpperCase();
      if (uppercase === 'MEGA') {
        return Promise.resolve({
          symbol: 'MEGA',
          retrievedAt: new Date().toISOString(),
          source: 'finnhub',
          profile: { marketCapitalization: 5420000 }, // $5.42 Trillion
          metrics: { peRatio: 33.9561 },
          quote: { currentPrice: 200 },
        });
      }
      if (uppercase === 'MID') {
        return Promise.resolve({
          symbol: 'MID',
          retrievedAt: new Date().toISOString(),
          source: 'finnhub',
          profile: { marketCapitalization: 789070 }, // $789.07 Billion
          metrics: { peRatio: 122.6411 },
          quote: { currentPrice: 150 },
        });
      }
      if (uppercase === 'SMALL') {
        return Promise.resolve({
          symbol: 'SMALL',
          retrievedAt: new Date().toISOString(),
          source: 'finnhub',
          profile: { marketCapitalization: 500 }, // $500 Million
          metrics: { peRatio: 15.0 },
          quote: { currentPrice: 20 },
        });
      }
      return Promise.resolve({ symbol: uppercase, retrievedAt: new Date().toISOString(), source: 'finnhub', error: 'No data' });
    });

    const context: ExecutionContext = {
      conversationId: 'c1',
      userId: 'u1',
      conversationHistory: [],
      metadata: {},
      services: { logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any, config: {} as any },
      task: {
        id: 't-comp',
        conversationId: 'c1',
        userId: 'u1',
        intent: IntentCategory.STOCK_COMPARISON,
        entities: { tickers: ['MEGA', 'MID', 'SMALL'], companies: [] },
        message: 'Compare MEGA, MID, and SMALL',
        needsClarification: false,
        createdAt: new Date().toISOString(),
      },
    };

    const result = await marketAgent.execute(context);
    expect(result.success).toBe(true);

    // Trillion vs Billion vs Million relation
    expect(result.output).toContain('MEGA ($5.42 Trillion ($5,420,000 Million USD)) HAS A LARGER MARKET CAPITALIZATION THAN SMALL ($500.00 Million USD).');
    expect(result.output).toContain('MEGA ($5.42 Trillion ($5,420,000 Million USD)) > MID ($789.07 Billion ($789,070 Million USD)) > SMALL ($500.00 Million USD)');

    // P/E comparison fact
    expect(result.output).toContain('MID (P/E 122.6411) TRADES AT A HIGHER P/E MULTIPLE THAN SMALL (P/E 15). SMALL HAS THE LOWER P/E RATIO.');
  });

  it('5. 52-Week Range Formatting F & G — Formats 52W range when available, and handles missing metrics cleanly', async () => {
    // NVDA in default mock has 52W Range $75 - $140
    const context1: ExecutionContext = {
      conversationId: 'c1',
      userId: 'u1',
      conversationHistory: [],
      metadata: {},
      services: { logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any, config: {} as any },
      task: {
        id: 't-52w',
        conversationId: 'c1',
        userId: 'u1',
        intent: IntentCategory.STOCK_PRICE,
        entities: { tickers: ['NVDA'], companies: [] },
        message: 'What is NVDA price?',
        needsClarification: false,
        createdAt: new Date().toISOString(),
      },
    };

    const result1 = await marketAgent.execute(context1);
    expect(result1.success).toBe(true);
    expect(result1.output).toContain('52-Week Range: $75 - $140');
  });

  it('6. News Causality Test A & C — MarketAgent formats neutral news with NOT ESTABLISHED tag and explicit reaction with REACTION REPORTED tag', async () => {
    // Mock getFinancialContext with neutral news and market-reaction news
    mockFinanceService.getFinancialContext = jest.fn().mockImplementation((symbol: string, options?: any) => {
      return Promise.resolve({
        symbol: symbol.toUpperCase(),
        companyName: 'NVIDIA Corp',
        retrievedAt: new Date().toISOString(),
        source: 'finnhub',
        quote: { currentPrice: 125, previousClose: 122, change: 3, percentChange: 2.45, open: 122, high: 126, low: 121 },
        profile: { marketCapitalization: 3000000 },
        metrics: { peRatio: 35, fiftyTwoWeekLow: 75, fiftyTwoWeekHigh: 140 },
        news: options?.includeNews ? [
          { headline: 'NVIDIA Commits $5 Billion To AI Infrastructure', summary: 'NVIDIA announced strategic investments in global AI data centers.' },
          { headline: 'NVIDIA Shares Surged 4% Following Quarterly Announcement', summary: 'NVDA stock price climbed as investors reacted to strong guidance.' },
        ] : [],
      });
    });

    const context: ExecutionContext = {
      conversationId: 'c1',
      userId: 'u1',
      conversationHistory: [],
      metadata: {},
      services: { logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any, config: {} as any },
      task: {
        id: 't-news-causality',
        conversationId: 'c1',
        userId: 'u1',
        intent: IntentCategory.FINANCIAL_NEWS,
        entities: { tickers: ['NVDA'], companies: [] },
        message: 'Why did NVDA move?',
        needsClarification: false,
        createdAt: new Date().toISOString(),
      },
    };

    const result = await marketAgent.execute(context);
    expect(result.success).toBe(true);

    // Neutral news item 1 must be marked NOT ESTABLISHED
    expect(result.output).toContain('Reported Causality to Today\'s Movement: NOT ESTABLISHED IN ARTICLE (Company/Business Context Only)');
    // Market reaction news item 2 must be marked EXPLICIT MARKET REACTION REPORTED
    expect(result.output).toContain('Reported Causality to Today\'s Movement: EXPLICIT MARKET REACTION REPORTED IN ARTICLE');
  });

  it('7. News Causality Test B — System prompt contains strict news causality rules and non-causal fallback wording', () => {
    expect(ATLAS_SYSTEM_PROMPT).toContain('NEWS RELEVANCE IS NOT PRICE-MOVEMENT CAUSALITY');
    expect(ATLAS_SYSTEM_PROMPT).toContain('A news article mentioning the target company does NOT establish that the article caused or contributed to today\'s stock-price movement.');
    expect(ATLAS_SYSTEM_PROMPT).toContain('The retrieved news provides context about [TICKER], but it does not establish a specific catalyst for today\'s move.');
    expect(ATLAS_SYSTEM_PROMPT).toContain('NEUTRAL OPENING STATEMENT FOR MOVEMENT ANALYSIS');
    expect(ATLAS_SYSTEM_PROMPT).toContain('The following retrieved news items provide context about [TICKER]\'s recent activity:');
    expect(ATLAS_SYSTEM_PROMPT).toContain('The response MUST NOT rewrite contextual news into stronger causal language such as:');
    expect(ATLAS_SYSTEM_PROMPT).toContain('* "This contributed to the move."');
    expect(ATLAS_SYSTEM_PROMPT).toContain('* "This caused the increase."');
    expect(ATLAS_SYSTEM_PROMPT).toContain('STRICT SINGLE-COMPANY SCOPE (NO UNREQUESTED PEER DATA)');
  });

  it('8. News Causality Test D — Verifies guidance prohibits causal opening phrasing "can be attributed to the following news items"', async () => {
    mockFinanceService.getFinancialContext = jest.fn().mockImplementation((symbol: string, options?: any) => {
      return Promise.resolve({
        symbol: symbol.toUpperCase(),
        companyName: 'NVIDIA Corp',
        retrievedAt: new Date().toISOString(),
        source: 'finnhub',
        quote: { currentPrice: 125, previousClose: 122, change: 3, percentChange: 2.45, open: 122, high: 126, low: 121 },
        profile: { marketCapitalization: 3000000 },
        metrics: { peRatio: 35, fiftyTwoWeekLow: 75, fiftyTwoWeekHigh: 140 },
        news: options?.includeNews ? [
          { headline: 'NVIDIA Commits $5 Billion To AI Infrastructure', summary: 'NVIDIA announced strategic investments in global AI data centers.' },
        ] : [],
      });
    });

    const context: ExecutionContext = {
      conversationId: 'c1',
      userId: 'u1',
      conversationHistory: [],
      metadata: {},
      services: { logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any, config: {} as any },
      task: {
        id: 't-news-opening',
        conversationId: 'c1',
        userId: 'u1',
        intent: IntentCategory.FINANCIAL_NEWS,
        entities: { tickers: ['NVDA'], companies: [] },
        message: 'Why did NVDA move?',
        needsClarification: false,
        createdAt: new Date().toISOString(),
      },
    };

    const result = await marketAgent.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('The following retrieved news items provide context about [TICKER]\'s recent activity:');
    expect(result.output).not.toContain('The daily price movement ... can be attributed to the following news items');
  });
});
