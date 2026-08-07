'use client';

import { useEffect, useState } from 'react';

interface SystemStats {
  totalUsers: number;
  totalConversations: number;
}

interface SystemHealthData {
  status: 'ok' | 'degraded';
  version: string;
  environment: string;
  database: 'connected' | 'disconnected';
  telegram: 'connected' | 'disconnected';
  groq: 'connected' | 'disconnected';
  stats: SystemStats;
  uptimeSeconds: number;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data: SystemHealthData;
  timestamp: string;
}

export default function DashboardPage() {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3001/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload: ApiResponse = await res.json();
      setHealth(payload.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to Atlas AI Backend Engine');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="h-3.5 w-3.5 rounded-full bg-blue-500 animate-pulse"></span>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
                Atlas AI Monitor
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-slate-800 text-blue-400 border border-slate-700">
                v{health?.version || '0.2.0'}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Telegram AI Financial Assistant • Groq Llama-3.3 LLM Provider
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-500 font-mono">
              Env:{' '}
              <strong className="text-slate-300">{health?.environment || 'development'}</strong>
            </span>
            <button
              onClick={fetchHealth}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition duration-200"
            >
              Refresh Diagnostics
            </button>
          </div>
        </div>

        {/* Core Component Health Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-5 border border-slate-800">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              NestJS Engine
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-lg font-semibold">Backend Core</span>
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                  health?.status === 'ok'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {loading ? 'Checking...' : health?.status.toUpperCase() || 'OFFLINE'}
              </span>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5 border border-slate-800">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              PostgreSQL + pgvector
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-lg font-semibold">Database</span>
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                  health?.database === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}
              >
                {loading ? 'Checking...' : health?.database.toUpperCase() || 'DISCONNECTED'}
              </span>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5 border border-slate-800">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Telegraf Bot
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-lg font-semibold">Telegram Interface</span>
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                  health?.telegram === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {loading ? 'Checking...' : health?.telegram.toUpperCase() || 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5 border border-slate-800">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Groq LLM Engine
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-lg font-semibold">Llama 3.3 70B</span>
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                  health?.groq === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}
              >
                {loading ? 'Checking...' : health?.groq.toUpperCase() || 'UNCONFIGURED'}
              </span>
            </div>
          </div>
        </div>

        {/* Statistics Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card rounded-xl p-6 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Total Registered Users
              </p>
              <h3 className="text-3xl font-bold mt-1 text-slate-100">
                {health?.stats.totalUsers ?? 0}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Unique Telegram Users</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-semibold text-xl">
              👤
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Active Conversations
              </p>
              <h3 className="text-3xl font-bold mt-1 text-slate-100">
                {health?.stats.totalConversations ?? 0}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Persisted Financial Consultation Contexts
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-semibold text-xl">
              💬
            </div>
          </div>
        </div>

        {/* Pipeline Architecture Specs & Status Output */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
            <h2 className="text-lg font-semibold text-slate-200">System Architecture Specs</h2>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center space-x-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                <span>
                  <strong className="text-slate-200">Conversation Gateway:</strong> Input validation
                  & text normalization
                </span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                <span>
                  <strong className="text-slate-200">AI Orchestrator:</strong> Task evaluation,
                  ambiguity clarification & execution routing
                </span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                <span>
                  <strong className="text-slate-200">Groq LLM Provider:</strong> High-speed Llama
                  3.3 70B inference with latency tracking (ms)
                </span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                <span>
                  <strong className="text-slate-200">Persistence Layer:</strong> Chronological
                  user/assistant turns in PostgreSQL
                </span>
              </li>
            </ul>
          </div>

          <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
            <h2 className="text-lg font-semibold text-slate-200">Live Health Diagnostic Payload</h2>
            {loading ? (
              <div className="text-sm text-slate-400 animate-pulse">
                Querying backend health endpoint...
              </div>
            ) : error ? (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                [Status Error]: {error}
              </div>
            ) : (
              <pre className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono overflow-x-auto">
                {JSON.stringify(health, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
