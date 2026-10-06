'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  QrCode,
  Layers,
  Zap,
  CheckCircle2,
  ArrowRight,
  Lock,
  Server,
  Sparkles,
  Globe,
  FileText,
  BarChart3,
  Smartphone,
  ExternalLink,
  Shield,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';

interface LandingPageViewProps {
  onLoginClick?: () => void;
}

export function LandingPageView({ onLoginClick }: LandingPageViewProps) {
  const router = useRouter();
  const [copiedLink, setCopiedLink] = useState(false);

  const navigateToLogin = () => {
    if (onLoginClick) {
      onLoginClick();
    } else {
      router.push('/login');
    }
  };

  const copyDemoLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText('https://jup.st/fee-may26');
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* 1. Global Sticky Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center p-1.5 shadow-xs border border-slate-700/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jupsoft-logo.png" alt="Jupsoft Shortly" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">Jupsoft Shortly</span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium bg-blue-900/60 text-blue-300 border border-blue-700/50 rounded-sm">
                JLMP MVP
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Communication & Attribution Engine</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <a href="#attribution" className="hover:text-blue-400 transition">
            Attribution
          </a>
          <a href="#features" className="hover:text-blue-400 transition">
            Features
          </a>
          <a href="#compliance" className="hover:text-blue-400 transition">
            DLT & SMS
          </a>
          <a href="#comparison" className="hover:text-blue-400 transition">
            Why Shortly
          </a>
          <a href="#api" className="hover:text-blue-400 transition">
            API
          </a>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={navigateToLogin}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-900 rounded-lg shadow-sm transition border border-slate-200 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="hidden sm:inline">Continue with Google</span>
            <span className="sm:hidden">Google</span>
          </button>

          <button
            onClick={navigateToLogin}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition cursor-pointer"
          >
            <span>Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-8 max-w-6xl mx-auto w-full text-center overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

        {/* Product Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800 text-blue-300 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>TRAI DLT Whitelisted & Click-to-Outcome Engine</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
          Turn Every Link into a Trusted Touchpoint and a{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
            Measurable Business Outcome.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          The communication and attribution platform designed for{' '}
          <span className="text-white font-medium">Jupsoft eConnect ERP</span>,{' '}
          <span className="text-white font-medium">Admission CRM</span>, and bulk SMS dispatch. Replace untrusted generic
          shorteners, slash SMS character costs, and connect every click to fees paid and admissions confirmed.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={navigateToLogin}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-lg shadow-blue-900/40 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Launch Management Console</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={navigateToLogin}
            className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs sm:text-sm rounded-lg shadow-sm transition flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In with Google</span>
          </button>
        </div>

        {/* 3. Interactive Hero Preview Card (Attribution Visual) */}
        <div className="mt-12 text-left max-w-4xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div>
                <span className="text-xs font-semibold text-white">Live Attribution Active</span>
                <span className="text-[10px] text-slate-400 block">St. Xavier’s Academy · Fee Reminders 2026</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyDemoLink}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink ? 'Copied' : 'Copy Sample Link'}</span>
              </button>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-950/70 text-emerald-300 border border-emerald-800 rounded">
                DLT Verified
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
            {/* Box 1: Short Link Details */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-medium mb-1">Branded Short URL</div>
              <div className="font-mono text-sm text-blue-400 font-bold truncate">https://jup.st/fee-may26</div>
              <div className="text-[10px] text-slate-400 mt-2 truncate">
                Target: econnect.jupsoft.com/fees/pay?inv=9821
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span>Google Safe Browsing Verified</span>
              </div>
            </div>

            {/* Box 2: Engagement Breakdown */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-medium mb-1">Total Verified Clicks</div>
              <div className="text-2xl font-bold text-white">1,420</div>
              <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
                <span>Unique: 1,288</span>
                <span className="text-blue-400">96.4% Mobile</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-blue-500 h-full w-[96%]" />
              </div>
            </div>

            {/* Box 3: Attributed Business Outcome (The Differentiator) */}
            <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 p-4 rounded-xl border border-emerald-800/60">
              <div className="text-[11px] text-emerald-400 font-medium mb-1 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Attributed Fee Collection</span>
              </div>
              <div className="text-2xl font-extrabold text-white">₹52,40,000</div>
              <div className="mt-2 text-[10px] text-slate-300 flex justify-between">
                <span>Invoices Settled: 342</span>
                <span className="text-emerald-400 font-bold">24.1% Conv. Rate</span>
              </div>
              <div className="text-[10px] text-emerald-400/90 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Synchronized via ERP Outcome Hook</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Trust & Compliance Highlights Bar */}
      <section id="compliance" className="border-y border-slate-800 bg-slate-900/50 py-8 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">&lt; 50 ms</div>
            <div className="text-xs text-slate-400 mt-1">In-Memory Redis Redirects</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-blue-400 font-mono">100%</div>
            <div className="text-xs text-slate-400 mt-1">TRAI DLT SMS Compliant</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">40% Savings</div>
            <div className="text-xs text-slate-400 mt-1">160-Char SMS Boundary</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-indigo-400 font-mono">10,000+</div>
            <div className="text-xs text-slate-400 mt-1">Async Bulk Batch Size</div>
          </div>
        </div>
      </section>

      {/* 5. Generic Shorteners vs Shortly Comparison */}
      <section id="comparison" className="py-20 px-4 sm:px-8 max-w-6xl mx-auto w-full">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Why Generic Shorteners Fail for Enterprise Communication
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
            Bitly, Short.io and open-source tools compete on link shortening. Shortly is engineered to connect clicks to real
            institutional action.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Third-party Shorteners */}
          <div className="bg-slate-900/60 border border-red-900/40 rounded-2xl p-6 sm:p-8">
            <div className="text-red-400 font-semibold text-xs tracking-wider uppercase mb-2">
              Third-Party Tools (Bitly / TinyURL)
            </div>
            <h3 className="text-lg font-bold text-white mb-4">Dead-End Vanity Links</h3>
            <ul className="space-y-3.5 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="text-red-400 font-bold shrink-0">✕</span>
                <span>Parents and students treat bit.ly links as phishing scams.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-400 font-bold shrink-0">✕</span>
                <span>Long links push SMS past 160 characters, doubling telecommunication costs.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-400 font-bold shrink-0">✕</span>
                <span>Cannot be whitelisted under strict TRAI DLT commercial SMS guidelines in India.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-400 font-bold shrink-0">✕</span>
                <span>Zero attribution: Cannot tell if a fee reminder produced a bank payment.</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Jupsoft Shortly (JLMP) */}
          <div className="bg-blue-950/20 border border-blue-800/80 rounded-2xl p-6 sm:p-8 relative">
            <div className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
              BUILT FOR RESULTS
            </div>
            <div className="text-blue-400 font-semibold text-xs tracking-wider uppercase mb-2">
              Jupsoft Shortly (JLMP)
            </div>
            <h3 className="text-lg font-bold text-white mb-4">Action-Oriented Attribution Layer</h3>
            <ul className="space-y-3.5 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>100% Institutional Trust:</strong> Custom subdomains and verified sender identities.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>SMS Cost Optimization:</strong> Ultra-short 6-char codes preserve SMS character budgets.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>DLT Compliant:</strong> Dedicated pre-whitelisted routing prevents carrier message blocking.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Click-to-Outcome Engine:</strong> Tracks fees paid, inquiries raised, and admissions confirmed.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 6. Four Core Architecture Pillars */}
      <section id="features" className="py-16 px-4 sm:px-8 max-w-6xl mx-auto w-full border-t border-slate-900">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Four Core Pillars Built for Enterprise Scale
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-slate-400">
            From bulk dispatch to dynamic vector QR codes, everything you need is ready in one console.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pillar 1 */}
          <div id="attribution" className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-blue-600/60 transition">
            <div className="w-10 h-10 rounded-lg bg-blue-900/40 border border-blue-700/60 flex items-center justify-center text-blue-400 mb-4">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Outcome Attribution</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Attach external invoice IDs or admission leads to your links. Receive webhooks when conversions occur.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-blue-600/60 transition">
            <div className="w-10 h-10 rounded-lg bg-emerald-900/40 border border-emerald-700/60 flex items-center justify-center text-emerald-400 mb-4">
              <QrCode className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Dynamic QR Studio</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Generate print-ready vector SVG and high-resolution PNG QR codes. Change destination anytime without reprinting.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-blue-600/60 transition">
            <div className="w-10 h-10 rounded-lg bg-indigo-900/40 border border-indigo-700/60 flex items-center justify-center text-indigo-400 mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Bulk Dispatch Studio</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload CSV batches or push up to 10,000 links through our background queue. Real-time progress monitoring.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-blue-600/60 transition">
            <div className="w-10 h-10 rounded-lg bg-sky-900/40 border border-sky-700/60 flex items-center justify-center text-sky-400 mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Safe Browsing Screening</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated anti-phishing inspection for every submitted URL. Public abuse takedown console with Super Admin reviews.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Institutional Solutions */}
      <section className="py-16 px-4 sm:px-8 max-w-6xl mx-auto w-full">
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 rounded-2xl p-6 sm:p-10">
          <div className="max-w-2xl">
            <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Ecosystem Ready</span>
            <h3 className="text-xl sm:text-3xl font-bold text-white mt-2">
              Built for eConnect ERP, Admissions & DigifyNext Campaigns
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-3 leading-relaxed">
              Whether you are sending fee reminders to 20,000 parents, printing admission banners with dynamic QR codes,
              or tracking marketing campaigns across channels, Shortly connects communication to tangible business metrics.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-800/80">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-white">Fee Reminders</div>
                <div className="text-[11px] text-slate-400">Direct link to student payment gateway</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-white">Admission Circulars</div>
                <div className="text-[11px] text-slate-400">Track inquiries from print and digital ads</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-white">Attendance Alerts</div>
                <div className="text-[11px] text-slate-400">Instant parent portal verification</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Developer & API Section */}
      <section id="api" className="py-16 px-4 sm:px-8 max-w-6xl mx-auto w-full border-t border-slate-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Developer First</span>
            <h3 className="text-2xl sm:text-3xl font-bold text-white mt-2">
              Robust REST API & Scoped Token Architecture
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-3 leading-relaxed">
              Every operation available on the console can be executed via our high-throughput REST API. Authenticate
              using scoped API keys with per-key rate limiting and idempotency protection.
            </p>

            <div className="mt-6 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Idempotent requests prevent duplicate link generation</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Scoped tokens: links:read, links:write, analytics:read</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>PostgreSQL 16 partitioned storage with Row-Level Security</span>
              </div>
            </div>
          </div>

          {/* Code preview block */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 font-mono text-xs overflow-x-auto shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[11px] text-slate-400">
              <span>POST /api/v1/links</span>
              <span className="text-emerald-400">201 Created</span>
            </div>
            <pre className="text-slate-300 mt-3 overflow-x-auto">
{`curl -X POST https://api.jupsoft.com/v1/links \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "destinationUrl": "https://school.edu/fee/pay?id=8210",
    "alias": "term2-fee",
    "externalRef": "inv_8210",
    "redirectType": "302"
  }'

# Response:
{
  "success": true,
  "data": {
    "shortUrl": "https://jup.st/term2-fee",
    "shortCode": "t2fee",
    "qrCode": "https://api.jupsoft.com/v1/links/t2fee/qr"
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="py-20 px-4 sm:px-8 max-w-4xl mx-auto w-full text-center">
        <div className="bg-gradient-to-b from-blue-950/60 to-slate-900 border border-blue-800/60 rounded-3xl p-8 sm:p-12 shadow-2xl">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to Make Every Link a Measurable Outcome?
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
            Log in to the Jupsoft Shortly console to create branded short links, generate dynamic QR codes, and view real-time attribution reports.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={navigateToLogin}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Access Management Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={navigateToLogin}
              className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs sm:text-sm rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
      </section>

      {/* 10. Global Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-10 px-4 sm:px-8 text-slate-500 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 bg-white rounded flex items-center justify-center p-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/jupsoft-logo.png" alt="Jupsoft" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-slate-400">Jupsoft Shortly (JLMP)</span>
            <span>· Enterprise Communication Layer</span>
          </div>

          <div className="flex items-center gap-5 text-slate-400">
            <button onClick={navigateToLogin} className="hover:text-white transition">
              Console Sign In
            </button>
            <a href="#compliance" className="hover:text-white transition">
              DLT Compliance
            </a>
            <a href="#api" className="hover:text-white transition">
              API Docs
            </a>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-slate-900 text-center text-[11px] text-slate-600">
          &copy; {new Date().getFullYear()} Jupsoft Technologies. All rights reserved. Platform Version 1.0 (MVP).
        </div>
      </footer>
    </div>
  );
}
