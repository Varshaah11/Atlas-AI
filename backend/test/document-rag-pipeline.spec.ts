import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DocumentAgent, NO_DOCUMENT_INFO_FOUND_MESSAGE } from '@/ai/agents/document-agent';
import { AgentRegistryService } from '@/ai/agents/agent-registry.service';
import { DocumentSearchService } from '@/documents/document-search.service';
import { RuleBasedIntentClassifier } from '@/ai/conversation/rule-based-intent-classifier.service';
import { IntentCategory } from '@/ai/conversation/conversation.types';
import { ConversationTask } from '@/ai/orchestrator/conversation-task';
import { ExecutionContext } from '@/ai/orchestrator/execution-context';
import { AppLogger } from '@/common/logger/logger.service';
import { DOCUMENT_QUERY_SYSTEM_PROMPT } from '@/ai/prompts/atlas-system.prompt';
import { GroqService } from '@/ai/groq.service';

function makeTask(intent: IntentCategory, message: string): ConversationTask {
  return {
    id: 't1',
    conversationId: 'c1',
    userId: 'user-1',
    intent,
    message,
    entities: { companies: [], tickers: [] },
    needsClarification: false,
    createdAt: new Date().toISOString(),
  };
}

describe('Document RAG Pipeline & Financial Intelligence Tests', () => {
  let documentAgent: DocumentAgent;
  let documentSearchService: DocumentSearchService;
  let intentClassifier: RuleBasedIntentClassifier;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const sampleChunks = [
    {
      documentId: 'doc-msft-2025',
      filename: 'MSFT_FY25q4_10K.pdf',
      pageNumber: 37,
      chunkIndex: 0,
      content: `INCOME STATEMENTS
Fiscal Year 2025 Financial Results:
Revenue: $281,724 million
Operating Income: $128,528 million
Net Income: $101,834 million`,
      score: 0.95,
    },
    {
      documentId: 'doc-msft-2025',
      filename: 'MSFT_FY25q4_10K.pdf',
      pageNumber: 42,
      chunkIndex: 1,
      content: `CONSOLIDATED BALANCE SHEETS
As of June 30, 2025
Assets
Current assets:
  Cash and cash equivalents $34,746 million
  Short-term investments $43,245 million
  Total current assets $120,400 million
Property, plant, and equipment $142,500 million
Operating lease right-of-use assets $45,000 million
Total assets $619,003 million`,
      score: 0.98,
    },
    {
      documentId: 'doc-msft-2025',
      filename: 'MSFT_FY25q4_10K.pdf',
      pageNumber: 12,
      chunkIndex: 2,
      content: `BUSINESS SEGMENTS
Microsoft operates in three main business segments:
1. Productivity and Business Processes (Office, LinkedIn, Dynamics)
2. Intelligent Cloud (Azure, Windows Server, SQL Server)
3. More Personal Computing (Windows, Gaming, Devices, Search)`,
      score: 0.92,
    },
    {
      documentId: 'doc-msft-2025',
      filename: 'MSFT_FY25q4_10K.pdf',
      pageNumber: 5,
      chunkIndex: 3,
      content: `ARTIFICIAL INTELLIGENCE & CLOUD INITIATIVES
Microsoft is integrating copilot AI features and generative artificial intelligence across its product suite, expanding Azure AI cloud infrastructure and AI models.`,
      score: 0.90,
    },
  ];

  beforeEach(async () => {
    const searchServiceMock = {
      search: jest.fn().mockImplementation(async (userId: string, query: string, topK: number) => {
        const qLower = query.toLowerCase();
        if (qLower.includes('2030') || qLower.includes('mars')) {
          return [];
        }
        return sampleChunks;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentAgent,
        AgentRegistryService,
        RuleBasedIntentClassifier,
        { provide: DocumentSearchService, useValue: searchServiceMock },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    documentAgent = module.get<DocumentAgent>(DocumentAgent);
    documentSearchService = module.get<DocumentSearchService>(DocumentSearchService);
    intentClassifier = module.get<RuleBasedIntentClassifier>(RuleBasedIntentClassifier);
  });

  it('TEST 1: Intent classifier routes document revenue query to DOCUMENT_QUERY and retrieves context', async () => {
    const query = "What was Microsoft's revenue in fiscal year 2025?";
    const intent = await intentClassifier.classify(query);
    expect(intent.category).toBe(IntentCategory.DOCUMENT_QUERY);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'c1',
      task: makeTask(intent.category, query),
      conversationHistory: [],
      metadata: {},
      services: {} as any,
    };

    const result = await documentAgent.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('Revenue: $281,724 million');
  });

  it('TEST 2: Intent classifier routes business segments query to DOCUMENT_QUERY and retrieves segments', async () => {
    const query = "What are Microsoft's three main business segments?";
    const intent = await intentClassifier.classify(query);
    expect(intent.category).toBe(IntentCategory.DOCUMENT_QUERY);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'c1',
      task: makeTask(intent.category, query),
      conversationHistory: [],
      metadata: {},
      services: {} as any,
    };

    const result = await documentAgent.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('Productivity and Business Processes');
    expect(result.output).toContain('Intelligent Cloud');
    expect(result.output).toContain('More Personal Computing');
  });

  it('TEST 3: Intent classifier routes operating income query to DOCUMENT_QUERY and retrieves operating income', async () => {
    const query = "What was Microsoft's operating income in fiscal year 2025?";
    const intent = await intentClassifier.classify(query);
    expect(intent.category).toBe(IntentCategory.DOCUMENT_QUERY);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'c1',
      task: makeTask(intent.category, query),
      conversationHistory: [],
      metadata: {},
      services: {} as any,
    };

    const result = await documentAgent.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('Operating Income: $128,528 million');
  });

  it('TEST 4: Intent classifier routes total assets query to DOCUMENT_QUERY and retrieves $619,003 million', async () => {
    const query = "What are Microsoft's total assets as of June 30, 2025?";
    const intent = await intentClassifier.classify(query);
    expect(intent.category).toBe(IntentCategory.DOCUMENT_QUERY);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'c1',
      task: makeTask(intent.category, query),
      conversationHistory: [],
      metadata: {},
      services: {} as any,
    };

    const result = await documentAgent.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('Total assets $619,003 million');
  });

  it('TEST 5: Intent classifier routes balance sheet query to DOCUMENT_QUERY and retrieves balance sheet chunk', async () => {
    const query = "What does the balance sheet report for total assets?";
    const intent = await intentClassifier.classify(query);
    expect(intent.category).toBe(IntentCategory.DOCUMENT_QUERY);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'c1',
      task: makeTask(intent.category, query),
      conversationHistory: [],
      metadata: {},
      services: {} as any,
    };

    const result = await documentAgent.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('CONSOLIDATED BALANCE SHEETS');
    expect(result.output).toContain('Total assets $619,003 million');
  });

  it('TEST 6: Out-of-bounds query (2030 revenue) returns no chunks found without hallucinating', async () => {
    const query = "What was Microsoft's revenue in fiscal year 2030?";
    const intent = await intentClassifier.classify(query);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'c1',
      task: makeTask(intent.category, query),
      conversationHistory: [],
      metadata: {},
      services: {} as any,
    };

    const result = await documentAgent.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toBe(NO_DOCUMENT_INFO_FOUND_MESSAGE);
    expect(result.metadata?.noChunksFound).toBe(true);
  });

  it('TEST 7: AI description query routes to DOCUMENT_QUERY and retrieves AI section', async () => {
    const query = "How does Microsoft describe artificial intelligence in its 2025 10-K?";
    const intent = await intentClassifier.classify(query);
    expect(intent.category).toBe(IntentCategory.DOCUMENT_QUERY);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'c1',
      task: makeTask(intent.category, query),
      conversationHistory: [],
      metadata: {},
      services: {} as any,
    };

    const result = await documentAgent.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('ARTIFICIAL INTELLIGENCE & CLOUD INITIATIVES');
  });

  it('TEST 8: Completely unrelated question produces grounded "not found" response', async () => {
    const query = "What is the capital of Mars in the uploaded document?";
    const intent = await intentClassifier.classify(query);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'c1',
      task: makeTask(intent.category, query),
      conversationHistory: [],
      metadata: {},
      services: {} as any,
    };

    const result = await documentAgent.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toBe(NO_DOCUMENT_INFO_FOUND_MESSAGE);
  });

  it('TEST 9: DocumentAgent context output MUST NOT contain internal RAG metadata', async () => {
    const query = "Summarize this document.";
    const intent = await intentClassifier.classify(query);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'c1',
      task: makeTask(intent.category, query),
      conversationHistory: [],
      metadata: {},
      services: {} as any,
    };

    const result = await documentAgent.execute(context);
    expect(result.output).not.toContain('Document ID');
    expect(result.output).not.toContain('Chunk Index');
    expect(result.output).not.toContain('Similarity Score');
    expect(DOCUMENT_QUERY_SYSTEM_PROMPT).toContain('NO INTERNAL RAG TERMINOLOGY');
  });

  describe('Groq 429 & Rate Limit Error Handling Tests', () => {
    it('returns a clean user-facing rate limit message when Groq returns HTTP 429', async () => {
      const groqService = new GroqService(
        { get: (key: string) => (key === 'GROQ_API_KEY' ? 'fake-key' : undefined) } as any,
        mockLogger as any,
      );
      groqService.onModuleInit();

      const rateLimitError = new Error('Rate limit reached for model llama-3.3-70b-versatile (TPD: 100000)');
      (rateLimitError as any).status = 429;

      // Mock groq completion create to simulate 429 rate limit
      (groqService as any).groq = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(rateLimitError),
          },
        },
      };

      const res = await groqService.generateResponse({
        systemInstruction: 'sys',
        contents: [{ role: 'user', parts: [{ text: 'What is total assets?' }] }],
        messageCount: 1,
      });

      expect(res.text).toBe('The AI analysis service is temporarily rate limited by the LLM provider. Please wait a moment and try again.');
      expect(res.text).not.toContain('fake-key');
      expect(res.text).not.toContain('100000');
      expect(res.text).not.toContain('llama-3.3-70b-versatile');
    });

    it('attempts single fallback to llama-3.1-8b-instant when primary model is rate limited', async () => {
      const groqService = new GroqService(
        { get: (key: string) => (key === 'GROQ_API_KEY' ? 'fake-key' : undefined) } as any,
        mockLogger as any,
      );
      groqService.onModuleInit();

      const rateLimitError = new Error('Rate limit reached for model llama-3.3-70b-versatile (TPD: 100000)');
      (rateLimitError as any).status = 429;

      const mockCreate = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ choices: [{ message: { content: "Microsoft's total assets as of June 30, 2025 were $619,003 million." } }] });

      (groqService as any).groq = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      };

      const res = await groqService.generateResponse({
        systemInstruction: 'sys',
        contents: [{ role: 'user', parts: [{ text: 'What are total assets?' }] }],
        messageCount: 1,
      });

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(mockCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({ model: 'llama-3.1-8b-instant' })
      );
      expect(res.text).toBe("Microsoft's total assets as of June 30, 2025 were $619,003 million.");
    });

    it('returns concise response for factual document query on normal successful Groq call', async () => {
      const groqService = new GroqService(
        { get: (key: string) => (key === 'GROQ_API_KEY' ? 'fake-key' : undefined) } as any,
        mockLogger as any,
      );
      groqService.onModuleInit();

      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{ message: { content: "Microsoft's total assets as of June 30, 2025 were $619,003 million." } }],
      });

      (groqService as any).groq = {
        chat: {
          completions: { create: mockCreate },
        },
      };

      const res = await groqService.generateResponse({
        systemInstruction: DOCUMENT_QUERY_SYSTEM_PROMPT,
        contents: [{ role: 'user', parts: [{ text: 'What are Microsoft total assets?' }] }],
        messageCount: 1,
      });

      expect(res.text).toBe("Microsoft's total assets as of June 30, 2025 were $619,003 million.");
    });
  });
});
