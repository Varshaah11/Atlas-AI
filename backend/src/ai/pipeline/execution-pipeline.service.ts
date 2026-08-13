import { Injectable, Inject } from '@nestjs/common';
import { AgentResult } from '../agents/agent.types';
import { DocumentAgent } from '../agents/document-agent';
import { MarketAgent } from '../agents/market-agent';
import { ResearchAgent } from '../agents/research-agent';
import {
  CONTEXT_BUILDER_TOKEN,
  IContextBuilderService,
} from '../context/interfaces/context-builder.interface';
import { IntentCategory } from '../conversation/conversation.types';
import { ILLMProvider, LLM_PROVIDER_TOKEN } from '../interfaces/llm-provider.interface';
import { ExecutionContext } from '../orchestrator/execution-context';
import { GENERAL_CHAT_SYSTEM_PROMPT, DOCUMENT_QUERY_SYSTEM_PROMPT } from '../prompts';
import { AppLogger } from '@/common/logger/logger.service';
import { MemoryService } from '@/memory/memory.service';

@Injectable()
export class ExecutionPipelineService {
  constructor(
    @Inject(CONTEXT_BUILDER_TOKEN) private readonly contextBuilder: IContextBuilderService,
    @Inject(LLM_PROVIDER_TOKEN) private readonly llmProvider: ILLMProvider,
    private readonly researchAgent: ResearchAgent,
    private readonly marketAgent: MarketAgent,
    private readonly documentAgent: DocumentAgent,
    private readonly memoryService: MemoryService,
    private readonly logger: AppLogger,
  ) {}

  async executePipeline(context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();
    const { task, conversationHistory, userId, conversationId } = context;

    this.logger.log(
      `ExecutionPipeline executing task ${task.id} [Intent: ${task.intent}] for User ${userId} in Conversation ${conversationId}`,
      'ExecutionPipelineService',
    );

    // Retrieve user preferences and long-term memories prior to inference
    const memoryPrompt = await this.memoryService.buildMemoryPromptContext(userId);
    if (memoryPrompt) {
      this.logger.log(
        `Retrieved long-term user memory context for User ${userId}`,
        'ExecutionPipelineService',
      );
    }

    const intent = task.intent as IntentCategory;

    // ROUTING PATH 1: COMPANY_RESEARCH & SEC_FILINGS → ResearchAgent (Finnhub + SEC EDGAR)
    if (intent === IntentCategory.COMPANY_RESEARCH || intent === IntentCategory.SEC_FILINGS) {
      this.logger.log(
        `[Pipeline] ${intent} → Routing to ResearchAgent (Finnhub + SEC EDGAR)...`,
        'ExecutionPipelineService',
      );

      const agentResult = await this.researchAgent.execute(context);

      // Deterministic Error Short-Circuit for Invalid Tickers / Unresolved Data / SEC Failure
      if (!agentResult.success) {
        this.logger.log(
          `[Pipeline] ResearchAgent error: "${agentResult.output}". Returning deterministic error response directly (bypassing Groq).`,
          'ExecutionPipelineService',
        );

        return {
          agentName: agentResult.agentName,
          success: true,
          output: agentResult.output,
          executionTimeMs: Date.now() - startTime,
          metadata: {
            intent: task.intent,
            financialError: true,
          },
        };
      }

      let fullUserPrompt = `${task.message}\n\n${agentResult.output}`;
      if (memoryPrompt) {
        fullUserPrompt += `\n\n${memoryPrompt}`;
      }

      const preparedContext = this.contextBuilder.buildContext(conversationHistory, fullUserPrompt);

      this.logger.log(
        `[Pipeline] Valid ResearchAgent context attached. Sending prompt to Groq...`,
        'ExecutionPipelineService',
      );
      const llmResult = await this.llmProvider.generateResponse(preparedContext);

      // Asynchronously trigger non-blocking user memory update
      void this.extractAndUpdateMemoryAsync(userId, task.message, llmResult.text);

      const totalPipelineTimeMs = Date.now() - startTime;
      return {
        agentName: agentResult.agentName,
        success: true,
        output: llmResult.text,
        executionTimeMs: totalPipelineTimeMs,
        metadata: {
          llmExecutionMs: llmResult.executionTimeMs,
          messageCount: preparedContext.messageCount,
          intent: task.intent,
        },
      };
    }

    // ROUTING PATH 2: MARKET INTENTS → MarketAgent (Finnhub Quotes, Metrics, News, Comparison)
    const isMarketIntent = [
      IntentCategory.STOCK_PRICE,
      IntentCategory.FINANCIAL_METRICS,
      IntentCategory.FINANCIAL_NEWS,
      IntentCategory.STOCK_COMPARISON,
      IntentCategory.COMPANY_COMPARISON,
      IntentCategory.MARKET_INFORMATION,
    ].includes(intent);

    if (isMarketIntent) {
      this.logger.log(
        `[Pipeline] ${intent} → Routing to MarketAgent (Finnhub Quotes/Metrics/News)...`,
        'ExecutionPipelineService',
      );

      const agentResult = await this.marketAgent.execute(context);

      // Deterministic Error Short-Circuit for Invalid Tickers / Unresolved Data
      if (!agentResult.success) {
        this.logger.log(
          `[Pipeline] MarketAgent error: "${agentResult.output}". Returning deterministic error response directly (bypassing Groq).`,
          'ExecutionPipelineService',
        );

        return {
          agentName: agentResult.agentName,
          success: true,
          output: agentResult.output,
          executionTimeMs: Date.now() - startTime,
          metadata: {
            intent: task.intent,
            financialError: true,
          },
        };
      }

      let fullUserPrompt = `${task.message}\n\n${agentResult.output}`;
      if (memoryPrompt) {
        fullUserPrompt += `\n\n${memoryPrompt}`;
      }

      const preparedContext = this.contextBuilder.buildContext(conversationHistory, fullUserPrompt);

      this.logger.log(
        `[Pipeline] Valid MarketAgent context attached. Sending prompt to Groq...`,
        'ExecutionPipelineService',
      );
      const llmResult = await this.llmProvider.generateResponse(preparedContext);

      // Asynchronously trigger non-blocking user memory update
      void this.extractAndUpdateMemoryAsync(userId, task.message, llmResult.text);

      const totalPipelineTimeMs = Date.now() - startTime;
      return {
        agentName: agentResult.agentName,
        success: true,
        output: llmResult.text,
        executionTimeMs: totalPipelineTimeMs,
        metadata: {
          llmExecutionMs: llmResult.executionTimeMs,
          messageCount: preparedContext.messageCount,
          intent: task.intent,
        },
      };
    }

    // ROUTING PATH 3: DOCUMENT_QUERY → DocumentAgent (DocumentSearchService + Groq)
    if (intent === IntentCategory.DOCUMENT_QUERY) {
      this.logger.log(
        `[Pipeline] ${intent} → Routing to DocumentAgent (DocumentSearchService)...`,
        'ExecutionPipelineService',
      );

      let agentResult;
      try {
        agentResult = await this.documentAgent.execute(context);
      } catch (err) {
        this.logger.error(
          `DocumentAgent execution error: ${err}`,
          undefined,
          'ExecutionPipelineService',
        );
        return {
          agentName: 'DocumentAgent',
          success: true,
          output: "I couldn't find that information in the uploaded document.",
          executionTimeMs: Date.now() - startTime,
          metadata: { intent: task.intent, searchError: true },
        };
      }

      if (!agentResult.success || agentResult.metadata?.noChunksFound) {
        this.logger.log(
          `[Pipeline] DocumentAgent returned direct response (no chunks or error). Bypassing Groq.`,
          'ExecutionPipelineService',
        );

        return {
          agentName: agentResult.agentName,
          success: true,
          output: agentResult.output,
          executionTimeMs: Date.now() - startTime,
          metadata: {
            intent: task.intent,
            ...agentResult.metadata,
          },
        };
      }

      let fullUserPrompt = `${task.message}\n\n${agentResult.output}\n\nINSTRUCTION: Answer the user's question using ONLY the [RETRIEVED DOCUMENT CONTEXT] provided above. Be concise and direct for simple factual questions (e.g., state figures directly). Provide detailed explanations only when explicitly asked for summaries or in-depth analysis. If the retrieved context does not contain the answer to the question, respond ONLY with: "I couldn't find that information in the uploaded document." Do not use external or general knowledge.`;
      if (memoryPrompt) {
        fullUserPrompt += `\n\n${memoryPrompt}`;
      }

      const preparedContext = this.contextBuilder.buildContext(
        conversationHistory,
        fullUserPrompt,
        DOCUMENT_QUERY_SYSTEM_PROMPT,
        3,
      );

      this.logger.log(
        `[Pipeline] Valid DocumentAgent context attached. Sending prompt to Groq...`,
        'ExecutionPipelineService',
      );

      let llmResult;
      try {
        llmResult = await this.llmProvider.generateResponse(preparedContext);
      } catch (err) {
        this.logger.error(
          `LLM provider error in DocumentAgent pipeline: ${err}`,
          undefined,
          'ExecutionPipelineService',
        );
        return {
          agentName: 'ExecutionPipelineService',
          success: false,
          output: "I couldn't find that information in the uploaded document.",
          executionTimeMs: Date.now() - startTime,
          metadata: { intent: task.intent, llmError: true },
        };
      }

      // Asynchronously trigger non-blocking user memory update
      void this.extractAndUpdateMemoryAsync(userId, task.message, llmResult.text);

      const totalPipelineTimeMs = Date.now() - startTime;
      return {
        agentName: agentResult.agentName,
        success: true,
        output: llmResult.text,
        executionTimeMs: totalPipelineTimeMs,
        metadata: {
          llmExecutionMs: llmResult.executionTimeMs,
          messageCount: preparedContext.messageCount,
          intent: task.intent,
          documentIds: agentResult.metadata?.documentIds,
        },
      };
    }

    // ROUTING PATH 4: GENERAL_CHAT & OTHER INTENTS → Direct to Groq with GENERAL_CHAT_SYSTEM_PROMPT
    this.logger.log(
      `[Pipeline] ${intent} → Non-financial intent. Skipping FinanceService & Finnhub. Sending request directly to Groq...`,
      'ExecutionPipelineService',
    );

    // Shortcut: Directly answer simple greetings & /start onboarding trigger without invoking LLM to avoid hallucinations
    if (intent === IntentCategory.GENERAL_CHAT) {
      const trimmedText = task.message.trim();

      if (trimmedText === '/start' || /^\/start\b/i.test(trimmedText)) {
        const onboardingWelcome = `Welcome to Finora! I'm your financial intelligence assistant.\n\nTo help tailor market insights to you, what's your background or main area of interest in finance?`;
        return {
          agentName: 'ExecutionPipelineService',
          success: true,
          output: onboardingWelcome,
          executionTimeMs: Date.now() - startTime,
          metadata: { intent: task.intent },
        };
      }

      const greetingPattern =
        /^(hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening|how are you|how's it going|what's up|who are you|what can you do|help)\b/i;
      if (greetingPattern.test(trimmedText)) {
        const simpleResponse = `Hello! I'm Finora, your financial intelligence assistant. How can I help you today?`;
        return {
          agentName: 'ExecutionPipelineService',
          success: true,
          output: simpleResponse,
          executionTimeMs: Date.now() - startTime,
          metadata: { intent: task.intent },
        };
      }
    }

    const fullUserPrompt = memoryPrompt
      ? `${memoryPrompt}\n\n[CONVERSATIONAL DIRECTIVE]: The preferences above are passive context. Do NOT generate stock analysis, financial reports, risk tolerance assumptions, or ticker recommendations in General Chat. Respond naturally and ask ONE follow-up question.\n\n[CURRENT USER MESSAGE]\n${task.message}`
      : task.message;

    const preparedContext = this.contextBuilder.buildContext(
      conversationHistory,
      fullUserPrompt,
      GENERAL_CHAT_SYSTEM_PROMPT,
    );
    const llmResult = await this.llmProvider.generateResponse(preparedContext);

    // Asynchronously trigger non-blocking user memory update
    void this.extractAndUpdateMemoryAsync(userId, task.message, llmResult.text);

    const totalPipelineTimeMs = Date.now() - startTime;
    return {
      agentName: 'ExecutionPipelineService',
      success: true,
      output: llmResult.text,
      executionTimeMs: totalPipelineTimeMs,
      metadata: {
        llmExecutionMs: llmResult.executionTimeMs,
        messageCount: preparedContext.messageCount,
        intent: task.intent,
      },
    };
  }

  private async extractAndUpdateMemoryAsync(
    userId: string,
    userMessage: string,
    assistantOutput: string,
  ): Promise<void> {
    try {
      const textLower = userMessage.toLowerCase();

      // Skip quick greetings, short messages, or simple commands
      if (
        userMessage.length < 12 ||
        /^(hi|hello|hey|thanks|thank you|good morning|help)$/i.test(textLower.trim())
      ) {
        return;
      }

      // Preference signal check to avoid unnecessary LLM calls
      const hasPreferenceSignals =
        /\b(prefer|invest|portfolio|style|risk|tolerance|follow|like|stocks|sectors|ticker|conservative|aggressive|growth|moderate|tech|technology|healthcare|student|interest|interested|semiconductor|semiconductors|updates|news|earnings|events)\b/i.test(
          userMessage,
        );

      if (!hasPreferenceSignals) {
        return;
      }

      const extractionPrompt = `Analyze the user's message and extract ONLY explicitly stated long-term preferences or facts about the user.
CRITICAL NON-INFERENCE RULES:
- Do NOT infer or invent investmentStyle ("growth", "conservative", etc.) unless explicitly stated in userMessage. If unstated, set to null.
- Do NOT infer or invent riskTolerance ("low", "moderate", "high") unless explicitly stated in userMessage. If unstated, set to null.
- Do NOT invent or infer preferredTickers (e.g. AAPL, MSFT, NVDA) unless explicitly named by symbol/name in userMessage. If unstated, set to [].
- Extract preferredSectors ONLY if explicitly named by the user in userMessage (e.g. "technology").

Return ONLY a JSON object in this format (no markdown codeblocks, no extra text):
{
  "preferences": {
    "investmentStyle": null,
    "riskTolerance": null,
    "preferredSectors": ["technology"],
    "preferredTickers": []
  },
  "memories": [
    {
      "memory": "Direct factual statement explicitly stated by user",
      "category": "PROFILE",
      "importance": 0.7
    }
  ]
}

User Message: "${userMessage}"
Assistant Response: "${assistantOutput}"`;

      const extractionContext = this.contextBuilder.buildContext([], extractionPrompt);
      const extractionResult = await this.llmProvider.generateResponse(extractionContext);

      const cleanText = extractionResult.text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleanText);

      if (parsed.preferences) {
        await this.memoryService.updateUserPreferences(userId, parsed.preferences);
      }

      if (Array.isArray(parsed.memories)) {
        for (const mem of parsed.memories) {
          if (mem.memory && typeof mem.memory === 'string') {
            await this.memoryService.saveMemory(
              userId,
              mem.memory,
              mem.category || 'PROFILE',
              typeof mem.importance === 'number' ? mem.importance : 0.6,
            );
          }
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `Background memory extraction skipped or failed for User ${userId}: ${error.message}`,
        'ExecutionPipelineService',
      );
    }
  }
}
