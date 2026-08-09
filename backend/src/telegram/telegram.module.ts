import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ChatModule } from '@/chat/chat.module';
import { AppLogger } from '@/common/logger/logger.service';
import { DocumentModule } from '@/documents/document.module';
import { UsersModule } from '@/users/users.module';

@Module({
  imports: [ChatModule, UsersModule, DocumentModule],
  providers: [AppLogger, TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
