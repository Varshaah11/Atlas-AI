import { Test, TestingModule } from '@nestjs/testing';
import { FinanceController } from '@/finance/finance.controller';
import { FinanceService } from '@/finance/finance.service';
import { USER_SERVICE_TOKEN } from '@/users/interfaces/user-service.interface';
import { WebAuthGuard } from '@/common/guards/web-auth.guard';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('FinanceController Unit Tests', () => {
  let controller: FinanceController;
  let financeServiceMock: any;
  let userServiceMock: any;
  let webAuthGuard: WebAuthGuard;

  beforeEach(async () => {
    financeServiceMock = {
      resolveTicker: jest.fn().mockImplementation((query: string) => {
        if (query.toUpperCase() === 'INVALID') return Promise.resolve(null);
        return Promise.resolve(query.toUpperCase());
      }),
      getFinancialContext: jest.fn().mockImplementation((symbol: string) => {
        if (symbol === 'INVALID') {
          return Promise.resolve({
            symbol: 'INVALID',
            retrievedAt: new Date().toISOString(),
            source: 'finnhub',
            error: 'Could not find valid market data',
          });
        }
        return Promise.resolve({
          symbol,
          companyName: `${symbol} Inc.`,
          quote: { currentPrice: 150, change: 2.5, percentChange: 1.69, high: 155, low: 148, open: 149, previousClose: 147.5, timestamp: 12345 },
          profile: { name: `${symbol} Inc.`, ticker: symbol, industry: 'Technology', marketCapitalization: 2000000 },
          metrics: { peRatio: 28.5, marketCap: 2000000, fiftyTwoWeekHigh: 180, fiftyTwoWeekLow: 120 },
          news: [{ headline: 'Test headline', source: 'Financial Times' }],
          retrievedAt: new Date().toISOString(),
          source: 'finnhub',
        });
      }),
      getStockQuote: jest.fn().mockResolvedValue({
        currentPrice: 150,
        change: 2.5,
        percentChange: 1.69,
        high: 155,
        low: 148,
        open: 149,
        previousClose: 147.5,
        timestamp: 12345,
      }),
      getRecentSecFilings: jest.fn().mockResolvedValue({
        cik: '0000320193',
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        recentFilings: [
          { form: '10-K', filingDate: '2025-10-31', accessionNumber: '0000320193-25-000106', primaryDocument: 'aapl-10k.htm' },
        ],
        retrievedAt: new Date().toISOString(),
      }),
    };

    userServiceMock = {
      getOrCreateUser: jest.fn().mockImplementation((userData: any) => {
        return Promise.resolve({
          id: `uuid-${userData.telegramId}`,
          telegramId: userData.telegramId,
          username: userData.username,
        });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        WebAuthGuard,
        { provide: FinanceService, useValue: financeServiceMock },
        { provide: USER_SERVICE_TOKEN, useValue: userServiceMock },
      ],
    }).compile();

    controller = module.get<FinanceController>(FinanceController);
    webAuthGuard = module.get<WebAuthGuard>(WebAuthGuard);
  });

  describe('1. GET /finance/overview', () => {
    it('returns quote, profile, metrics, and news via FinanceService', async () => {
      const res = await controller.getOverview('AAPL');
      expect(res.success).toBe(true);
      expect(res.data.symbol).toBe('AAPL');
      expect(res.data.quote).toBeDefined();
      expect(res.data.profile).toBeDefined();
      expect(res.data.metrics).toBeDefined();
      expect(res.data.news).toBeDefined();
      expect(financeServiceMock.getFinancialContext).toHaveBeenCalledWith('AAPL', {
        includeQuote: true,
        includeProfile: true,
        includeMetrics: true,
        includeNews: true,
        includeSecFilings: false,
      });
    });

    it('throws BadRequestException if symbol parameter is missing', async () => {
      await expect(controller.getOverview('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. GET /finance/quote', () => {
    it('calls existing FinanceService.getStockQuote', async () => {
      const res = await controller.getQuote('AAPL');
      expect(res.success).toBe(true);
      expect(res.symbol).toBe('AAPL');
      expect(res.data?.currentPrice).toBe(150);
      expect(financeServiceMock.resolveTicker).toHaveBeenCalledWith('AAPL');
      expect(financeServiceMock.getStockQuote).toHaveBeenCalledWith('AAPL');
    });

    it('throws BadRequestException if symbol parameter is missing', async () => {
      await expect(controller.getQuote('   ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. GET /finance/sec-filings', () => {
    it('returns existing SEC filing data', async () => {
      const res = await controller.getSecFilings('MSFT');
      expect(res.success).toBe(true);
      expect(res.data.cik).toBe('0000320193');
      expect(res.data.recentFilings.length).toBe(1);
      expect(financeServiceMock.getRecentSecFilings).toHaveBeenCalledWith('MSFT');
    });
  });

  describe('4. GET /finance/compare', () => {
    it('returns side-by-side data for both companies', async () => {
      const res = await controller.compareSymbols('AAPL', 'MSFT');
      expect(res.success).toBe(true);
      expect(res.data.symbol1.symbol).toBe('AAPL');
      expect(res.data.symbol2.symbol).toBe('MSFT');
      expect(financeServiceMock.getFinancialContext).toHaveBeenCalledTimes(2);
    });

    it('throws BadRequestException if either symbol is missing', async () => {
      await expect(controller.compareSymbols('AAPL', '')).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. Handling Missing/Invalid Symbols Cleanly', () => {
    it('handles invalid symbol cleanly returning error payload', async () => {
      const res = await controller.getOverview('INVALID');
      expect(res.success).toBe(false);
      expect(res.data.error).toBeDefined();
    });
  });

  describe('6 & 7. WebAuthGuard Authentication Guard', () => {
    it('allows authenticated requests with valid header', async () => {
      const mockReq = { headers: { 'x-user-id': 'valid-web-user' } } as any;
      const canActivate = await webAuthGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => mockReq }),
      } as any);
      expect(canActivate).toBe(true);
      expect(mockReq.user.telegramId).toBe('web-valid-web-user');
    });

    it('rejects unauthenticated requests without headers with 401 Unauthorized', async () => {
      const mockReq = { headers: {} } as any;
      await expect(
        webAuthGuard.canActivate({
          switchToHttp: () => ({ getRequest: () => mockReq }),
        } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
