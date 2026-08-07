import { ProcessMessageDto } from '@/shared/interfaces';

export interface IChatService {
  processMessage(dto: ProcessMessageDto): Promise<string>;
}

export const CHAT_SERVICE_TOKEN = 'CHAT_SERVICE_TOKEN';
