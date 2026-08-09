import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIModule } from '@/ai/ai.module';
import { ChatModule } from '@/chat/chat.module';
import { AppLogger } from '@/common/logger/logger.service';
import { validateEnv } from '@/config/env.config';
import { DatabaseModule } from '@/database/database.module';
import { DocumentModule } from '@/documents/document.module';
import { FinanceModule } from '@/finance/finance.module';
import { HealthModule } from '@/health/health.module';
import { MemoryModule } from '@/memory/memory.module';
import { SharedModule } from '@/shared/shared.module';
import { TelegramModule } from '@/telegram/telegram.module';
import { UsersModule } from '@/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    SharedModule,
    DatabaseModule,
    UsersModule,
    MemoryModule,
    FinanceModule,
    HealthModule,
    AIModule,
    ChatModule,
    TelegramModule,
    DocumentModule,
  ],
  providers: [AppLogger],
})
export class AppModule {}
