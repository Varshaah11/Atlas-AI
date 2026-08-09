import * as crypto from 'crypto';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { IUserService } from './interfaces/user-service.interface';
import { AppLogger } from '@/common/logger/logger.service';
import { PrismaService } from '@/database/prisma.service';
import { TelegramUserData } from '@/shared/interfaces';

@Injectable()
export class UserService implements IUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async getOrCreateUser(userData: TelegramUserData): Promise<User> {
    let user = await this.findByTelegramId(userData.telegramId);

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          telegramId: userData.telegramId,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
        },
      });
      this.logger.log(`Created new Telegram user: ${user.telegramId}`, 'UserService');
    }

    return user;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  async getTelegramChatId(user: User | null): Promise<string | null> {
    if (!user) {
      return null;
    }

    if (user.telegramChatId && user.telegramChatId.trim().length > 0) {
      return user.telegramChatId.trim();
    }

    if (user.telegramId) {
      const cleanId = user.telegramId.trim();
      if (!cleanId.startsWith('web-')) {
        return cleanId;
      }
    }

    return null;
  }

  async createTelegramLinkToken(userId: string): Promise<{ linkUrl: string; expiresAt: Date }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    await this.prisma.telegramLinkToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    const botUsername = this.configService?.get<string>('TELEGRAM_BOT_USERNAME') || 'AtlasAIBot';
    const linkUrl = `https://t.me/${botUsername}?start=link_${rawToken}`;

    return { linkUrl, expiresAt };
  }

  async consumeTelegramLinkToken(
    rawToken: string,
    telegramChatId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!rawToken || !telegramChatId) {
      return {
        success: false,
        message:
          '❌ This linking link is invalid or has expired. Please generate a new link from your Atlas AI dashboard.',
      };
    }

    const cleanChatId = telegramChatId.trim();
    if (!cleanChatId || cleanChatId.startsWith('web-')) {
      return {
        success: false,
        message: '❌ Invalid Telegram account identity.',
      };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    return this.prisma.$transaction(async (tx) => {
      const linkTokenRecord = await tx.telegramLinkToken.findUnique({
        where: { tokenHash },
      });

      if (!linkTokenRecord || linkTokenRecord.usedAt || linkTokenRecord.expiresAt < new Date()) {
        return {
          success: false,
          message:
            '❌ This linking link is invalid or has expired. Please generate a new link from your Atlas AI dashboard.',
        };
      }

      const existingTelegramUser = await tx.user.findFirst({
        where: {
          telegramChatId: cleanChatId,
          id: { not: linkTokenRecord.userId },
        },
      });

      if (existingTelegramUser) {
        return {
          success: false,
          message: '❌ This Telegram account is already linked to another Atlas AI account.',
        };
      }

      await tx.telegramLinkToken.update({
        where: { id: linkTokenRecord.id },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: linkTokenRecord.userId },
        data: { telegramChatId: cleanChatId },
      });

      this.logger.log(
        `Successfully linked Telegram Chat ID ${cleanChatId} to User ${linkTokenRecord.userId}`,
        'UserService',
      );

      return {
        success: true,
        message:
          '✅ Your Telegram account has been linked to your Atlas AI Web Dashboard. You can now receive alerts and market briefings here.',
      };
    });
  }
}
