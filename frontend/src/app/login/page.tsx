'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, getAuthToken } from '../../api';
import { Lock, Mail, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // If already authenticated, redirect to home
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      api.getMe().then((res) => {
        if (res && res.success) {
          router.replace('/');
        }
      });
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await api.login(email.trim(), password);
      if (res.success && res.data?.token) {
        router.replace('/');
      } else {
        setError(res.error?.message || 'Invalid credentials. Please verify your email and password.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred while attempting login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 select-none">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-white rounded-xl mx-auto mb-4 flex items-center justify-center p-2 shadow-sm border border-slate-700/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/jupsoft-logo.png"
              alt="Jupsoft Shortly"
              className="w-full h-full object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            Jupsoft Shortly
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">
            Enterprise Link Management Platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-6 shadow-xl">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-white">Sign in to your account</h2>
            <p className="text-xs text-slate-400 mt-0.5">Enter your Super Admin credentials to continue</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Info Alert */}
          {info && (
            <div className="mb-4 p-3 rounded-lg bg-blue-950/80 border border-blue-800 text-blue-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field with Natural Case Label */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="sachin@jupsoft.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            {/* Password Field with Natural Case Label */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Clean Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-sm transition cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Clean, Subtle Footer */}
        <div className="mt-8 text-center text-[11px] text-slate-500">
          &copy; {new Date().getFullYear()} Jupsoft Technologies. All rights reserved.
        </div>
      </div>
    </div>
  );
}
