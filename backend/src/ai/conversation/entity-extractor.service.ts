import { Injectable } from '@nestjs/common';
import { ExtractedEntities } from './conversation.types';

const KNOWN_TICKER_MAP: Record<string, string> = {
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

@Injectable()
export class EntityExtractorService {
  extractEntities(message: string): ExtractedEntities {
    const text = message.trim();
    const lowerText = text.toLowerCase();

    const tickers = new Set<string>();
    const companies = new Set<string>();
    const metrics = new Set<string>();
    const dates = new Set<string>();
    const requestedActions = new Set<string>();

    // 1. Extract explicit ticker symbols with optional $ prefix (e.g. $AAPL, AAPL, $P)
    const tickerMatches = text.match(/(\$[A-Za-z0-9]{1,12}|\b[A-Z]{1,12}\b)/g);
    if (tickerMatches) {
      const EXCLUDED_TOKENS = new Set([
        'IN', 'IS', 'IT', 'ON', 'OR', 'US', 'THE', 'AND', 'FOR', 'WHAT',
        'WHATS', 'TELL', 'SHOW', 'ME', 'MOST', 'RECENT', 'FILING', 'DATE',
        'SEC', 'PE', 'EPS', 'EBITDA', 'ROE', 'ROA', 'ROIC', 'NAV', 'FCF',
        'CAGR', 'YTD', 'TTM', 'USD', 'FY', 'Q1', 'Q2', 'Q3', 'Q4', 'BUY',
        'SELL', 'HOLD', 'ALL', 'TOP', 'GET', 'CAN', 'HAS', 'HAD', 'NOT',
        'BUT', 'OUT', 'OUR', 'NEW', 'NEWS', 'NOW', 'WHY', 'DID', 'MOVE',
        'MOVED', 'PRICE', 'STOCK', 'STOCKS', 'VALUE', 'INFO', 'OVERVIEW', 'RATIO',
        'COMPANY', 'RESEARCH', 'COMPARE', 'VERSUS', 'SIDE', 'BY', 'SIDE',
        'CURRENT', 'LATEST', 'MARKET', 'DATA', 'DETAILS', 'FINANCIAL',
        'FINANCIALS', 'METRICS', 'ABOUT', 'LIKE', 'SOME', 'WITH', 'FROM',
        'ITS', 'THAT', 'THIS', 'RISE', 'FALL', 'FALLEN', 'DROPPED', 'HIGH',
        'LOW', 'VALUATION', 'REVENUE', 'CAUSE', 'CAUSED', 'VS', 'CHANGE',
        'OPEN', 'CLOSE', 'DAILY', 'PREVIOUS', 'SNAPSHOT', 'SYMBOL', 'NAME',
        'INDUSTRY', 'EXCHANGE', 'URL', 'SOURCE', 'TIMESTAMP', 'AUTHORITATIVE'
      ]);

      for (const raw of tickerMatches) {
        const symbol = raw.replace('$', '');
        const isExplicitDollar = raw.startsWith('$');

        if (isExplicitDollar && /[A-Za-z]/.test(symbol)) {
          tickers.add(symbol);
        } else if (symbol.length > 1 && !EXCLUDED_TOKENS.has(symbol) && !/^\d+$/.test(symbol)) {
          if (symbol === 'AI') {
            // Require explicit financial ticker context before treating ambiguous "AI" as stock symbol C3.ai
            const isExplicitAiTicker =
              /\b(ai (stock|stocks|shares?|ticker|quote|price|valuation|metrics|p\/e|pe)|(price|quote|valuation|p\/e|pe|metrics|financials) (of|for|on) ai|c3\.?ai)\b/i.test(text);
            if (isExplicitAiTicker) {
              tickers.add(symbol);
            }
          } else {
            tickers.add(symbol);
          }
        }
      }
    }

    // 2. Map known company names to tickers & companies
    for (const [name, symbol] of Object.entries(KNOWN_TICKER_MAP)) {
      if (lowerText.includes(name)) {
        companies.add(name.charAt(0).toUpperCase() + name.slice(1));
        tickers.add(symbol);
      }
    }

    // 3. Extract financial metrics
    const metricKeywords = [
      'revenue',
      'earnings',
      'net income',
      'ebitda',
      'free cash flow',
      'pe ratio',
      'gross margin',
      'operating margin',
      'debt to equity',
    ];
    for (const metric of metricKeywords) {
      if (lowerText.includes(metric)) {
        metrics.add(metric);
      }
    }

    // 4. Extract dates/periods
    const dateMatches = text.match(/\b(Q[1-4]\s?\d{0,4}|\d{4}|20\d{2})\b/gi);
    if (dateMatches) {
      for (const d of dateMatches) {
        dates.add(d.toUpperCase());
      }
    }

    // 5. Extract actions
    const actionKeywords = ['analyze', 'compare', 'evaluate', 'summarize', 'forecast', 'track'];
    for (const action of actionKeywords) {
      if (lowerText.includes(action)) {
        requestedActions.add(action);
      }
    }

    return {
      companies: Array.from(companies),
      tickers: Array.from(tickers),
      metrics: Array.from(metrics),
      dates: Array.from(dates),
      requestedActions: Array.from(requestedActions),
    };
  }
}
