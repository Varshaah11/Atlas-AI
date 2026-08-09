'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastItem = { id, type, message };

      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Global Toast Container */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-20 right-6 left-4 sm:left-auto sm:max-w-md z-50 space-y-3 pointer-events-none"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const getBadgeIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '⚠️';
      case 'warning':
        return '⚡';
      case 'info':
        return 'ℹ️';
    }
  };

  const getStyle = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 shadow-emerald-950/50';
      case 'error':
        return 'bg-rose-950/90 text-rose-300 border-rose-500/40 shadow-rose-950/50';
      case 'warning':
        return 'bg-amber-950/90 text-amber-300 border-amber-500/40 shadow-amber-950/50';
      case 'info':
        return 'bg-blue-950/90 text-blue-300 border-blue-500/40 shadow-blue-950/50';
    }
  };

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl flex items-center justify-between space-x-3 transition-all duration-300 ${getStyle(
        toast.type,
      )}`}
    >
      <div className="flex items-center space-x-3">
        <span className="text-base select-none">{getBadgeIcon(toast.type)}</span>
        <span className="text-xs font-semibold leading-relaxed">{toast.message}</span>
      </div>
      <button
        onClick={onClose}
        aria-label="Close notification"
        className="text-slate-400 hover:text-slate-100 text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-800/50 transition focus:outline-none focus:ring-1 focus:ring-slate-400 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
