import { Test, TestingModule } from '@nestjs/testing';
import { ConversationAgentService } from '../src/ai/conversation/conversation-agent.service';
import { EntityExtractorService } from '../src/ai/conversation/entity-extractor.service';
import { RuleBasedIntentClassifier } from '../src/ai/conversation/rule-based-intent-classifier.service';
import { ClarificationService } from '../src/ai/conversation/clarification.service';
import { AgentRegistryService } from '../src/ai/agents/agent-registry.service';
import { INTENT_CLASSIFIER_TOKEN } from '../src/ai/conversation/intent-classifier.interface';
import { AppLogger } from '../src/common/logger/logger.service';
import { IntentCategory } from '../src/ai/conversation/conversation.types';
import { ContextBuilderService } from '../src/ai/context/context-builder.service';
import { ChatMessageContext, TelegramUserData } from '../src/shared/interfaces';

describe('Conversational Entity Inheritance Suite', () => {
  let conversationAgent: ConversationAgentService;
  const mockUserData: TelegramUserData = { telegramId: '12345', firstName: 'TestUser' };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationAgentService,
        EntityExtractorService,
        RuleBasedIntentClassifier,
        ClarificationService,
        AgentRegistryService,
        {
          provide: INTENT_CLASSIFIER_TOKEN,
          useClass: RuleBasedIntentClassifier,
        },
        {
          provide: AppLogger,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    conversationAgent = moduleRef.get<ConversationAgentService>(ConversationAgentService);
  });

  it('Test Case A — /start with NVDA in history does NOT inherit NVDA', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'What is the current price of NVDA?' },
      { role: 'assistant', content: 'NVDA — Market Snapshot: $120.00' },
      { role: 'user', content: '/start' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: '/start', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).toEqual([]);
    expect(task.intent).toBe(IntentCategory.GENERAL_CHAT);
  });

  it('Test Case B — "hi" with NVDA in history remains GENERAL_CHAT and does NOT inherit NVDA', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'What is the current price of NVDA?' },
      { role: 'assistant', content: 'NVDA — Market Snapshot: $120.00' },
      { role: 'user', content: 'hi' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'hi', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).toEqual([]);
    expect(task.intent).toBe(IntentCategory.GENERAL_CHAT);
  });

  it('Test Case C — "hello" with NVDA in history remains GENERAL_CHAT and does NOT inherit NVDA', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'What is the current price of NVDA?' },
      { role: 'assistant', content: 'NVDA — Market Snapshot: $120.00' },
      { role: 'user', content: 'hello' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'hello', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).toEqual([]);
    expect(task.intent).toBe(IntentCategory.GENERAL_CHAT);
  });

  it('Test Case D — "thanks" with NVDA in history remains GENERAL_CHAT and does NOT inherit NVDA', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'What is the current price of NVDA?' },
      { role: 'assistant', content: 'NVDA — Market Snapshot: $120.00' },
      { role: 'user', content: 'thanks' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'thanks', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).toEqual([]);
    expect(task.intent).toBe(IntentCategory.GENERAL_CHAT);
  });

  it('Test Case E — Direct entity: "What is the current price of NVDA?" resolves NVDA', async () => {
    const task = await conversationAgent.processMessageToTask(
      { messageText: 'What is the current price of NVDA?', userData: mockUserData },
      'conv-1',
      'user-1',
    );

    expect(task.intent).toBe(IntentCategory.STOCK_PRICE);
    expect(task.entities.tickers).toContain('NVDA');
    expect(task.needsClarification).toBeFalsy();
  });

  it('Test Case F — Follow-up: "Why did it move?" after NVDA inherits NVDA from history', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'What is the current price of NVDA?' },
      { role: 'assistant', content: 'NVDA — Market Snapshot\nCurrent Price: $120.00' },
      { role: 'user', content: 'Why did it move?' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'Why did it move?', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).toEqual(['NVDA']);
    expect(task.intent).toBe(IntentCategory.FINANCIAL_NEWS);
    expect(task.needsClarification).toBeFalsy();
  });

  it('Test Case G — Metric follow-up: "What about its P/E?" after NVDA inherits NVDA', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'What is the current price of NVDA?' },
      { role: 'assistant', content: 'NVDA — Market Snapshot' },
      { role: 'user', content: 'What about its P/E?' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'What about its P/E?', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).toEqual(['NVDA']);
    expect(task.intent).toBe(IntentCategory.FINANCIAL_METRICS);
    expect(task.needsClarification).toBeFalsy();
  });

  it('Test Case H — Explicit TSLA overrides inherited NVDA', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'What is the current price of NVDA?' },
      { role: 'assistant', content: 'NVDA — Market Snapshot...' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'What is the price of TSLA?', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).toEqual(['TSLA']);
    expect(task.needsClarification).toBeFalsy();
  });

  it('Test Case I — Ambiguous comparison: "Compare NVDA and AMD." then "Why did it move?" requests clarification', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'What is the current price of NVDA?' },
      { role: 'assistant', content: 'NVDA — Market Snapshot: $120.00' },
      { role: 'user', content: 'Why did it move?' },
      { role: 'assistant', content: 'NVDA moved because...' },
      { role: 'user', content: 'What about its P/E?' },
      { role: 'assistant', content: 'NVDA P/E is 45.2' },
      { role: 'user', content: 'What is the price of AMD?' },
      { role: 'assistant', content: 'AMD — Market Snapshot: $150.00' },
      { role: 'user', content: 'Compare NVDA and AMD.' },
      { role: 'assistant', content: 'Side-by-side comparison of NVDA and AMD:\nSymbol: NVDA... Symbol: AMD...' },
      { role: 'user', content: 'Why did it move?' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'Why did it move?', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.needsClarification).toBe(true);
    expect(task.clarificationQuestion).toContain('NVDA');
    expect(task.clarificationQuestion).toContain('AMD');
    expect(task.clarificationQuestion).not.toContain('AAPL');
  });

  it('Test Case J — Existing P/E regression: "What is the P/E ratio of NVDA?" resolves NVDA (never P / Everpure)', async () => {
    const task = await conversationAgent.processMessageToTask(
      { messageText: 'What is the P/E ratio of NVDA?', userData: mockUserData },
      'conv-1',
      'user-1',
    );

    expect(task.entities.tickers).toEqual(['NVDA']);
    expect(task.entities.tickers).not.toContain('P');
    expect(task.needsClarification).toBeFalsy();
  });

  it('ContextBuilderService — Prevents current user message duplication and respects window limit', () => {
    const contextBuilder = new ContextBuilderService();
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'Turn 1 user' },
      { role: 'assistant', content: 'Turn 1 assistant' },
      { role: 'user', content: 'Turn 2 user' },
      { role: 'assistant', content: 'Turn 2 assistant' },
      { role: 'user', content: 'Turn 3 user' },
      { role: 'assistant', content: 'Turn 3 assistant' },
      { role: 'user', content: 'Current prompt user' },
    ];

    const fullCurrentPrompt = 'Current prompt user\n\n[RETRIEVED FINANCIAL DATA]';
    const prepared = contextBuilder.buildContext(history, fullCurrentPrompt);

    // Filter user messages in prepared contents
    const userMessages = prepared.contents.filter((c) => c.role === 'user');

    // Verify that "Current prompt user" only appears once at the very end
    expect(userMessages.length).toBe(3); // Turn 1, Turn 2, and current prompt
    expect(userMessages[userMessages.length - 1].parts[0].text).toBe(fullCurrentPrompt);
    expect(userMessages.filter(u => u.parts[0].text.includes('Current prompt user')).length).toBe(1);
  });

  it('MessageService — getConversationHistory retrieves MOST RECENT messages in asc order when history exceeds limit', async () => {
    const mockPrisma = {
      message: {
        findMany: jest.fn().mockImplementation(({ take }) => {
          // Generate 25 messages in desc order (most recent first)
          const descMsgs: any[] = [];
          for (let i = 25; i >= 1; i--) {
            descMsgs.push({
              id: `msg-${i}`,
              role: i % 2 === 1 ? 'USER' : 'ASSISTANT',
              content: `Message ${i}`,
              createdAt: new Date(100000 + i * 1000),
            });
          }
          return descMsgs.slice(0, take);
        }),
      },
    };

    const { MessageService } = await import('../src/chat/services/message.service');
    const service = new MessageService(
      mockPrisma as any,
      { debug: jest.fn() } as any,
    );

    const history = await service.getConversationHistory('conv-1', 20);

    expect(history.length).toBe(20);
    // Should contain messages 6 through 25 in chronological (asc) order
    expect(history[0].content).toBe('Message 6');
    expect(history[19].content).toBe('Message 25');
  });

  it('Entity Inheritance — Inherits tickers from stored message metadata if text extraction is ambiguous', async () => {
    const history: ChatMessageContext[] = [
      {
        role: 'user',
        content: 'Compare NVDA and AMD.',
        metadata: { entities: { tickers: ['NVDA', 'AMD'] } },
      },
      {
        role: 'assistant',
        content: 'I compared both tech leaders.',
        metadata: { entities: { tickers: ['NVDA', 'AMD'] } },
      },
      { role: 'user', content: 'Why did it move?' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'Why did it move?', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.needsClarification).toBe(true);
    expect(task.clarificationQuestion).toContain('NVDA');
    expect(task.clarificationQuestion).toContain('AMD');
  });

  it('Clarification Continuation A — Responding "NVDA" to clarification preserves FINANCIAL_NEWS intent and resolves NVDA', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'Compare NVDA and AMD.' },
      { role: 'assistant', content: 'Side-by-side comparison of NVDA and AMD...' },
      { role: 'user', content: 'Why did it move?' },
      {
        role: 'assistant',
        content: 'Which stock are you referring to? (NVDA or AMD)',
        metadata: { intent: IntentCategory.FINANCIAL_NEWS, clarified: true },
      },
      { role: 'user', content: 'NVDA' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'NVDA', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.intent).toBe(IntentCategory.FINANCIAL_NEWS);
    expect(task.entities.tickers).toEqual(['NVDA']);
    expect(task.needsClarification).toBe(false);
  });

  it('Clarification Continuation B — Responding "AMD" to clarification preserves FINANCIAL_NEWS intent and resolves AMD', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'Compare NVDA and AMD.' },
      { role: 'assistant', content: 'Side-by-side comparison of NVDA and AMD...' },
      { role: 'user', content: 'Why did it move?' },
      {
        role: 'assistant',
        content: 'Which stock are you referring to? (NVDA or AMD)',
        metadata: { intent: IntentCategory.FINANCIAL_NEWS, clarified: true },
      },
      { role: 'user', content: 'AMD' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'AMD', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.intent).toBe(IntentCategory.FINANCIAL_NEWS);
    expect(task.entities.tickers).toEqual(['AMD']);
    expect(task.needsClarification).toBe(false);
  });

  it('Clarification Continuation C — Responding "NVDA" to metric clarification preserves FINANCIAL_METRICS intent', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'Compare NVDA and AMD.' },
      { role: 'assistant', content: 'Side-by-side comparison of NVDA and AMD...' },
      { role: 'user', content: 'What about its P/E?' },
      {
        role: 'assistant',
        content: 'Which stock are you referring to? (NVDA or AMD)',
        metadata: { intent: IntentCategory.FINANCIAL_METRICS, clarified: true },
      },
      { role: 'user', content: 'NVDA' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'NVDA', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.intent).toBe(IntentCategory.FINANCIAL_METRICS);
    expect(task.entities.tickers).toEqual(['NVDA']);
    expect(task.needsClarification).toBe(false);
  });

  it('Clarification Continuation D — Selected entity overrides multi-entity context without requiring clarification again', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'Compare NVDA and AMD.' },
      { role: 'assistant', content: 'Side-by-side comparison of NVDA and AMD...' },
      { role: 'user', content: 'Why did it move?' },
      {
        role: 'assistant',
        content: 'Which stock are you referring to? (NVDA or AMD)',
        metadata: { intent: IntentCategory.FINANCIAL_NEWS, clarified: true },
      },
      { role: 'user', content: 'NVDA' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'NVDA', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.needsClarification).toBe(false);
    expect(task.entities.tickers).toEqual(['NVDA']);
  });

  it('AI Token Test 1 — /start followed by "What about its P/E?" does NOT resolve "AI" and requests clarification', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: '/start' },
      { role: 'assistant', content: 'Welcome to Finora! I am your AI financial assistant.' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'What about its P/E?', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).not.toContain('AI');
    expect(task.entities.tickers).toEqual([]);
    expect(task.needsClarification).toBe(true);
    expect(task.clarificationQuestion).toContain('Which company or stock symbol are you asking about?');
  });

  it('AI Token Test 2 — "What is the P/E of AI?" allows explicit AI ticker', async () => {
    const task = await conversationAgent.processMessageToTask(
      { messageText: 'What is the P/E of AI?', userData: mockUserData },
      'conv-1',
      'user-1',
    );

    expect(task.entities.tickers).toEqual(['AI']);
    expect(task.needsClarification).toBeFalsy();
  });

  it('AI Token Test 3 — "$AI price" resolves AI ticker via explicit dollar prefix', async () => {
    const task = await conversationAgent.processMessageToTask(
      { messageText: '$AI price', userData: mockUserData },
      'conv-1',
      'user-1',
    );

    expect(task.entities.tickers).toEqual(['AI']);
  });

  it('AI Token Test 4 — "I\'m interested in AI companies" remains GENERAL_CHAT and does NOT resolve AI ticker', async () => {
    const task = await conversationAgent.processMessageToTask(
      { messageText: "I'm interested in AI companies", userData: mockUserData },
      'conv-1',
      'user-1',
    );

    expect(task.intent).toBe(IntentCategory.GENERAL_CHAT);
    expect(task.entities.tickers).not.toContain('AI');
    expect(task.entities.tickers).toEqual([]);
  });

  it('Start Boundary Test 1 — Old NVDA history -> /start -> "What about its P/E?" does NOT inherit NVDA and requests clarification', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'What is the current price of NVDA?' },
      { role: 'assistant', content: 'NVDA — Market Snapshot: $120.50' },
      { role: 'user', content: 'Why did it move?' },
      { role: 'assistant', content: 'NVDA moved because...' },
      { role: 'user', content: 'What about its P/E?' },
      { role: 'assistant', content: 'NVDA P/E is 45.2' },
      { role: 'user', content: '/start' },
      { role: 'assistant', content: 'Welcome to Finora! I am your financial assistant.' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'What about its P/E?', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).toEqual([]);
    expect(task.needsClarification).toBe(true);
    expect(task.clarificationQuestion).toContain('Which company or stock symbol are you asking about?');
  });

  it('Start Boundary Test 2 — Old AMD history -> /start -> "What about its P/E?" does NOT inherit AMD and requests clarification', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: 'What is the price of AMD?' },
      { role: 'assistant', content: 'AMD — Market Snapshot: $150.00' },
      { role: 'user', content: '/start' },
      { role: 'assistant', content: 'Welcome to Finora!' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'What about its P/E?', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).toEqual([]);
    expect(task.needsClarification).toBe(true);
  });

  it('Start Boundary Test 3 — /start -> explicit NVDA query -> "Why did it move?" STILL inherits NVDA normally', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: '/start' },
      { role: 'assistant', content: 'Welcome to Finora!' },
      { role: 'user', content: 'What is the current price of NVDA?' },
      { role: 'assistant', content: 'NVDA — Market Snapshot: $120.50' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'Why did it move?', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).toEqual(['NVDA']);
    expect(task.needsClarification).toBeFalsy();
  });

  it('Start Boundary Test 4 — /start -> "hi" -> "What about its P/E?" does NOT inherit any ticker', async () => {
    const history: ChatMessageContext[] = [
      { role: 'user', content: '/start' },
      { role: 'assistant', content: 'Welcome to Finora!' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Hello! How can I help you?' },
    ];

    const task = await conversationAgent.processMessageToTask(
      { messageText: 'What about its P/E?', userData: mockUserData },
      'conv-1',
      'user-1',
      history,
    );

    expect(task.entities.tickers).toEqual([]);
    expect(task.needsClarification).toBe(true);
  });

  describe('Explicit Ticker & Market Movement Analysis Routing Suite', () => {
    it('1. "Why did NVDA move?" classifies as FINANCIAL_NEWS, extracts NVDA, and requires no clarification', async () => {
      const task = await conversationAgent.processMessageToTask(
        { messageText: 'Why did NVDA move?', userData: mockUserData },
        'conv-1',
        'user-1',
      );

      expect(task.intent).toBe(IntentCategory.FINANCIAL_NEWS);
      expect(task.entities.tickers).toEqual(['NVDA']);
      expect(task.needsClarification).toBeFalsy();
    });

    it('2. "Why is NVDA down?" classifies as FINANCIAL_NEWS, extracts NVDA, and requires no clarification', async () => {
      const task = await conversationAgent.processMessageToTask(
        { messageText: 'Why is NVDA down?', userData: mockUserData },
        'conv-1',
        'user-1',
      );

      expect(task.intent).toBe(IntentCategory.FINANCIAL_NEWS);
      expect(task.entities.tickers).toEqual(['NVDA']);
      expect(task.needsClarification).toBeFalsy();
    });

    it('3. "Why is AMD up?" classifies as FINANCIAL_NEWS, extracts AMD, and requires no clarification', async () => {
      const task = await conversationAgent.processMessageToTask(
        { messageText: 'Why is AMD up?', userData: mockUserData },
        'conv-1',
        'user-1',
      );

      expect(task.intent).toBe(IntentCategory.FINANCIAL_NEWS);
      expect(task.entities.tickers).toEqual(['AMD']);
      expect(task.needsClarification).toBeFalsy();
    });

    it('4. "What caused AAPL to move?" classifies as FINANCIAL_NEWS, extracts AAPL, and requires no clarification', async () => {
      const task = await conversationAgent.processMessageToTask(
        { messageText: 'What caused AAPL to move?', userData: mockUserData },
        'conv-1',
        'user-1',
      );

      expect(task.intent).toBe(IntentCategory.FINANCIAL_NEWS);
      expect(task.entities.tickers).toEqual(['AAPL']);
      expect(task.needsClarification).toBeFalsy();
    });

    it('5. Ensures explicit tickers are preserved and route to MarketAgent for movement queries', async () => {
      const task = await conversationAgent.processMessageToTask(
        { messageText: 'Why did NVDA move?', userData: mockUserData },
        'conv-1',
        'user-1',
      );

      const agentRegistry = new AgentRegistryService({ log: jest.fn(), warn: jest.fn() } as any);
      const mockFinanceService = {} as any;
      const { MarketAgent } = await import('../src/ai/agents/market-agent');
      const marketAgent = new MarketAgent(mockFinanceService, agentRegistry, { log: jest.fn(), warn: jest.fn() } as any);

      expect(marketAgent.canHandle(task)).toBe(true);
    });
  });
});
