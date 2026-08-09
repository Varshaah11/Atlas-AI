-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE_ABOVE', 'PRICE_BELOW', 'PERCENT_CHANGE_DAILY', 'NEW_SEC_FILING');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'TRIGGERED', 'MUTED');

-- CreateEnum
CREATE TYPE "BriefingFrequency" AS ENUM ('DAILY_MORNING', 'DAILY_EVENING', 'WEEKLY_MONDAY');

-- CreateTable
CREATE TABLE "stock_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "targetValue" DOUBLE PRECISION,
    "secFormType" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_briefings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "frequency" "BriefingFrequency" NOT NULL DEFAULT 'DAILY_MORNING',
    "preferredTime" TEXT NOT NULL DEFAULT '08:00',
    "symbols" TEXT[],
    "includeNews" BOOLEAN NOT NULL DEFAULT true,
    "includeSec" BOOLEAN NOT NULL DEFAULT true,
    "deliverTelegram" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastDeliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_briefings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'TELEGRAM',
    "delivered" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_alerts_userId_idx" ON "stock_alerts"("userId");

-- CreateIndex
CREATE INDEX "stock_alerts_symbol_status_idx" ON "stock_alerts"("symbol", "status");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_briefings_userId_key" ON "scheduled_briefings"("userId");

-- CreateIndex
CREATE INDEX "notification_logs_userId_createdAt_idx" ON "notification_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_briefings" ADD CONSTRAINT "scheduled_briefings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
