import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AIModule } from '@/ai/ai.module';
import { FinanceModule } from '@/finance/finance.module';
import { TelegramModule } from '@/telegram/telegram.module';

@Module({
  imports: [TelegramModule, AIModule, FinanceModule],
  controllers: [HealthController],
})
export class HealthModule {}
