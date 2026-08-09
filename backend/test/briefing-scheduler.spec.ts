import { Test, TestingModule } from '@nestjs/testing';
import { BriefingFrequency } from '@prisma/client';
import { BriefingSchedulerService } from '@/briefings/briefing-scheduler.service';
import { BriefingsService } from '@/briefings/briefings.service';
import { PrismaService } from '@/database/prisma.service';
import { AppLogger } from '@/common/logger/logger.service';

describe('BriefingSchedulerService Unit Tests (Phase 5)', () => {
  let briefingSchedulerService: BriefingSchedulerService;
  let prismaMock: any;
  let briefingsServiceMock: any;
  let loggerMock: any;

  beforeEach(async () => {
    prismaMock = {
      scheduledBriefing: {
        findMany: jest.fn(),
      },
    };

    briefingsServiceMock = {
      triggerNow: jest.fn().mockResolvedValue({
        success: true,
        briefing: 'Market Briefing Content',
        deliveredToTelegram: true,
      }),
    };

    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BriefingSchedulerService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: BriefingsService, useValue: briefingsServiceMock },
        { provide: AppLogger, useValue: loggerMock },
      ],
    }).compile();

    briefingSchedulerService = module.get<BriefingSchedulerService>(BriefingSchedulerService);
  });

  it('Test 1 — DAILY_MORNING due briefing is generated', async () => {
    const now = new Date('2026-08-10T08:15:00Z'); // 08:15 UTC (Hour = 8)
    const config = {
      id: 'b-1',
      userId: 'user-1',
      frequency: BriefingFrequency.DAILY_MORNING,
      preferredTime: '08:00',
      enabled: true,
      lastDeliveredAt: null,
    };

    prismaMock.scheduledBriefing.findMany.mockResolvedValue([config]);
    jest.spyOn(briefingSchedulerService, 'isBriefingDue').mockReturnValue(true);

    await briefingSchedulerService.evaluateBriefingSchedules();

    expect(briefingsServiceMock.triggerNow).toHaveBeenCalledWith('user-1');
  });

  it('Test 2 — DAILY_MORNING not due is skipped', async () => {
    const config = {
      id: 'b-1',
      userId: 'user-1',
      frequency: BriefingFrequency.DAILY_MORNING,
      preferredTime: '08:00',
      enabled: true,
      lastDeliveredAt: null,
    };

    const notDueTime = new Date('2026-08-10T14:00:00Z'); // 14:00 UTC != 08:00
    const isDue = briefingSchedulerService.isBriefingDue(config as any, notDueTime);

    expect(isDue).toBe(false);
  });

  it('Test 3 — DAILY_EVENING due briefing is generated', async () => {
    const config = {
      id: 'b-2',
      userId: 'user-2',
      frequency: BriefingFrequency.DAILY_EVENING,
      preferredTime: '18:00',
      enabled: true,
      lastDeliveredAt: null,
    };

    const eveningTime = new Date('2026-08-10T18:00:00Z'); // 18:00 UTC
    const isDue = briefingSchedulerService.isBriefingDue(config as any, eveningTime);

    expect(isDue).toBe(true);
  });

  it('Test 4 — WEEKLY_MONDAY works only on Monday', async () => {
    const config = {
      id: 'b-3',
      userId: 'user-3',
      frequency: BriefingFrequency.WEEKLY_MONDAY,
      preferredTime: '08:00',
      enabled: true,
      lastDeliveredAt: null,
    };

    const mondayTime = new Date('2026-08-10T08:00:00Z'); // 2026-08-10 is a Monday (getUTCDay() === 1)
    const tuesdayTime = new Date('2026-08-11T08:00:00Z'); // Tuesday

    expect(briefingSchedulerService.isBriefingDue(config as any, mondayTime)).toBe(true);
    expect(briefingSchedulerService.isBriefingDue(config as any, tuesdayTime)).toBe(false);
  });

  it('Test 5 — Already-delivered occurrence is skipped', async () => {
    const now = new Date('2026-08-10T08:15:00Z');
    const config = {
      id: 'b-1',
      userId: 'user-1',
      frequency: BriefingFrequency.DAILY_MORNING,
      preferredTime: '08:00',
      enabled: true,
      lastDeliveredAt: new Date('2026-08-10T08:02:00Z'), // Delivered earlier today
    };

    expect(briefingSchedulerService.isBriefingDue(config as any, now)).toBe(false);
  });

  it('Test 6 — Server restart/delayed scheduler does not duplicate if already delivered today', async () => {
    const restartTime = new Date('2026-08-10T08:30:00Z');
    const config = {
      id: 'b-1',
      userId: 'user-1',
      frequency: BriefingFrequency.DAILY_MORNING,
      preferredTime: '08:00',
      enabled: true,
      lastDeliveredAt: new Date('2026-08-10T08:00:00Z'),
    };

    expect(briefingSchedulerService.isBriefingDue(config as any, restartTime)).toBe(false);
  });

  it('Test 7 — Disabled briefing is skipped', async () => {
    const config = {
      id: 'b-1',
      userId: 'user-1',
      frequency: BriefingFrequency.DAILY_MORNING,
      preferredTime: '08:00',
      enabled: false,
      lastDeliveredAt: null,
    };

    prismaMock.scheduledBriefing.findMany.mockResolvedValue([]);

    await briefingSchedulerService.evaluateBriefingSchedules();

    expect(briefingsServiceMock.triggerNow).not.toHaveBeenCalled();
  });

  it('Test 8 — deliverTelegram=false does not send Telegram (handled inside BriefingsService)', async () => {
    briefingsServiceMock.triggerNow.mockResolvedValueOnce({
      success: true,
      briefing: 'Web briefing',
      deliveredToTelegram: false,
    });

    const config = { id: 'b-1', userId: 'user-1', frequency: BriefingFrequency.DAILY_MORNING, preferredTime: '08:00', enabled: true };
    prismaMock.scheduledBriefing.findMany.mockResolvedValue([config]);
    jest.spyOn(briefingSchedulerService, 'isBriefingDue').mockReturnValue(true);

    await briefingSchedulerService.evaluateBriefingSchedules();

    expect(briefingsServiceMock.triggerNow).toHaveBeenCalledWith('user-1');
  });

  it('Test 9 — Telegram failure does not crash scheduler', async () => {
    briefingsServiceMock.triggerNow.mockRejectedValueOnce(new Error('Groq / Telegram failure'));
    const config = { id: 'b-1', userId: 'user-1', frequency: BriefingFrequency.DAILY_MORNING, preferredTime: '08:00', enabled: true };
    prismaMock.scheduledBriefing.findMany.mockResolvedValue([config]);
    jest.spyOn(briefingSchedulerService, 'isBriefingDue').mockReturnValue(true);

    await expect(briefingSchedulerService.evaluateBriefingSchedules()).resolves.not.toThrow();
  });

  it("Test 10 — One user's failure does not stop other users", async () => {
    const config1 = { id: 'b-1', userId: 'user-1', enabled: true };
    const config2 = { id: 'b-2', userId: 'user-2', enabled: true };

    prismaMock.scheduledBriefing.findMany.mockResolvedValue([config1, config2]);
    jest.spyOn(briefingSchedulerService, 'isBriefingDue').mockReturnValue(true);

    briefingsServiceMock.triggerNow
      .mockRejectedValueOnce(new Error('User 1 error'))
      .mockResolvedValueOnce({ success: true, briefing: 'User 2 Briefing', deliveredToTelegram: true });

    await briefingSchedulerService.evaluateBriefingSchedules();

    expect(briefingsServiceMock.triggerNow).toHaveBeenCalledWith('user-1');
    expect(briefingsServiceMock.triggerNow).toHaveBeenCalledWith('user-2');
  });

  it('Test 11 — Concurrent scheduler execution is prevented', async () => {
    (briefingSchedulerService as any).isRunning = true;

    await briefingSchedulerService.evaluateBriefingSchedules();

    expect(prismaMock.scheduledBriefing.findMany).not.toHaveBeenCalled();
    expect(loggerMock.warn).toHaveBeenCalledWith(
      expect.stringContaining('already in progress'),
      'BriefingSchedulerService',
    );
  });

  it('Test 12 — Existing BriefingsService.triggerNow is reused', async () => {
    const config = { id: 'b-1', userId: 'user-1', enabled: true };
    prismaMock.scheduledBriefing.findMany.mockResolvedValue([config]);
    jest.spyOn(briefingSchedulerService, 'isBriefingDue').mockReturnValue(true);

    await briefingSchedulerService.evaluateBriefingSchedules();

    expect(briefingsServiceMock.triggerNow).toHaveBeenCalledWith('user-1');
  });
});
