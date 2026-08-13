'use client';

import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface SessionExpiredProps {
  onRetry?: () => void;
  isModal?: boolean;
}

export default function SessionExpired({ onRetry, isModal = true }: SessionExpiredProps) {
  const handleSignInAgain = () => {
    if (onRetry) {
      onRetry();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const content = (
    <div className="glass-card rounded-2xl p-6 border border-amber-500/30 max-w-md w-full mx-auto space-y-5 text-center shadow-2xl backdrop-blur-xl">
      <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
        <ShieldAlert className="h-6 w-6" />
      </div>

      <div className="space-y-2">
        <h2 id="session-expired-title" className="text-xl font-bold tracking-tight text-slate-100">
          Session Expired
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Your session has expired. Please sign in again to continue using Finora.
        </p>
      </div>

      <div className="pt-2">
        <button
          onClick={handleSignInAgain}
          aria-label="Sign in again to restore session"
          className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition duration-200 shadow-md flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>Sign In Again</span>
        </button>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
      >
        {content}
      </div>
    );
  }

  return content;
}
