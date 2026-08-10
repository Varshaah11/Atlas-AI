import { normalizeTelegramText } from '../src/telegram/telegram.utils';
import { EntityExtractorService } from '../src/ai/conversation/entity-extractor.service';
import { RuleBasedIntentClassifier } from '../src/ai/conversation/rule-based-intent-classifier.service';
import { IntentCategory } from '../src/ai/conversation/conversation.types';

describe('Telegram Formatting & Entity Resolution Suite', () => {
  describe('normalizeTelegramText', () => {
    it('1. Strips bold syntax **text** and __text__', () => {
      const input = '**AAPL — Market Snapshot**\n**Key Metrics**';
      const expected = 'AAPL — Market Snapshot\nKey Metrics';
      expect(normalizeTelegramText(input)).toBe(expected);
    });

    it('2. Strips italic syntax *text*', () => {
      const input = '*Current Price:* $313.33';
      const expected = 'Current Price: $313.33';
      expect(normalizeTelegramText(input)).toBe(expected);
    });

    it('3. Converts markdown headers #, ##, ### to clean text', () => {
      const input = '# Header 1\n## Header 2\n### Header 3';
      const expected = 'Header 1\nHeader 2\nHeader 3';
      expect(normalizeTelegramText(input)).toBe(expected);
    });

    it('4. Converts markdown list bullets (-, *, +) to bullet points (•)', () => {
      const input = '- Item 1\n* Item 2\n+ Item 3';
      const expected = '• Item 1\n• Item 2\n• Item 3';
      expect(normalizeTelegramText(input)).toBe(expected);
    });

    it('5. Converts markdown links [Label](URL) to Label (URL) while keeping URLs intact', () => {
      const input = 'Read more at [Apple News](https://apple.com/news)';
      const expected = 'Read more at Apple News (https://apple.com/news)';
      expect(normalizeTelegramText(input)).toBe(expected);
    });

    it('6. Strips inline code backticks and strikethroughs', () => {
      const input = 'Price: `$313.33` and ~~old price~~';
      const expected = 'Price: $313.33 and old price';
      expect(normalizeTelegramText(input)).toBe(expected);
    });

    it('7. Handles complex multi-section Markdown output correctly', () => {
      const input = `**AAPL — Market Snapshot**

**Key Metrics**
- Current Price: $313.33
- P/E: 35.47`;

      const expected = `AAPL — Market Snapshot

Key Metrics
• Current Price: $313.33
• P/E: 35.47`;

      expect(normalizeTelegramText(input)).toBe(expected);
    });
  });

  describe('EntityExtractorService Ticker Resolution', () => {
    let extractor: EntityExtractorService;

    beforeEach(() => {
      extractor = new EntityExtractorService();
    });

    it('1. Resolves NVDA correctly for "What is the P/E ratio of NVDA?" and ignores P and E', () => {
      const result = extractor.extractEntities('What is the P/E ratio of NVDA?');
      expect(result.tickers).toContain('NVDA');
      expect(result.tickers).not.toContain('P');
      expect(result.tickers).not.toContain('E');
    });

    it('2. Preserves explicit $ single-letter tickers like "$P" or "$F"', () => {
      const result = extractor.extractEntities('What is the current price of $P?');
      expect(result.tickers).toContain('P');
    });

    it('3. Extracts AAPL for "Give me the latest market information for AAPL"', () => {
      const result = extractor.extractEntities('Give me the latest market information for AAPL');
      expect(result.tickers).toContain('AAPL');
    });

    it('4. Extracts TSLA for "What\'s the current price of TSLA?"', () => {
      const result = extractor.extractEntities("What's the current price of TSLA?");
      expect(result.tickers).toContain('TSLA');
    });

    it('5. Extracts AMZN for "Latest news about AMZN"', () => {
      const result = extractor.extractEntities('Latest news about AMZN');
      expect(result.tickers).toContain('AMZN');
    });

    it('6. Extracts AAPL and MSFT for "Compare AAPL and MSFT"', () => {
      const result = extractor.extractEntities('Compare AAPL and MSFT');
      expect(result.tickers).toContain('AAPL');
      expect(result.tickers).toContain('MSFT');
    });
  });

  describe('RuleBasedIntentClassifier Onboarding', () => {
    let classifier: RuleBasedIntentClassifier;

    beforeEach(() => {
      classifier = new RuleBasedIntentClassifier();
    });

    it('1. Classifies /start as GENERAL_CHAT', async () => {
      const result = await classifier.classify('/start');
      expect(result.category).toBe(IntentCategory.GENERAL_CHAT);
    });

    it('2. Classifies onboarding statement "I\'m a student interested in technology stocks" as GENERAL_CHAT', async () => {
      const result = await classifier.classify("I'm a student interested in technology stocks");
      expect(result.category).toBe(IntentCategory.GENERAL_CHAT);
    });
  });
});
