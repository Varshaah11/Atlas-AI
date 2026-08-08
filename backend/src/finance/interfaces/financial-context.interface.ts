import {
  CompanyNewsItem,
  CompanyProfile,
  FinancialMetrics,
  StockQuote,
} from './finance-provider.interface';

export interface FinancialContext {
  symbol: string;
  companyName?: string;
  quote?: StockQuote;
  profile?: CompanyProfile;
  metrics?: FinancialMetrics;
  news?: CompanyNewsItem[];
  retrievedAt: string;
  source: 'finnhub';
  error?: string;
}
