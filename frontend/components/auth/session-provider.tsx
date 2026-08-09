'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import SessionExpired from '@/components/auth/session-expired';

interface SessionContextType {
  isSessionExpired: boolean;
  triggerSessionExpired: () => void;
  resetSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const triggerSessionExpired = useCallback(() => {
    setIsSessionExpired(true);
  }, []);

  const resetSession = useCallback(() => {
    setIsSessionExpired(false);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    const handleUnauthorizedEvent = () => {
      triggerSessionExpired();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('atlas:unauthorized', handleUnauthorizedEvent);
      return () => {
        window.removeEventListener('atlas:unauthorized', handleUnauthorizedEvent);
      };
    }
  }, [triggerSessionExpired]);

  return (
    <SessionContext.Provider
      value={{ isSessionExpired, triggerSessionExpired, resetSession }}
    >
      {children}
      {isSessionExpired && <SessionExpired onRetry={resetSession} isModal={true} />}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
