import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlertStatus, AlertType } from '@prisma/client';
import { AlertsController } from '@/alerts/alerts.controller';
import { AlertsService } from '@/alerts/alerts.service';
import { PrismaService } from '@/database/prisma.service';
import { FinanceService } from '@/finance/finance.service';
import { AppLogger } from '@/common/logger/logger.service';
import { UserService } from '@/users/user.service';
import { USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';

describe('Stock Alerts API & Security Suite (Phase 3)', () => {
  let alertsService: AlertsService;
  let alertsController: AlertsController;
  let prismaMock: any;
  let financeServiceMock: any;
  let userServiceMock: any;

  const mockUserA = { id: 'user-uuid-A', telegramId: 'telegram-user-A' };
  const mockUserB = { id: 'user-uuid-B', telegramId: 'telegram-user-B' };

  beforeEach(async () => {
    prismaMock = {
      stockAlert: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'alert-101', ...data })),
        findMany: jest.fn().mockImplementation(({ where }) => {
          if (where.userId === mockUserA.id) {
            return Promise.resolve([
              { id: 'alert-101', userId: mockUserA.id, symbol: 'AAPL', alertType: AlertType.PRICE_ABOVE, targetValue: 200, status: AlertStatus.ACTIVE, createdAt: new Date() },
            ]);
          }
          return Promise.resolve([]);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'alert-101' && where.userId === mockUserA.id) {
            return Promise.resolve({ id: 'alert-101', userId: mockUserA.id, symbol: 'AAPL', alertType: AlertType.PRICE_ABOVE, targetValue: 200, status: AlertStatus.ACTIVE });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, userId: mockUserA.id, symbol: 'AAPL', alertType: AlertType.PRICE_ABOVE, targetValue: 200, status: AlertStatus.ACTIVE, ...data })),
        delete: jest.fn().mockResolvedValue({ id: 'alert-101' }),
      },
    };

    financeServiceMock = {
      resolveTicker: jest.fn().mockImplementation((query: string) => {
        const qUpper = query.trim().toUpperCase();
        if (qUpper === 'AAPL' || qUpper === 'APPLE') return Promise.resolve('AAPL');
        if (qUpper === 'MSFT' || qUpper === 'MICROSOFT') return Promise.resolve('MSFT');
        if (qUpper === 'NVDA') return Promise.resolve('NVDA');
        return Promise.resolve(null);
      }),
    };

    userServiceMock = {
      getOrCreateUser: jest.fn().mockImplementation((data) => {
        if (data.telegramId === mockUserA.telegramId) return Promise.resolve(mockUserA);
        if (data.telegramId === mockUserB.telegramId) return Promise.resolve(mockUserB);
        return Promise.resolve(mockUserA);
      }),
      findByTelegramId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        AlertsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FinanceService, useValue: financeServiceMock },
        { provide: USER_SERVICE_TOKEN, useValue: userServiceMock },
        { provide: AppLogger, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    alertsService = module.get<AlertsService>(AlertsService);
    alertsController = module.get<AlertsController>(AlertsController);
  });

  it('Test 1 — Authenticated user can create PRICE_ABOVE alert', async () => {
    const req = { user: mockUserA };
    const res = await alertsController.createAlert(req, {
      symbol: 'AAPL',
      alertType: AlertType.PRICE_ABOVE,
      targetValue: 250,
    });

    expect(res.success).toBe(true);
    expect(res.alert.symbol).toBe('AAPL');
    expect(res.alert.alertType).toBe(AlertType.PRICE_ABOVE);
    expect(res.alert.targetValue).toBe(250);
    expect(res.alert.userId).toBe(mockUserA.id);
  });

  it('Test 2 — Authenticated user can create PRICE_BELOW alert', async () => {
    const req = { user: mockUserA };
    const res = await alertsController.createAlert(req, {
      symbol: 'MSFT',
      alertType: AlertType.PRICE_BELOW,
      targetValue: 400,
    });

    expect(res.success).toBe(true);
    expect(res.alert.symbol).toBe('MSFT');
    expect(res.alert.alertType).toBe(AlertType.PRICE_BELOW);
    expect(res.alert.targetValue).toBe(400);
  });

  it('Test 3 — Authenticated user can create PERCENT_CHANGE_DAILY alert', async () => {
    const req = { user: mockUserA };
    const res = await alertsController.createAlert(req, {
      symbol: 'NVDA',
      alertType: AlertType.PERCENT_CHANGE_DAILY,
      targetValue: 5,
    });

    expect(res.success).toBe(true);
    expect(res.alert.symbol).toBe('NVDA');
    expect(res.alert.alertType).toBe(AlertType.PERCENT_CHANGE_DAILY);
    expect(res.alert.targetValue).toBe(5);
  });

  it('Test 4 — Authenticated user can create NEW_SEC_FILING alert', async () => {
    const req = { user: mockUserA };
    const res = await alertsController.createAlert(req, {
      symbol: 'AAPL',
      alertType: AlertType.NEW_SEC_FILING,
      secFormType: '10-K',
    });

    expect(res.success).toBe(true);
    expect(res.alert.symbol).toBe('AAPL');
    expect(res.alert.alertType).toBe(AlertType.NEW_SEC_FILING);
    expect(res.alert.secFormType).toBe('10-K');
  });

  it('Test 5 — Symbols are normalized to uppercase (e.g. apple -> AAPL)', async () => {
    const req = { user: mockUserA };
    const res = await alertsController.createAlert(req, {
      symbol: 'apple',
      alertType: AlertType.PRICE_ABOVE,
      targetValue: 200,
    });

    expect(res.alert.symbol).toBe('AAPL');
  });

  it('Test 6 — Missing targetValue is rejected for price alerts', async () => {
    const req = { user: mockUserA };
    await expect(
      alertsController.createAlert(req, {
        symbol: 'AAPL',
        alertType: AlertType.PRICE_ABOVE,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('Test 7 — Invalid SEC form type is rejected', async () => {
    const req = { user: mockUserA };
    await expect(
      alertsController.createAlert(req, {
        symbol: 'AAPL',
        alertType: AlertType.NEW_SEC_FILING,
        secFormType: 'INVALID_FORM',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("Test 8 — User A cannot list User B's alerts", async () => {
    const reqA = { user: mockUserA };
    const reqB = { user: mockUserB };

    const resA = await alertsController.listAlerts(reqA);
    const resB = await alertsController.listAlerts(reqB);

    expect(resA.alerts.length).toBe(1);
    expect(resA.alerts[0].userId).toBe(mockUserA.id);
    expect(resB.alerts.length).toBe(0);
  });

  it("Test 9 — User A cannot update User B's alert (returns 404)", async () => {
    const reqB = { user: mockUserB };
    await expect(
      alertsController.updateAlert(reqB, 'alert-101', { status: AlertStatus.MUTED }),
    ).rejects.toThrow(NotFoundException);
  });

  it("Test 10 — User A cannot delete User B's alert (returns 404)", async () => {
    const reqB = { user: mockUserB };
    await expect(alertsController.deleteAlert(reqB, 'alert-101')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('Test 11 — Controller uses req.user.id and body userId/telegramId cannot override req.user.id', async () => {
    const req = { user: mockUserA };
    const maliciousBody: any = {
      userId: 'hacker-user-id',
      telegramId: 'hacker-telegram-id',
      symbol: 'AAPL',
      alertType: AlertType.PRICE_ABOVE,
      targetValue: 210,
    };

    const res = await alertsController.createAlert(req, maliciousBody);
    expect(res.alert.userId).toBe(mockUserA.id);
    expect(res.alert.userId).not.toBe('hacker-user-id');
  });

  it('Test 12 — New alerts default to ACTIVE status', async () => {
    const req = { user: mockUserA };
    const res = await alertsController.createAlert(req, {
      symbol: 'AAPL',
      alertType: AlertType.PRICE_ABOVE,
      targetValue: 190,
    });

    expect(res.alert.status).toBe(AlertStatus.ACTIVE);
  });

  it('Test 13 — Existing alert statuses (TRIGGERED, MUTED) can be updated', async () => {
    const req = { user: mockUserA };

    const updatedMuted = await alertsController.updateAlert(req, 'alert-101', {
      status: AlertStatus.MUTED,
    });
    expect(updatedMuted.alert.status).toBe(AlertStatus.MUTED);

    const updatedTriggered = await alertsController.updateAlert(req, 'alert-101', {
      status: AlertStatus.TRIGGERED,
    });
    expect(updatedTriggered.alert.status).toBe(AlertStatus.TRIGGERED);
  });

  it('Test 14 — Valid delete owned alert succeeds', async () => {
    const req = { user: mockUserA };
    const res = await alertsController.deleteAlert(req, 'alert-101');

    expect(res.success).toBe(true);
    expect(res.id).toBe('alert-101');
    expect(prismaMock.stockAlert.delete).toHaveBeenCalledWith({ where: { id: 'alert-101' } });
  });
});
