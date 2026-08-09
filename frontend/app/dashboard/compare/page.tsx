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
}

interface FinancialMetrics {
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  peRatio?: number;
  marketCap?: number;
}

interface OverviewData {
  symbol: string;
  companyName?: string;
  quote?: StockQuote;
  profile?: CompanyProfile;
  metrics?: FinancialMetrics;
  error?: string;
}

export default function StockComparisonPage() {
  const [symbol1Input, setSymbol1Input] = useState('AAPL');
  const [symbol2Input, setSymbol2Input] = useState('MSFT');

  const [activeSymbol1, setActiveSymbol1] = useState('AAPL');
  const [activeSymbol2, setActiveSymbol2] = useState('MSFT');

  const [compData, setCompData] = useState<{ symbol1: OverviewData; symbol2: OverviewData } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async (s1: string, s2: string) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetchApi(
        `/finance/compare?symbol1=${encodeURIComponent(s1)}&symbol2=${encodeURIComponent(s2)}`,
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to execute stock comparison`);
      }

      const result = await res.json();
      if (!result.success || !result.data) {
        setError('Unable to fetch comparison data for specified symbols');
        setCompData((prev) => (prev ? prev : null));
      } else {
        setCompData(result.data);
      }
    } catch (err: any) {
      setError(err.message || 'Market comparison data is temporarily unavailable. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComparison(activeSymbol1, activeSymbol2);
  }, [activeSymbol1, activeSymbol2, fetchComparison]);

  const handleCompareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol1Input.trim() || !symbol2Input.trim() || loading) return;
    setActiveSymbol1(symbol1Input.trim().toUpperCase());
    setActiveSymbol2(symbol2Input.trim().toUpperCase());
  };

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'N/A';
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Inputs */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
            <span>Side-by-Side Stock Comparison</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Compare key market metrics, valuation ratios, and price ranges for two companies.
          </p>
        </div>

        <form onSubmit={handleCompareSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Company / Symbol A</label>
            <input
              type="text"
              value={symbol1Input}
              onChange={(e) => setSymbol1Input(e.target.value)}
              placeholder="e.g. AAPL"
              disabled={loading}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Company / Symbol B</label>
            <input
              type="text"
              value={symbol2Input}
              onChange={(e) => setSymbol2Input(e.target.value)}
              placeholder="e.g. MSFT"
              disabled={loading}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <button
            type="submit"
            disabled={!symbol1Input.trim() || !symbol2Input.trim() || loading}
            className="w-full py-2.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition duration-200"
          >
            {loading ? 'Comparing...' : 'Compare Stock Metrics'}
          </button>
        </form>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="glass-card rounded-2xl p-8 border border-slate-800 text-center space-y-3 animate-pulse">
          <div className="h-4 w-1/3 bg-slate-800 rounded mx-auto"></div>
          <div className="h-8 w-1/2 bg-slate-800 rounded mx-auto"></div>
          <div className="text-xs text-slate-500">Querying side-by-side financial metrics...</div>
        </div>
      )}

      {/* Error Display */}
      {error && !loading && (
        <div className="glass-card rounded-2xl p-6 border border-red-500/30 bg-red-950/20 text-red-400 text-xs space-y-3">
          <p className="font-semibold text-sm">⚠️ Comparison Error</p>
          <p>{error}</p>
          <button
            onClick={() => fetchComparison(activeSymbol1, activeSymbol2)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition duration-200"
          >
            Retry Comparison
          </button>
        </div>
      )}

      {/* Comparison Grid */}
      {compData && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Symbol 1 */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
            {compData.symbol1.error ? (
              <div className="text-xs text-red-400">⚠️ {compData.symbol1.error}</div>
            ) : (
              <>
                <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-100">
                      {compData.symbol1.companyName || compData.symbol1.symbol}
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      {compData.symbol1.symbol}
                    </span>
                  </div>
                  {compData.symbol1.quote && (
                    <div className="text-right">
                      <div className="text-2xl font-extrabold text-slate-100">
                        {formatCurrency(compData.symbol1.quote.currentPrice)}
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          compData.symbol1.quote.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {compData.symbol1.quote.change >= 0 ? '▲' : '▼'}{' '}
                        {formatCurrency(Math.abs(compData.symbol1.quote.change))} (
                        {compData.symbol1.quote.percentChange.toFixed(2)}%)
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex justify-between py-2 border-b border-slate-900">
                    <span className="text-slate-500">Market Cap</span>
                    <span className="font-semibold text-slate-100">
                      {compData.symbol1.metrics?.marketCap
                        ? `$${compData.symbol1.metrics.marketCap.toLocaleString()}M`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-900">
                    <span className="text-slate-500">P/E Ratio</span>
                    <span className="font-semibold text-slate-100">
                      {compData.symbol1.metrics?.peRatio?.toFixed(2) || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-900">
                    <span className="text-slate-500">52-Week High</span>
                    <span className="font-semibold text-emerald-400">
                      {formatCurrency(compData.symbol1.metrics?.fiftyTwoWeekHigh)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-900">
                    <span className="text-slate-500">52-Week Low</span>
                    <span className="font-semibold text-amber-400">
                      {formatCurrency(compData.symbol1.metrics?.fiftyTwoWeekLow)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-900">
                    <span className="text-slate-500">Industry</span>
                    <span className="font-semibold text-slate-100">{compData.symbol1.profile?.industry || 'N/A'}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Card Symbol 2 */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
            {compData.symbol2.error ? (
              <div className="text-xs text-red-400">⚠️ {compData.symbol2.error}</div>
            ) : (
              <>
                <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-100">
                      {compData.symbol2.companyName || compData.symbol2.symbol}
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                      {compData.symbol2.symbol}
                    </span>
                  </div>
                  {compData.symbol2.quote && (
                    <div className="text-right">
                      <div className="text-2xl font-extrabold text-slate-100">
                        {formatCurrency(compData.symbol2.quote.currentPrice)}
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          compData.symbol2.quote.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {compData.symbol2.quote.change >= 0 ? '▲' : '▼'}{' '}
                        {formatCurrency(Math.abs(compData.symbol2.quote.change))} (
                        {compData.symbol2.quote.percentChange.toFixed(2)}%)
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex justify-between py-2 border-b border-slate-900">
                    <span className="text-slate-500">Market Cap</span>
                    <span className="font-semibold text-slate-100">
                      {compData.symbol2.metrics?.marketCap
                        ? `$${compData.symbol2.metrics.marketCap.toLocaleString()}M`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-900">
                    <span className="text-slate-500">P/E Ratio</span>
                    <span className="font-semibold text-slate-100">
                      {compData.symbol2.metrics?.peRatio?.toFixed(2) || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-900">
                    <span className="text-slate-500">52-Week High</span>
                    <span className="font-semibold text-emerald-400">
                      {formatCurrency(compData.symbol2.metrics?.fiftyTwoWeekHigh)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-900">
                    <span className="text-slate-500">52-Week Low</span>
                    <span className="font-semibold text-amber-400">
                      {formatCurrency(compData.symbol2.metrics?.fiftyTwoWeekLow)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-900">
                    <span className="text-slate-500">Industry</span>
                    <span className="font-semibold text-slate-100">{compData.symbol2.profile?.industry || 'N/A'}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
