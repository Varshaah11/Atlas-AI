import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { AgentRegistryService } from '../agents/agent-registry.service';
import { AgentCapability, AgentResult } from '../agents/agent.types';
import { BaseAgent } from '../agents/base-agent.interface';
import { ConversationTask } from '../orchestrator/conversation-task';
import { ExecutionContext } from '../orchestrator/execution-context';
import { ClarificationService } from './clarification.service';
import { IntentCategory } from './conversation.types';
import { EntityExtractorService } from './entity-extractor.service';
import { IIntentClassifier, INTENT_CLASSIFIER_TOKEN } from './intent-classifier.interface';
import { AppLogger } from '@/common/logger/logger.service';
import { ProcessMessageDto, ChatMessageContext } from '@/shared/interfaces';

@Injectable()
export class ConversationAgentService implements BaseAgent, OnModuleInit {
  readonly name = 'ConversationAgent';
  readonly capabilities = [
    AgentCapability.INTENT_CLASSIFICATION,
    AgentCapability.ENTITY_EXTRACTION,
    AgentCapability.CLARIFICATION,
  ];

  constructor(
    @Inject(INTENT_CLASSIFIER_TOKEN) private readonly intentClassifier: IIntentClassifier,
    private readonly entityExtractor: EntityExtractorService,
    private readonly clarificationService: ClarificationService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.agentRegistry.registerAgent(this);
  }

  canHandle(_task: ConversationTask): boolean {
    return true; // Default fallback agent handling general conversational tasks
  }

  async processMessageToTask(
    dto: ProcessMessageDto,
    conversationId: string,
    userId: string,
    history?: ChatMessageContext[],
  ): Promise<ConversationTask> {
    const { messageText } = dto;

    // 1. Detect intent using abstract classifier
    let intentResult = await this.intentClassifier.classify(messageText);

    // 2. Extract structured entities
    let entities = this.entityExtractor.extractEntities(messageText);

    let needsClarificationOverride: boolean | undefined;
    let clarificationQuestionOverride: string | undefined;

    // 3. Conversational Entity Inheritance & Resolution
    const hasExplicitEntities =
      (entities.tickers && entities.tickers.length > 0) ||
      (entities.companies && entities.companies.length > 0);

    const isStartOrGreeting =
      /^\/?start\b/i.test(messageText.trim()) ||
      /^(hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening|how are you|how's it going|what's up|who are you|what can you do|help|ok|okay|bye|goodbye)$/i.test(
        messageText.trim().toLowerCase(),
      );

    const isFinancialFollowUp =
      /\b(why did (it|the stock|the price|that)|what caused (that|it|the move|the drop|the rise|the fall)|why (did|has|is) (it|the price|the stock) (move|moving|moved|fall|fallen|drop|dropped|rise|risen|gain|gained|plummet|soar|dip|dipped|crash|down|up|high|low)|what about (its|the) (p\/e|pe|valuation|price|revenue|earnings|metrics|market cap|stock)|why is (its|the) (valuation|price|pe|p\/e|market cap) (high|low)|is (it|the stock) (a good buy|overvalued|undervalued)|how did (it|the stock) perform|what happened to (it|the stock))\b/i.test(
        messageText,
      ) ||
      (/\b(it|its|that)\b/i.test(messageText) &&
        [
          IntentCategory.FINANCIAL_NEWS,
          IntentCategory.FINANCIAL_METRICS,
          IntentCategory.STOCK_PRICE,
          IntentCategory.COMPANY_RESEARCH,
          IntentCategory.STOCK_COMPARISON,
          IntentCategory.SEC_FILINGS,
          IntentCategory.MARKET_INFORMATION,
        ].includes(intentResult.category));

    // Check if the preceding turn was a clarification question awaiting entity selection
    const lastPastMsg = history && history.length > 1 ? history[history.length - 2] : null;
    const isRespondingToClarification =
      lastPastMsg &&
      lastPastMsg.role === 'assistant' &&
      (lastPastMsg.metadata?.clarified === true ||
        /which (stock|company|peer|symbol)/i.test(lastPastMsg.content));

    if (isRespondingToClarification && hasExplicitEntities && !isStartOrGreeting) {
      const pendingIntent =
        (lastPastMsg.metadata?.intent as IntentCategory | undefined) ||
        (history && history.length >= 3 && history[history.length - 3].role === 'user'
          ? (await this.intentClassifier.classify(history[history.length - 3].content)).category
          : null);

      if (
        pendingIntent &&
        pendingIntent !== IntentCategory.GENERAL_CHAT &&
        pendingIntent !== IntentCategory.UNKNOWN
      ) {
        intentResult = {
          category: pendingIntent,
          confidence: 0.95,
          reasoning: `Selected entity [${entities.tickers.join(', ')}] in response to clarification question, continuing original intent ${pendingIntent}`,
        };
        needsClarificationOverride = false;
      }
    }

    this.logger.log(
      `[ConversationalContext] Input: "${messageText}" | History count: ${history?.length || 0} | Explicit entities: [${entities.tickers.join(', ')}] | IsGreeting: ${isStartOrGreeting} | IsFollowUp: ${isFinancialFollowUp} | RespondingToClarification: ${!!isRespondingToClarification}`,
      'ConversationAgent',
    );

    if (!hasExplicitEntities && !isStartOrGreeting && history && history.length > 1) {
      if (isFinancialFollowUp) {
        const pastHistory = history.slice(0, -1);
        const activeEntities = this.resolveActiveEntitiesFromHistory(pastHistory);

        this.logger.log(
          `[ActiveEntities] Resolved active entities from history: [${activeEntities.join(', ')}]`,
          'ConversationAgent',
        );

        if (activeEntities.length === 1) {
          // Inherit single active entity from recent conversation context
          entities = {
            ...entities,
            tickers: [activeEntities[0]],
          };

          if (intentResult.category === IntentCategory.GENERAL_CHAT) {
            intentResult = {
              category: IntentCategory.FINANCIAL_NEWS,
              confidence: 0.9,
              reasoning: 'Inherited active financial entity from conversation history',
            };
          }
        } else if (activeEntities.length > 1) {
          // Ambiguous context (multiple active entities in recent financial turn)
          needsClarificationOverride = true;
          clarificationQuestionOverride = `Which stock are you referring to? (${activeEntities.join(' or ')})`;
        } else {
          // Genuine follow-up but no active entity found in history
          needsClarificationOverride = true;
          clarificationQuestionOverride = `Which company or stock symbol are you asking about? (e.g., NVDA or Microsoft)`;
        }
      }
    }

    // 4. Evaluate ambiguity & clarification requirement
    const clarification = this.clarificationService.evaluateClarification(
      intentResult.category,
      entities,
      messageText,
    );

    const finalNeedsClarification =
      needsClarificationOverride ?? clarification.needsClarification;
    const finalClarificationQuestion =
      clarificationQuestionOverride ?? clarification.clarificationQuestion;

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const task: ConversationTask = {
      id: taskId,
      conversationId,
      userId,
      intent: intentResult.category,
      message: messageText,
      entities,
      needsClarification: finalNeedsClarification,
      clarificationQuestion: finalClarificationQuestion,
      createdAt: new Date().toISOString(),
    };

    this.logger.log(
      `[Intent] "${messageText}" → ${intentResult.category} (Confidence: ${intentResult.confidence})`,
      'ConversationAgent',
    );
    this.logger.log(
      `[Entities] Tickers: [${entities.tickers.join(', ')}], Companies: [${entities.companies.join(', ')}]`,
      'ConversationAgent',
    );
    this.logger.log(
      `[Clarification] Evaluated: needsClarification=${finalNeedsClarification} | Question: "${finalClarificationQuestion || 'none'}"`,
      'ConversationAgent',
    );

    this.logger.log(
      `ConversationAgent created Task [ID: ${taskId}] | Intent: ${intentResult.category} | Entities: (${entities.tickers.join(', ') || 'none'}) | Needs Clarification: ${finalNeedsClarification}`,
      'ConversationAgent',
    );

    return task;
  }

  private resolveActiveEntitiesFromHistory(history: ChatMessageContext[]): string[] {
    if (!history || history.length === 0) return [];

    // Find index of the most recent /start user message to serve as context boundary
    let startIndex = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'user' && /^\/?start\b/i.test(msg.content.trim())) {
        startIndex = i;
        break;
      }
    }

    // Search backwards ONLY within current session (from history.length - 1 down to startIndex)
    for (let i = history.length - 1; i >= startIndex; i--) {
      const msg = history[i];

      // Stop searching if we hit the /start boundary message
      if (msg.role === 'user' && /^\/?start\b/i.test(msg.content.trim())) {
        break;
      }

      const getTickersFromMsg = (m: ChatMessageContext): string[] => {
        const metaTickers = m.metadata?.entities?.tickers || m.metadata?.tickers;
        if (Array.isArray(metaTickers) && metaTickers.length > 0) {
          return metaTickers;
        }
        return this.entityExtractor.extractEntities(m.content).tickers;
      };

      const msgTickers = getTickersFromMsg(msg);

      if (msgTickers.length > 0) {
        const tickersSet = new Set<string>(msgTickers);

        // Combine with counterpart message in the same turn if present
        if (msg.role === 'user' && i + 1 < history.length && history[i + 1].role === 'assistant') {
          const assistantTickers = getTickersFromMsg(history[i + 1]);
          assistantTickers.forEach((t) => tickersSet.add(t));
        } else if (msg.role === 'assistant' && i - 1 >= startIndex && history[i - 1].role === 'user') {
          const userTickers = getTickersFromMsg(history[i - 1]);
          userTickers.forEach((t) => tickersSet.add(t));
        }

        return Array.from(tickersSet);
      }
    }

    return [];
  }

  async execute(context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();
    this.logger.log(
      `ConversationAgent executing task ${context.task.id} for user ${context.userId}`,
      'ConversationAgent',
    );

    return {
      agentName: this.name,
      success: true,
      output: context.task.message,
      executionTimeMs: Date.now() - startTime,
    };
  }
}
