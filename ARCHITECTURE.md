# Atlas AI - System Architecture & Engineering Reference

This document serves as the **single source of truth** for the system design, software architecture, technical principles, module contracts, and long-term evolutionary roadmap of **Atlas AI**.

---

## 1. Project Overview

### What is Atlas AI?

**Atlas AI** is an AI-powered Financial Assistant built inside Telegram. It is engineered to operate with the analytical rigor, directness, and quantitative precision of an experienced senior financial analyst rather than a generic conversational chatbot.

### Vision & Purpose

Finance professionals, analysts, and decision-makers spend hours extracting insights from SEC filings, synthesizing earnings reports, building peer comparisons, and monitoring market movements. Atlas AI automates manual financial research workflows and delivers concise, actionable financial intelligence directly through natural conversational interactions.

### High-Level Product Goals

- **Natural Conversation First**: Zero slash-command menus or rigid button trees; driven purely by natural language.
- **Financial Rigor & Accuracy**: No invented facts or speculative investment advice; strict adherence to accounting and valuation principles.
- **Multi-Agent Orchestration**: Modular agent architecture routing queries to domain-specialized AI components.
- **Long-Term Memory & Personalization**: Deep context preservation across conversations and user preferences.
- **Production-Grade Scalability**: Backend-first architecture engineered following SOLID and Clean Architecture principles.

---

## 2. Core Design Principles

- **Modular Architecture**: Features are grouped into cohesive, self-contained domain modules with clear public APIs.
- **Clean Architecture & Separation of Concerns**: Strict boundary separation between ingress gateways, business logic, persistence, and AI orchestration.
- **SOLID Principles**:
  - **Single Responsibility Principle (SRP)**: Each class/service owns a single, well-defined application responsibility.
  - **Open/Closed Principle (OCP)**: Extensible frameworks (e.g., Agent Registry, Intent Classifier) open for expansion without modifying existing code.
  - **Liskov Substitution Principle (LSP)**: Interchangeable provider abstractions (`ILLMProvider`, `IIntentClassifier`, `BaseAgent`).
  - **Interface Segregation Principle (ISP)**: Focused, lightweight interfaces (`IUserService`, `IMessageService`, `IConversationService`).
  - **Dependency Inversion Principle (DIP)**: Core business services depend on abstractions rather than concrete implementations.
- **Incremental Sprint-Based Evolution**: Foundation built sprint-by-sprint without speculative abstractions or broken stubs.

---

## 3. High-Level System Architecture

```text
[ Telegram User ]
        │
        ▼ (Telegram Updates / Long Polling)
[ Telegram Bot Listener ] (Telegraf.js)
        │
        ▼ (ProcessMessageDto)
[ Conversation Gateway ] (Input Validation & Normalization)
        │
        ▼ (ProcessMessageDto)
[ Chat Service ]
        │
        ├──► [ User Service & Conversation Service ] (Profile & Active Conversation Context)
        │
        ├──► [ Message Service ] (Persists Incoming User Message)
        │
        ├──► [ Conversation Agent ] ───► [ IIntentClassifier (RuleBasedIntentClassifier) ]
        │         │                      [ EntityExtractorService ]
        │         │                      [ ClarificationService ]
        │         ▼
        │    (ConversationTask)
        │
        └──► [ AI Orchestrator ] ───► [ Clarification Short-Circuit ] (If Ambiguous)
                  │
                  ▼
         [ Execution Pipeline ]
                  │
                  ├──► [ Context Builder ] (Formats History & ATLAS_SYSTEM_PROMPT)
                  │
                  └──► [ Gemini Service ] (Executes LLM Inference)
                           │
                           ▼
         [ Message Service ] (Persists Assistant Message Turn)
                           │
                           ▼
         [ Telegram Reply ] (Sends Structured Output Back to User)
```

### Layer Responsibilities

| Layer                    | Primary Responsibility                                                                |
| ------------------------ | ------------------------------------------------------------------------------------- |
| **Telegram Listener**    | Handles Telegram Bot API updates, typing indicators, and user polling.                |
| **Conversation Gateway** | Validates message payloads, normalizes text, and sanitizes input.                     |
| **Chat Service**         | Coordinates database retrieval, user profile upserts, and orchestrator delegation.    |
| **Conversation Agent**   | Classifies user intent, extracts financial entities, and checks ambiguity.            |
| **AI Orchestrator**      | Evaluates tasks, manages execution context, and short-circuits clarification queries. |
| **Execution Pipeline**   | Executes context building and LLM inference for orchestrator plans.                   |
| **Context Builder**      | Constructs sliding history window contexts and applies system prompts.                |
| **Gemini Service**       | Performs Gemini LLM API calls and tracks inference latency.                           |
| **Prisma Database**      | Manages PostgreSQL persistence for users, conversations, and messages.                |

---

## 4. Repository Structure

```
Atlas-AI/
├── .editorconfig              # IDE code formatting rules
├── .prettierrc                # Prettier code style configuration
├── .prettierignore            # Files ignored by Prettier
├── package.json               # Root monorepo workspace configuration
├── README.md                  # Project introduction and quickstart guide
├── ARCHITECTURE.md            # Master architectural specification
├── backend/                   # NestJS Backend Application
│   ├── .env.example           # Environment template
│   ├── .eslintrc.js           # Strict TypeScript ESLint rules
│   ├── nest-cli.json          # Nest CLI build settings
│   ├── tsconfig.json          # TypeScript compiler & path alias configuration (@/*)
│   ├── prisma/
│   │   └── schema.prisma      # PostgreSQL schema with pgvector support
│   └── src/
│       ├── main.ts            # Application bootstrap, validation pipes, and error filters
│       ├── app.module.ts      # Root NestJS application module
│       ├── ai/                # AI Engine, Orchestrator, Agents, and LLM Providers
│       │   ├── agents/        # BaseAgent interface & capability-based AgentRegistryService
│       │   ├── context/       # ContextBuilderService & LLM prompt context interfaces
│       │   ├── conversation/  # ConversationAgent, IIntentClassifier, EntityExtractor, ClarificationEngine
│       │   ├── interfaces/    # ILLMProvider & LLMExecutionResult contracts
│       │   ├── orchestrator/  # AIOrchestratorService, ConversationTask, ExecutionContext
│       │   ├── pipeline/      # ExecutionPipelineService for orchestrator execution plans
│       │   └── prompts/       # ATLAS_SYSTEM_PROMPT & prompt registry
│       ├── chat/              # Chat Domain, Gateways, and Persistence Services
│       │   ├── gateways/      # ConversationGateway entry point
│       │   ├── interfaces/    # IChatService, IConversationService, IMessageService
│       │   └── services/      # ChatService, ConversationService, MessageService
│       ├── common/            # Structured loggers, exception filters, and common utilities
│       ├── config/            # Environment schema validation (class-validator / dotenv)
│       ├── database/          # Prisma database service & lifecycle hooks
│       ├── health/            # System health diagnostics endpoint (GET /health)
│       ├── shared/            # Application-wide constants, DTOs, and ApiResponse<T>
│       ├── telegram/          # Telegraf bot service & update listener
│       └── users/             # User domain service & profile management
└── frontend/                  # Next.js System Health Dashboard
    ├── package.json
    ├── tsconfig.json          # Frontend path aliases (@/*)
    ├── tailwind.config.js     # Glassmorphism dark theme styling
    └── app/
        ├── layout.tsx
        ├── globals.css
        └── page.tsx           # System health diagnostics status monitor (v0.2.0)
```

---

## 5. Request Lifecycle

```text
1. User sends message on Telegram.
2. TelegramService receives update -> sends 'typing' chat action.
3. ConversationGateway validates payload (rejects empty/invalid messages) -> normalizes text.
4. ChatService fetches/upserts User profile via UserService.
5. ChatService fetches/creates active Conversation via ConversationService.
6. ChatService persists user message turn via MessageService.
7. ChatService retrieves conversation history (last 20 messages) via MessageService.
8. ConversationAgent processes text -> IIntentClassifier detects intent -> EntityExtractor parses tickers/metrics -> ClarificationService checks ambiguity -> returns ConversationTask.
9. AIOrchestrator receives ConversationTask:
   a. If needsClarification is true -> Returns clarification question directly.
   b. If ready -> Builds ExecutionContext -> Passes to ExecutionPipeline.
10. ExecutionPipeline -> ContextBuilder formats history & ATLAS_SYSTEM_PROMPT -> GeminiService calls Gemini API.
11. ChatService receives response -> Persists assistant message turn via MessageService.
12. TelegramService replies with output message to Telegram User.
```

---

## 6. AI Layer

The **AI Layer** (`backend/src/ai/`) contains all AI logic:

- **`IIntentClassifier` / `RuleBasedIntentClassifier`**: Categorizes messages into `GENERAL_CHAT`, `COMPANY_RESEARCH`, `COMPANY_COMPARISON`, `MARKET_INFORMATION`, `DOCUMENT_QUERY`, `WATCHLIST`, `ALERT`, or `UNKNOWN`.
- **`EntityExtractorService`**: Extracts stock tickers (e.g., `AAPL`, `MSFT`, `NVDA`), company names, dates, and financial metrics.
- **`ClarificationService`**: Short-circuits ambiguous requests with targeted clarifying questions before LLM inference.
- **`ConversationAgentService`**: Combines classification, extraction, and clarification into a `ConversationTask`.
- **`AgentRegistryService`**: Capability-based agent discovery registry (`INTENT_CLASSIFICATION`, `ENTITY_EXTRACTION`, `CLARIFICATION`, etc.).
- **`AIOrchestratorService`**: Evaluates tasks, constructs `ExecutionContext`, and routes execution.
- **`ExecutionPipelineService`**: Executes context building and LLM inference.
- **`ContextBuilderService`**: Prepares sliding-window LLM prompt contexts.
- **`GeminiService`**: Provider-agnostic LLM client executing API requests.

---

## 7. Multi-Agent Architecture

Atlas AI employs a multi-agent framework where specialized agents register capabilities and handle domain tasks.

```text
[ AI Orchestrator ]
        │
        ├──► [ Conversation Agent ] (Implemented - Sprint 3)
        ├──► [ Memory Agent ]       (Planned - Sprint 4)
        ├──► [ Research Agent ]     (Planned - Sprint 5)
        ├──► [ Market Agent ]       (Planned - Sprint 5)
        ├──► [ Document Agent ]     (Planned - Sprint 6)
        ├──► [ Alert Agent ]        (Planned - Sprint 7)
        ├──► [ Briefing Agent ]     (Planned - Sprint 7)
        └──► [ Decision Agent ]     (Planned - Sprint 8)
```

### Implementation Status Matrix

| Agent Name             | Primary Capabilities                                                          | Implementation Status      |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------- |
| **Conversation Agent** | Intent Classification, Entity Extraction, Ambiguity Clarification             | **Implemented (Sprint 3)** |
| **Memory Agent**       | User Memory Extraction, Vector Embedding Storage, Long-Term Preference Recall | Planned (Sprint 4)         |
| **Research Agent**     | SEC Filings Extraction, Company Profile Syntheses, Peer Comparison            | Planned (Sprint 5)         |
| **Market Agent**       | Real-Time Stock Quotes, Market Index Summaries, Financial Metric Pulls        | Planned (Sprint 5)         |
| **Document Agent**     | Financial PDF Parsing, Multi-Document RAG, Earnings Transcript Q&A            | Planned (Sprint 6)         |
| **Alert Agent**        | Price Target Alerts, Metric Threshold Monitoring, Notification Delivery       | Planned (Sprint 7)         |
| **Briefing Agent**     | Scheduled Morning/Evening Briefings, Portfolio News Digests                   | Planned (Sprint 7)         |
| **Decision Agent**     | Multi-Agent Output Synthesis, Financial Trade-Off Evaluation                  | Planned (Sprint 8)         |

---

## 8. Database Architecture

### Current Implemented Schema (Prisma PostgreSQL)

```prisma
model User {
  id            String         @id @default(uuid())
  telegramId    String         @unique
  username      String?
  firstName     String?
  lastName      String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  conversations Conversation[]
}

model Conversation {
  id        String             @id @default(uuid())
  userId    String
  user      User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String?
  status    ConversationStatus @default(ACTIVE)
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt
  messages  Message[]
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           MessageRole
  content        String
  metadata       Json?
  createdAt      DateTime     @default(now())
}
```

### Database Roadmap (Future Sprints)

- `UserMemory`: Storing user facts and preferences with vector embeddings (`pgvector`).
- `Watchlist` & `WatchlistItem`: User stock watchlists and tracked metrics.
- `SmartAlert`: User alert thresholds and trigger conditions.
- `Document` & `DocumentChunk`: Financial report metadata and chunked vector embeddings.

---

## 9. AI Pipeline

The AI pipeline divides responsibilities into distinct single-purpose services:

1. **Intent & Entity Processing**: Handled by `ConversationAgent` before execution decisions are made.
2. **Context Construction**: Handled by `ContextBuilderService`, applying sliding history window limits (20 messages) and system instructions.
3. **Inference Execution**: Handled by `GeminiService`, accepting pre-built context and returning generated text along with latency timings.
4. **Result Persistence**: Handled by `MessageService`, recording user and assistant turns in PostgreSQL.

---

## 10. Module Responsibilities

### `ai/` Module

- **Purpose**: AI understanding, prompt building, context formatting, and LLM inference.
- **Responsibilities**: Intent classification, entity extraction, clarification generation, task orchestration, context formatting, LLM call execution.
- **Dependencies**: `@google/generative-ai`, `ConfigModule`, `CommonModule`.
- **Prohibitions**: Must **NOT** directly query database models or interact with Telegram APIs.

### `chat/` Module

- **Purpose**: Conversational domain logic and pipeline coordination.
- **Responsibilities**: Message ingress validation, conversation lifecycle, message persistence.
- **Dependencies**: `UsersModule`, `AIModule`, `DatabaseModule`.
- **Prohibitions**: Must **NOT** contain raw LLM API client code.

### `telegram/` Module

- **Purpose**: Telegram Bot API integration.
- **Responsibilities**: Receiving Telegram webhook/polling updates, sending typing actions, delivering replies.
- **Dependencies**: `telegraf`, `ChatModule`.
- **Prohibitions**: Must **NOT** implement business logic, prompt construction, or database queries directly.

### `users/` Module

- **Purpose**: Telegram user profile management.
- **Responsibilities**: Upserting users, querying user profiles by Telegram ID.
- **Dependencies**: `DatabaseModule`.
- **Prohibitions**: Must **NOT** manage conversation messages or AI prompts.

### `database/` Module

- **Purpose**: Database persistence layer.
- **Responsibilities**: Prisma Client lifecycle management and connection health checks.
- **Dependencies**: `@prisma/client`.
- **Prohibitions**: Must **NOT** contain business logic.

---

## 11. Extension Points

### Adding a New AI Agent

1. Implement `BaseAgent` in `src/ai/agents/`.
2. Declare agent name and `AgentCapability[]` tags.
3. Register the agent inside `AgentRegistryService`.
4. Define task handling logic in `canHandle(task)` and `execute(context)`.

### Adding a New LLM Provider

1. Implement `ILLMProvider` interface in `src/ai/interfaces/llm-provider.interface.ts`.
2. Register the provider token in `AIModule`.

---

## 12. Sprint Roadmap

```text
Sprint 1 (Completed)  ──► Baseline Infrastructure & Monorepo Setup
Sprint 2 (Completed)  ──► Conversation Engine & Context Builder Pipeline
Sprint 3 (Completed)  ──► AI Orchestrator, Conversation Agent & Architecture Specs
Sprint 4 (Planned)    ──► Memory Agent & User Personalization (pgvector)
Sprint 5 (Planned)    ──► Company & Market Research Agents
Sprint 6 (Planned)    ──► Financial Document Intelligence Agent (PDF RAG)
Sprint 7 (Planned)    ──► Briefings & Smart Alerts Engine
Sprint 8 (Planned)    ──► Multi-Agent Decision Engine & Synthesis
Sprint 9 (Planned)    ──► Production Polish, Integrations & Final Deployment
```

---

## 13. Architecture Decision Records (ADRs)

- **ADR-001: Monorepo Architecture**: Selected NestJS backend + Next.js frontend monorepo to maintain shared TypeScript definitions and unified tooling.
- **ADR-002: NestJS Framework**: Chosen for dependency injection, module modularity, and strict TypeScript support.
- **ADR-003: PostgreSQL + pgvector**: Chosen over dedicated vector databases to keep user data and vector embeddings within a unified, ACID-compliant database.
- **ADR-004: Telegram-First Interface**: Selected because finance professionals require instant, friction-free assistant access without installing desktop apps or navigating web logins.
- **ADR-005: Decoupled AI Pipeline**: Separating `ConversationAgent`, `AIOrchestrator`, `ExecutionPipeline`, and `ContextBuilder` ensures future agents can plug in seamlessly without architectural churn.

---

## 14. Development Standards

- **Formatting & Linting**: ESLint + Prettier rules configured across workspace files.
- **Git Conventions**: Conventional Commits standard (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`).
- **Git Hooks**: `husky` and `lint-staged` pre-commit checks.
- **Path Aliases**: Clean `@/*` TypeScript import paths across modules.
- **API Response Wrapper**: All endpoints return uniform `ApiResponse<T>` wrappers.
- **Environment Validation**: Application fails fast if required environment variables are missing.

---

## 15. Future Vision

Post-hackathon evolutionary roadmap:

- **Autonomous Portfolio Intelligence**: Continuous background analysis of user portfolios.
- **Multi-LLM Hybrid Routing**: Routing analytical queries to specialized financial models.
- **Voice Conversations**: Native Telegram voice note parsing and audio financial digests.
- **Calendar & Workplace Integrations**: Google Workspace / Microsoft 365 meeting prep automation.
- **Enterprise Team Dashboards**: Multi-tenant analytics dashboard for financial research teams.
