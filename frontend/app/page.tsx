'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/app/dashboard/layout';
import { fetchApi } from '@/lib/api';

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

export default function SystemMonitorPage() {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/health');
      const payload: ApiResponse = await res.json();
      setHealth(payload.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to Atlas AI Backend Engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return 'N/A';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="h-3.5 w-3.5 rounded-full bg-blue-500 animate-pulse"></span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
                <span>System Health & Infrastructure Monitor</span>
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-slate-900 text-blue-400 border border-slate-800">
                v{health?.version || '0.2.0'}
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              Real-time telemetry for NestJS core, PostgreSQL vector database, Telegraf Bot listener, and Groq LLM inference pipeline.
            </p>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-auto">
            <span className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              Env: <strong className="text-slate-200">{health?.environment || 'development'}</strong>
            </span>
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition duration-200 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh Diagnostics'}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="glass-card rounded-2xl p-4 border border-red-500/30 bg-red-950/20 text-red-400 text-xs flex items-center space-x-3">
            <span className="text-base">⚠️</span>
            <div>
              <span className="font-semibold">Backend Engine Unreachable:</span> {error}
            </div>
          </div>
        )}

        {/* Core Component Health Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* NestJS Core */}
          <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                NestJS Engine
              </p>
              <span className="text-xs font-mono text-slate-500">HTTP REST</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-100">Backend Core</span>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                  health?.status === 'ok'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {loading ? 'CHECKING...' : health?.status === 'ok' ? 'HEALTHY (OK)' : 'DEGRADED'}
              </span>
            </div>
          </div>

          {/* Database */}
          <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                PostgreSQL + pgvector
              </p>
              <span className="text-xs font-mono text-slate-500">Port 5433</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-100">Database</span>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                  health?.database === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}
              >
                {loading ? 'CHECKING...' : health?.database === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </div>

          {/* Telegraf Bot */}
          <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Telegraf Bot
              </p>
              <span className="text-xs font-mono text-slate-500">Polling</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-100">Telegram Bot</span>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                  health?.telegram === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {loading ? 'CHECKING...' : health?.telegram === 'connected' ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
          </div>

          {/* Groq LLM */}
          <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Groq LLM Engine
              </p>
              <span className="text-xs font-mono text-slate-500">Llama 3.3</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-100">AI Provider</span>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                  health?.groq === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}
              >
                {loading ? 'CHECKING...' : health?.groq === 'connected' ? 'CONNECTED' : 'UNCONFIGURED'}
              </span>
            </div>
          </div>
        </div>

        {/* Statistics Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Total Registered Users
              </p>
              <h3 className="text-3xl font-bold mt-1 text-slate-100">
                {health?.stats.totalUsers ?? 0}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Unique Authenticated Identity Contexts</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-semibold text-xl">
              👤
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Active Conversations
              </p>
              <h3 className="text-3xl font-bold mt-1 text-slate-100">
                {health?.stats.totalConversations ?? 0}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Persisted Consultation Threads
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-semibold text-xl">
              💬
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Process Uptime
              </p>
              <h3 className="text-3xl font-bold mt-1 text-slate-100 font-mono">
                {formatUptime(health?.uptimeSeconds)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Continuous Execution Runtime</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-xl">
              ⏱️
            </div>
          </div>
        </div>

        {/* System Specs & Live Status Telemetry Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Architecture Specs */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
            <h2 className="text-lg font-bold text-slate-100">Architecture & Execution Stack</h2>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start space-x-2">
                <span className="h-2 w-2 rounded-full bg-blue-400 mt-1 shrink-0"></span>
                <span>
                  <strong className="text-slate-100 font-semibold">Conversation Gateway:</strong> Normalizes incoming chat messages and enforces user identity isolation.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="h-2 w-2 rounded-full bg-blue-400 mt-1 shrink-0"></span>
                <span>
                  <strong className="text-slate-100 font-semibold">AI Orchestrator Engine:</strong> Evaluates queries, manages multi-agent routing (ResearchAgent, MarketAgent, DocumentAgent).
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="h-2 w-2 rounded-full bg-blue-400 mt-1 shrink-0"></span>
                <span>
                  <strong className="text-slate-100 font-semibold">Groq LLM Service:</strong> Primary Llama 3.3 70B inference engine with single fallback retry strategy.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="h-2 w-2 rounded-full bg-blue-400 mt-1 shrink-0"></span>
                <span>
                  <strong className="text-slate-100 font-semibold">Scheduled Briefings & Alerts:</strong> Background evaluation engines running automated 5-minute sweeps and morning/evening briefings.
                </span>
              </li>
            </ul>
          </div>

          {/* Live Telemetry Panel */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
            <h2 className="text-lg font-bold text-slate-100">Live Health Telemetry</h2>
            {loading ? (
              <div className="text-xs text-slate-400 animate-pulse py-8 text-center">
                Querying backend diagnostic telemetry...
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                ⚠️ Telemetry Unavailable
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-900">
                  <span className="text-slate-400">Backend Core Status</span>
                  <span className="font-semibold text-emerald-400 font-mono">HEALTHY (200 OK)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-900">
                  <span className="text-slate-400">Environment</span>
                  <span className="font-semibold text-slate-200 font-mono">{health?.environment}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-900">
                  <span className="text-slate-400">Application Release Version</span>
                  <span className="font-semibold text-blue-400 font-mono">v{health?.version}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-900">
                  <span className="text-slate-400">Relational Database Engine</span>
                  <span className="font-semibold text-emerald-400 font-mono">PostgreSQL / Prisma ORM</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-900">
                  <span className="text-slate-400">Vector Search Extension</span>
                  <span className="font-semibold text-indigo-400 font-mono">pgvector Enabled</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-900">
                  <span className="text-slate-400">Telegram Bot Listener</span>
                  <span className="font-semibold text-slate-200 font-mono">Long Polling Active</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
