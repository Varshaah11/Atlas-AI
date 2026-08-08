export const FINANCE_PROVIDER_TOKEN = 'IFinanceProvider';

export interface StockQuote {
  currentPrice: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

export interface CompanyProfile {
  name: string;
  ticker: string;
  exchange?: string;
  industry?: string;
  country?: string;
  currency?: string;
  marketCapitalization?: number;
  logo?: string;
  weburl?: string;
  shareOutstanding?: number;
}

export interface CompanyNewsItem {
  id?: number | string;
  category?: string;
  datetime?: number;
  headline: string;
  source?: string;
  summary?: string;
  url?: string;
}

export interface FinancialMetrics {
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  peRatio?: number;
  marketCap?: number;
  [key: string]: number | string | undefined;
}

export interface SymbolSearchResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

export interface IFinanceProvider {
  isHealthy(): Promise<boolean>;
  getQuote(symbol: string): Promise<StockQuote | null>;
  getCompanyProfile(symbol: string): Promise<CompanyProfile | null>;
  getCompanyNews(symbol: string, from: string, to: string): Promise<CompanyNewsItem[]>;
  getBasicMetrics(symbol: string): Promise<FinancialMetrics | null>;
  searchSymbol(query: string): Promise<SymbolSearchResult[]>;
}
