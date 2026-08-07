import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AIModule } from '@/ai/ai.module';
import { TelegramModule } from '@/telegram/telegram.module';

@Module({
  imports: [TelegramModule, AIModule],
  controllers: [HealthController],
})
export class HealthModule {}
