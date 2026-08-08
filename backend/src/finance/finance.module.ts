import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FINANCE_PROVIDER_TOKEN } from './interfaces/finance-provider.interface';
import { FinnhubProvider } from './providers/finnhub.provider';
import { AppLogger } from '@/common/logger/logger.service';

@Module({
  providers: [
    AppLogger,
    FinnhubProvider,
    {
      provide: FINANCE_PROVIDER_TOKEN,
      useExisting: FinnhubProvider,
    },
    FinanceService,
  ],
  exports: [FinanceService, FINANCE_PROVIDER_TOKEN],
})
export class FinanceModule {}
