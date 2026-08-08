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

    // 1. General conversation greetings & basic prompts (must NEVER call Finnhub)
    if (
      /^(hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening|how are you|how's it going|what's up|who are you|what can you do|help)\b/i.test(
        text,
      ) ||
      /^(hi|hello|hey|thanks|help|howdy)$/i.test(text)
    ) {
      return {
        category: IntentCategory.GENERAL_CHAT,
        confidence: 0.95,
        reasoning: 'Matched general chat or greeting pattern',
      };
    }

    // 2. Comparison: Compare Apple and Microsoft / AAPL vs MSFT
    if (/\b(compare|versus|vs\.?|peer analysis|benchmark|side by side)\b/i.test(text)) {
      return {
        category: IntentCategory.STOCK_COMPARISON,
        confidence: 0.9,
        reasoning: 'Matched stock comparison keywords',
      };
    }

    // 3. Financial News: What is the latest news about NVIDIA? / NVDA news
    if (/\b(news|latest news|headline|headlines|article|articles|press release)\b/i.test(text)) {
      return {
        category: IntentCategory.FINANCIAL_NEWS,
        confidence: 0.9,
        reasoning: 'Matched financial news keywords',
      };
    }

    // 4. Stock Price: What is Apple's stock price? / What's AAPL trading at?
    if (
      /\b(stock price|price|trading at|quote|share price|current price|ticker price)\b/i.test(
        text,
      ) ||
      /what'?s? \$?[a-z0-9]{1,15} (trading at|worth|at)/i.test(text)
    ) {
      return {
        category: IntentCategory.STOCK_PRICE,
        confidence: 0.9,
        reasoning: 'Matched stock price query pattern',
      };
    }

    // 5. Financial Metrics: P/E ratio, market cap, 52 week high/low, ebitda, revenue, margin
    if (
      /\b(p\/e|pe ratio|valuation|market cap|market capitalization|52 week|52-week|ebitda|gross margin|operating margin|eps|earnings per share|financial metrics|metrics)\b/i.test(
        text,
      )
    ) {
      return {
        category: IntentCategory.FINANCIAL_METRICS,
        confidence: 0.9,
        reasoning: 'Matched financial metrics query pattern',
      };
    }

    // 6. Watchlist
    if (/\b(watchlist|track list|monitored stocks)\b/i.test(text)) {
      return {
        category: IntentCategory.WATCHLIST,
        confidence: 0.85,
        reasoning: 'Matched watchlist keywords',
      };
    }

    // 7. Alert
    if (/\b(alert|notify|trigger|price target)\b/i.test(text)) {
      return {
        category: IntentCategory.ALERT,
        confidence: 0.85,
        reasoning: 'Matched alert keywords',
      };
    }

    // 8. Document
    if (/\b(document|pdf|file|transcript|prospectus|10-k|10-q)\b/i.test(text)) {
      return {
        category: IntentCategory.DOCUMENT_QUERY,
        confidence: 0.85,
        reasoning: 'Matched document query keywords',
      };
    }

    // 9. Macro / Market info
    if (
      /\b(s&p|nasdaq|dow|fed|inflation|interest rates|treasury|yield curve|macro)\b/i.test(text)
    ) {
      return {
        category: IntentCategory.MARKET_INFORMATION,
        confidence: 0.85,
        reasoning: 'Matched macro market information keywords',
      };
    }

    // 10. Company Research: Tell me about Microsoft / company profile / overview / research
    if (
      /\b(tell me about|about|profile|overview|company info|information on|research|details on)\b/i.test(
        text,
      )
    ) {
      return {
        category: IntentCategory.COMPANY_RESEARCH,
        confidence: 0.9,
        reasoning: 'Matched company research query pattern',
      };
    }

    return {
      category: IntentCategory.GENERAL_CHAT,
      confidence: 0.6,
      reasoning: 'Default conversational query classification',
    };
  }
}
