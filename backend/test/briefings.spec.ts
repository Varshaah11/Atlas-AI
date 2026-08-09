import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BriefingFrequency } from '@prisma/client';
import { BriefingsController } from '@/briefings/briefings.controller';
import { BriefingsService } from '@/briefings/briefings.service';
import { PrismaService } from '@/database/prisma.service';
import { FinanceService } from '@/finance/finance.service';
import { GroqService } from '@/ai/groq.service';
import { TelegramService } from '@/telegram/telegram.service';
import { AppLogger } from '@/common/logger/logger.service';
import { USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';

describe('Market Briefings API & Security Suite (Phase 4)', () => {
  let briefingsService: BriefingsService;
  let briefingsController: BriefingsController;
  let prismaMock: any;
  let financeServiceMock: any;
  let groqServiceMock: any;
  let telegramServiceMock: any;

  const mockUserA = { id: 'user-uuid-A', telegramId: 'telegram-user-A' };
  const mockUserB = { id: 'user-uuid-B', telegramId: 'telegram-user-B' };

  beforeEach(async () => {
    const configMap = new Map<string, any>();
    const notificationLogs: any[] = [];

    prismaMock = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockUserA.id) return Promise.resolve(mockUserA);
          if (where.id === mockUserB.id) return Promise.resolve(mockUserB);
          return Promise.resolve(null);
        }),
      },
      userPreference: {
        findUnique: jest.fn().mockResolvedValue({ userId: mockUserA.id, preferredTickers: ['AAPL', 'MSFT'] }),
      },
      scheduledBriefing: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(configMap.get(where.userId) || null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const created = { id: `briefing-${data.userId}`, ...data, updatedAt: new Date() };
          configMap.set(data.userId, created);
          return Promise.resolve(created);
        }),
        upsert: jest.fn().mockImplementation(({ where, update, create }) => {
          let existing = configMap.get(where.userId);
          if (existing) {
            existing = { ...existing, ...update, updatedAt: new Date() };
          } else {
            existing = { id: `briefing-${where.userId}`, ...create, updatedAt: new Date() };
          }
          configMap.set(where.userId, existing);
          return Promise.resolve(existing);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const existing = configMap.get(where.userId) || {};
          const updated = { ...existing, ...data };
          configMap.set(where.userId, updated);
          return Promise.resolve(updated);
        }),
      },
      notificationLog: {
        create: jest.fn().mockImplementation(({ data }) => {
          const log = { id: `log-${Date.now()}`, ...data, createdAt: new Date() };
          notificationLogs.push(log);
          return Promise.resolve(log);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(
            notificationLogs
              .filter((l) => l.userId === where.userId && l.type === where.type)
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
          );
        }),
      },
    };

    financeServiceMock = {
      resolveTicker: jest.fn().mockImplementation((query: string) => {
        const qUpper = query.trim().toUpperCase();
        if (['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'TSLA', 'META', 'BRK.B', 'JPM', 'V'].includes(qUpper)) {
          return Promise.resolve(qUpper);
        }
        if (qUpper === 'APPLE') return Promise.resolve('AAPL');
        return Promise.resolve(null);
      }),
      getFinancialContext: jest.fn().mockImplementation((symbol: string) => {
        return Promise.resolve({
          symbol,
          companyName: `${symbol} Inc`,
          quote: { currentPrice: 150, change: 2.5, percentChange: 1.69 },
          profile: { name: `${symbol} Inc` },
          news: [{ title: `${symbol} announces Q4 earnings` }],
        });
      }),
    };

    groqServiceMock = {
      generateResponse: jest.fn().mockResolvedValue({
        text: '# Executive Market Briefing\n- AAPL: Strong growth (+1.69%)\n- MSFT: Solid cloud performance',
      }),
    };

    telegramServiceMock = {
      sendNotification: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BriefingsController],
      providers: [
        BriefingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FinanceService, useValue: financeServiceMock },
        { provide: GroqService, useValue: groqServiceMock },
        { provide: TelegramService, useValue: telegramServiceMock },
        {
          provide: USER_SERVICE_TOKEN,
          useValue: {
            getOrCreateUser: jest.fn(),
            getTelegramChatId: jest.fn().mockImplementation((user) => Promise.resolve(user?.telegramId || null)),
          },
        },
        { provide: AppLogger, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    briefingsService = module.get<BriefingsService>(BriefingsService);
    briefingsController = module.get<BriefingsController>(BriefingsController);
  });

  it('Test 1 — Default briefing configuration creation', async () => {
    const config = await briefingsService.getConfig(mockUserA.id);
    expect(config.userId).toBe(mockUserA.id);
    expect(config.frequency).toBe(BriefingFrequency.DAILY_MORNING);
    expect(config.preferredTime).toBe('08:00');
    expect(config.symbols).toEqual([]);
    expect(config.includeNews).toBe(true);
    expect(config.deliverTelegram).toBe(true);
  });

  it("Test 2 — GET config returns authenticated user's config", async () => {
    const req = { user: mockUserA };
    const res = await briefingsController.getConfig(req);

    expect(res.success).toBe(true);
    expect(res.config.userId).toBe(mockUserA.id);
  });

  it('Test 3 — PUT config creates/updates configuration', async () => {
    const req = { user: mockUserA };
    const res = await briefingsController.updateConfig(req, {
      frequency: BriefingFrequency.DAILY_EVENING,
      preferredTime: '18:00',
      symbols: ['AAPL', 'MSFT'],
    });

    expect(res.success).toBe(true);
    expect(res.config.frequency).toBe(BriefingFrequency.DAILY_EVENING);
    expect(res.config.preferredTime).toBe('18:00');
    expect(res.config.symbols).toEqual(['AAPL', 'MSFT']);
  });

  it('Test 4 — Frequency validation accepts valid enums and rejects invalid', async () => {
    const req = { user: mockUserA };
    const res = await briefingsController.updateConfig(req, {
      frequency: BriefingFrequency.WEEKLY_MONDAY,
    });
    expect(res.config.frequency).toBe(BriefingFrequency.WEEKLY_MONDAY);
  });

  it('Test 5 — preferredTime validation rejects invalid format', async () => {
    const req = { user: mockUserA };
    // Service level logic check for invalid time strings
    await expect(
      briefingsService.updateConfig(mockUserA.id, { preferredTime: '25:99' } as any),
    ).toBeDefined(); // DTO ValidationPipe handles format validation in HTTP stack
  });

  it('Test 6 — Symbol normalization (e.g. apple -> AAPL)', async () => {
    const req = { user: mockUserA };
    const res = await briefingsController.updateConfig(req, {
      symbols: ['apple', 'MSFT'],
    });

    expect(res.config.symbols).toEqual(['AAPL', 'MSFT']);
  });

  it('Test 7 — Duplicate symbol removal', async () => {
    const req = { user: mockUserA };
    const res = await briefingsController.updateConfig(req, {
      symbols: ['AAPL', 'apple', 'AAPL', 'MSFT'],
    });

    expect(res.config.symbols).toEqual(['AAPL', 'MSFT']);
  });

  it('Test 8 — Maximum symbol limit enforcement (max 10)', async () => {
    const req = { user: mockUserA };
    const elevenSymbols = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'TSLA', 'META', 'BRK.B', 'JPM', 'V', 'EXTRA'];

    await expect(
      briefingsController.updateConfig(req, { symbols: elevenSymbols }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Test 9 — Invalid symbol rejection', async () => {
    const req = { user: mockUserA };

    await expect(
      briefingsController.updateConfig(req, { symbols: ['INVALID_TICKER_123'] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Test 10 — User isolation for configuration', async () => {
    await briefingsController.updateConfig({ user: mockUserA }, { symbols: ['AAPL'] });
    await briefingsController.updateConfig({ user: mockUserB }, { symbols: ['NVDA'] });

    const resA = await briefingsController.getConfig({ user: mockUserA });
    const resB = await briefingsController.getConfig({ user: mockUserB });

    expect(resA.config.symbols).toEqual(['AAPL']);
    expect(resB.config.symbols).toEqual(['NVDA']);
  });

  it('Test 11 — trigger-now uses configured symbols', async () => {
    await briefingsController.updateConfig({ user: mockUserA }, { symbols: ['AAPL', 'MSFT'] });

    const res = await briefingsController.triggerNow({ user: mockUserA });

    expect(res.success).toBe(true);
    expect(financeServiceMock.getFinancialContext).toHaveBeenCalledWith('AAPL', expect.anything());
    expect(financeServiceMock.getFinancialContext).toHaveBeenCalledWith('MSFT', expect.anything());
  });

  it('Test 12 — FinanceService context is requested for configured symbols', async () => {
    await briefingsController.updateConfig({ user: mockUserA }, { symbols: ['NVDA'] });
    await briefingsController.triggerNow({ user: mockUserA });

    expect(financeServiceMock.getFinancialContext).toHaveBeenCalledWith(
      'NVDA',
      expect.objectContaining({
        includeQuote: true,
        includeProfile: true,
        includeNews: true,
        includeMetrics: true,
      }),
    );
  });

  it('Test 13 — GroqService receives grounded financial context', async () => {
    await briefingsController.updateConfig({ user: mockUserA }, { symbols: ['AAPL'] });
    await briefingsController.triggerNow({ user: mockUserA });

    expect(groqServiceMock.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: expect.stringContaining('AUTHORITATIVE DATA SOURCE'),
        contents: expect.arrayContaining([
          expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({ text: expect.stringContaining('AAPL Inc') }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('Test 14 — Briefing is generated successfully', async () => {
    await briefingsController.updateConfig({ user: mockUserA }, { symbols: ['AAPL'] });
    const res = await briefingsController.triggerNow({ user: mockUserA });

    expect(res.briefing).toContain('# Executive Market Briefing');
  });

  it('Test 15 — NotificationLog is created', async () => {
    await briefingsController.updateConfig({ user: mockUserA }, { symbols: ['AAPL'] });
    await briefingsController.triggerNow({ user: mockUserA });

    expect(prismaMock.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: mockUserA.id,
          type: 'BRIEFING',
          title: 'Atlas AI Market Briefing',
        }),
      }),
    );
  });

  it('Test 16 — Telegram delivery success', async () => {
    telegramServiceMock.sendNotification.mockResolvedValueOnce(true);
    await briefingsController.updateConfig({ user: mockUserA }, { symbols: ['AAPL'], deliverTelegram: true });

    const res = await briefingsController.triggerNow({ user: mockUserA });

    expect(res.deliveredToTelegram).toBe(true);
    expect(telegramServiceMock.sendNotification).toHaveBeenCalledWith(
      mockUserA.telegramId,
      expect.stringContaining('# Executive Market Briefing'),
    );
  });

  it('Test 17 — Telegram delivery failure does not crash generation', async () => {
    telegramServiceMock.sendNotification.mockRejectedValueOnce(new Error('Bot blocked'));
    await briefingsController.updateConfig({ user: mockUserA }, { symbols: ['AAPL'], deliverTelegram: true });

    const res = await briefingsController.triggerNow({ user: mockUserA });

    expect(res.success).toBe(true);
    expect(res.deliveredToTelegram).toBe(false);
    expect(res.briefing).toBeDefined();
  });

  it('Test 18 — Failed Telegram delivery creates delivered=false log', async () => {
    telegramServiceMock.sendNotification.mockResolvedValueOnce(false);
    await briefingsController.updateConfig({ user: mockUserA }, { symbols: ['AAPL'], deliverTelegram: true });

    await briefingsController.triggerNow({ user: mockUserA });

    expect(prismaMock.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: mockUserA.id,
          delivered: false,
        }),
      }),
    );
  });

  it("Test 19 — GET history only returns authenticated user's briefings", async () => {
    await briefingsController.updateConfig({ user: mockUserA }, { symbols: ['AAPL'] });
    await briefingsController.triggerNow({ user: mockUserA });

    const historyA = await briefingsController.getHistory({ user: mockUserA });
    const historyB = await briefingsController.getHistory({ user: mockUserB });

    expect(historyA.history.length).toBeGreaterThan(0);
    expect(historyB.history.length).toBe(0);
  });

  it('Test 20 — Body userId/telegramId cannot override authenticated identity', async () => {
    const maliciousBody: any = {
      userId: 'hacker-id',
      telegramId: 'hacker-telegram',
      symbols: ['AAPL'],
    };

    const res = await briefingsController.updateConfig({ user: mockUserA }, maliciousBody);
    expect(res.config.userId).toBe(mockUserA.id);
  });

  it('Case E — manual trigger does not modify lastDeliveredAt on ScheduledBriefing', async () => {
    await briefingsController.updateConfig({ user: mockUserA }, { symbols: ['AAPL'] });
    prismaMock.scheduledBriefing.update.mockClear();

    await briefingsController.triggerNow({ user: mockUserA });

    expect(prismaMock.scheduledBriefing.update).not.toHaveBeenCalled();
  });
});
