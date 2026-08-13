import Link from 'next/link';
import {
  TrendingUp,
  MessageSquare,
  FileText,
  GitCompare,
  Files,
  Bell,
  Newspaper,
  Activity,
  ArrowRight,
  ShieldCheck,
  Send,
  Zap,
  Sparkles,
  BarChart3,
  Bot,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Shared Header Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
                Finora
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Financial Research
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard/monitor"
                className="hidden md:inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Monitor</span>
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition duration-200 shadow-lg shadow-blue-600/20 flex items-center space-x-2"
              >
                <span>Open Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-slate-900">
        <div className="absolute inset-0 bg-radial-gradient from-blue-900/10 via-transparent to-transparent opacity-60 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Finora Financial Platform</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-slate-100">
                Your Intelligent Financial Research Copilot
              </h1>

              <p className="text-slate-400 text-base md:text-lg leading-relaxed max-w-2xl">
                Research markets, analyze companies, track SEC filings, compare stocks, and receive AI-powered financial briefings — all in one workspace.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <Link
                  href="/dashboard"
                  className="px-6 py-3 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition duration-200 shadow-xl shadow-blue-600/25 flex items-center justify-center space-x-2"
                >
                  <span>Open Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#features"
                  className="px-6 py-3 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800/80 text-slate-300 border border-slate-800 transition duration-200 text-center"
                >
                  Explore Features
                </a>
              </div>
            </div>

            {/* Right Hero Column — Visual Representation */}
            <div className="lg:col-span-5">
              <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 shadow-2xl bg-slate-900/60 backdrop-blur-xl relative">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/80"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80"></div>
                    <span className="text-xs font-semibold text-slate-400 ml-2">Finora Intelligence Workspace</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Live Context
                  </span>
                </div>

                {/* Market Quote Stream Pill */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/60 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400">AAPL · Apple Inc</span>
                    <p className="text-sm font-bold text-emerald-400 flex items-center justify-between">
                      <span>$224.50</span>
                      <span className="text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">+2.4%</span>
                    </p>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/60 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400">MSFT · Microsoft</span>
                    <p className="text-sm font-bold text-emerald-400 flex items-center justify-between">
                      <span>$448.20</span>
                      <span className="text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">+1.8%</span>
                    </p>
                  </div>
                </div>

                {/* AI Assistant Insight Bubble */}
                <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-blue-400">
                    <Bot className="h-4 w-4" />
                    <span>Finora Financial Assistant</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Q2 revenue grew 14% YoY driven by cloud segments. Operating margin remains strong at 44.2%.
                  </p>
                </div>

                {/* Telegram & SEC Badge Strip */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <FileText className="h-3.5 w-3.5 text-indigo-400" />
                    <span>SEC 10-K Context</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-blue-400 font-medium">
                    <Send className="h-3.5 w-3.5" />
                    <span>Telegram Briefings</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust / Capability Strip */}
      <section className="py-8 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <TrendingUp className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">Market Intelligence</span>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <MessageSquare className="h-4 w-4 text-indigo-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">AI Research</span>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <FileText className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">SEC Intelligence</span>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <Newspaper className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">Automated Briefings</span>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 col-span-2 sm:col-span-1">
              <Send className="h-4 w-4 text-sky-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">Telegram Delivery</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
              Everything you need for smarter financial research
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              Unified analytical tools designed to streamline financial workflows and market analysis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature 1 */}
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 hover:border-slate-700 transition duration-200">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Market Intelligence</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Monitor market data and track the companies that matter to you.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 hover:border-slate-700 transition duration-200">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">AI Research</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ask questions and get AI-powered financial analysis in a contextual workspace.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 hover:border-slate-700 transition duration-200">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">SEC Intelligence</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Explore company filings and surface important regulatory information.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 hover:border-slate-700 transition duration-200">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Newspaper className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Automated Briefings</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Receive personalized market intelligence on your schedule, including Telegram delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How Atlas AI Works */}
      <section className="py-16 md:py-24 border-b border-slate-900 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
              How Finora Works
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              Simple 3-step financial intelligence flow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 relative">
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/80 border border-blue-500/30 px-3 py-1 rounded-full">
                01 — Research
              </span>
              <h3 className="text-base font-bold text-slate-100 pt-2">Identify & Investigate</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ask questions, explore markets, or investigate a company.
              </p>
            </div>

            {/* Step 2 */}
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 relative">
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-3 py-1 rounded-full">
                02 — Analyze
              </span>
              <h3 className="text-base font-bold text-slate-100 pt-2">Synthesize Insights</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Finora combines financial data, SEC filings, market context, and AI reasoning.
              </p>
            </div>

            {/* Step 3 */}
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 relative">
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full">
                03 — Stay Informed
              </span>
              <h3 className="text-base font-bold text-slate-100 pt-2">Automate Delivery</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track developments and receive personalized briefings and alerts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="py-16 md:py-24 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-card rounded-3xl p-8 md:p-12 border border-slate-800 text-center max-w-4xl mx-auto space-y-6 bg-gradient-to-b from-slate-900/80 to-slate-950">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-100">
              One workspace. Complete market intelligence.
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
              Finora brings real-time market overview, AI conversations, SEC filings, side-by-side stock comparisons, PDF document intelligence, real-time alerts, scheduled briefings, and infrastructure monitoring into a single unified workspace.
            </p>
            <div className="pt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center space-x-2 px-6 py-3 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition duration-200 shadow-xl shadow-blue-600/25"
              >
                <span>Enter Finora</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24 border-b border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100 max-w-2xl mx-auto">
            Build your financial intelligence workflow with Finora.
          </h2>
          <p className="text-slate-400 text-sm">
            Research faster. Understand more. Stay informed.
          </p>
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center space-x-2 px-8 py-3.5 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition duration-200 shadow-xl shadow-blue-600/25"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-12 bg-slate-950 text-xs text-slate-500 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-sm font-bold text-slate-200">Finora</span>
              <p className="text-slate-500">AI-powered financial intelligence.</p>
            </div>

            {/* Existing Route Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400 font-medium">
              <Link href="/dashboard" className="hover:text-slate-200 transition">
                Market
              </Link>
              <Link href="/dashboard/chat" className="hover:text-slate-200 transition">
                Chat
              </Link>
              <Link href="/dashboard/sec" className="hover:text-slate-200 transition">
                SEC
              </Link>
              <Link href="/dashboard/compare" className="hover:text-slate-200 transition">
                Compare
              </Link>
              <Link href="/dashboard/documents" className="hover:text-slate-200 transition">
                Docs
              </Link>
              <Link href="/dashboard/alerts" className="hover:text-slate-200 transition">
                Alerts
              </Link>
              <Link href="/dashboard/briefings" className="hover:text-slate-200 transition">
                Briefings
              </Link>
              <Link href="/dashboard/monitor" className="hover:text-slate-200 transition">
                Monitor
              </Link>
            </div>
          </div>

          <div className="text-center pt-4 border-t border-slate-900/60 text-[11px] text-slate-600">
            © 2026 Finora. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
