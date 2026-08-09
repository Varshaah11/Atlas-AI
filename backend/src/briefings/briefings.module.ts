import { Module } from '@nestjs/common';
import { BriefingSchedulerService } from './briefing-scheduler.service';
import { BriefingsController } from './briefings.controller';
import { BriefingsService } from './briefings.service';
import { AIModule } from '@/ai/ai.module';
import { DatabaseModule } from '@/database/database.module';
import { FinanceModule } from '@/finance/finance.module';
import { TelegramModule } from '@/telegram/telegram.module';
import { UsersModule } from '@/users/users.module';

@Module({
  imports: [DatabaseModule, UsersModule, FinanceModule, AIModule, TelegramModule],
  controllers: [BriefingsController],
  providers: [BriefingsService, BriefingSchedulerService],
  exports: [BriefingsService, BriefingSchedulerService],
})
export class BriefingsModule {}
