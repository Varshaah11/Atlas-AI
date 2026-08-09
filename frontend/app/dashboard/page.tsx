'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '@/lib/api';

interface StockQuote {
  currentPrice: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

interface CompanyProfile {
  name: string;
  ticker: string;
  exchange?: string;
  industry?: string;
  country?: string;
  marketCapitalization?: number;
  logo?: string;
  weburl?: string;
}

interface FinancialMetrics {
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  peRatio?: number;
  marketCap?: number;
}

interface NewsItem {
  id?: number | string;
  headline: string;
  source?: string;
  summary?: string;
  url?: string;
}

interface OverviewData {
  symbol: string;
  companyName?: string;
  quote?: StockQuote;
  profile?: CompanyProfile;
  metrics?: FinancialMetrics;
  news?: NewsItem[];
  retrievedAt?: string;
  error?: string;
}

export default function MarketOverviewPage() {
  const [searchQuery, setSearchQuery] = useState('AAPL');
  const [activeSymbol, setActiveSymbol] = useState('AAPL');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async (symbol: string) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetchApi(
        `/finance/overview?symbol=${encodeURIComponent(symbol)}`,
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch market overview`);
      }

      const result = await res.json();
      if (!result.success || result.data?.error) {
        setError(result.data?.error || `Unable to retrieve financial data for "${symbol}"`);
        setData((prev) => (prev ? prev : null));
      } else {
        setData(result.data);
      }
    } catch (err: any) {
      setError(err.message || 'Market data is temporarily unavailable. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview(activeSymbol);
  }, [activeSymbol, fetchOverview]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || loading) return;
    setActiveSymbol(searchQuery.trim().toUpperCase());
  };

  const formatNumber = (val?: number, prefix = '$', suffix = '') => {
    if (val === undefined || val === null) return 'N/A';
    return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
  };

  return (
    <div className="space-y-6">
      {/* Search Bar Header */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
            <span>Market Intelligence Overview</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time stock quotes, company profiles, key metrics, and financial news powered by Finnhub.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2 w-full md:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter symbol or company (e.g. AAPL, MSFT)..."
            disabled={loading}
            className="w-full md:w-72 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <button
            type="submit"
            disabled={!searchQuery.trim() || loading}
            className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition duration-200 shrink-0"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="glass-card rounded-2xl p-8 border border-slate-800 text-center space-y-3 animate-pulse">
          <div className="h-4 w-1/3 bg-slate-800 rounded mx-auto"></div>
          <div className="h-8 w-1/4 bg-slate-800 rounded mx-auto"></div>
          <div className="text-xs text-slate-500">Querying Finnhub market data endpoints...</div>
        </div>
      )}

      {/* Error Message Display */}
      {error && !loading && (
        <div className="glass-card rounded-2xl p-6 border border-red-500/30 bg-red-950/20 text-red-400 text-xs space-y-3">
          <p className="font-semibold text-sm">⚠️ Market Data Unavailable</p>
          <p>{error}</p>
          <button
            onClick={() => fetchOverview(activeSymbol)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition duration-200"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* Financial Overview Content */}
      {data && !loading && (
        <div className="space-y-6">
          {/* Main Company Header & Quote Card */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
              <div>
                <div className="flex items-center space-x-3">
                  <h2 className="text-3xl font-bold tracking-tight text-slate-100">
                    {data.companyName || data.symbol}
                  </h2>
                  <span className="px-3 py-1 text-xs font-bold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    {data.symbol}
                  </span>
                  {data.profile?.exchange && (
                    <span className="px-2.5 py-0.5 text-xs font-mono rounded bg-slate-900 text-slate-400 border border-slate-800">
                      {data.profile.exchange}
                    </span>
                  )}
                </div>
                {data.profile?.industry && (
                  <p className="text-xs text-slate-400 mt-1">
                    Industry: <strong className="text-slate-200">{data.profile.industry}</strong>
                    {data.profile.country && ` • ${data.profile.country}`}
                  </p>
                )}
              </div>

              {data.quote && (
                <div className="text-right self-start md:self-auto">
                  <div className="text-3xl font-extrabold text-slate-100">
                    ${data.quote.currentPrice.toFixed(2)}
                  </div>
                  <div
                    className={`text-xs font-semibold mt-0.5 flex items-center justify-end space-x-1 ${
                      data.quote.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    <span>
                      {data.quote.change >= 0 ? '▲' : '▼'} ${Math.abs(data.quote.change).toFixed(2)} (
                      {data.quote.percentChange.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Price Detail Grid */}
            {data.quote && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-xs text-slate-500 font-medium">Day High</p>
                  <p className="text-sm font-bold text-slate-200 mt-1">${data.quote.high.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-xs text-slate-500 font-medium">Day Low</p>
                  <p className="text-sm font-bold text-slate-200 mt-1">${data.quote.low.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-xs text-slate-500 font-medium">Open Price</p>
                  <p className="text-sm font-bold text-slate-200 mt-1">${data.quote.open.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-xs text-slate-500 font-medium">Previous Close</p>
                  <p className="text-sm font-bold text-slate-200 mt-1">${data.quote.previousClose.toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Key Financial Metrics */}
          {data.metrics && (
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-slate-100">Key Financial Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-xs text-slate-500">Market Capitalization</p>
                  <p className="text-base font-bold text-slate-100 mt-1">
                    {data.metrics.marketCap !== undefined ? `$${data.metrics.marketCap.toLocaleString()}M` : 'N/A'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-xs text-slate-500">P/E Ratio</p>
                  <p className="text-base font-bold text-slate-100 mt-1">
                    {data.metrics.peRatio !== undefined ? data.metrics.peRatio.toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-xs text-slate-500">52-Week High</p>
                  <p className="text-base font-bold text-emerald-400 mt-1">
                    {formatNumber(data.metrics.fiftyTwoWeekHigh)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-xs text-slate-500">52-Week Low</p>
                  <p className="text-base font-bold text-amber-400 mt-1">
                    {formatNumber(data.metrics.fiftyTwoWeekLow)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Company News Feed */}
          {data.news && data.news.length > 0 && (
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-slate-100">Recent Financial News</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.news.slice(0, 6).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-blue-400">{item.source || 'News'}</span>
                      </div>
                      <h4 className="font-semibold text-slate-100 text-sm line-clamp-2">{item.headline}</h4>
                      {item.summary && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                          {item.summary}
                        </p>
                      )}
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition duration-200 self-start pt-2"
                      >
                        Read Full Article →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
