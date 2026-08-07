import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRegistryService } from '../agents/agent-registry.service';
import { AgentResult } from '../agents/agent.types';
import { ExecutionPipelineService } from '../pipeline/execution-pipeline.service';
import { ConversationTask } from './conversation-task';
import { ExecutionContext } from './execution-context';
import { AppLogger } from '@/common/logger/logger.service';
import { ChatMessageContext } from '@/shared/interfaces';

@Injectable()
export class AIOrchestratorService {
  constructor(
    private readonly pipelineService: ExecutionPipelineService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  async orchestrateTask(
    task: ConversationTask,
    conversationHistory: ChatMessageContext[],
  ): Promise<AgentResult> {
    const startTime = Date.now();

    this.logger.log(
      `AIOrchestrator received Task [ID: ${task.id}] | Intent: ${task.intent} | Needs Clarification: ${task.needsClarification}`,
      'AIOrchestratorService',
    );

    // 1. Clarification Engine Short-Circuit: If ambiguous, return clarification query directly
    if (task.needsClarification && task.clarificationQuestion) {
      this.logger.log(
        `AIOrchestrator short-circuiting for Clarification Question on Task [ID: ${task.id}]`,
        'AIOrchestratorService',
      );
      return {
        agentName: 'ClarificationEngine',
        success: true,
        output: task.clarificationQuestion,
        executionTimeMs: Date.now() - startTime,
        metadata: {
          clarified: true,
          intent: task.intent,
        },
      };
    }

    // 2. Query Agent Registry for suitable agent
    const selectedAgent = this.agentRegistry.findAgentForTask(task);
    const agentName = selectedAgent ? selectedAgent.name : 'ConversationAgent';

    this.logger.log(
      `AIOrchestrator selected Agent: "${agentName}" for Task [ID: ${task.id}]`,
      'AIOrchestratorService',
    );

    // 3. Construct enriched ExecutionContext
    const executionContext: ExecutionContext = {
      conversationId: task.conversationId,
      userId: task.userId,
      conversationHistory,
      metadata: {
        intent: task.intent,
        entities: task.entities,
      },
      task,
      services: {
        logger: this.logger,
        config: this.configService,
      },
    };

    // 4. Delegate task execution to ExecutionPipelineService
    const result = await this.pipelineService.executePipeline(executionContext);

    const totalOrchestrationMs = Date.now() - startTime;
    this.logger.log(
      `AIOrchestrator successfully completed orchestration for Task [ID: ${task.id}] in ${totalOrchestrationMs}ms`,
      'AIOrchestratorService',
    );

    return {
      ...result,
      agentName,
      executionTimeMs: totalOrchestrationMs,
    };
  }
}
