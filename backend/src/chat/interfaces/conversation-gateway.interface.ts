import { ProcessMessageDto } from '@/shared/interfaces';

export interface IConversationGateway {
  handleIncomingMessage(dto: ProcessMessageDto): Promise<string>;
}

export const CONVERSATION_GATEWAY_TOKEN = 'CONVERSATION_GATEWAY_TOKEN';
