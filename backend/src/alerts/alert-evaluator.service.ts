import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertStatus, AlertType, StockAlert } from '@prisma/client';
import { AppLogger } from '@/common/logger/logger.service';
import { PrismaService } from '@/database/prisma.service';
import { FinanceService } from '@/finance/finance.service';
import { TelegramService } from '@/telegram/telegram.service';
import { IUserService, USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';

@Injectable()
export class AlertEvaluatorService {
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly telegramService: TelegramService,
    @Inject(USER_SERVICE_TOKEN) private readonly userService: IUserService,
    private readonly logger: AppLogger,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluateAlerts(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'Alert evaluation already in progress, skipping concurrent tick.',
        'AlertEvaluatorService',
      );
      return;
    }

    this.isRunning = true;
    try {
      this.logger.log('Starting 5-minute stock alert evaluation sweep...', 'AlertEvaluatorService');

      const activeAlerts = await this.prisma.stockAlert.findMany({
        where: { status: AlertStatus.ACTIVE },
        include: { user: true },
      });

      if (!activeAlerts || activeAlerts.length === 0) {
        this.logger.log('No active stock alerts found for evaluation.', 'AlertEvaluatorService');
        return;
      }

      // Group active alerts by symbol to minimize external API calls
      const alertsBySymbol = new Map<string, typeof activeAlerts>();
      for (const alert of activeAlerts) {
        const symbolUpper = alert.symbol.trim().toUpperCase();
        if (!alertsBySymbol.has(symbolUpper)) {
          alertsBySymbol.set(symbolUpper, []);
        }
        alertsBySymbol.get(symbolUpper)!.push(alert);
      }

      for (const [symbol, alerts] of alertsBySymbol.entries()) {
        try {
          await this.evaluateSymbolAlerts(symbol, alerts);
        } catch (err: any) {
          this.logger.error(
            `Failed evaluating alerts for symbol ${symbol}: ${err.message}`,
            err.stack,
            'AlertEvaluatorService',
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Critical error during alert evaluation sweep: ${error.message}`,
        error.stack,
        'AlertEvaluatorService',
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async evaluateSymbolAlerts(
    symbol: string,
    alerts: (StockAlert & { user: any })[],
  ): Promise<void> {
    // Determine if price alerts or SEC alerts exist for this symbol
    const hasPriceAlerts = alerts.some(
      (a) =>
        a.alertType === AlertType.PRICE_ABOVE ||
        a.alertType === AlertType.PRICE_BELOW ||
        a.alertType === AlertType.PERCENT_CHANGE_DAILY,
    );

    const hasSecAlerts = alerts.some((a) => a.alertType === AlertType.NEW_SEC_FILING);

    let quote: any = null;
    if (hasPriceAlerts) {
      quote = await this.financeService.getStockQuote(symbol);
    }

    let secFilings: any = null;
    if (hasSecAlerts) {
      secFilings = await this.financeService.getRecentSecFilings(symbol, ['10-K', '10-Q', '8-K']);
    }

    for (const alert of alerts) {
      try {
        await this.processSingleAlert(alert, quote, secFilings);
      } catch (err: any) {
        this.logger.error(
          `Failed processing alert ID ${alert.id} for user ${alert.userId}: ${err.message}`,
          err.stack,
          'AlertEvaluatorService',
        );
      }
    }
  }

  private async processSingleAlert(
    alert: StockAlert & { user: any },
    quote: any,
    secFilings: any,
  ): Promise<void> {
    let triggered = false;
    let messageText = '';

    if (alert.alertType === AlertType.PRICE_ABOVE && quote && alert.targetValue !== null) {
      if (quote.currentPrice >= alert.targetValue) {
        triggered = true;
        messageText = `🔔 *Atlas AI Stock Alert*\n\n*${alert.symbol}* crossed above your target price of *$${alert.targetValue.toFixed(2)}*.\n\n*Current Price:* $${quote.currentPrice.toFixed(2)}`;
      }
    } else if (alert.alertType === AlertType.PRICE_BELOW && quote && alert.targetValue !== null) {
      if (quote.currentPrice <= alert.targetValue) {
        triggered = true;
        messageText = `🔔 *Atlas AI Stock Alert*\n\n*${alert.symbol}* dropped below your target price of *$${alert.targetValue.toFixed(2)}*.\n\n*Current Price:* $${quote.currentPrice.toFixed(2)}`;
      }
    } else if (
      alert.alertType === AlertType.PERCENT_CHANGE_DAILY &&
      quote &&
      alert.targetValue !== null
    ) {
      const changePct = quote.percentChange || 0;
      if (Math.abs(changePct) >= alert.targetValue) {
        triggered = true;
        const direction = changePct >= 0 ? 'up' : 'down';
        messageText = `📈 *Atlas AI Market Movement Alert*\n\n*${alert.symbol}* moved *${changePct.toFixed(2)}% ${direction}* today (Threshold: ${alert.targetValue}%).\n\n*Current Price:* $${quote.currentPrice.toFixed(2)}`;
      }
    } else if (alert.alertType === AlertType.NEW_SEC_FILING && secFilings && alert.secFormType) {
      const filingsList = secFilings.recentFilings || [];
      const matchingFiling = filingsList.find(
        (f: any) => (f.form || '').toUpperCase() === alert.secFormType!.toUpperCase(),
      );

      if (matchingFiling) {
        const filingDate = new Date(
          matchingFiling.filingDate || matchingFiling.filedAt || Date.now(),
        );
        const lastTriggered = alert.lastTriggeredAt ? new Date(alert.lastTriggeredAt) : new Date(0);

        // Check if filing is genuinely newer than lastTriggeredAt timestamp
        if (filingDate.getTime() > lastTriggered.getTime()) {
          triggered = true;
          messageText = `📄 *Atlas AI SEC Filing Alert*\n\n*${alert.symbol}* filed a new *${alert.secFormType}*.\n\n*Filed Date:* ${matchingFiling.filingDate || 'Recently'}`;
        }
      }
    }

    if (!triggered || !messageText) return;

    let delivered = false;
    let deliveryError: string | null = null;

    const targetTelegramId = await this.userService.getTelegramChatId(alert.user);

    if (targetTelegramId) {
      try {
        delivered = await this.telegramService.sendNotification(targetTelegramId, messageText);
        if (!delivered) {
          deliveryError = 'Failed to deliver Telegram notification or bot unconfigured.';
        }
      } catch (err: any) {
        delivered = false;
        deliveryError = err.message || 'Telegram notification error.';
      }
    } else {
      deliveryError = 'User has no linked Telegram chat ID.';
    }

    // Record NotificationLog
    await this.prisma.notificationLog.create({
      data: {
        userId: alert.userId,
        type: 'ALERT',
        title: `Atlas AI Alert: ${alert.symbol}`,
        content: messageText,
        channel: delivered ? 'TELEGRAM' : 'WEB',
        delivered,
        error: deliveryError,
      },
    });

    // Update alert status to TRIGGERED and record timestamp to prevent duplicate 5-minute spam loops
    await this.prisma.stockAlert.update({
      where: { id: alert.id },
      data: {
        status: AlertStatus.TRIGGERED,
        lastTriggeredAt: new Date(),
      },
    });

    this.logger.log(
      `Alert ID ${alert.id} (${alert.symbol} - ${alert.alertType}) triggered for user ${alert.userId} (Delivered: ${delivered})`,
      'AlertEvaluatorService',
    );
  }
}
