'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast-provider';

interface ScheduledBriefingConfig {
  id: string;
  userId: string;
  frequency: 'DAILY_MORNING' | 'DAILY_EVENING' | 'WEEKLY_MONDAY';
  preferredTime: string;
  symbols: string[];
  includeNews: boolean;
  includeSec: boolean;
  deliverTelegram: boolean;
  enabled: boolean;
  lastDeliveredAt: string | null;
}

interface NotificationLog {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  channel: string;
  delivered: boolean;
  error: string | null;
  createdAt: string;
}

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY_MORNING: 'Daily Morning',
  DAILY_EVENING: 'Daily Evening',
  WEEKLY_MONDAY: 'Every Monday',
};

export default function BriefingsPage() {
  const [config, setConfig] = useState<ScheduledBriefingConfig | null>(null);
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [generatedBriefing, setGeneratedBriefing] = useState<string | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<string | null>(null);

  // Form State
  const [frequency, setFrequency] = useState<'DAILY_MORNING' | 'DAILY_EVENING' | 'WEEKLY_MONDAY'>('DAILY_MORNING');
  const [preferredTime, setPreferredTime] = useState<string>('08:00');
  const [symbols, setSymbols] = useState<string[]>([]);
  const [newSymbolInput, setNewSymbolInput] = useState<string>('');
  const [includeNews, setIncludeNews] = useState<boolean>(true);
  const [includeSec, setIncludeSec] = useState<boolean>(true);
  const [deliverTelegram, setDeliverTelegram] = useState<boolean>(true);
  const [enabled, setEnabled] = useState<boolean>(true);

  // Telegram Account Connection State
  const [telegramConnected, setTelegramConnected] = useState<boolean>(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState<boolean>(false);

  const { showToast } = useToast();

  const handleConnectTelegram = async () => {
    try {
      setGeneratingLink(true);
      const res = await fetchApi('/users/telegram-link', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to generate Telegram link.');
      }
      setLinkUrl(data.linkUrl);
      showToast('success', 'Telegram link generated! Open Telegram to connect.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to generate Telegram link.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const fetchConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      const res = await fetchApi('/briefings/config');

      if (!res.ok) {
        throw new Error(`Failed to fetch briefing config (Status ${res.status})`);
      }

      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setFrequency(data.config.frequency);
        setPreferredTime(data.config.preferredTime);
        setSymbols(data.config.symbols || []);
        setIncludeNews(data.config.includeNews);
        setIncludeSec(data.config.includeSec);
        setDeliverTelegram(data.config.deliverTelegram);
        setEnabled(data.config.enabled);
        if (data.telegramConnected !== undefined) {
          setTelegramConnected(data.telegramConnected);
        }
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error loading briefing configuration.');
    } finally {
      setLoadingConfig(false);
    }
  }, [showToast]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetchApi('/briefings/history');

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          setHistory(data.history);
        }
      }
    } catch {
      // Silent error for secondary history fetch
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchHistory();
  }, [fetchConfig, fetchHistory]);

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newSymbolInput.trim().toUpperCase();

    if (!raw) return;

    if (symbols.length >= 10) {
      showToast('error', 'Maximum limit of 10 tracked symbols reached.');
      return;
    }

    if (symbols.includes(raw)) {
      showToast('error', `Symbol $${raw} is already tracked.`);
      return;
    }

    setSymbols([...symbols, raw]);
    setNewSymbolInput('');
  };

  const handleRemoveSymbol = (symToRemove: string) => {
    setSymbols(symbols.filter((s) => s !== symToRemove));
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!preferredTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) {
      showToast('error', 'Please enter a valid preferred time in HH:mm format (00:00 - 23:59).');
      return;
    }

    try {
      setSavingConfig(true);

      const payload = {
        frequency,
        preferredTime,
        symbols,
        includeNews,
        includeSec,
        deliverTelegram,
        enabled,
      };

      const res = await fetchApi('/briefings/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save briefing configuration.');
      }

      showToast('success', 'Briefing preferences saved successfully.');
      setConfig(data.config);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save briefing preferences.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTriggerNow = async () => {
    try {
      setGenerating(true);
      setGeneratedBriefing(null);
      setDeliveryInfo(null);

      const res = await fetchApi('/briefings/trigger-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to generate briefing.');
      }

      setGeneratedBriefing(data.briefing);

      if (data.deliveredToTelegram) {
        setDeliveryInfo('Briefing generated and sent to Telegram.');
        showToast('success', 'Briefing generated and delivered to Telegram.');
      } else if (deliverTelegram && !telegramConnected) {
        setDeliveryInfo('Briefing generated. Connect Telegram to receive briefings there.');
        showToast('info', 'Briefing generated. Connect Telegram to receive briefings in chat.');
      } else if (deliverTelegram && !data.deliveredToTelegram) {
        setDeliveryInfo('Briefing generated, but Telegram delivery failed.');
        showToast('warning', 'Briefing generated, but Telegram delivery failed.');
      } else {
        setDeliveryInfo('Briefing generated successfully.');
        showToast('success', 'Briefing generated successfully.');
      }

      // Refresh history log after triggering
      fetchHistory();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to generate market briefing.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Market Briefings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure personalized financial briefings and receive market intelligence on your schedule.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 self-start sm:self-auto">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="text-xs font-medium text-slate-300">Briefing Engine Active</span>
        </div>
      </div>

      {/* Action Bar: Trigger Now Button */}
      <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900/60 border border-blue-500/20 rounded-xl p-4 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div>
          <h2 className="text-sm font-semibold text-white">Instant Market Intelligence</h2>
          <p className="text-xs text-slate-400">
            Generate an executive financial summary for your tracked stock symbols immediately.
          </p>
        </div>

        <button
          onClick={handleTriggerNow}
          disabled={generating}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs py-2.5 px-5 rounded-lg shadow-md transition duration-200 flex items-center justify-center space-x-2 whitespace-nowrap self-start sm:self-auto"
        >
          {generating ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
              <span>Generating Briefing...</span>
            </>
          ) : (
            <>
              <span>⚡ Generate Briefing Now</span>
            </>
          )}
        </button>
      </div>

      {/* Generated Briefing Result Card */}
      {generatedBriefing && (
        <div className="bg-slate-900/80 border border-blue-500/30 rounded-xl p-6 backdrop-blur-md space-y-4 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
              <span>📄</span> Generated Market Briefing
            </h3>
            {deliveryInfo && (
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                {deliveryInfo}
              </span>
            )}
          </div>

          <div className="prose prose-invert prose-xs max-w-none text-slate-200 leading-relaxed space-y-3">
            <ReactMarkdown>{generatedBriefing}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Main Grid: Configuration Form (Left) & Briefing History (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Telegram Status & Briefing Preferences */}
        <div className="lg:col-span-1 space-y-6 h-fit">
          {/* Telegram Account Connection Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <span>📱</span> Telegram Delivery Status
              </h3>
              <span
                className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                  telegramConnected
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700/50'
                }`}
              >
                {telegramConnected ? 'Telegram Connected' : 'Not Connected'}
              </span>
            </div>

            {!telegramConnected && (
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <p className="text-[11px] text-slate-400">
                  Connect your Telegram account to receive real-time stock alerts and market briefings.
                </p>

                {linkUrl ? (
                  <div className="space-y-2 pt-1">
                    <a
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center space-x-2 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 px-3 rounded-lg shadow-sm transition"
                    >
                      <span>✈️ Open Telegram to connect</span>
                    </a>
                    <p className="text-[10px] text-amber-400 text-center font-medium">
                      Link expires in 10 minutes.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectTelegram}
                    disabled={generatingLink}
                    className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold py-2 px-3 rounded-lg transition"
                  >
                    {generatingLink ? 'Generating Link...' : 'Connect Telegram'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Configuration Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md space-y-4">
          <h2 className="text-base font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
            <span>⚙️</span> Briefing Preferences
          </h2>

          {loadingConfig ? (
            <div className="py-8 text-center text-slate-400 flex flex-col items-center space-y-2">
              <span className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></span>
              <span className="text-xs">Loading preferences...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              {/* Frequency Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Delivery Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
                  disabled={savingConfig}
                >
                  <option value="DAILY_MORNING">Daily Morning</option>
                  <option value="DAILY_EVENING">Daily Evening</option>
                  <option value="WEEKLY_MONDAY">Every Monday</option>
                </select>
              </div>

              {/* Preferred Time Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Preferred Time (UTC HH:mm)
                </label>
                <input
                  type="text"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  placeholder="08:00"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  disabled={savingConfig}
                />
              </div>

              {/* Tracked Stocks Management */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tracked Stock Symbols ({symbols.length}/10)
                </label>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {symbols.map((sym) => (
                    <span
                      key={sym}
                      className="bg-blue-950/80 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5"
                    >
                      <span>${sym}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSymbol(sym)}
                        className="text-blue-400 hover:text-rose-400 font-bold ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {symbols.length === 0 && (
                    <span className="text-[11px] text-slate-500 italic">No stocks added yet.</span>
                  )}
                </div>

                {/* Add Symbol Input */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newSymbolInput}
                    onChange={(e) => setNewSymbolInput(e.target.value)}
                    placeholder="e.g. AAPL"
                    className="flex-1 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    disabled={savingConfig || symbols.length >= 10}
                  />
                  <button
                    type="button"
                    onClick={handleAddSymbol}
                    disabled={savingConfig || symbols.length >= 10 || !newSymbolInput.trim()}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Toggle Controls */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Include Market News</span>
                  <input
                    type="checkbox"
                    checked={includeNews}
                    onChange={(e) => setIncludeNews(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0 h-4 w-4"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Include SEC Filings</span>
                  <input
                    type="checkbox"
                    checked={includeSec}
                    onChange={(e) => setIncludeSec(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0 h-4 w-4"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Deliver to Telegram</span>
                  <input
                    type="checkbox"
                    checked={deliverTelegram}
                    onChange={(e) => setDeliverTelegram(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0 h-4 w-4"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer pt-1">
                  <span className="font-semibold text-white">Enable Briefing Schedule</span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0 h-4 w-4"
                  />
                </label>
              </div>

              {/* Save Preferences Button */}
              <button
                type="submit"
                disabled={savingConfig}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition duration-200 shadow-md flex items-center justify-center gap-2"
              >
                {savingConfig ? (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Preferences</span>
                )}
              </button>

              {config?.lastDeliveredAt && (
                <p className="text-[10px] text-slate-500 text-center pt-1">
                  Last delivered: {new Date(config.lastDeliveredAt).toLocaleString()}
                </p>
              )}
            </form>
          )}
        </div>
      </div>

        {/* Briefing History Container */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center justify-between">
            <span>Briefing History</span>
            <span className="text-xs text-slate-400 font-normal">
              {history.length} {history.length === 1 ? 'Record' : 'Records'}
            </span>
          </h2>

          {history.length === 0 ? (
            /* Empty History State */
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center space-y-4">
              <div className="text-4xl">📰</div>
              <div>
                <h3 className="text-sm font-semibold text-white">Your briefing history is empty</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Generate your first briefing to see executive summaries archived here.
                </p>
              </div>
              <button
                onClick={handleTriggerNow}
                disabled={generating}
                className="bg-blue-600/20 text-blue-400 border border-blue-500/40 hover:bg-blue-600/30 px-4 py-2 rounded-lg text-xs font-semibold transition"
              >
                Generate Briefing Now
              </button>
            </div>
          ) : (
            /* Briefing History List */
            <div className="space-y-3">
              {history.map((item) => (
                <details
                  key={item.id}
                  className="group bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-xl transition duration-200 overflow-hidden"
                >
                  <summary className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 list-none">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-bold text-white">{item.title}</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                          item.delivered
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                            : 'bg-rose-950/80 text-rose-400 border-rose-500/40'
                        }`}
                      >
                        {item.delivered ? 'Delivered' : 'Delivery Failed'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-slate-400">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] uppercase font-semibold text-slate-300">
                        {item.channel}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                      <span className="text-slate-500 group-open:rotate-180 transition-transform">
                        ▼
                      </span>
                    </div>
                  </summary>

                  <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-slate-950/40 text-xs text-slate-300 space-y-2">
                    <div className="prose prose-invert prose-xs max-w-none">
                      <ReactMarkdown>{item.content}</ReactMarkdown>
                    </div>
                    {item.error && (
                      <p className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-900/50 p-2 rounded">
                        Error: {item.error}
                      </p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
