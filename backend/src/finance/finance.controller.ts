import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { WebAuthGuard } from '@/common/guards/web-auth.guard';

@Controller('finance')
@UseGuards(WebAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('overview')
  async getOverview(@Query('symbol') symbol: string) {
    if (!symbol || !symbol.trim()) {
      throw new BadRequestException('Query parameter "symbol" is required');
    }

    const context = await this.financeService.getFinancialContext(symbol.trim(), {
      includeQuote: true,
      includeProfile: true,
      includeMetrics: true,
      includeNews: true,
      includeSecFilings: false,
    });

    return {
      success: !context.error,
      data: context,
    };
  }

  @Get('quote')
  async getQuote(@Query('symbol') symbol: string) {
    if (!symbol || !symbol.trim()) {
      throw new BadRequestException('Query parameter "symbol" is required');
    }

    const resolved = await this.financeService.resolveTicker(symbol.trim());
    const target = resolved || symbol.trim().toUpperCase();

    const quote = await this.financeService.getStockQuote(target);

    return {
      success: !!quote,
      symbol: target,
      data: quote,
    };
  }

  @Get('sec-filings')
  async getSecFilings(@Query('symbol') symbol: string) {
    if (!symbol || !symbol.trim()) {
      throw new BadRequestException('Query parameter "symbol" is required');
    }

    const resolved = await this.financeService.resolveTicker(symbol.trim());
    const target = resolved || symbol.trim().toUpperCase();

    const filings = await this.financeService.getRecentSecFilings(target);

    return {
      success: !filings.error && !!filings.recentFilings,
      data: filings,
    };
  }

  @Get('compare')
  async compareSymbols(@Query('symbol1') symbol1: string, @Query('symbol2') symbol2: string) {
    if (!symbol1 || !symbol1.trim() || !symbol2 || !symbol2.trim()) {
      throw new BadRequestException('Query parameters "symbol1" and "symbol2" are required');
    }

    const [context1, context2] = await Promise.all([
      this.financeService.getFinancialContext(symbol1.trim(), {
        includeQuote: true,
        includeProfile: true,
        includeMetrics: true,
        includeNews: false,
      }),
      this.financeService.getFinancialContext(symbol2.trim(), {
        includeQuote: true,
        includeProfile: true,
        includeMetrics: true,
        includeNews: false,
      }),
    ]);

    return {
      success: !context1.error || !context2.error,
      data: {
        symbol1: context1,
        symbol2: context2,
      },
    };
  }
}
