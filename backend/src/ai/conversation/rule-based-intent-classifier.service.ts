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
      /^\/?start\b/i.test(text) ||
      /^(hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening|how are you|how's it going|what's up|who are you|what can you do|help)\b/i.test(
        text,
      ) ||
      /^(hi|hello|hey|thanks|help|howdy|ok|okay|bye|goodbye)$/i.test(text)
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

    // 3. Financial News & Market Movement: What is the latest news about NVIDIA? / Why did it move?
    if (
      /\b(news|latest news|headline|headlines|article|articles|press release|market news|company news)\b/i.test(
        text,
      ) ||
      /\b(why did (it|the stock|the price|that)|what caused (that|it|the move|the drop|the rise|the fall)|why (did|has) (it|the price|the stock) (move|moving|moved|fall|fallen|drop|dropped|rise|risen|gain|gained|plummet|soar|dip|dipped|crash))\b/i.test(
        text,
      )
    ) {
      return {
        category: IntentCategory.FINANCIAL_NEWS,
        confidence: 0.9,
        reasoning: 'Matched financial news or market movement query pattern',
      };
    }

    // 4. Stock Price: What is Apple's stock price? / What's AAPL trading at?
    if (
      /\b(stock price|price|trading at|quote|share price|current price|ticker price|stock value|share value|market price)\b/i.test(
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
      /\b(p\/e|pe ratio|valuation|market cap|market capitalization|52 week|52-week|ebitda|gross margin|operating margin|eps|earnings per share|financial metrics|metrics|financials|financial data|financial info)\b/i.test(
        text,
      )
    ) {
      return {
        category: IntentCategory.FINANCIAL_METRICS,
        confidence: 0.9,
        reasoning: 'Matched financial metrics query pattern',
      };
    }

    // 6. Document Content Queries (placed before SEC_FILINGS & FINANCIAL_METRICS for document & financial report queries)
    if (
      /\b(document|pdf|file|transcript|prospectus|uploaded|balance sheet|balance sheets|total assets|total liabilities|cash flows|operating income|net income|business segments|business segment|in its 10-k|in the 10-k|in 10-k|this 10-k|its 10-k|in document|from document)\b/i.test(
        text,
      ) ||
      (/\b(describe|explain|summarize|summary|what does|according to)\b/i.test(text) &&
        /\b(10-k|10k|10-q|10q|8-k|8k|report)\b/i.test(text)) ||
      (/\b(revenue|operating income|segments|fiscal year)\b/i.test(text) &&
        /\b(fiscal|fiscal year|fy25|fy2025|2025|segments|three main|main business)\b/i.test(text))
    ) {
      return {
        category: IntentCategory.DOCUMENT_QUERY,
        confidence: 0.95,
        reasoning: 'Matched document query or financial statement pattern',
      };
    }

    // 7. SEC Filings: 10-K, 10-Q, 8-K, sec filing, edgar, accession number
    if (
      /\b(sec|edgar|10-k|10k|10-q|10q|8-k|8k|filing|filings|accession number|accession)\b/i.test(
        text,
      )
    ) {
      return {
        category: IntentCategory.SEC_FILINGS,
        confidence: 0.95,
        reasoning: 'Matched SEC EDGAR filing keywords',
      };
    }

    // 8. Watchlist
    if (/\b(watchlist|track list|monitored stocks)\b/i.test(text)) {
      return {
        category: IntentCategory.WATCHLIST,
        confidence: 0.85,
        reasoning: 'Matched watchlist keywords',
      };
    }

    // 9. Alert
    if (/\b(alert|notify|trigger|price target)\b/i.test(text)) {
      return {
        category: IntentCategory.ALERT,
        confidence: 0.85,
        reasoning: 'Matched alert keywords',
      };
    }

    // 10. Macro / Market info
    if (
      /\b(s&p|nasdaq|dow|fed|inflation|interest rates|treasury|yield curve|macro|market info|market information|market data|market update|market updates|market overview|market performance)\b/i.test(
        text,
      )
    ) {
      return {
        category: IntentCategory.MARKET_INFORMATION,
        confidence: 0.85,
        reasoning: 'Matched macro market information keywords',
      };
    }

    // 11. Company Research: Tell me about Microsoft / company profile / overview / research
    if (
      /\b(tell me about|about|profile|overview|company info|information on|information for|research|details on|details for|company overview|stock overview)\b/i.test(
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
