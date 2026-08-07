export interface TelegramUserData {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface ProcessMessageDto {
  userData: TelegramUserData;
  messageText: string;
}

export interface ChatMessageContext {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
