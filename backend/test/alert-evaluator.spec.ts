import { Test, TestingModule } from '@nestjs/testing';
import { AlertStatus, AlertType } from '@prisma/client';
import { AlertEvaluatorService } from '@/alerts/alert-evaluator.service';
import { PrismaService } from '@/database/prisma.service';
import { FinanceService } from '@/finance/finance.service';
import { TelegramService } from '@/telegram/telegram.service';
import { AppLogger } from '@/common/logger/logger.service';
import { USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';

describe('AlertEvaluatorService Unit Tests (Phase 5 & Integration Fix)', () => {
  let alertEvaluatorService: AlertEvaluatorService;
  let prismaMock: any;
  let financeServiceMock: any;
  let telegramServiceMock: any;
  let userServiceMock: any;
  let loggerMock: any;

  const mockUser = { id: 'user-uuid-1', telegramId: 'telegram-user-1' };

  beforeEach(async () => {
    prismaMock = {
      stockAlert: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'alert-1', status: AlertStatus.TRIGGERED }),
      },
      notificationLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    financeServiceMock = {
      getStockQuote: jest.fn(),
      getRecentSecFilings: jest.fn(),
    };

    telegramServiceMock = {
      sendNotification: jest.fn().mockResolvedValue(true),
    };

    userServiceMock = {
      getTelegramChatId: jest.fn().mockImplementation((user) => {
        if (!user || !user.telegramId) return Promise.resolve(null);
        if (user.telegramId.startsWith('web-unlinked')) return Promise.resolve(null);
        if (user.telegramId === 'web-default-web-user') return Promise.resolve('987654321');
        return Promise.resolve(user.telegramId);
      }),
    };

    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertEvaluatorService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FinanceService, useValue: financeServiceMock },
        { provide: TelegramService, useValue: telegramServiceMock },
        { provide: USER_SERVICE_TOKEN, useValue: userServiceMock },
        { provide: AppLogger, useValue: loggerMock },
      ],
    }).compile();

    alertEvaluatorService = module.get<AlertEvaluatorService>(AlertEvaluatorService);
  });

  it('Test 1 — PRICE_ABOVE triggers when threshold crossed', async () => {
    const alert = {
      id: 'alert-1',
      userId: mockUser.id,
      symbol: 'AAPL',
      alertType: AlertType.PRICE_ABOVE,
      targetValue: 200,
      status: AlertStatus.ACTIVE,
      user: mockUser,
    };

    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 205, percentChange: 2.5 });

    await alertEvaluatorService.evaluateAlerts();

    expect(telegramServiceMock.sendNotification).toHaveBeenCalledWith(
      mockUser.telegramId,
      expect.stringContaining('crossed above your target price'),
    );
    expect(prismaMock.stockAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alert-1' },
        data: expect.objectContaining({ status: AlertStatus.TRIGGERED }),
      }),
    );
  });

  it('Test 2 — PRICE_ABOVE does not trigger below threshold', async () => {
    const alert = {
      id: 'alert-1',
      userId: mockUser.id,
      symbol: 'AAPL',
      alertType: AlertType.PRICE_ABOVE,
      targetValue: 200,
      status: AlertStatus.ACTIVE,
      user: mockUser,
    };

    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 195 });

    await alertEvaluatorService.evaluateAlerts();

    expect(telegramServiceMock.sendNotification).not.toHaveBeenCalled();
    expect(prismaMock.stockAlert.update).not.toHaveBeenCalled();
  });

  it('Test 3 — PRICE_BELOW triggers when threshold crossed', async () => {
    const alert = {
      id: 'alert-2',
      userId: mockUser.id,
      symbol: 'MSFT',
      alertType: AlertType.PRICE_BELOW,
      targetValue: 400,
      status: AlertStatus.ACTIVE,
      user: mockUser,
    };

    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 390 });

    await alertEvaluatorService.evaluateAlerts();

    expect(telegramServiceMock.sendNotification).toHaveBeenCalledWith(
      mockUser.telegramId,
      expect.stringContaining('dropped below your target price'),
    );
  });

  it('Test 4 — PRICE_BELOW does not trigger above threshold', async () => {
    const alert = {
      id: 'alert-2',
      userId: mockUser.id,
      symbol: 'MSFT',
      alertType: AlertType.PRICE_BELOW,
      targetValue: 400,
      status: AlertStatus.ACTIVE,
      user: mockUser,
    };

    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 410 });

    await alertEvaluatorService.evaluateAlerts();

    expect(telegramServiceMock.sendNotification).not.toHaveBeenCalled();
  });

  it('Test 5 — PERCENT_CHANGE_DAILY triggers at threshold', async () => {
    const alert = {
      id: 'alert-3',
      userId: mockUser.id,
      symbol: 'NVDA',
      alertType: AlertType.PERCENT_CHANGE_DAILY,
      targetValue: 5,
      status: AlertStatus.ACTIVE,
      user: mockUser,
    };

    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 120, percentChange: 5.5 });

    await alertEvaluatorService.evaluateAlerts();

    expect(telegramServiceMock.sendNotification).toHaveBeenCalledWith(
      mockUser.telegramId,
      expect.stringContaining('5.50% up'),
    );
  });

  it('Test 6 — PERCENT_CHANGE_DAILY works for negative movement', async () => {
    const alert = {
      id: 'alert-3',
      userId: mockUser.id,
      symbol: 'NVDA',
      alertType: AlertType.PERCENT_CHANGE_DAILY,
      targetValue: 5,
      status: AlertStatus.ACTIVE,
      user: mockUser,
    };

    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 110, percentChange: -6.2 });

    await alertEvaluatorService.evaluateAlerts();

    expect(telegramServiceMock.sendNotification).toHaveBeenCalledWith(
      mockUser.telegramId,
      expect.stringContaining('-6.20% down'),
    );
  });

  it('Test 7 — TRIGGERED alerts are skipped', async () => {
    // Evaluation query explicitly filters status = ACTIVE
    prismaMock.stockAlert.findMany.mockResolvedValue([]);

    await alertEvaluatorService.evaluateAlerts();

    expect(financeServiceMock.getStockQuote).not.toHaveBeenCalled();
  });

  it('Test 8 — MUTED alerts are skipped', async () => {
    prismaMock.stockAlert.findMany.mockResolvedValue([]);

    await alertEvaluatorService.evaluateAlerts();

    expect(financeServiceMock.getStockQuote).not.toHaveBeenCalled();
  });

  it('Test 9 — Multiple alerts for same symbol reuse one quote request', async () => {
    const alert1 = { id: 'a1', userId: mockUser.id, symbol: 'AAPL', alertType: AlertType.PRICE_ABOVE, targetValue: 200, status: AlertStatus.ACTIVE, user: mockUser };
    const alert2 = { id: 'a2', userId: mockUser.id, symbol: 'AAPL', alertType: AlertType.PRICE_BELOW, targetValue: 150, status: AlertStatus.ACTIVE, user: mockUser };

    prismaMock.stockAlert.findMany.mockResolvedValue([alert1, alert2]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 205 });

    await alertEvaluatorService.evaluateAlerts();

    expect(financeServiceMock.getStockQuote).toHaveBeenCalledTimes(1);
    expect(financeServiceMock.getStockQuote).toHaveBeenCalledWith('AAPL');
  });

  it('Test 10 — Telegram success creates delivered NotificationLog', async () => {
    const alert = { id: 'a1', userId: mockUser.id, symbol: 'AAPL', alertType: AlertType.PRICE_ABOVE, targetValue: 200, status: AlertStatus.ACTIVE, user: mockUser };
    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 205 });
    telegramServiceMock.sendNotification.mockResolvedValue(true);

    await alertEvaluatorService.evaluateAlerts();

    expect(prismaMock.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          delivered: true,
          channel: 'TELEGRAM',
        }),
      }),
    );
  });

  it('Test 11 — Telegram failure does not crash scheduler', async () => {
    const alert = { id: 'a1', userId: mockUser.id, symbol: 'AAPL', alertType: AlertType.PRICE_ABOVE, targetValue: 200, status: AlertStatus.ACTIVE, user: mockUser };
    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 205 });
    telegramServiceMock.sendNotification.mockRejectedValue(new Error('Network offline'));

    await expect(alertEvaluatorService.evaluateAlerts()).resolves.not.toThrow();
  });

  it('Test 12 — Failed delivery does not cause notification spam (status updated to TRIGGERED)', async () => {
    const alert = { id: 'a1', userId: mockUser.id, symbol: 'AAPL', alertType: AlertType.PRICE_ABOVE, targetValue: 200, status: AlertStatus.ACTIVE, user: mockUser };
    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 205 });
    telegramServiceMock.sendNotification.mockResolvedValue(false);

    await alertEvaluatorService.evaluateAlerts();

    expect(prismaMock.stockAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1' },
        data: expect.objectContaining({ status: AlertStatus.TRIGGERED }),
      }),
    );
  });

  it('Test 13 — Alert becomes TRIGGERED after successful delivery', async () => {
    const alert = { id: 'a1', userId: mockUser.id, symbol: 'AAPL', alertType: AlertType.PRICE_ABOVE, targetValue: 200, status: AlertStatus.ACTIVE, user: mockUser };
    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 205 });
    telegramServiceMock.sendNotification.mockResolvedValue(true);

    await alertEvaluatorService.evaluateAlerts();

    expect(prismaMock.stockAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: AlertStatus.TRIGGERED }),
      }),
    );
  });

  it('Test 14 — NEW_SEC_FILING detects a genuinely new filing', async () => {
    const alert = {
      id: 'a-sec-1',
      userId: mockUser.id,
      symbol: 'MSFT',
      alertType: AlertType.NEW_SEC_FILING,
      secFormType: '10-K',
      status: AlertStatus.ACTIVE,
      lastTriggeredAt: new Date('2026-01-01T00:00:00Z'),
      user: mockUser,
    };

    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getRecentSecFilings.mockResolvedValue({
      recentFilings: [
        { form: '10-K', filingDate: '2026-08-09' },
      ],
    });

    await alertEvaluatorService.evaluateAlerts();

    expect(telegramServiceMock.sendNotification).toHaveBeenCalledWith(
      mockUser.telegramId,
      expect.stringContaining('filed a new'),
    );
  });

  it('Test 15 — Same SEC filing is not notified twice', async () => {
    const alert = {
      id: 'a-sec-1',
      userId: mockUser.id,
      symbol: 'MSFT',
      alertType: AlertType.NEW_SEC_FILING,
      secFormType: '10-K',
      status: AlertStatus.ACTIVE,
      lastTriggeredAt: new Date('2026-08-09T10:00:00Z'),
      user: mockUser,
    };

    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getRecentSecFilings.mockResolvedValue({
      recentFilings: [
        { form: '10-K', filingDate: '2026-08-09' }, // Older or same date as lastTriggeredAt
      ],
    });

    await alertEvaluatorService.evaluateAlerts();

    expect(telegramServiceMock.sendNotification).not.toHaveBeenCalled();
  });

  it('Test 16 — One symbol failure does not stop other symbols', async () => {
    const alertAAPL = { id: 'a1', userId: mockUser.id, symbol: 'AAPL', alertType: AlertType.PRICE_ABOVE, targetValue: 200, status: AlertStatus.ACTIVE, user: mockUser };
    const alertMSFT = { id: 'a2', userId: mockUser.id, symbol: 'MSFT', alertType: AlertType.PRICE_ABOVE, targetValue: 300, status: AlertStatus.ACTIVE, user: mockUser };

    prismaMock.stockAlert.findMany.mockResolvedValue([alertAAPL, alertMSFT]);
    financeServiceMock.getStockQuote
      .mockRejectedValueOnce(new Error('Finnhub AAPL timeout'))
      .mockResolvedValueOnce({ currentPrice: 350 });

    await alertEvaluatorService.evaluateAlerts();

    expect(telegramServiceMock.sendNotification).toHaveBeenCalledWith(
      mockUser.telegramId,
      expect.stringContaining('MSFT'),
    );
  });

  it('Test 17 — Synthetic web user with linked Telegram chat ID resolves real Telegram chat ID', async () => {
    const webUser = { id: 'web-user-uuid', telegramId: 'web-default-web-user' };
    const alert = { id: 'a-web-1', userId: webUser.id, symbol: 'AAPL', alertType: AlertType.PRICE_ABOVE, targetValue: 200, status: AlertStatus.ACTIVE, user: webUser };

    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 205 });

    await alertEvaluatorService.evaluateAlerts();

    expect(userServiceMock.getTelegramChatId).toHaveBeenCalledWith(webUser);
    expect(telegramServiceMock.sendNotification).toHaveBeenCalledWith(
      '987654321', // Resolved real Telegram Chat ID
      expect.stringContaining('crossed above your target price'),
    );
  });

  it('Test 18 — User without linked Telegram account is handled safely and produces delivered=false without calling sendNotification with synthetic ID', async () => {
    const unlinkedWebUser = { id: 'unlinked-uuid', telegramId: 'web-unlinked-user' };
    const alert = { id: 'a-web-2', userId: unlinkedWebUser.id, symbol: 'MSFT', alertType: AlertType.PRICE_ABOVE, targetValue: 300, status: AlertStatus.ACTIVE, user: unlinkedWebUser };

    prismaMock.stockAlert.findMany.mockResolvedValue([alert]);
    financeServiceMock.getStockQuote.mockResolvedValue({ currentPrice: 350 });

    await alertEvaluatorService.evaluateAlerts();

    expect(userServiceMock.getTelegramChatId).toHaveBeenCalledWith(unlinkedWebUser);
    expect(telegramServiceMock.sendNotification).not.toHaveBeenCalled();
    expect(prismaMock.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          delivered: false,
          error: 'User has no linked Telegram chat ID.',
        }),
      }),
    );
  });
});
