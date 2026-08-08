import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CompanyNewsItem,
  CompanyProfile,
  FinancialMetrics,
  IFinanceProvider,
  StockQuote,
  SymbolSearchResult,
} from '../interfaces/finance-provider.interface';
import { AppLogger } from '@/common/logger/logger.service';

@Injectable()
export class FinnhubProvider implements IFinanceProvider {
  private readonly apiKey: string | null;
  private readonly baseUrl = 'https://finnhub.io/api/v1';

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.apiKey = this.configService.get<string>('FINNHUB_API_KEY') || null;
    if (!this.apiKey) {
      this.logger.warn(
        'FINNHUB_API_KEY is not configured. Finance provider running in unconfigured mode.',
        'FinnhubProvider',
      );
    } else {
      this.logger.log('FinnhubProvider initialized with API key.', 'FinnhubProvider');
    }
  }

  async isHealthy(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  private async fetchFromFinnhub<T>(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<T | null> {
    if (!this.apiKey) {
      this.logger.warn(
        `Finnhub API key unconfigured. Skipping request to ${endpoint}`,
        'FinnhubProvider',
      );
      return null;
    }

    const queryParams = new URLSearchParams({
      ...params,
      token: this.apiKey,
    });

    const url = `${this.baseUrl}${endpoint}?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.error(
          `Finnhub HTTP Error [${response.status} ${response.statusText}] for ${endpoint}`,
          undefined,
          'FinnhubProvider',
        );
        return null;
      }

      const data = await response.json();
      return data as T;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch from Finnhub endpoint ${endpoint}: ${error.message}`,
        error.stack,
        'FinnhubProvider',
      );
      return null;
    }
  }

  async getQuote(symbol: string): Promise<StockQuote | null> {
    const uppercaseSymbol = symbol.trim().toUpperCase();
    const raw = await this.fetchFromFinnhub<any>('/quote', { symbol: uppercaseSymbol });

    if (!raw || (raw.c === 0 && raw.pc === 0 && raw.h === 0 && raw.l === 0)) {
      this.logger.warn(
        `No valid quote data returned for symbol ${uppercaseSymbol}`,
        'FinnhubProvider',
      );
      return null;
    }

    return {
      currentPrice: raw.c,
      change: raw.d,
      percentChange: raw.dp,
      high: raw.h,
      low: raw.l,
      open: raw.o,
      previousClose: raw.pc,
      timestamp: raw.t,
    };
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
    const uppercaseSymbol = symbol.trim().toUpperCase();
    const raw = await this.fetchFromFinnhub<any>('/stock/profile2', { symbol: uppercaseSymbol });

    if (!raw || !raw.name) {
      this.logger.warn(
        `No valid profile data returned for symbol ${uppercaseSymbol}`,
        'FinnhubProvider',
      );
      return null;
    }

    return {
      name: raw.name,
      ticker: raw.ticker || uppercaseSymbol,
      exchange: raw.exchange,
      industry: raw.finnhubIndustry,
      country: raw.country,
      currency: raw.currency,
      marketCapitalization: raw.marketCapitalization,
      logo: raw.logo,
      weburl: raw.weburl,
      shareOutstanding: raw.shareOutstanding,
    };
  }

  async getCompanyNews(symbol: string, from: string, to: string): Promise<CompanyNewsItem[]> {
    const uppercaseSymbol = symbol.trim().toUpperCase();
    const raw = await this.fetchFromFinnhub<any[]>('/company-news', {
      symbol: uppercaseSymbol,
      from,
      to,
    });

    if (!Array.isArray(raw)) {
      return [];
    }

    const companyKeywords: Record<string, string[]> = {
      MSFT: ['microsoft', 'msft'],
      AAPL: ['apple', 'aapl', 'iphone', 'mac', 'ipad'],
      NVDA: ['nvidia', 'nvda'],
      TSLA: ['tesla', 'tsla'],
      AMZN: ['amazon', 'amzn', 'aws'],
      GOOGL: ['google', 'alphabet', 'googl', 'goog'],
      META: ['meta', 'facebook', 'instagram'],
    };

    const searchTerms = companyKeywords[uppercaseSymbol] || [uppercaseSymbol.toLowerCase()];

    // Strict news relevance filter: keep only articles that explicitly mention the ticker or company in headline/summary
    const relevantArticles = raw.filter((item) => {
      const text = `${item.headline || ''} ${item.summary || ''}`.toLowerCase();
      return searchTerms.some((term) => text.includes(term));
    });

    return relevantArticles.slice(0, 5).map((item) => ({
      id: item.id,
      category: item.category,
      datetime: item.datetime,
      headline: item.headline,
      source: item.source,
      summary: item.summary,
      url: item.url,
    }));
  }

  async getBasicMetrics(symbol: string): Promise<FinancialMetrics | null> {
    const uppercaseSymbol = symbol.trim().toUpperCase();
    const raw = await this.fetchFromFinnhub<any>('/stock/metric', {
      symbol: uppercaseSymbol,
      metric: 'all',
    });

    if (!raw || !raw.metric) {
      return null;
    }

    const m = raw.metric;
    const metrics: FinancialMetrics = {};

    if (m['52WeekHigh'] !== undefined) metrics.fiftyTwoWeekHigh = m['52WeekHigh'];
    if (m['52WeekLow'] !== undefined) metrics.fiftyTwoWeekLow = m['52WeekLow'];
    if (m['peTTM'] !== undefined) metrics.peRatio = m['peTTM'];
    if (m['marketCapitalization'] !== undefined) metrics.marketCap = m['marketCapitalization'];

    return Object.keys(metrics).length > 0 ? metrics : null;
  }

  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const raw = await this.fetchFromFinnhub<any>('/search', { q: cleanQuery });

    if (!raw || !Array.isArray(raw.result)) {
      return [];
    }

    return raw.result.map((item: any) => ({
      description: item.description,
      displaySymbol: item.displaySymbol,
      symbol: item.symbol,
      type: item.type,
    }));
  }
}
