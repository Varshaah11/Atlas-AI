import { Module } from '@nestjs/common';
import { AgentRegistryService } from './agents/agent-registry.service';
import { DocumentAgent } from './agents/document-agent';
import { MarketAgent } from './agents/market-agent';
import { ResearchAgent } from './agents/research-agent';
import { ContextBuilderService } from './context/context-builder.service';
import { CONTEXT_BUILDER_TOKEN } from './context/interfaces/context-builder.interface';
import { ClarificationService } from './conversation/clarification.service';
import { ConversationAgentService } from './conversation/conversation-agent.service';
import { EntityExtractorService } from './conversation/entity-extractor.service';
import { INTENT_CLASSIFIER_TOKEN } from './conversation/intent-classifier.interface';
import { RuleBasedIntentClassifier } from './conversation/rule-based-intent-classifier.service';
import { CerebrasService } from './cerebras.service';
import { FallbackLLMProvider } from './fallback-llm.provider';
import { GroqService } from './groq.service';
import { LLM_PROVIDER_TOKEN } from './interfaces/llm-provider.interface';
import { AIOrchestratorService } from './orchestrator/orchestrator.service';
import { ExecutionPipelineService } from './pipeline/execution-pipeline.service';
import { AppLogger } from '@/common/logger/logger.service';
import { DocumentModule } from '@/documents/document.module';
import { FinanceModule } from '@/finance/finance.module';
import { MemoryModule } from '@/memory/memory.module';

@Module({
  imports: [FinanceModule, MemoryModule, DocumentModule],
  providers: [
    AppLogger,
    GroqService,
    CerebrasService,
    FallbackLLMProvider,
    ContextBuilderService,
    EntityExtractorService,
    ClarificationService,
    AgentRegistryService,
    ConversationAgentService,
    ResearchAgent,
    MarketAgent,
    DocumentAgent,
    ExecutionPipelineService,
    AIOrchestratorService,
    RuleBasedIntentClassifier,
    {
      provide: LLM_PROVIDER_TOKEN,
      useClass: FallbackLLMProvider,
    },
    {
      provide: CONTEXT_BUILDER_TOKEN,
      useExisting: ContextBuilderService,
    },
    {
      provide: INTENT_CLASSIFIER_TOKEN,
      useExisting: RuleBasedIntentClassifier,
    },
  ],
  exports: [
    GroqService,
    LLM_PROVIDER_TOKEN,
    ContextBuilderService,
    CONTEXT_BUILDER_TOKEN,
    ConversationAgentService,
    ResearchAgent,
    MarketAgent,
    DocumentAgent,
    AgentRegistryService,
    AIOrchestratorService,
    ExecutionPipelineService,
  ],
})
export class AIModule {}
