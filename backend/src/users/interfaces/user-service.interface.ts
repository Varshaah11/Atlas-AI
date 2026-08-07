import { User } from '@prisma/client';
import { TelegramUserData } from '@/shared/interfaces';

export interface IUserService {
  getOrCreateUser(userData: TelegramUserData): Promise<User>;
  findByTelegramId(telegramId: string): Promise<User | null>;
}

export const USER_SERVICE_TOKEN = 'USER_SERVICE_TOKEN';
