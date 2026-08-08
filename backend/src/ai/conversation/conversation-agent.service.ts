import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { AgentRegistryService } from '../agents/agent-registry.service';
import { AgentCapability, AgentResult } from '../agents/agent.types';
import { BaseAgent } from '../agents/base-agent.interface';
import { ConversationTask } from '../orchestrator/conversation-task';
import { ExecutionContext } from '../orchestrator/execution-context';
import { ClarificationService } from './clarification.service';
import { EntityExtractorService } from './entity-extractor.service';
import { IIntentClassifier, INTENT_CLASSIFIER_TOKEN } from './intent-classifier.interface';
import { AppLogger } from '@/common/logger/logger.service';
import { ProcessMessageDto } from '@/shared/interfaces';

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
  ): Promise<ConversationTask> {
    const { messageText } = dto;

    // 1. Detect intent using abstract classifier
    const intentResult = await this.intentClassifier.classify(messageText);

    // 2. Extract structured entities
    const entities = this.entityExtractor.extractEntities(messageText);

    // 3. Evaluate ambiguity & clarification requirement
    const clarification = this.clarificationService.evaluateClarification(
      intentResult.category,
      entities,
      messageText,
    );

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const task: ConversationTask = {
      id: taskId,
      conversationId,
      userId,
      intent: intentResult.category,
      message: messageText,
      entities,
      needsClarification: clarification.needsClarification,
      clarificationQuestion: clarification.clarificationQuestion,
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
      `[Clarification] Evaluated: needsClarification=${clarification.needsClarification}`,
      'ConversationAgent',
    );

    this.logger.log(
      `ConversationAgent created Task [ID: ${taskId}] | Intent: ${intentResult.category} | Entities: (${entities.tickers.join(', ') || 'none'}) | Needs Clarification: ${clarification.needsClarification}`,
      'ConversationAgent',
    );

    return task;
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
