export interface SecFilingItem {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
  primaryDocDescription?: string;
  documentUrl?: string;
}

export interface SecCompanyFilings {
  cik: string;
  companyName?: string;
  ticker?: string;
  recentFilings: SecFilingItem[];
  retrievedAt: string;
  error?: string;
}

export interface ISecEdgarProvider {
  isHealthy(): Promise<boolean>;
  getCompanyCik(tickerOrName: string): Promise<string | null>;
  getRecentFilings(
    tickerOrName: string,
    forms?: string[],
    limit?: number,
  ): Promise<SecCompanyFilings>;
}

export const SEC_EDGAR_PROVIDER_TOKEN = 'ISecEdgarProvider';
