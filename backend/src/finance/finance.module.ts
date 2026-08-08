import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FINANCE_PROVIDER_TOKEN } from './interfaces/finance-provider.interface';
import { SEC_EDGAR_PROVIDER_TOKEN } from './interfaces/sec-edgar.interface';
import { FinnhubProvider } from './providers/finnhub.provider';
import { SecEdgarProvider } from './providers/sec-edgar.provider';
import { AppLogger } from '@/common/logger/logger.service';

@Module({
  providers: [
    AppLogger,
    FinnhubProvider,
    SecEdgarProvider,
    {
      provide: FINANCE_PROVIDER_TOKEN,
      useExisting: FinnhubProvider,
    },
    {
      provide: SEC_EDGAR_PROVIDER_TOKEN,
      useExisting: SecEdgarProvider,
    },
    FinanceService,
  ],
  exports: [
    FinanceService,
    FinnhubProvider,
    SecEdgarProvider,
    FINANCE_PROVIDER_TOKEN,
    SEC_EDGAR_PROVIDER_TOKEN,
  ],
})
export class FinanceModule {}
