import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ChatModule } from '@/chat/chat.module';
import { AppLogger } from '@/common/logger/logger.service';

@Module({
  imports: [ChatModule],
  providers: [AppLogger, TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
