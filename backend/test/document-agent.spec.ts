import { Test, TestingModule } from '@nestjs/testing';
import { DocumentAgent, NO_DOCUMENT_INFO_FOUND_MESSAGE } from '@/ai/agents/document-agent';
import { DocumentSearchService } from '@/documents/document-search.service';
import { AgentRegistryService } from '@/ai/agents/agent-registry.service';
import { ExecutionPipelineService } from '@/ai/pipeline/execution-pipeline.service';
import { ResearchAgent } from '@/ai/agents/research-agent';
import { MarketAgent } from '@/ai/agents/market-agent';
import { IntentCategory } from '@/ai/conversation/conversation.types';
import { CONTEXT_BUILDER_TOKEN } from '@/ai/context/interfaces/context-builder.interface';
import { LLM_PROVIDER_TOKEN } from '@/ai/interfaces/llm-provider.interface';
import { AppLogger } from '@/common/logger/logger.service';
import { MemoryService } from '@/memory/memory.service';
import { ExecutionContext } from '@/ai/orchestrator/execution-context';
import { ConversationTask } from '@/ai/orchestrator/conversation-task';
import { RuleBasedIntentClassifier } from '@/ai/conversation/rule-based-intent-classifier.service';
import { ConfigService } from '@nestjs/config';

describe('DocumentAgent', () => {
  let documentAgent: DocumentAgent;
  let documentSearchService: DocumentSearchService;
  let executionPipelineService: ExecutionPipelineService;
  let llmProviderMock: any;
  let researchAgentMock: any;
  let marketAgentMock: any;

  let appLoggerMock: any;
  let configServiceMock: any;

  function makeTask(intent: IntentCategory, message: string): ConversationTask {
    return {
      id: 'task-1',
      conversationId: 'conv-1',
      userId: 'user-1',
      intent,
      message,
      entities: { companies: [], tickers: [] },
      needsClarification: false,
      createdAt: new Date().toISOString(),
    };
  }

  beforeEach(async () => {
    const searchServiceMock = {
      search: jest.fn(),
    };

    llmProviderMock = {
      generateResponse: jest.fn().mockResolvedValue({ text: 'Answer from LLM', executionTimeMs: 50 }),
    };

    researchAgentMock = {
      name: 'ResearchAgent',
      canHandle: jest.fn().mockReturnValue(true),
      execute: jest.fn().mockResolvedValue({
        agentName: 'ResearchAgent',
        success: true,
        output: '[RETRIEVED SEC EDGAR OFFICIAL FILINGS]\n10-K Data',
      }),
    };

    marketAgentMock = {
      name: 'MarketAgent',
      canHandle: jest.fn().mockReturnValue(true),
      execute: jest.fn().mockResolvedValue({
        agentName: 'MarketAgent',
        success: true,
        output: 'Market data',
      }),
    };

    const contextBuilderMock = {
      buildContext: jest.fn().mockImplementation((history, prompt, sysPrompt) => ({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: sysPrompt,
        messageCount: 1,
      })),
    };

    const memoryServiceMock = {
      buildMemoryPromptContext: jest.fn().mockResolvedValue(null),
      extractAndUpdateMemoryAsync: jest.fn().mockResolvedValue(undefined),
    };

    appLoggerMock = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() };
    configServiceMock = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentAgent,
        AgentRegistryService,
        ExecutionPipelineService,
        { provide: DocumentSearchService, useValue: searchServiceMock },
        { provide: LLM_PROVIDER_TOKEN, useValue: llmProviderMock },
        { provide: CONTEXT_BUILDER_TOKEN, useValue: contextBuilderMock },
        { provide: ResearchAgent, useValue: researchAgentMock },
        { provide: MarketAgent, useValue: marketAgentMock },
        { provide: MemoryService, useValue: memoryServiceMock },
        {
          provide: AppLogger,
          useValue: appLoggerMock,
        },
      ],
    }).compile();

    documentAgent = module.get<DocumentAgent>(DocumentAgent);
    documentSearchService = module.get<DocumentSearchService>(DocumentSearchService);
    executionPipelineService = module.get<ExecutionPipelineService>(ExecutionPipelineService);
  });

  it('relevant document question retrieves chunks and produces formatted context & documentIds metadata', async () => {
    (documentSearchService.search as jest.Mock).mockResolvedValue([
      {
        documentId: 'doc-123',
        filename: 'report.pdf',
        pageNumber: 2,
        chunkIndex: 0,
        content: 'Q3 Revenue was $50 Million.',
        score: 0.88,
      },
    ]);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'conv-1',
      task: makeTask(IntentCategory.DOCUMENT_QUERY, 'What was the Q3 revenue in the report?'),
      conversationHistory: [],
      metadata: {},
      services: { logger: appLoggerMock, config: configServiceMock },
    };

    const result = await documentAgent.execute(context);

    expect(result.success).toBe(true);
    expect(result.output).toContain('[RETRIEVED DOCUMENT CONTEXT]');
    expect(result.output).toContain('report.pdf');
    expect(result.output).toContain('Q3 Revenue was $50 Million.');
    expect(result.metadata?.documentIds).toEqual(['doc-123']);
    expect(documentSearchService.search).toHaveBeenCalledWith('user-1', 'What was the Q3 revenue in the report?', 10);
  });

  it('no matching chunks produces the "couldn\'t find" response', async () => {
    (documentSearchService.search as jest.Mock).mockResolvedValue([]);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'conv-1',
      task: makeTask(IntentCategory.DOCUMENT_QUERY, 'What is the secret recipe?'),
      conversationHistory: [],
      metadata: {},
      services: { logger: appLoggerMock, config: configServiceMock },
    };

    const result = await documentAgent.execute(context);

    expect(result.success).toBe(true);
    expect(result.output).toBe(NO_DOCUMENT_INFO_FOUND_MESSAGE);
    expect(result.metadata?.noChunksFound).toBe(true);
    expect(result.metadata?.documentIds).toEqual([]);
  });

  it('enforces user isolation by passing userId to search service', async () => {
    (documentSearchService.search as jest.Mock).mockResolvedValue([]);

    const context: ExecutionContext = {
      userId: 'isolated-user-999',
      conversationId: 'conv-1',
      task: makeTask(IntentCategory.DOCUMENT_QUERY, 'Get my documents'),
      conversationHistory: [],
      metadata: {},
      services: { logger: appLoggerMock, config: configServiceMock },
    };

    await documentAgent.execute(context);
    expect(documentSearchService.search).toHaveBeenCalledWith('isolated-user-999', expect.any(String), 10);
  });

  it('handles search failure gracefully', async () => {
    (documentSearchService.search as jest.Mock).mockRejectedValue(new Error('Search DB error'));

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'conv-1',
      task: makeTask(IntentCategory.DOCUMENT_QUERY, 'Failing search query'),
      conversationHistory: [],
      metadata: {},
      services: { logger: appLoggerMock, config: configServiceMock },
    };

    const result = await documentAgent.execute(context);

    expect(result.success).toBe(false);
    expect(result.output).toBe(NO_DOCUMENT_INFO_FOUND_MESSAGE);
    expect(result.metadata?.searchError).toBe(true);
  });

  it('DOCUMENT_QUERY routes to DocumentAgent through ExecutionPipelineService', async () => {
    (documentSearchService.search as jest.Mock).mockResolvedValue([
      {
        documentId: 'doc-777',
        filename: 'summary.pdf',
        pageNumber: 1,
        chunkIndex: 0,
        content: 'EBITDA margin is 25%.',
        score: 0.92,
      },
    ]);

    llmProviderMock.generateResponse.mockResolvedValue({
      text: 'Based on summary.pdf, the EBITDA margin is 25%.',
      executionTimeMs: 120,
    });

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'conv-1',
      task: makeTask(IntentCategory.DOCUMENT_QUERY, 'What is the EBITDA margin in summary.pdf?'),
      conversationHistory: [],
      metadata: {},
      services: { logger: appLoggerMock, config: configServiceMock },
    };

    const pipelineResult = await executionPipelineService.executePipeline(context);

    expect(pipelineResult.success).toBe(true);
    expect(pipelineResult.agentName).toBe('DocumentAgent');
    expect(pipelineResult.output).toBe('Based on summary.pdf, the EBITDA margin is 25%.');
    expect(pipelineResult.metadata?.documentIds).toEqual(['doc-777']);
    expect(llmProviderMock.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('[RETRIEVED DOCUMENT CONTEXT]'),
          }),
        ]),
      }),
    );
  });

  it('handles LLM failure gracefully when executing DOCUMENT_QUERY pipeline', async () => {
    (documentSearchService.search as jest.Mock).mockResolvedValue([
      {
        documentId: 'doc-777',
        filename: 'summary.pdf',
        pageNumber: 1,
        chunkIndex: 0,
        content: 'EBITDA margin is 25%.',
        score: 0.92,
      },
    ]);

    llmProviderMock.generateResponse.mockRejectedValue(new Error('Groq rate limit exceeded'));

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'conv-1',
      task: makeTask(IntentCategory.DOCUMENT_QUERY, 'What is the EBITDA margin?'),
      conversationHistory: [],
      metadata: {},
      services: { logger: appLoggerMock, config: configServiceMock },
    };

    const pipelineResult = await executionPipelineService.executePipeline(context);

    expect(pipelineResult.success).toBe(false);
    expect(pipelineResult.output).toBe(NO_DOCUMENT_INFO_FOUND_MESSAGE);
    expect(pipelineResult.metadata?.llmError).toBe(true);
  });

  it('SEC_FILINGS still routes to ResearchAgent and NOT DocumentAgent', async () => {
    const classifier = new RuleBasedIntentClassifier();
    const classification = await classifier.classify("What is Microsoft's latest 10-K?");
    expect(classification.category).toBe(IntentCategory.SEC_FILINGS);

    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'conv-1',
      task: makeTask(classification.category, "What is Microsoft's latest 10-K?"),
      conversationHistory: [],
      metadata: {},
      services: { logger: appLoggerMock, config: configServiceMock },
    };

    const pipelineResult = await executionPipelineService.executePipeline(context);

    expect(pipelineResult.agentName).toBe('ResearchAgent');
    expect(researchAgentMock.execute).toHaveBeenCalled();
    expect(documentSearchService.search).not.toHaveBeenCalled();
  });

  it('GENERAL_CHAT remains unchanged and does not invoke DocumentAgent', async () => {
    const context: ExecutionContext = {
      userId: 'user-1',
      conversationId: 'conv-1',
      task: makeTask(IntentCategory.GENERAL_CHAT, 'Hello, how are you?'),
      conversationHistory: [],
      metadata: {},
      services: { logger: appLoggerMock, config: configServiceMock },
    };

    const pipelineResult = await executionPipelineService.executePipeline(context);

    expect(pipelineResult.output).toContain("Hello! I'm Finora");
    expect(documentSearchService.search).not.toHaveBeenCalled();
  });

  it('does not access DocumentChunk or Prisma directly', () => {
    expect((documentAgent as any).prisma).toBeUndefined();
    expect((documentAgent as any).documentChunk).toBeUndefined();
  });
});
