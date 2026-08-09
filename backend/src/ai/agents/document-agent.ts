import { Injectable, OnModuleInit } from '@nestjs/common';
import { IntentCategory } from '../conversation/conversation.types';
import { ConversationTask } from '../orchestrator/conversation-task';
import { ExecutionContext } from '../orchestrator/execution-context';
import { AgentRegistryService } from './agent-registry.service';
import { AgentCapability, AgentResult } from './agent.types';
import { BaseAgent } from './base-agent.interface';
import { AppLogger } from '@/common/logger/logger.service';
import { DocumentSearchService } from '@/documents/document-search.service';

export const NO_DOCUMENT_INFO_FOUND_MESSAGE =
  "I couldn't find that information in the uploaded document.";

@Injectable()
export class DocumentAgent implements BaseAgent, OnModuleInit {
  readonly name = 'DocumentAgent';
  readonly capabilities = [AgentCapability.DOCUMENT_ANALYSIS];

  constructor(
    private readonly documentSearchService: DocumentSearchService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.agentRegistry.registerAgent(this);
  }

  canHandle(task: ConversationTask): boolean {
    return task.intent === IntentCategory.DOCUMENT_QUERY;
  }

  async execute(context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();
    const { task, userId } = context;

    this.logger.log(
      `DocumentAgent executing task ${task.id} for User ${userId} [Query length: ${task.message?.length ?? 0}]`,
      'DocumentAgent',
    );

    if (!task.message || task.message.trim().length === 0) {
      return {
        agentName: this.name,
        success: true,
        output: NO_DOCUMENT_INFO_FOUND_MESSAGE,
        executionTimeMs: Date.now() - startTime,
        metadata: {
          noChunksFound: true,
          documentIds: [],
        },
      };
    }

    let searchResults;
    try {
      searchResults = await this.documentSearchService.search(userId, task.message, 5);
    } catch (err) {
      this.logger.error(`DocumentSearchService failed: ${err}`, undefined, 'DocumentAgent');
      return {
        agentName: this.name,
        success: false,
        output: NO_DOCUMENT_INFO_FOUND_MESSAGE,
        executionTimeMs: Date.now() - startTime,
        metadata: {
          searchError: true,
          documentIds: [],
        },
      };
    }

    if (!searchResults || searchResults.length === 0) {
      return {
        agentName: this.name,
        success: true,
        output: NO_DOCUMENT_INFO_FOUND_MESSAGE,
        executionTimeMs: Date.now() - startTime,
        metadata: {
          noChunksFound: true,
          documentIds: [],
        },
      };
    }

    // Filter out chunks with 0 similarity score
    const relevantChunks = searchResults.filter((r) => r.score > 0);
    if (relevantChunks.length === 0) {
      return {
        agentName: this.name,
        success: true,
        output: NO_DOCUMENT_INFO_FOUND_MESSAGE,
        executionTimeMs: Date.now() - startTime,
        metadata: {
          noChunksFound: true,
          documentIds: [],
        },
      };
    }

    const documentIds = Array.from(new Set(relevantChunks.map((c) => c.documentId)));
    const filenames = Array.from(new Set(relevantChunks.map((c) => c.filename)));
    const pages = Array.from(new Set(relevantChunks.map((c) => c.pageNumber)));

    const formattedContext = this.formatDocumentContext(relevantChunks);

    return {
      agentName: this.name,
      success: true,
      output: formattedContext,
      executionTimeMs: Date.now() - startTime,
      metadata: {
        documentIds,
        filenames,
        pages,
        chunkCount: relevantChunks.length,
        topScore: relevantChunks[0].score,
      },
    };
  }

  private formatDocumentContext(chunks: any[]): string {
    const lines: string[] = [];
    lines.push('[RETRIEVED DOCUMENT CONTEXT]');
    chunks.forEach((chunk, idx) => {
      lines.push(`Chunk ${idx + 1}:`);
      lines.push(`  - Document ID: ${chunk.documentId}`);
      lines.push(`  - Filename: ${chunk.filename}`);
      lines.push(`  - Page Number: ${chunk.pageNumber}`);
      lines.push(`  - Chunk Index: ${chunk.chunkIndex}`);
      lines.push(`  - Similarity Score: ${chunk.score.toFixed(4)}`);
      lines.push(`  - Content: ${chunk.content}`);
      lines.push('');
    });
    return lines.join('\n').trim();
  }
}
