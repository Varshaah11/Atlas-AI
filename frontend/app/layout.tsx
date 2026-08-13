import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/toast-provider';
import { SessionProvider } from '@/components/auth/session-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Finora - AI-Powered Financial Intelligence',
  description:
    'AI-powered Financial Assistant living inside Telegram and Web Dashboard.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
