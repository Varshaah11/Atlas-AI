export enum IntentCategory {
  GENERAL_CHAT = 'GENERAL_CHAT',
  COMPANY_RESEARCH = 'COMPANY_RESEARCH',
  COMPANY_COMPARISON = 'COMPANY_COMPARISON',
  MARKET_INFORMATION = 'MARKET_INFORMATION',
  DOCUMENT_QUERY = 'DOCUMENT_QUERY',
  WATCHLIST = 'WATCHLIST',
  ALERT = 'ALERT',
  UNKNOWN = 'UNKNOWN',
}

export interface ExtractedEntities {
  companies: string[];
  tickers: string[];
  dates?: string[];
  metrics?: string[];
  requestedActions?: string[];
}

export interface IntentResult {
  category: IntentCategory;
  confidence: number;
  reasoning?: string;
}
