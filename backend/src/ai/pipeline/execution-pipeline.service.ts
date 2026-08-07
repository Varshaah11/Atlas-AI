import { Injectable, Inject } from '@nestjs/common';
import { AgentResult } from '../agents/agent.types';
import {
  CONTEXT_BUILDER_TOKEN,
  IContextBuilderService,
} from '../context/interfaces/context-builder.interface';
import { ILLMProvider, LLM_PROVIDER_TOKEN } from '../interfaces/llm-provider.interface';
import { ExecutionContext } from '../orchestrator/execution-context';
import { AppLogger } from '@/common/logger/logger.service';

@Injectable()
export class ExecutionPipelineService {
  constructor(
    @Inject(CONTEXT_BUILDER_TOKEN) private readonly contextBuilder: IContextBuilderService,
    @Inject(LLM_PROVIDER_TOKEN) private readonly llmProvider: ILLMProvider,
    private readonly logger: AppLogger,
  ) {}

  async executePipeline(context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();
    const { task, conversationHistory, userId, conversationId } = context;

    this.logger.log(
      `ExecutionPipeline executing task ${task.id} [Intent: ${task.intent}] for User ${userId}`,
      'ExecutionPipelineService',
    );

    // 1. Build prepared LLM context
    const preparedContext = this.contextBuilder.buildContext(conversationHistory, task.message);

    // 2. Invoke LLM provider
    const llmResult = await this.llmProvider.generateResponse(preparedContext);

    const totalPipelineTimeMs = Date.now() - startTime;

    this.logger.log(
      `ExecutionPipeline completed for Conversation ${conversationId} | LLM Latency: ${llmResult.executionTimeMs}ms | Total Pipeline Latency: ${totalPipelineTimeMs}ms`,
      'ExecutionPipelineService',
    );

    return {
      agentName: 'ExecutionPipelineService',
      success: true,
      output: llmResult.text,
      executionTimeMs: totalPipelineTimeMs,
      metadata: {
        llmExecutionMs: llmResult.executionTimeMs,
        messageCount: preparedContext.messageCount,
      },
    };
  }
}
