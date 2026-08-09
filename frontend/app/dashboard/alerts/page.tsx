'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast-provider';

interface StockAlert {
  id: string;
  symbol: string;
  alertType: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'PERCENT_CHANGE_DAILY' | 'NEW_SEC_FILING';
  targetValue: number | null;
  secFormType: string | null;
  status: 'ACTIVE' | 'TRIGGERED' | 'MUTED';
  lastTriggeredAt: string | null;
  createdAt: string;
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  PRICE_ABOVE: 'Price Above',
  PRICE_BELOW: 'Price Below',
  PERCENT_CHANGE_DAILY: 'Daily % Change',
  NEW_SEC_FILING: 'New SEC Filing',
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteModalAlert, setDeleteModalAlert] = useState<StockAlert | null>(null);

  // Form State
  const [symbol, setSymbol] = useState<string>('');
  const [alertType, setAlertType] = useState<'PRICE_ABOVE' | 'PRICE_BELOW' | 'PERCENT_CHANGE_DAILY' | 'NEW_SEC_FILING'>('PRICE_ABOVE');
  const [targetValue, setTargetValue] = useState<string>('');
  const [secFormType, setSecFormType] = useState<string>('10-K');

  const { showToast } = useToast();
  const symbolInputRef = useRef<HTMLInputElement>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/alerts');

      if (!res.ok) {
        throw new Error(`Failed to fetch alerts (Status ${res.status})`);
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.alerts)) {
        setAlerts(data.alerts);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error fetching alerts from server.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!symbol.trim()) {
      showToast('error', 'Please enter a valid stock ticker or company name.');
      return;
    }

    if (
      (alertType === 'PRICE_ABOVE' || alertType === 'PRICE_BELOW' || alertType === 'PERCENT_CHANGE_DAILY') &&
      (!targetValue || isNaN(Number(targetValue)) || Number(targetValue) <= 0)
    ) {
      showToast('error', 'Please enter a positive numeric target value or percentage threshold.');
      return;
    }

    if (alertType === 'NEW_SEC_FILING' && !secFormType) {
      showToast('error', 'Please select a valid SEC Form type.');
      return;
    }

    try {
      setCreating(true);

      const payload: any = {
        symbol: symbol.trim(),
        alertType,
      };

      if (alertType === 'NEW_SEC_FILING') {
        payload.secFormType = secFormType;
      } else {
        payload.targetValue = Number(targetValue);
      }

      const res = await fetchApi('/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create alert.');
      }

      showToast('success', `Alert for ${data.alert.symbol} created successfully.`);
      setAlerts((prev) => [data.alert, ...prev]);

      // Reset Form
      setSymbol('');
      setTargetValue('');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create alert.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (alertId: string, newStatus: 'ACTIVE' | 'MUTED') => {
    try {
      setUpdatingId(alertId);

      const res = await fetchApi(`/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update alert.');
      }

      showToast('success', `Alert status updated to ${newStatus}.`);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a)),
      );
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update alert status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      setUpdatingId(alertId);

      const res = await fetchApi(`/alerts/${alertId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete alert.');
      }

      showToast('success', 'Alert deleted successfully.');
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      setDeleteModalAlert(null);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete alert.');
    } finally {
      setUpdatingId(null);
    }
  };

  const focusCreateForm = () => {
    if (symbolInputRef.current) {
      symbolInputRef.current.focus();
      symbolInputRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Market Alerts
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Get notified when stocks move, prices cross thresholds, or new SEC filings appear.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 self-start sm:self-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-medium text-slate-300">Alert Engine Active</span>
        </div>
      </div>

      {/* Main Grid: Left Column Create Form, Right Column Alert Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Alert Form Card */}
        <div className="lg:col-span-1 bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md space-y-4 h-fit">
          <h2 className="text-base font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
            <span>➕</span> Create New Alert
          </h2>

          <form onSubmit={handleCreateAlert} className="space-y-4">
            {/* Symbol Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Stock / Company Ticker
              </label>
              <input
                ref={symbolInputRef}
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. AAPL, Microsoft, NVDA"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                disabled={creating}
              />
            </div>

            {/* Alert Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Alert Trigger Condition
              </label>
              <select
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as any)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
                disabled={creating}
              >
                <option value="PRICE_ABOVE">Price Above ($)</option>
                <option value="PRICE_BELOW">Price Below ($)</option>
                <option value="PERCENT_CHANGE_DAILY">Daily % Change (±%)</option>
                <option value="NEW_SEC_FILING">New SEC Filing</option>
              </select>
            </div>

            {/* Conditional Threshold Input */}
            {alertType === 'NEW_SEC_FILING' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  SEC Form Type
                </label>
                <select
                  value={secFormType}
                  onChange={(e) => setSecFormType(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
                  disabled={creating}
                >
                  <option value="10-K">10-K (Annual Report)</option>
                  <option value="10-Q">10-Q (Quarterly Report)</option>
                  <option value="8-K">8-K (Current Material Event)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {alertType === 'PERCENT_CHANGE_DAILY'
                    ? 'Percentage Threshold (%)'
                    : 'Target Price ($)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder={
                    alertType === 'PERCENT_CHANGE_DAILY'
                      ? 'e.g. 5 (for ±5%)'
                      : 'e.g. 250.00'
                  }
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  disabled={creating}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition duration-200 shadow-md flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                  <span>Creating Alert...</span>
                </>
              ) : (
                <span>Create Alert</span>
              )}
            </button>
          </form>
        </div>

        {/* Configured Alerts List Container */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center justify-between">
            <span>Configured Stock Alerts</span>
            <span className="text-xs text-slate-400 font-normal">
              {alerts.length} {alerts.length === 1 ? 'Alert' : 'Alerts'}
            </span>
          </h2>

          {loading ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
              <span className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></span>
              <span className="text-xs">Loading market alerts...</span>
            </div>
          ) : alerts.length === 0 ? (
            /* Empty State */
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center space-y-4">
              <div className="text-4xl">🔔</div>
              <div>
                <h3 className="text-sm font-semibold text-white">No alerts configured yet</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Create an alert to get notified about price movements and new SEC filings over Telegram.
                </p>
              </div>
              <button
                onClick={focusCreateForm}
                className="bg-blue-600/20 text-blue-400 border border-blue-500/40 hover:bg-blue-600/30 px-4 py-2 rounded-lg text-xs font-semibold transition"
              >
                Create Your First Alert
              </button>
            </div>
          ) : (
            /* Active Alerts Grid */
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Left Side: Symbol & Condition Details */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <span className="text-base font-bold text-white tracking-wide">
                        ${alert.symbol}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                          alert.status === 'ACTIVE'
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                            : alert.status === 'TRIGGERED'
                            ? 'bg-amber-950/80 text-amber-400 border-amber-500/40'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700/50'
                        }`}
                      >
                        {alert.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 flex items-center space-x-2">
                      <span className="font-semibold text-blue-400">
                        {ALERT_TYPE_LABELS[alert.alertType] || alert.alertType}:
                      </span>
                      <span>
                        {alert.alertType === 'NEW_SEC_FILING'
                          ? `Form ${alert.secFormType}`
                          : alert.alertType === 'PERCENT_CHANGE_DAILY'
                          ? `±${alert.targetValue}%`
                          : `$${alert.targetValue?.toFixed(2)}`}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center space-x-3 pt-1">
                      <span>Created: {new Date(alert.createdAt).toLocaleDateString()}</span>
                      {alert.lastTriggeredAt && (
                        <span>
                          Triggered: {new Date(alert.lastTriggeredAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Action Controls */}
                  <div className="flex items-center space-x-2 border-t sm:border-t-0 border-slate-800/60 pt-3 sm:pt-0">
                    {/* Toggle Mute/Active Status */}
                    <button
                      disabled={updatingId === alert.id}
                      onClick={() =>
                        handleUpdateStatus(
                          alert.id,
                          alert.status === 'MUTED' ? 'ACTIVE' : 'MUTED',
                        )
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                        alert.status === 'MUTED'
                          ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30'
                          : 'bg-slate-800/60 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                      }`}
                    >
                      {updatingId === alert.id
                        ? 'Updating...'
                        : alert.status === 'MUTED'
                        ? 'Activate'
                        : 'Mute'}
                    </button>

                    {/* Delete Alert Button */}
                    <button
                      disabled={updatingId === alert.id}
                      onClick={() => setDeleteModalAlert(alert)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-950/40 text-rose-400 border border-rose-500/30 hover:bg-rose-900/50 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalAlert && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>⚠️</span> Delete Alert Confirmation
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete the alert for{' '}
              <strong className="text-white">${deleteModalAlert.symbol}</strong> (
              {ALERT_TYPE_LABELS[deleteModalAlert.alertType]}
              {deleteModalAlert.targetValue ? ` @ $${deleteModalAlert.targetValue}` : ''})?
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeleteModalAlert(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/60 rounded-lg border border-slate-700/60 transition"
              >
                Cancel
              </button>
              <button
                disabled={updatingId === deleteModalAlert.id}
                onClick={() => handleDeleteAlert(deleteModalAlert.id)}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-md transition"
              >
                {updatingId === deleteModalAlert.id ? 'Deleting...' : 'Delete Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
