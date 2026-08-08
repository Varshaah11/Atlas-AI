# Atlas AI - AI Financial Assistant

Atlas AI is an AI-powered Financial Assistant living inside Telegram, designed to operate with the analytical rigor and persona of an experienced senior financial analyst.

## 🚀 Features

- **Telegram Bot Interface**: Natural conversational interface powered by `Telegraf.js`.
- **Conversation Gateway**: Input validation, text normalization, and graceful handling of empty or invalid messages.
- **AI Orchestrator & Conversation Agent**: Multi-agent framework supporting intent classification (`IIntentClassifier`), entity extraction (`EntityExtractorService`), ambiguity clarification (`ClarificationService`), and capability-based agent discovery (`AgentRegistryService`).
- **Financial Intelligence Layer (Sprint 4)**: Real-time financial context integration via **Finnhub REST API** for real stock quotes, company profiles, financial metrics, news, and stock comparisons.
- **Strict Anti-Hallucination Guardrails**: Groq receives retrieved Finnhub data as the authoritative source of truth for financial figures. Values are never fabricated or estimated if unavailable.
- **Lightweight TTL Caching**: Quota-friendly in-memory caching (60s Quotes, 10m Profiles/Metrics, 5m News) ensuring free-tier efficiency.
- **Execution Pipeline**: Decoupled execution pipeline (`ExecutionPipelineService`) managing financial data retrieval, context building, and LLM inference.
- **Groq LLM Engine**: Powered by Groq (`groq-sdk`) running `llama-3.3-70b-versatile` with latency tracking.
- **Data Persistence**: Prisma ORM with PostgreSQL + `pgvector` for user profiles, active conversations, and message histories.
- **Standardized API & Health Monitoring**: `GET /health` endpoint reporting database, Telegram, Groq, and Finnhub health status plus system counters.
- **System Monitor Dashboard**: Next.js 14 web monitor UI displaying component health status badges and user/conversation stats.

---

## 📈 Supported Financial Queries

- **Stock Price**: `"What is Apple's stock price?"` or `"What's AAPL trading at?"`
- **Company Research**: `"Tell me about Microsoft"` or `"Apple company profile"`
- **Financial Metrics**: `"What is the market cap of Tesla?"` or `"Show me NVDA P/E ratio"`
- **Financial News**: `"What is the latest news about NVIDIA?"`
- **Stock Comparison**: `"Compare Apple and Microsoft"` or `"AAPL vs MSFT"`
- **General Conversation**: Greetings like `"hi"` or `"what can you do?"` remain fast and never call Finnhub API.

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

# Finnhub Financial Data Provider Key
FINNHUB_API_KEY="PASTE_YOUR_FINNHUB_API_KEY_HERE"
```

> [!IMPORTANT]
> The `backend/.env.example` file contains the placeholder `FINNHUB_API_KEY="PASTE_YOUR_FINNHUB_API_KEY_HERE"`. Paste your actual Finnhub key directly into your local `backend/.env`. Never commit real API keys to version control.

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
    "version": "0.3.0",
    "environment": "development",
    "database": "connected",
    "telegram": "connected",
    "groq": "connected",
    "finnhub": "connected",
    "stats": {
      "totalUsers": 12,
      "totalConversations": 18
    },
    "uptimeSeconds": 342
  },
  "timestamp": "2026-08-08T17:30:00.000Z"
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
