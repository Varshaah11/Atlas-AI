import { Injectable } from '@nestjs/common';
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
}
