import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ISecEdgarProvider,
  SecCompanyFilings,
  SecFilingItem,
} from '../interfaces/sec-edgar.interface';
import { AppLogger } from '@/common/logger/logger.service';

const COMMON_CIKS: Record<string, string> = {
  AAPL: '0000320193',
  MSFT: '0000789019',
  NVDA: '0001045810',
  GOOGL: '0001652044',
  GOOG: '0001652044',
  AMZN: '0001018724',
  TSLA: '0001318605',
  META: '0001326801',
};

interface CikCacheEntry {
  mapping: Map<string, string>;
  expiresAt: number;
}

@Injectable()
export class SecEdgarProvider implements ISecEdgarProvider {
  private readonly userAgent: string;
  private cikMapCache: CikCacheEntry | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.userAgent =
      this.configService.get<string>('SEC_USER_AGENT') || 'Finora ResearchBot admin@finora.com';
    this.logger.log(
      `SecEdgarProvider initialized with User-Agent: "${this.userAgent}"`,
      'SecEdgarProvider',
    );
  }

  async isHealthy(): Promise<boolean> {
    try {
      const testCik = await this.getCompanyCik('AAPL');
      return !!testCik;
    } catch {
      return false;
    }
  }

  private async fetchWithUserAgent<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn(
          `SEC EDGAR HTTP Error [${response.status} ${response.statusText}] for ${url}`,
          'SecEdgarProvider',
        );
        return null;
      }

      const data = await response.json();
      return data as T;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch from SEC EDGAR URL ${url}: ${error.message}`,
        error.stack,
        'SecEdgarProvider',
      );
      return null;
    }
  }

  private async loadCikMapping(): Promise<Map<string, string>> {
    if (this.cikMapCache && Date.now() < this.cikMapCache.expiresAt) {
      return this.cikMapCache.mapping;
    }

    const mapping = new Map<string, string>();
    // Pre-seed common dictionary
    Object.entries(COMMON_CIKS).forEach(([ticker, cik]) => {
      mapping.set(ticker, cik);
    });

    try {
      const raw = await this.fetchWithUserAgent<Record<string, any>>(
        'https://www.sec.gov/files/company_tickers.json',
      );

      if (raw) {
        Object.values(raw).forEach((entry: any) => {
          if (entry.ticker && entry.cik_str) {
            const cikStr = String(entry.cik_str).padStart(10, '0');
            const tickerUpper = String(entry.ticker).toUpperCase();
            mapping.set(tickerUpper, cikStr);
            if (entry.title) {
              mapping.set(String(entry.title).toLowerCase(), cikStr);
            }
          }
        });
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to load online company_tickers.json from SEC EDGAR: ${error.message}`,
        'SecEdgarProvider',
      );
    }

    this.cikMapCache = {
      mapping,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour TTL
    };

    return mapping;
  }

  async getCompanyCik(tickerOrName: string): Promise<string | null> {
    const raw = tickerOrName.trim().replace(/^\$/, '');
    if (!raw) return null;

    const upper = raw.toUpperCase();
    const lower = raw.toLowerCase();

    this.logger.log(`[SEC] Resolving ticker/company: "${raw}"`, 'SecEdgarProvider');

    if (COMMON_CIKS[upper]) {
      const cik = COMMON_CIKS[upper];
      this.logger.log(`[SEC] Resolved ${upper} → CIK ${cik}`, 'SecEdgarProvider');
      return cik;
    }

    const cikMap = await this.loadCikMapping();
    if (cikMap.has(upper)) {
      const cik = cikMap.get(upper)!;
      this.logger.log(`[SEC] Resolved ${upper} → CIK ${cik}`, 'SecEdgarProvider');
      return cik;
    }
    if (cikMap.has(lower)) {
      const cik = cikMap.get(lower)!;
      this.logger.log(`[SEC] Resolved "${lower}" → CIK ${cik}`, 'SecEdgarProvider');
      return cik;
    }

    this.logger.warn(`[SEC] Could not resolve CIK for "${raw}"`, 'SecEdgarProvider');
    return null;
  }

  async getRecentFilings(
    tickerOrName: string,
    forms: string[] = ['10-K', '10-Q', '8-K'],
    limit = 5,
  ): Promise<SecCompanyFilings> {
    const retrievedAt = new Date().toISOString();
    const cik = await this.getCompanyCik(tickerOrName);

    if (!cik) {
      return {
        cik: '',
        ticker: tickerOrName.toUpperCase(),
        recentFilings: [],
        retrievedAt,
        error: `Could not resolve SEC CIK number for "${tickerOrName}".`,
      };
    }

    const paddedCik = cik.padStart(10, '0');
    const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
    this.logger.log(`[SEC] Fetching SEC submissions for CIK ${paddedCik}`, 'SecEdgarProvider');

    const data = await this.fetchWithUserAgent<any>(url);

    if (!data || !data.filings || !data.filings.recent) {
      this.logger.warn(`[SEC] No filings object returned for CIK ${paddedCik}`, 'SecEdgarProvider');
      return {
        cik: paddedCik,
        companyName: data?.name || undefined,
        ticker: tickerOrName.toUpperCase(),
        recentFilings: [],
        retrievedAt,
        error: `No recent SEC filings returned from EDGAR for CIK ${paddedCik}.`,
      };
    }

    const recent = data.filings.recent;
    const totalCount = recent.form?.length || 0;
    this.logger.log(
      `[SEC] Retrieved ${totalCount} total filing items from SEC EDGAR for CIK ${paddedCik}`,
      'SecEdgarProvider',
    );

    const targetFormsUpper = forms.map((f) => f.toUpperCase());
    const candidates: SecFilingItem[] = [];

    const cikInt = parseInt(paddedCik, 10);

    for (let i = 0; i < totalCount; i++) {
      const form = recent.form[i]?.toUpperCase();
      if (form && (targetFormsUpper.length === 0 || targetFormsUpper.includes(form))) {
        const accessionNumber = recent.accessionNumber[i];
        const primaryDocument = recent.primaryDocument[i];
        const filingDate = recent.filingDate[i];
        const primaryDocDescription = recent.primaryDocDescription?.[i] || '';

        const accessionNoDashes = accessionNumber ? accessionNumber.replace(/-/g, '') : '';
        const documentUrl =
          accessionNoDashes && primaryDocument
            ? `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accessionNoDashes}/${primaryDocument}`
            : undefined;

        candidates.push({
          form,
          filingDate,
          accessionNumber,
          primaryDocument,
          primaryDocDescription,
          documentUrl,
        });
      }
    }

    this.logger.log(
      `[SEC] Filtered ${candidates.length} records matching forms [${targetFormsUpper.join(', ')}]`,
      'SecEdgarProvider',
    );

    // CRITICAL REQUIREMENT: Sort candidates by actual filingDate descending (newest first)
    candidates.sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());

    const topFilings = candidates.slice(0, limit);

    if (topFilings.length > 0) {
      const latest = topFilings[0];
      this.logger.log(
        `[SEC] Latest ${latest.form} filing for ${tickerOrName}: Date: ${latest.filingDate} | Accession: ${latest.accessionNumber}`,
        'SecEdgarProvider',
      );
    }

    return {
      cik: paddedCik,
      companyName: data.name || undefined,
      ticker: tickerOrName.toUpperCase(),
      recentFilings: topFilings,
      retrievedAt,
    };
  }
}
