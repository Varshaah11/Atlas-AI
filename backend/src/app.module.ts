import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AIModule } from '@/ai/ai.module';
import { AlertsModule } from '@/alerts/alerts.module';
import { BriefingsModule } from '@/briefings/briefings.module';
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
    ScheduleModule.forRoot(),
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
    AlertsModule,
    BriefingsModule,
  ],
  providers: [AppLogger],
})
export class AppModule {}
