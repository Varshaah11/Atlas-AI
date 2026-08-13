import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { UserService } from '@/users/user.service';
import { UsersController } from '@/users/users.controller';
import { USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';
import { TelegramService } from '@/telegram/telegram.service';
import { AlertEvaluatorService } from '@/alerts/alert-evaluator.service';
import { BriefingsService } from '@/briefings/briefings.service';
import { PrismaService } from '@/database/prisma.service';
import { AppLogger } from '@/common/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { AlertStatus, AlertType } from '@prisma/client';

describe('Telegram Account Linking & Security Suite (Sprint 8)', () => {
  let userService: UserService;
  let usersController: UsersController;
  let telegramService: TelegramService;
  let prismaMock: any;
  let loggerMock: any;
  let configServiceMock: any;

  const mockWebUser = { id: 'web-user-id-1', telegramId: 'web-default-web-user', username: 'user_default-web-user' };
  const mockWebUserB = { id: 'web-user-id-2', telegramId: 'web-user-2', username: 'user_2' };
  const mockTelegramUser = { id: 'tg-user-id', telegramId: '987654321', telegramChatId: '987654321', username: 'real_tg_user' };

  const linkTokensDb: any[] = [];
  const usersDb: any[] = [];
  let txLock = Promise.resolve();

  beforeEach(async () => {
    txLock = Promise.resolve();
    linkTokensDb.length = 0;
    usersDb.length = 0;

    usersDb.push({ ...mockWebUser }, { ...mockWebUserB }, { ...mockTelegramUser });

    prismaMock = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id) return Promise.resolve(usersDb.find((u) => u.id === where.id) || null);
          if (where.telegramId) return Promise.resolve(usersDb.find((u) => u.telegramId === where.telegramId) || null);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.OR) {
            const targetChatId = where.OR[0]?.telegramId || where.OR[1]?.telegramChatId;
            return Promise.resolve(
              usersDb.find(
                (u) =>
                  (u.telegramId === targetChatId || u.telegramChatId === targetChatId) &&
                  u.id !== where.id?.not,
              ) || null,
            );
          }
          return Promise.resolve(
            usersDb.find(
              (u) =>
                ((where.telegramId && u.telegramId === where.telegramId) ||
                  (where.telegramChatId && u.telegramChatId === where.telegramChatId)) &&
                u.id !== where.id?.not,
            ) || null,
          );
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const userIndex = usersDb.findIndex((u) => u.id === where.id);
          if (userIndex !== -1) {
            usersDb[userIndex] = { ...usersDb[userIndex], ...data };
            return Promise.resolve(usersDb[userIndex]);
          }
          return Promise.resolve(null);
        }),
      },
      telegramLinkToken: {
        create: jest.fn().mockImplementation(({ data }) => {
          const record = { id: `token-${Date.now()}-${Math.random()}`, ...data, usedAt: null, createdAt: new Date() };
          linkTokensDb.push(record);
          return Promise.resolve(record);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(linkTokensDb.find((t) => t.tokenHash === where.tokenHash) || null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const tokenIndex = linkTokensDb.findIndex((t) => t.id === where.id);
          if (tokenIndex !== -1) {
            linkTokensDb[tokenIndex] = { ...linkTokensDb[tokenIndex], ...data };
            return Promise.resolve(linkTokensDb[tokenIndex]);
          }
          return Promise.resolve(null);
        }),
      },
      $transaction: jest.fn().mockImplementation((cb) => {
        const next = txLock.then(() => cb(prismaMock));
        txLock = next.catch(() => {});
        return next;
      }),
    };

    loggerMock = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    configServiceMock = { get: jest.fn().mockReturnValue('AtlasAIBot') };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UserService,
        { provide: USER_SERVICE_TOKEN, useClass: UserService },
        { provide: PrismaService, useValue: prismaMock },
        { provide: AppLogger, useValue: loggerMock },
        { provide: ConfigService, useValue: configServiceMock },
        {
          provide: TelegramService,
          useValue: {
            sendNotification: jest.fn().mockResolvedValue(true),
            handleTextMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    usersController = module.get<UsersController>(UsersController);
    telegramService = module.get<TelegramService>(TelegramService);
  });

  it('1. Authenticated user can generate a Telegram link token', async () => {
    const req = { user: { id: mockWebUser.id } };
    const res = await usersController.createTelegramLink(req);

    expect(res.success).toBe(true);
    expect(res.linkUrl).toContain('https://t.me/AtlasAIBot?start=link_');
    expect(res.expiresAt).toBeDefined();
  });

  it('2. Client-supplied userId in body or query parameters cannot override req.user.id', async () => {
    const req = { user: { id: mockWebUser.id }, body: { userId: 'hacked-id' } };
    const res = await usersController.createTelegramLink(req);

    expect(prismaMock.telegramLinkToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: mockWebUser.id,
        }),
      }),
    );
  });

  it('3. Generated token is cryptographically random and raw token is not stored in database', async () => {
    const req = { user: { id: mockWebUser.id } };
    const res = await usersController.createTelegramLink(req);
    const rawToken = res.linkUrl.split('link_')[1];

    expect(rawToken).toHaveLength(64); // 32 bytes hex
    expect(linkTokensDb[0].tokenHash).not.toBe(rawToken);

    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    expect(linkTokensDb[0].tokenHash).toBe(expectedHash);
  });

  it('4. Token expires after 10 minutes', async () => {
    const res = await userService.createTelegramLinkToken(mockWebUser.id);
    const rawToken = res.linkUrl.split('link_')[1];

    // Fast-forward token expiration
    const tokenRecord = linkTokensDb[0];
    tokenRecord.expiresAt = new Date(Date.now() - 1000);

    const consumeRes = await userService.consumeTelegramLinkToken(rawToken, '5551234');
    expect(consumeRes.success).toBe(false);
    expect(consumeRes.message).toContain('invalid or has expired');
  });

  it('5. Token cannot be reused', async () => {
    const res = await userService.createTelegramLinkToken(mockWebUser.id);
    const rawToken = res.linkUrl.split('link_')[1];

    const firstConsume = await userService.consumeTelegramLinkToken(rawToken, '5551234');
    expect(firstConsume.success).toBe(true);

    const secondConsume = await userService.consumeTelegramLinkToken(rawToken, '5551234');
    expect(secondConsume.success).toBe(false);
    expect(secondConsume.message).toContain('invalid or has expired');
  });

  it('6. Valid /start link successfully links the exact web user', async () => {
    const res = await userService.createTelegramLinkToken(mockWebUser.id);
    const rawToken = res.linkUrl.split('link_')[1];

    const consumeRes = await userService.consumeTelegramLinkToken(rawToken, '555999');
    expect(consumeRes.success).toBe(true);

    const updatedUser = usersDb.find((u) => u.id === mockWebUser.id);
    expect(updatedUser.telegramChatId).toBe('555999');
  });

  it('7. Telegram ID already belonging to another user cannot be stolen/reassigned', async () => {
    // mockTelegramUser already has telegramId '987654321'
    const res = await userService.createTelegramLinkToken(mockWebUser.id);
    const rawToken = res.linkUrl.split('link_')[1];

    const consumeRes = await userService.consumeTelegramLinkToken(rawToken, '987654321');
    expect(consumeRes.success).toBe(false);
    expect(consumeRes.message).toContain('already linked to another Finora account');

    const webUser = usersDb.find((u) => u.id === mockWebUser.id);
    expect(webUser.telegramChatId).toBeUndefined();
  });

  it('8. Concurrent token consumption allows only one successful link', async () => {
    const res = await userService.createTelegramLinkToken(mockWebUser.id);
    const rawToken = res.linkUrl.split('link_')[1];

    const [res1, res2] = await Promise.all([
      userService.consumeTelegramLinkToken(rawToken, '555001'),
      userService.consumeTelegramLinkToken(rawToken, '555001'),
    ]);

    const successes = [res1, res2].filter((r) => r.success);
    const failures = [res1, res2].filter((r) => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });

  it('9. getTelegramChatId() returns null for unlinked web user and never searches arbitrary Telegram users', async () => {
    const unlinkedUser = { id: 'u1', telegramId: 'web-default-web-user' };
    const chatId = await userService.getTelegramChatId(unlinkedUser as any);
    expect(chatId).toBeNull();
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it('10. getTelegramChatId() returns exact numeric Telegram ID for linked user', async () => {
    const linkedUser = { id: 'u2', telegramId: '123456789' };
    const chatId = await userService.getTelegramChatId(linkedUser as any);
    expect(chatId).toBe('123456789');
  });
});
