import { Module } from '@nestjs/common';
import { AlertEvaluatorService } from './alert-evaluator.service';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { DatabaseModule } from '@/database/database.module';
import { FinanceModule } from '@/finance/finance.module';
import { TelegramModule } from '@/telegram/telegram.module';
import { UsersModule } from '@/users/users.module';

@Module({
  imports: [DatabaseModule, UsersModule, FinanceModule, TelegramModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertEvaluatorService],
  exports: [AlertsService, AlertEvaluatorService],
})
export class AlertsModule {}
