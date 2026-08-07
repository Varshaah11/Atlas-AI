import { Injectable } from '@nestjs/common';
import { ExtractedEntities, IntentCategory } from './conversation.types';

@Injectable()
export class ClarificationService {
  evaluateClarification(
    intent: IntentCategory,
    entities: ExtractedEntities,
    rawMessage: string,
  ): { needsClarification: boolean; clarificationQuestion?: string } {
    const text = rawMessage.trim();
    const wordCount = text.split(/\s+/).length;

    // Ambiguity Trigger 1: Single company query with very brief wording and no specific metric requested
    // Example: "Tell me about Apple." or "Apple"
    if (
      intent === IntentCategory.COMPANY_RESEARCH &&
      entities.companies.length === 1 &&
      (entities.metrics?.length || 0) === 0 &&
      wordCount <= 5
    ) {
      const companyName = entities.companies[0];
      return {
        needsClarification: true,
        clarificationQuestion: `Are you interested in ${companyName}'s latest financial performance (revenue/earnings), valuation metrics, company overview, or peer comparison?`,
      };
    }

    // Ambiguity Trigger 2: Comparison query with only 1 company extracted
    if (intent === IntentCategory.COMPANY_COMPARISON && entities.companies.length < 2) {
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
