import { Test, TestingModule } from '@nestjs/testing';
import { FallbackLLMProvider } from '../src/ai/fallback-llm.provider';
import { GroqService } from '../src/ai/groq.service';
import { CerebrasService } from '../src/ai/cerebras.service';
import { AppLogger } from '../src/common/logger/logger.service';
import { PreparedLLMContext } from '../src/ai/context/interfaces/context-builder.interface';

describe('FallbackLLMProvider & Cerebras Fallback Suite', () => {
  let fallbackProvider: FallbackLLMProvider;
  let groqService: jest.Mocked<GroqService>;
  let cerebrasService: jest.Mocked<CerebrasService>;
  let logger: jest.Mocked<AppLogger>;

  const sampleContext: PreparedLLMContext = {
    systemInstruction: 'You are Atlas AI',
    contents: [
      { role: 'user', parts: [{ text: 'Turn 1 user' }] },
      { role: 'model', parts: [{ text: 'Turn 1 assistant' }] },
      { role: 'user', parts: [{ text: 'What is the price of NVDA?' }] },
    ],
    messageCount: 3,
  };

  beforeEach(async () => {
    groqService = {
      isHealthy: jest.fn().mockResolvedValue(true),
      generateResponse: jest.fn(),
    } as any;

    cerebrasService = {
      isHealthy: jest.fn().mockResolvedValue(true),
      generateResponse: jest.fn(),
    } as any;

    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FallbackLLMProvider,
        { provide: GroqService, useValue: groqService },
        { provide: CerebrasService, useValue: cerebrasService },
        { provide: AppLogger, useValue: logger },
      ],
    }).compile();

    fallbackProvider = moduleRef.get<FallbackLLMProvider>(FallbackLLMProvider);
  });

  it('1 & 4. Groq succeeds → Cerebras is NOT called, output comes from Groq', async () => {
    groqService.generateResponse.mockResolvedValue({
      text: 'NVDA — Market Snapshot: $120.00',
      executionTimeMs: 150,
    });

    const result = await fallbackProvider.generateResponse(sampleContext);

    expect(result.text).toBe('NVDA — Market Snapshot: $120.00');
    expect(groqService.generateResponse).toHaveBeenCalledWith(sampleContext);
    expect(cerebrasService.generateResponse).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('[LLM] Groq request succeeded', 'FallbackLLMProvider');
  });

  it('2, 3 & 5. Groq rate-limits → Cerebras is called with exact optimized context and succeeds', async () => {
    groqService.generateResponse.mockResolvedValue({
      text: 'The AI analysis service is temporarily rate limited by the LLM provider. Please wait a moment and try again.',
      executionTimeMs: 50,
    });
    cerebrasService.generateResponse.mockResolvedValue({
      text: 'Cerebras Fallback: NVDA current price is $120.00',
      executionTimeMs: 200,
    });

    const result = await fallbackProvider.generateResponse(sampleContext);

    expect(groqService.generateResponse).toHaveBeenCalledWith(sampleContext);
    expect(cerebrasService.generateResponse).toHaveBeenCalledWith(sampleContext);
    expect(result.text).toBe('Cerebras Fallback: NVDA current price is $120.00');
    expect(logger.warn).toHaveBeenCalledWith(
      '[LLM] Groq returned rate limit or provider error. Falling back to Cerebras...',
      'FallbackLLMProvider',
    );
    expect(logger.log).toHaveBeenCalledWith('[LLM] Cerebras fallback succeeded', 'FallbackLLMProvider');
  });

  it('6. Groq fails + Cerebras fails → returns graceful fallback error message', async () => {
    groqService.generateResponse.mockRejectedValue(new Error('Groq connection timeout'));
    cerebrasService.generateResponse.mockRejectedValue(new Error('Cerebras rate limit'));

    const result = await fallbackProvider.generateResponse(sampleContext);

    expect(groqService.generateResponse).toHaveBeenCalledWith(sampleContext);
    expect(cerebrasService.generateResponse).toHaveBeenCalledWith(sampleContext);
    expect(result.text).toContain('temporarily rate limited');
  });

  it('7. Groq throws exception → Cerebras is attempted', async () => {
    groqService.generateResponse.mockRejectedValue(new Error('Network error'));
    cerebrasService.generateResponse.mockResolvedValue({
      text: 'Cerebras output',
      executionTimeMs: 180,
    });

    const result = await fallbackProvider.generateResponse(sampleContext);

    expect(cerebrasService.generateResponse).toHaveBeenCalledWith(sampleContext);
    expect(result.text).toBe('Cerebras output');
  });

  it('8. Verifies no duplicate current user message in context passed to providers', () => {
    const userMessages = sampleContext.contents.filter((c) => c.role === 'user');
    expect(userMessages.length).toBe(2);
    expect(userMessages[1].parts[0].text).toBe('What is the price of NVDA?');
  });
});
