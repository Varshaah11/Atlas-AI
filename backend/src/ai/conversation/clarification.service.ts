import { Injectable } from '@nestjs/common';
import { ExtractedEntities, IntentCategory } from './conversation.types';

@Injectable()
export class ClarificationService {
  evaluateClarification(
    intent: IntentCategory,
    entities: ExtractedEntities,
    _rawMessage: string,
  ): { needsClarification: boolean; clarificationQuestion?: string } {
    // 1. COMPANY_RESEARCH or SEC_FILINGS: If a company name or ticker symbol is already present, do NOT ask for clarification.
    if (
      (intent === IntentCategory.COMPANY_RESEARCH || intent === IntentCategory.SEC_FILINGS) &&
      (entities.companies?.length || 0) === 0 &&
      (entities.tickers?.length || 0) === 0
    ) {
      return {
        needsClarification: true,
        clarificationQuestion:
          'Which company or stock symbol would you like to research? (e.g., "Tell me about Microsoft" or "AAPL")',
      };
    }

    // 2. Comparison query: Require at least 2 companies or tickers
    if (
      (intent === IntentCategory.STOCK_COMPARISON ||
        intent === IntentCategory.COMPANY_COMPARISON) &&
      (entities.companies?.length || 0) < 2 &&
      (entities.tickers?.length || 0) < 2
    ) {
      return {
        needsClarification: true,
        clarificationQuestion:
          'Which peer companies would you like to compare against? (e.g., "Compare Microsoft vs. Apple")',
      };
    }

    return {
      needsClarification: false,
    };
  }
}
