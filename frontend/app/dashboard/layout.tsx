'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { label: '📈 Market Overview', href: '/dashboard' },
    { label: '💬 Financial AI Chat', href: '/dashboard/chat' },
    { label: '📄 SEC Filings', href: '/dashboard/sec' },
    { label: '⚖️ Stock Comparison', href: '/dashboard/compare' },
    { label: '📁 Documents', href: '/dashboard/documents' },
    { label: '🔔 Alerts', href: '/dashboard/alerts' },
    { label: '📰 Briefings', href: '/dashboard/briefings' },
    { label: '🖥️ System Monitor', href: '/' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Shared Dashboard Header & Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo & Title */}
            <div className="flex items-center space-x-3">
              <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse"></span>
              <Link href="/dashboard" className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
                Atlas AI Dashboard
              </Link>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Mobile Navigation Scrollbar */}
          <div className="md:hidden flex items-center space-x-2 overflow-x-auto pb-3 pt-1 scrollbar-none">
            {navItems.map((item) => {
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition duration-200 ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Page Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {children}
      </main>
    </div>
  );
}
