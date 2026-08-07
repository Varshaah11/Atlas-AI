# Atlas AI - AI Financial Assistant

Atlas AI is an AI-powered Financial Assistant living inside Telegram, designed to operate with the analytical rigor and persona of an experienced senior financial analyst.

## 🚀 Features

- **Telegram Bot Interface**: Natural conversational interface powered by `Telegraf.js`.
- **Conversation Gateway**: Input validation, text normalization, and graceful handling of empty or invalid messages.
- **AI Orchestrator & Conversation Agent**: Multi-agent framework supporting intent classification (`IIntentClassifier`), entity extraction (`EntityExtractorService`), ambiguity clarification (`ClarificationService`), and capability-based agent discovery (`AgentRegistryService`).
- **Execution Pipeline**: Decoupled execution pipeline (`ExecutionPipelineService`) managing context building and LLM inference.
- **Groq LLM Engine**: Powered by Groq (`groq-sdk`) running `llama-3.3-70b-versatile` with latency tracking.
- **Financial Intelligence Persona**: Isolated prompt registry (`ATLAS_SYSTEM_PROMPT`) delivering professional, factual, and non-advisory financial insights.
- **Data Persistence**: Prisma ORM with PostgreSQL + `pgvector` for user profiles, active conversations, and message histories.
- **Standardized API & Health Monitoring**: `GET /health` endpoint reporting database, Telegram, and Groq status plus system counters.
- **System Monitor Dashboard**: Next.js 14 web monitor UI displaying component health status badges and user/conversation stats.

---

## 📁 Project Structure

```
Atlas-AI/
├── .editorconfig              # Code formatting rules for IDEs
├── .prettierrc                # Shared Prettier formatting configuration
├── .prettierignore            # Ignore patterns for Prettier
├── package.json               # Root monorepo workspace configuration
├── README.md                  # Project introduction and quickstart guide
├── ARCHITECTURE.md            # Master architectural specification
├── backend/                   # NestJS Backend API & Telegram Service
│   ├── .eslintrc.js           # Strict TypeScript ESLint configuration
│   ├── nest-cli.json          # Nest CLI build configuration
│   ├── tsconfig.json          # TypeScript path aliases (@/*)
│   ├── prisma/
│   │   └── schema.prisma      # PostgreSQL schema with pgvector support
│   └── src/
│       ├── main.ts            # Application bootstrap with global pipes & filters
│       ├── app.module.ts      # Root NestJS application module
│       ├── ai/                # AI engine, Groq client, orchestrator, agents, and prompts
│       │   ├── agents/        # BaseAgent interface & capability-based AgentRegistryService
│       │   ├── context/       # ContextBuilderService & LLM prompt formatting
│       │   ├── conversation/  # ConversationAgent, IIntentClassifier, EntityExtractor, ClarificationEngine
│       │   ├── interfaces/    # ILLMProvider & LLMExecutionResult contracts
│       │   ├── orchestrator/  # AIOrchestratorService, ConversationTask, ExecutionContext
│       │   ├── pipeline/      # ExecutionPipelineService for orchestrator execution plans
│       │   ├── prompts/       # ATLAS_SYSTEM_PROMPT & prompt registry
│       │   └── groq.service.ts # Groq LLM provider implementation using groq-sdk
│       ├── chat/              # Chat orchestration, gateways, and services
│       │   ├── gateways/      # Input validation & ConversationGateway
│       │   ├── interfaces/    # Service contracts
│       │   └── services/      # ChatService, ConversationService, MessageService
│       ├── common/            # Shared loggers, filters, and exceptions
│       ├── config/            # Environment variable validation & schema
│       ├── database/          # Prisma database service & lifecycle hooks
│       ├── health/            # System health diagnostics endpoint (GET /health)
│       ├── shared/            # Reusable constants, DTOs, and interfaces
│       ├── telegram/          # Telegraf bot service & update listener
│       └── users/             # User domain service & profile lifecycle
└── frontend/                  # Next.js System Health Dashboard
    ├── package.json
    ├── tsconfig.json          # Frontend path aliases (@/*)
    ├── tailwind.config.js     # Glassmorphism dark theme styling
    └── app/
        ├── layout.tsx
        ├── globals.css
        └── page.tsx           # Live diagnostic status monitor (v0.2.0)
```

---

## 🛠️ Environment Setup

Create `.env` inside `backend/`:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Connection (PostgreSQL + pgvector)
DATABASE_URL=postgresql://user:password@localhost:5432/atlas_db?schema=public

# Telegram Bot Credentials (from @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Groq API Configuration
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
```

---

## 📦 Installation & Setup

```bash
# 1. Install all monorepo workspace dependencies
npm install

# 2. Generate Prisma Client
npm run prisma:generate

# 3. Run Database Migrations
npm run prisma:migrate
```

---

## 💻 Running the Application

```bash
# Run both Backend (Port 3001) and Frontend (Port 3000) concurrently:
npm run dev

# Or run services individually:
npm run dev:backend    # Starts NestJS backend in watch mode
npm run dev:frontend   # Starts Next.js dashboard
```

---

## 🌐 Health Endpoint Example (`GET /health`)

`GET http://localhost:3001/health`

```json
{
  "success": true,
  "message": "Atlas AI health check completed successfully.",
  "data": {
    "status": "ok",
    "version": "0.2.0",
    "environment": "development",
    "database": "connected",
    "telegram": "connected",
    "groq": "connected",
    "stats": {
      "totalUsers": 12,
      "totalConversations": 18
    },
    "uptimeSeconds": 342
  },
  "timestamp": "2026-08-07T22:00:00.000Z"
}
```

---

## 🤝 Git Commit Guidelines (Conventional Commits)

This repository enforces the **Conventional Commits** specification:

- `feat:` New features
- `fix:` Bug fixes
- `refactor:` Code restructuring without feature changes (e.g. `refactor: migrate LLM provider to Groq`)
- `docs:` Documentation updates
- `chore:` Dependency or toolchain updates
- `test:` Test additions or updates
