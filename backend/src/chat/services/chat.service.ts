import { Injectable, Inject } from '@nestjs/common';
import { MessageRole } from '@prisma/client';
import { IChatService } from '../interfaces/chat-service.interface';
import {
  IConversationService,
  CONVERSATION_SERVICE_TOKEN,
} from '../interfaces/conversation-service.interface';
import { IMessageService, MESSAGE_SERVICE_TOKEN } from '../interfaces/message-service.interface';
import { ConversationAgentService } from '@/ai/conversation/conversation-agent.service';
import { AIOrchestratorService } from '@/ai/orchestrator/orchestrator.service';
import { AppLogger } from '@/common/logger/logger.service';
import { ProcessMessageDto } from '@/shared/interfaces';
import { IUserService, USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';

@Injectable()
export class ChatService implements IChatService {
  constructor(
    @Inject(USER_SERVICE_TOKEN) private readonly userService: IUserService,
    @Inject(CONVERSATION_SERVICE_TOKEN) private readonly conversationService: IConversationService,
    @Inject(MESSAGE_SERVICE_TOKEN) private readonly messageService: IMessageService,
    private readonly conversationAgent: ConversationAgentService,
    private readonly aiOrchestrator: AIOrchestratorService,
    private readonly logger: AppLogger,
  ) {}

  async processMessage(dto: ProcessMessageDto): Promise<string> {
    const startTime = Date.now();
    const { userData, messageText } = dto;

    // 1. Get or create user profile
    const user = await this.userService.getOrCreateUser(userData);

    // 2. Get or create active conversation context
    const conversation = await this.conversationService.getOrCreateActiveConversation(user.id);

    // 3. Save incoming user message
    await this.messageService.saveMessage(conversation.id, MessageRole.USER, messageText);

    // 4. Retrieve conversation history window
    const history = await this.messageService.getConversationHistory(conversation.id);

    // 5. Conversation Agent processes message → intent classification, entity extraction, clarification check → builds ConversationTask
    const task = await this.conversationAgent.processMessageToTask(dto, conversation.id, user.id);

    // 6. AI Orchestrator executes orchestration plan (handles clarification or delegates to ExecutionPipeline)
    const result = await this.aiOrchestrator.orchestrateTask(task, history);

    // 7. Save assistant response turn
    await this.messageService.saveMessage(conversation.id, MessageRole.ASSISTANT, result.output);

    const totalLatencyMs = Date.now() - startTime;

    // Structured logging of execution metrics
    this.logger.log(
      `Pipeline Execution Complete [Agent: ${result.agentName}] [Task ID: ${task.id}] [Intent: ${task.intent}] [User: ${user.id}] | Total Latency: ${totalLatencyMs}ms | Execution Latency: ${result.executionTimeMs || 0}ms`,
      'ChatService',
    );

    return result.output;
  }
}
