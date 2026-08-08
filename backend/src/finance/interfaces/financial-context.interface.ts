import {
  CompanyNewsItem,
  CompanyProfile,
  FinancialMetrics,
  StockQuote,
} from './finance-provider.interface';
import { SecCompanyFilings } from './sec-edgar.interface';

export interface FinancialContext {
  symbol: string;
  companyName?: string;
  quote?: StockQuote;
  profile?: CompanyProfile;
  metrics?: FinancialMetrics;
  news?: CompanyNewsItem[];
  secFilings?: SecCompanyFilings;
  retrievedAt: string;
  source: 'finnhub' | 'finnhub+sec_edgar';
  error?: string;
}
