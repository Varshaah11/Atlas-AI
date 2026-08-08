import { Inject, Injectable } from '@nestjs/common';
import {
  FINANCE_PROVIDER_TOKEN,
  IFinanceProvider,
  StockQuote,
  CompanyProfile,
  CompanyNewsItem,
  FinancialMetrics,
} from './interfaces/finance-provider.interface';
import { FinancialContext } from './interfaces/financial-context.interface';
import { AppLogger } from '@/common/logger/logger.service';

const COMMON_DICTIONARY: Record<string, string> = {
  apple: 'AAPL',
  microsoft: 'MSFT',
  google: 'GOOGL',
  alphabet: 'GOOGL',
  amazon: 'AMZN',
  nvidia: 'NVDA',
  tesla: 'TSLA',
  meta: 'META',
  facebook: 'META',
};

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class FinanceService {
  private readonly cache = new Map<string, CacheEntry<any>>();

  constructor(
    @Inject(FINANCE_PROVIDER_TOKEN) private readonly financeProvider: IFinanceProvider,
    private readonly logger: AppLogger,
  ) {}

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCached<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async resolveTicker(query: string): Promise<string | null> {
    const raw = query.trim().replace(/^\$/, '');
    if (!raw) return null;

    const lower = raw.toLowerCase();
    const upper = raw.toUpperCase();

    // 1. Check small dictionary optimization for common companies
    if (COMMON_DICTIONARY[lower]) {
      return COMMON_DICTIONARY[lower];
    }

    // 2. Direct lookup validation for standard ticker symbol formats (1-5 letters)
    if (/^[A-Z]{1,5}$/.test(upper)) {
      try {
        const quote = await this.financeProvider.getQuote(upper);
        if (quote && (quote.currentPrice > 0 || quote.previousClose > 0)) {
          return upper;
        }
        const profile = await this.financeProvider.getCompanyProfile(upper);
        if (profile && profile.name) {
          return upper;
        }
      } catch {
        // Fallthrough to symbol search
      }
    }

    // 3. Primary resolution: Use Finnhub Symbol Search API with STRICT matching
    try {
      const results = await this.financeProvider.searchSymbol(raw);
      if (results && results.length > 0) {
        // Strict Match Criteria: Only accept search result if:
        // - symbol/displaySymbol matches query exactly
        // - OR description contains company query (case insensitive)
        const matched = results.find((r) => {
          const sym = (r.symbol || '').toUpperCase();
          const disp = (r.displaySymbol || '').toUpperCase();
          const desc = (r.description || '').toLowerCase();

          const exactSymbolMatch = sym === upper || disp === upper;
          const descMatch = lower.length >= 3 && desc.includes(lower);

          return exactSymbolMatch || descMatch;
        });

        if (matched) {
          this.logger.log(
            `Resolved ticker "${matched.symbol}" for query "${query}" via Finnhub search`,
            'FinanceService',
          );
          return matched.symbol;
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `Symbol search failed for query "${query}": ${error.message}`,
        'FinanceService',
      );
    }

    return null;
  }

  async getStockQuote(symbol: string): Promise<StockQuote | null> {
    const uppercaseSymbol = symbol.trim().toUpperCase();
    const cacheKey = `quote:${uppercaseSymbol}`;

    const cached = this.getCached<StockQuote>(cacheKey);
    if (cached) return cached;

    const quote = await this.financeProvider.getQuote(uppercaseSymbol);
    if (quote) {
      this.setCached(cacheKey, quote, 60 * 1000); // 60s TTL
    }
    return quote;
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
    const uppercaseSymbol = symbol.trim().toUpperCase();
    const cacheKey = `profile:${uppercaseSymbol}`;

    const cached = this.getCached<CompanyProfile>(cacheKey);
    if (cached) return cached;

    const profile = await this.financeProvider.getCompanyProfile(uppercaseSymbol);
    if (profile) {
      this.setCached(cacheKey, profile, 10 * 60 * 1000); // 10m TTL
    }
    return profile;
  }

  async getCompanyNews(symbol: string): Promise<CompanyNewsItem[]> {
    const uppercaseSymbol = symbol.trim().toUpperCase();
    const cacheKey = `news:${uppercaseSymbol}`;

    const cached = this.getCached<CompanyNewsItem[]>(cacheKey);
    if (cached) return cached;

    const today = new Date();
    const toDate = today.toISOString().split('T')[0];
    const pastDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fromDate = pastDate.toISOString().split('T')[0];

    const news = await this.financeProvider.getCompanyNews(uppercaseSymbol, fromDate, toDate);
    if (news && news.length > 0) {
      this.setCached(cacheKey, news, 5 * 60 * 1000); // 5m TTL
    }
    return news;
  }

  async getBasicMetrics(symbol: string): Promise<FinancialMetrics | null> {
    const uppercaseSymbol = symbol.trim().toUpperCase();
    const cacheKey = `metrics:${uppercaseSymbol}`;

    const cached = this.getCached<FinancialMetrics>(cacheKey);
    if (cached) return cached;

    const metrics = await this.financeProvider.getBasicMetrics(uppercaseSymbol);
    if (metrics) {
      this.setCached(cacheKey, metrics, 10 * 60 * 1000); // 10m TTL
    }
    return metrics;
  }

  async getFinancialContext(
    symbolOrCompany: string,
    options: {
      includeQuote?: boolean;
      includeProfile?: boolean;
      includeNews?: boolean;
      includeMetrics?: boolean;
    } = { includeQuote: true, includeProfile: true },
  ): Promise<FinancialContext> {
    const retrievedAt = new Date().toISOString();
    const cleanedTarget = symbolOrCompany.trim().replace(/^\$/, '').toUpperCase();

    const resolvedSymbol = await this.resolveTicker(symbolOrCompany);
    if (!resolvedSymbol) {
      return {
        symbol: cleanedTarget,
        retrievedAt,
        source: 'finnhub',
        error: `I couldn't find valid market data for ${cleanedTarget}. Please provide a valid stock ticker or company name.`,
      };
    }

    const promises: Array<Promise<void>> = [];
    let quote: StockQuote | undefined;
    let profile: CompanyProfile | undefined;
    let news: CompanyNewsItem[] | undefined;
    let metrics: FinancialMetrics | undefined;

    if (options.includeQuote) {
      promises.push(
        this.getStockQuote(resolvedSymbol).then((res) => {
          if (res) quote = res;
        }),
      );
    }

    if (options.includeProfile) {
      promises.push(
        this.getCompanyProfile(resolvedSymbol).then((res) => {
          if (res) profile = res;
        }),
      );
    }

    if (options.includeNews) {
      promises.push(
        this.getCompanyNews(resolvedSymbol).then((res) => {
          if (res) news = res;
        }),
      );
    }

    if (options.includeMetrics) {
      promises.push(
        this.getBasicMetrics(resolvedSymbol).then((res) => {
          if (res) metrics = res;
        }),
      );
    }

    await Promise.all(promises);

    const hasData = quote || profile || (news && news.length > 0) || metrics;

    if (!hasData) {
      return {
        symbol: resolvedSymbol,
        retrievedAt,
        source: 'finnhub',
        error: `I couldn't find valid market data for ${resolvedSymbol}. Please provide a valid stock ticker or company name.`,
      };
    }

    return {
      symbol: resolvedSymbol,
      companyName: profile?.name,
      quote,
      profile,
      news,
      metrics,
      retrievedAt,
      source: 'finnhub',
    };
  }

  async isHealthy(): Promise<boolean> {
    return this.financeProvider.isHealthy();
  }
}
