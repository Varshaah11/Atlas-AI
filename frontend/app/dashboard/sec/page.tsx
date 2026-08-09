'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '@/lib/api';

interface SecFilingItem {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
  primaryDocDescription?: string;
  documentUrl?: string;
}

interface SecCompanyFilings {
  cik: string;
  companyName?: string;
  ticker?: string;
  recentFilings: SecFilingItem[];
  retrievedAt: string;
  error?: string;
}

export default function SecFilingsPage() {
  const [searchQuery, setSearchQuery] = useState('MSFT');
  const [activeSymbol, setActiveSymbol] = useState('MSFT');
  const [selectedFormFilter, setSelectedFormFilter] = useState<string>('ALL');
  const [data, setData] = useState<SecCompanyFilings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSecFilings = useCallback(async (symbol: string) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetchApi(
        `/finance/sec-filings?symbol=${encodeURIComponent(symbol)}`,
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to retrieve SEC EDGAR filings`);
      }

      const result = await res.json();
      if (!result.success || result.data?.error) {
        setError(result.data?.error || `No SEC filings found for "${symbol}"`);
        setData((prev) => (prev ? prev : null));
      } else {
        setData(result.data);
      }
    } catch (err: any) {
      setError(err.message || 'SEC filing data is temporarily unavailable. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecFilings(activeSymbol);
  }, [activeSymbol, fetchSecFilings]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || loading) return;
    setActiveSymbol(searchQuery.trim().toUpperCase());
  };

  const filteredFilings =
    data?.recentFilings?.filter((filing) => {
      if (selectedFormFilter === 'ALL') return true;
      return filing.form.toUpperCase() === selectedFormFilter;
    }) || [];

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
            <span>SEC EDGAR Filings Browser</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Official SEC 10-K, 10-Q, and 8-K filings retrieved directly from the SEC EDGAR system.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2 w-full md:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ticker or company (e.g. MSFT, AAPL)..."
            disabled={loading}
            className="w-full md:w-72 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <button
            type="submit"
            disabled={!searchQuery.trim() || loading}
            className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition duration-200 shrink-0"
          >
            {loading ? 'Fetching...' : 'Lookup SEC Filings'}
          </button>
        </form>
      </div>

      {/* Form Type Filter Buttons */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        <span className="text-xs font-semibold text-slate-400">Filter Form:</span>
        {['ALL', '10-K', '10-Q', '8-K'].map((form) => (
          <button
            key={form}
            onClick={() => setSelectedFormFilter(form)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition duration-200 ${
              selectedFormFilter === form
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {form === 'ALL' ? 'All Forms' : `Form ${form}`}
          </button>
        ))}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="glass-card rounded-2xl p-8 border border-slate-800 text-center space-y-3 animate-pulse">
          <div className="h-4 w-1/3 bg-slate-800 rounded mx-auto"></div>
          <div className="h-8 w-1/4 bg-slate-800 rounded mx-auto"></div>
          <div className="text-xs text-slate-500">Querying SEC EDGAR CIK & submission endpoints...</div>
        </div>
      )}

      {/* Error Display */}
      {error && !loading && (
        <div className="glass-card rounded-2xl p-6 border border-red-500/30 bg-red-950/20 text-red-400 text-xs space-y-3">
          <p className="font-semibold text-sm">⚠️ SEC Filings Lookup Error</p>
          <p>{error}</p>
          <button
            onClick={() => fetchSecFilings(activeSymbol)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition duration-200"
          >
            Retry Search
          </button>
        </div>
      )}

      {/* Filings Content */}
      {data && !loading && (
        <div className="space-y-6">
          {/* CIK & Company Header */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-2xl font-bold text-slate-100">{data.companyName || activeSymbol}</h2>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  {data.ticker || activeSymbol}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                SEC Central Index Key (CIK): <strong className="text-slate-200 font-mono">{data.cik}</strong>
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Retrieved: {new Date(data.retrievedAt).toLocaleDateString()}
            </div>
          </div>

          {/* Filings List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100">
                Official Submissions ({filteredFilings.length})
              </h3>
            </div>

            {filteredFilings.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center text-slate-400 border border-slate-800 text-xs">
                No filings found matching filter &quot;{selectedFormFilter}&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredFilings.map((filing, idx) => (
                  <div
                    key={idx}
                    className="glass-card rounded-xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-3">
                        <span className="px-2.5 py-1 text-xs font-extrabold rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                          Form {filing.form}
                        </span>
                        <h4 className="font-semibold text-slate-100 text-sm">
                          Filing Date: {filing.filingDate}
                        </h4>
                      </div>
                      <div className="text-xs text-slate-400 space-y-0.5 pt-1 font-mono">
                        <p>Accession Number: {filing.accessionNumber}</p>
                        {filing.primaryDocument && <p>Primary Document: {filing.primaryDocument}</p>}
                      </div>
                    </div>

                    {filing.documentUrl && (
                      <a
                        href={filing.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition duration-200 self-end md:self-center shrink-0 flex items-center space-x-1"
                      >
                        <span>View on SEC EDGAR ↗</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
