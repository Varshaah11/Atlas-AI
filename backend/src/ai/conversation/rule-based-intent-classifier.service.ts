import { Injectable } from '@nestjs/common';
import { IntentCategory, IntentResult } from './conversation.types';
import { IIntentClassifier } from './intent-classifier.interface';

@Injectable()
export class RuleBasedIntentClassifier implements IIntentClassifier {
  async classify(message: string): Promise<IntentResult> {
    const text = message.toLowerCase().trim();

    if (!text) {
      return { category: IntentCategory.UNKNOWN, confidence: 0.0 };
    }

    if (/\b(compare|versus|vs\.?|peer analysis|benchmark)\b/.test(text)) {
      return {
        category: IntentCategory.COMPANY_COMPARISON,
        confidence: 0.9,
        reasoning: 'Matched comparison keywords (vs, compare, peer analysis)',
      };
    }

    if (/\b(watchlist|track list|monitored stocks)\b/.test(text)) {
      return {
        category: IntentCategory.WATCHLIST,
        confidence: 0.85,
        reasoning: 'Matched watchlist keywords',
      };
    }

    if (/\b(alert|notify|trigger|price target)\b/.test(text)) {
      return {
        category: IntentCategory.ALERT,
        confidence: 0.85,
        reasoning: 'Matched alert keywords',
      };
    }

    if (/\b(document|pdf|file|transcript|prospectus)\b/.test(text)) {
      return {
        category: IntentCategory.DOCUMENT_QUERY,
        confidence: 0.85,
        reasoning: 'Matched document query keywords',
      };
    }

    if (
      /\b(market|s&p|nasdaq|dow|fed|inflation|interest rates|treasury|yield curve|macro)\b/.test(
        text,
      )
    ) {
      return {
        category: IntentCategory.MARKET_INFORMATION,
        confidence: 0.85,
        reasoning: 'Matched macro market information keywords',
      };
    }

    if (
      /\b(revenue|earnings|ebitda|p\/e|valuation|balance sheet|cash flow|financials|ticker|stock|10-k|10-q|q1|q2|q3|q4|profit|margin|growth|sec)\b/.test(
        text,
      ) ||
      /\b[a-z]{1,5}\b/.test(text)
    ) {
      return {
        category: IntentCategory.COMPANY_RESEARCH,
        confidence: 0.8,
        reasoning: 'Matched financial metric or company research patterns',
      };
    }

    if (/\b(hi|hello|hey|who are you|what can you do|help)\b/.test(text)) {
      return {
        category: IntentCategory.GENERAL_CHAT,
        confidence: 0.95,
        reasoning: 'Matched general chat or greeting pattern',
      };
    }

    return {
      category: IntentCategory.GENERAL_CHAT,
      confidence: 0.6,
      reasoning: 'Default conversational query classification',
    };
  }
}
