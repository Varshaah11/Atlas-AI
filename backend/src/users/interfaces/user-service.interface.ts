import { User } from '@prisma/client';
import { TelegramUserData } from '@/shared/interfaces';

export interface IUserService {
  getOrCreateUser(userData: TelegramUserData): Promise<User>;
  findByTelegramId(telegramId: string): Promise<User | null>;
  getTelegramChatId(user: User | null): Promise<string | null>;
  createTelegramLinkToken(userId: string): Promise<{ linkUrl: string; expiresAt: Date }>;
  consumeTelegramLinkToken(
    token: string,
    telegramChatId: string,
  ): Promise<{ success: boolean; message: string }>;
}

export const USER_SERVICE_TOKEN = 'USER_SERVICE_TOKEN';
