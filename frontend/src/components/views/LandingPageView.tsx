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
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 flex flex-col selection:bg-blue-200 selection:text-blue-900 relative overflow-x-hidden">
      {/* Dynamic Ambient Background Orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-300/40 blur-[120px] mix-blend-multiply" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-200/40 blur-[150px] mix-blend-multiply" />
        <div className="absolute top-[30%] left-[40%] w-[40vw] h-[40vw] rounded-full bg-emerald-200/30 blur-[130px] mix-blend-multiply" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* 1. Global Sticky Navigation (Glassmorphic Light) */}
        <nav className="sticky top-0 z-50 bg-white/50 backdrop-blur-2xl border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white backdrop-blur-md rounded-xl flex items-center justify-center p-1.5 border border-slate-200 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/jupsoft-logo.png" alt="Jupsoft Shortly" className="w-full h-full object-contain filter drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-slate-900">Jupsoft Shortly</span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                  JLMP MVP
                </span>
              </div>
              <p className="text-[10px] text-slate-500 hidden sm:block">Communication & Attribution Engine</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-600">
            <a href="#attribution" className="hover:text-blue-600 transition-colors">Attribution</a>
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#compliance" className="hover:text-blue-600 transition-colors">DLT & SMS</a>
            <a href="#comparison" className="hover:text-blue-600 transition-colors">Why Shortly</a>
            <a href="#api" className="hover:text-blue-600 transition-colors">API</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={navigateToLogin}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition border border-slate-200 shadow-sm cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span className="hidden sm:inline">Google</span>
            </button>

            <button
              onClick={navigateToLogin}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-[0_4px_14px_0_rgba(15,23,42,0.39)] transition cursor-pointer"
            >
              <span>Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </nav>

        {/* 2. Hero Section (Light Glassmorphic) */}
        <section className="relative pt-24 pb-20 px-4 sm:px-8 max-w-6xl mx-auto w-full text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-slate-200/80 text-[11px] font-semibold mb-8 backdrop-blur-md shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">TRAI DLT Whitelisted & Click-to-Outcome Engine</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 max-w-5xl mx-auto leading-[1.1]">
            Turn Every Link into a Trusted Touchpoint and a{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 drop-shadow-sm">
              Measurable Outcome.
            </span>
          </h1>

          <p className="mt-8 text-sm sm:text-base text-slate-600 max-w-3xl mx-auto leading-relaxed font-medium">
            The communication and attribution platform designed for{' '}
            <span className="text-slate-900 font-semibold">Jupsoft eConnect ERP</span>,{' '}
            <span className="text-slate-900 font-semibold">Admission CRM</span>, and bulk SMS dispatch. Replace untrusted generic
            shorteners, slash SMS character costs, and connect every click to fees paid and admissions confirmed.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={navigateToLogin}
              className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-[0_8px_30px_rgba(37,99,235,0.3)] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Launch Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={navigateToLogin}
              className="w-full sm:w-auto px-7 py-3.5 bg-white/60 hover:bg-white text-slate-900 border border-slate-200/80 backdrop-blur-xl font-semibold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
            >
              <span>Book a Demo</span>
            </button>
          </div>

          {/* 3. Interactive Hero Preview Card (Light Glassmorphic) */}
          <div className="mt-16 text-left max-w-4xl mx-auto bg-white/40 border border-white/80 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-1 sm:p-2 backdrop-blur-2xl relative group">
            <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-transparent rounded-3xl pointer-events-none" />
            <div className="bg-white/80 rounded-2xl p-5 sm:p-7 relative border border-white/90 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 tracking-wide">Live Attribution Active</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">St. Xavier’s Academy · Fee Reminders 2026</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={copyDemoLink}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 transition shadow-sm font-semibold"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy Demo Link'}</span>
                  </button>
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg shadow-sm">
                    DLT Verified
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                {/* Box 1: Short Link Details */}
                <div className="bg-white/60 p-5 rounded-2xl border border-white/80 backdrop-blur-sm relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/50 blur-[30px] rounded-full" />
                  <div className="text-[11px] text-slate-500 uppercase tracking-wider font-bold mb-2 relative">Branded Short URL</div>
                  <div className="font-mono text-sm text-blue-700 font-bold truncate relative">https://jup.st/fee-may26</div>
                  <div className="text-[10px] text-slate-500 mt-3 truncate relative font-medium">
                    Target: econnect.jupsoft.com/fees/pay?inv=9821
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[10px] text-emerald-600 font-bold relative">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Google Safe Browsing Verified</span>
                  </div>
                </div>

                {/* Box 2: Engagement Breakdown */}
                <div className="bg-white/60 p-5 rounded-2xl border border-white/80 backdrop-blur-sm relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-100/50 blur-[30px] rounded-full" />
                  <div className="text-[11px] text-slate-500 uppercase tracking-wider font-bold mb-2 relative">Verified Clicks</div>
                  <div className="text-3xl font-extrabold text-slate-900 relative">1,420</div>
                  <div className="mt-3 text-[10px] text-slate-600 flex justify-between relative font-medium">
                    <span>Unique: 1,288</span>
                    <span className="text-indigo-600 font-bold">96.4% Mobile</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden relative shadow-inner">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full w-[96%]" />
                  </div>
                </div>

                {/* Box 3: Attributed Business Outcome (The Differentiator) */}
                <div className="bg-gradient-to-br from-emerald-50/80 to-emerald-100/30 p-5 rounded-2xl border border-emerald-200/60 backdrop-blur-md relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200/40 blur-[30px] rounded-full" />
                  <div className="text-[11px] text-emerald-700 uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5 relative">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Attributed Fees</span>
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-900 relative">₹52,40,000</div>
                  <div className="mt-3 text-[10px] text-slate-600 flex justify-between relative font-medium">
                    <span>Invoices Settled: 342</span>
                    <span className="text-emerald-700 font-bold">24.1% Conv.</span>
                  </div>
                  <div className="text-[10px] text-emerald-800 font-semibold mt-2.5 flex items-center gap-1.5 relative bg-white/60 w-fit px-2 py-1 rounded-md border border-emerald-200 shadow-sm backdrop-blur-sm">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>ERP Webhook Synced</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Trust & Compliance Highlights Bar */}
        <section id="compliance" className="py-10 px-4 sm:px-8">
          <div className="max-w-6xl mx-auto bg-white/50 border border-slate-200/80 rounded-3xl p-8 backdrop-blur-xl shadow-lg shadow-slate-200/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-slate-200/60">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 font-mono">&lt; 50 ms</div>
                <div className="text-xs text-slate-500 mt-2 uppercase tracking-wide font-bold">In-Memory Redis</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 font-mono">100%</div>
                <div className="text-xs text-slate-500 mt-2 uppercase tracking-wide font-bold">TRAI DLT Compliant</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono">40% Savings</div>
                <div className="text-xs text-slate-500 mt-2 uppercase tracking-wide font-bold">160-Char Boundary</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600 font-mono">10k+</div>
                <div className="text-xs text-slate-500 mt-2 uppercase tracking-wide font-bold">Async Bulk Batch</div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Generic Shorteners vs Shortly Comparison */}
        <section id="comparison" className="py-24 px-4 sm:px-8 max-w-6xl mx-auto w-full relative">
          <div className="text-center mb-16 relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
              Why Generic Shorteners Fail
            </h2>
            <p className="mt-4 text-sm text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
              Bitly, Short.io and open-source tools compete on link shortening. Shortly is engineered to connect clicks to real
              institutional action.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
            {/* Card 1: Third-party Shorteners */}
            <div className="bg-white/60 border border-red-100 rounded-3xl p-8 sm:p-10 backdrop-blur-xl relative overflow-hidden group hover:bg-white/80 transition-all duration-500 shadow-sm hover:shadow-md">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-100/50 blur-[40px] rounded-full group-hover:bg-red-200/50 transition-all duration-500" />
              <div className="text-red-600 font-bold text-[10px] tracking-widest uppercase mb-3 relative">
                Third-Party Tools (Bitly / TinyURL)
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-6 relative">Dead-End Vanity Links</h3>
              <ul className="space-y-4 text-xs sm:text-sm text-slate-700 relative font-medium">
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5 text-base">✕</span>
                  <span className="leading-relaxed">Parents and students treat external links as phishing scams.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5 text-base">✕</span>
                  <span className="leading-relaxed">Long domains push SMS past 160 characters, doubling costs.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5 text-base">✕</span>
                  <span className="leading-relaxed">Cannot be whitelisted under strict TRAI DLT commercial guidelines.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5 text-base">✕</span>
                  <span className="leading-relaxed">Zero attribution: Cannot tell if a reminder produced a payment.</span>
                </li>
              </ul>
            </div>

            {/* Card 2: Jupsoft Shortly (JLMP) */}
            <div className="bg-gradient-to-br from-blue-50/90 to-indigo-50/50 border border-blue-200 rounded-3xl p-8 sm:p-10 backdrop-blur-xl relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] group hover:shadow-[0_8px_40px_rgb(37,99,235,0.1)] transition-all duration-500">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-200/50 blur-[50px] rounded-full group-hover:bg-blue-300/40 transition-all duration-500" />
              <div className="absolute top-6 right-6 bg-white/80 text-blue-700 border border-blue-200 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-md shadow-sm">
                Built For Results
              </div>
              <div className="text-blue-600 font-bold text-[10px] tracking-widest uppercase mb-3 relative">
                Jupsoft Shortly (JLMP)
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-6 relative">Action-Oriented Attribution Layer</h3>
              <ul className="space-y-4 text-xs sm:text-sm text-slate-700 relative font-medium">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="leading-relaxed">
                    <strong className="text-slate-900 font-bold">100% Institutional Trust:</strong> Custom subdomains and verified sender identities.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="leading-relaxed">
                    <strong className="text-slate-900 font-bold">SMS Cost Optimization:</strong> Ultra-short 6-char codes preserve character budgets.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="leading-relaxed">
                    <strong className="text-slate-900 font-bold">DLT Compliant:</strong> Dedicated pre-whitelisted routing prevents carrier blocks.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="leading-relaxed">
                    <strong className="text-slate-900 font-bold">Click-to-Outcome Engine:</strong> Tracks fees paid, inquiries raised, and admissions.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 6. Four Core Architecture Pillars */}
        <section id="features" className="py-24 px-4 sm:px-8 max-w-6xl mx-auto w-full relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-white/30 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="text-center mb-16 relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
              Enterprise Scale Architecture
            </h2>
            <p className="mt-4 text-sm text-slate-600 max-w-2xl mx-auto font-medium">
              From bulk dispatch to dynamic vector QR codes, everything you need is ready in one console.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            {/* Pillar 1 */}
            <div className="bg-white/60 border border-slate-200/80 rounded-3xl p-7 hover:bg-white/90 hover:border-blue-300 transition-all duration-300 backdrop-blur-xl shadow-sm hover:shadow-md group">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-3">Outcome Attribution</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Attach external invoice IDs or admission leads to your links. Receive webhooks when conversions occur.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white/60 border border-slate-200/80 rounded-3xl p-7 hover:bg-white/90 hover:border-emerald-300 transition-all duration-300 backdrop-blur-xl shadow-sm hover:shadow-md group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-5 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-sm">
                <QrCode className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-3">Dynamic QR Studio</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Generate print-ready vector SVG and high-resolution PNG QR codes. Change destination anytime without reprinting.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white/60 border border-slate-200/80 rounded-3xl p-7 hover:bg-white/90 hover:border-indigo-300 transition-all duration-300 backdrop-blur-xl shadow-sm hover:shadow-md group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-5 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-3">Bulk Dispatch Studio</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Upload CSV batches or push up to 10,000 links through our background queue. Real-time progress monitoring.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="bg-white/60 border border-slate-200/80 rounded-3xl p-7 hover:bg-white/90 hover:border-sky-300 transition-all duration-300 backdrop-blur-xl shadow-sm hover:shadow-md group">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 mb-5 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white transition-all duration-300 shadow-sm">
                <Shield className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-3">Safe Browsing</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Automated anti-phishing inspection for every submitted URL. Public abuse takedown console with Super Admin reviews.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Developer & API Section */}
        <section id="api" className="py-24 px-4 sm:px-8 max-w-6xl mx-auto w-full">
          <div className="bg-white/50 border border-slate-200/80 rounded-[40px] p-8 md:p-12 backdrop-blur-2xl shadow-xl shadow-slate-200/50 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-200/50 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200 text-blue-700 text-[10px] font-extrabold uppercase tracking-widest mb-6 backdrop-blur-md shadow-sm">
                  Developer First
                </span>
                <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-5 leading-tight">
                  Robust REST API &<br />Scoped Architecture
                </h3>
                <p className="text-sm text-slate-600 font-medium leading-relaxed mb-8">
                  Every operation available on the console can be executed via our high-throughput REST API. Authenticate
                  using scoped API keys with per-key rate limiting and idempotency protection.
                </p>

                <div className="space-y-4 text-sm text-slate-700 font-semibold">
                  <div className="flex items-center gap-3 bg-white/80 p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                      <Check className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span>Idempotent requests prevent duplicate link generation</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/80 p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                      <Check className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span>Scoped tokens: links:read, links:write, analytics:read</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/80 p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                      <Check className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span>PostgreSQL 16 partitioned storage with RLS</span>
                  </div>
                </div>
              </div>

              {/* Code preview block (Kept Dark for contrast) */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 font-mono text-[11px] sm:text-xs overflow-x-auto shadow-2xl relative group">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800 text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                    </div>
                    <span className="ml-2 opacity-70">POST /api/v1/links</span>
                  </div>
                  <span className="text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-900/50 font-bold">201 Created</span>
                </div>
                <pre className="text-slate-300 overflow-x-auto custom-scrollbar leading-relaxed">
<span className="text-pink-400">curl</span> -X POST https://api.jupsoft.com/v1/links \
  -H <span className="text-green-300">"Authorization: Bearer &lt;API_KEY&gt;"</span> \
  -H <span className="text-green-300">"Content-Type: application/json"</span> \
  -d <span className="text-yellow-300">'{'{'}
    "destinationUrl": "https://school.edu/fee/pay?id=8210",
    "alias": "term2-fee",
    "externalRef": "inv_8210",
    "redirectType": "302"
  {'}'}'</span>

<span className="text-slate-500"># Response:</span>
{'{'}
  <span className="text-blue-300">"success"</span>: <span className="text-purple-400">true</span>,
  <span className="text-blue-300">"data"</span>: {'{'}
    <span className="text-blue-300">"shortUrl"</span>: <span className="text-green-300">"https://jup.st/term2-fee"</span>,
    <span className="text-blue-300">"shortCode"</span>: <span className="text-green-300">"t2fee"</span>,
    <span className="text-blue-300">"qrCode"</span>: <span className="text-green-300">"https://api.jupsoft.com/v1/links/t2fee/qr"</span>
  {'}'}
{'}'}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Final CTA */}
        <section className="py-24 px-4 sm:px-8 max-w-5xl mx-auto w-full text-center relative z-10">
          <div className="bg-gradient-to-b from-blue-50/80 to-white border border-blue-100 rounded-[40px] p-10 sm:p-16 shadow-[0_8px_40px_rgba(37,99,235,0.08)] backdrop-blur-2xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-blue-200/30 blur-[80px] rounded-full pointer-events-none" />
            
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight relative z-10">
              Ready to Make Every Link a<br/>Measurable Outcome?
            </h2>
            <p className="mt-6 text-sm text-slate-600 max-w-xl mx-auto font-medium leading-relaxed relative z-10">
              Log in to the Jupsoft Shortly console to create branded short links, generate dynamic QR codes, and view real-time attribution reports.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
              <button
                onClick={navigateToLogin}
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-[0_8px_20px_rgba(37,99,235,0.25)] transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Access Console</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* 9. Global Footer (Glassmorphic Light) */}
        <footer className="mt-auto border-t border-slate-200 bg-white/50 backdrop-blur-2xl py-12 px-4 sm:px-8 text-slate-500 text-xs relative z-10">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center p-1.5 border border-slate-200 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/jupsoft-logo.png" alt="Jupsoft" className="w-full h-full object-contain filter drop-shadow-sm" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="font-bold text-slate-800">Jupsoft Shortly (JLMP)</span>
                <span className="hidden sm:inline text-slate-300">·</span>
                <span className="font-medium text-slate-600">Enterprise Communication Layer</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-slate-500 font-medium">
              <button onClick={navigateToLogin} className="hover:text-blue-600 transition-colors">Console</button>
              <a href="#compliance" className="hover:text-blue-600 transition-colors">DLT Compliance</a>
              <a href="#api" className="hover:text-blue-600 transition-colors">API Docs</a>
              <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
            </div>
          </div>

          <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-slate-200 text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            &copy; {new Date().getFullYear()} Jupsoft Technologies. All rights reserved. Platform Version 1.0 (MVP).
          </div>
        </footer>
      </div>
    </div>
  );
}
