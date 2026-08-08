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

    // 1. Extract explicit ticker symbols with optional $ prefix (e.g. $AAPL, AAPL, INVALIDTICKERXYZ)
    const tickerMatches = text.match(/\b\$?([A-Z]{1,12})\b/g);
    if (tickerMatches) {
      for (const raw of tickerMatches) {
        const symbol = raw.replace('$', '');
        // Exclude common English short uppercase words
        if (
          ![
            'A',
            'I',
            'IN',
            'IS',
            'IT',
            'K',
            'ON',
            'OR',
            'Q',
            'S',
            'US',
            'THE',
            'AND',
            'FOR',
            'WHAT',
            'WHATS',
            'TELL',
            'SHOW',
            'ME',
            'MOST',
            'RECENT',
            'FILING',
            'DATE',
            'SEC',
          ].includes(symbol)
        ) {
          tickers.add(symbol);
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
