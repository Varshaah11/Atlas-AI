# Finora - Proactive Financial Intelligence Platform

Finora is an executive-grade AI Financial Assistant & Proactive Intelligence Platform living inside Telegram and the Web, designed to operate with the analytical rigor of a senior equity research analyst.

## 🚀 Key Features

- **Telegram Bot Interface**: Natural conversational interface powered by `Telegraf.js` with direct PDF document upload & analysis capabilities.
- **Financial Intelligence Web Dashboard**: Full-featured Next.js 14 Web Interface featuring Market Overview, Financial AI Chat, SEC Filings Search, Side-by-Side Stock Comparison, Document Intelligence RAG Workspace, Stock Alerts Dashboard, and Scheduled Market Briefings.
- **AI Orchestrator & Multi-Agent Framework**: Intent classification (`IIntentClassifier`), entity extraction (`EntityExtractorService`), ambiguity clarification (`ClarificationService`), and capability-based agent discovery (`AgentRegistryService`).
- **Financial Intelligence Layer**: Real-time financial context integration via **Finnhub REST API** for stock quotes, company profiles, fundamental metrics, market news, SEC filings, and peer stock comparisons.
- **Document Intelligence & Hybrid RAG**: High-accuracy PDF parsing (`pdf-parse`), structural chunking with overlap, hybrid keyword & vector search (`pgvector` cosine similarity), and grounded document query answering (`DocumentAgent`).
- **Proactive Intelligence & Stock Alerts (Sprint 8)**: User-configurable price threshold alerts (`PRICE_ABOVE`, `PRICE_BELOW`), daily percent movement alerts (`PERCENT_CHANGE_DAILY`), and new filing alerts (`NEW_SEC_FILING`) evaluated on a 5-minute schedule with automated Telegram notifications.
- **Scheduled Executive Market Briefings (Sprint 8)**: Automated AI market briefings (`DAILY_MORNING`, `DAILY_EVENING`, `WEEKLY_MONDAY`) synthesizing real-time quotes, news, and SEC filings delivered directly to Telegram and stored in briefing history.
- **Strict Anti-Hallucination Guardrails**: Groq receives retrieved Finnhub and document vector data as the sole source of truth. Figures are never fabricated or estimated if unavailable.
- **Lightweight TTL Caching**: Quota-friendly in-memory caching (60s Quotes, 10m Profiles/Metrics, 5m News) ensuring free-tier efficiency.
- **Data Persistence & Security**: PostgreSQL + `pgvector` via Prisma ORM with strict user isolation and `WebAuthGuard` identity enforcement.

---

## 📈 Dashboard & Features

- **Market Overview** (`/dashboard`): Real-time stock quotes, valuation metrics, and top company news.
- **Financial AI Chat** (`/dashboard/chat`): Conversational equity research & financial query assistant.
- **SEC Filings** (`/dashboard/sec`): Direct lookup and filtering of recent 10-K, 10-Q, and 8-K filings.
- **Stock Comparison** (`/dashboard/compare`): Side-by-side fundamental metric comparisons.
- **Document Intelligence** (`/dashboard/documents`): PDF document upload, status monitoring, and grounded RAG query analysis.
- **Stock & SEC Alerts** (`/dashboard/alerts`): Create, mute, activate, and delete real-time stock price and SEC filing triggers.
- **Scheduled Briefings** (`/dashboard/briefings`): Configure briefing frequencies, preferred delivery times, tracked stock lists, instant briefing generation (`trigger-now`), and delivery history.
- **System Monitor** (`/`): Health status monitoring for Postgres, Telegram, Groq, and Finnhub integration.

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
  "message": "Finora health check completed successfully.",
  "data": {
    "status": "ok",
    "version": "1.0.0",
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
  "timestamp": "2026-08-09T12:00:00.000Z"
}
```

---

## 🤝 Git Commit Guidelines (Conventional Commits)

This repository enforces the **Conventional Commits** specification:

- `feat:` New features
- `fix:` Bug fixes
- `refactor:` Code restructuring without feature changes
- `docs:` Documentation updates
- `chore:` Dependency or toolchain updates
- `test:` Test additions or updates
