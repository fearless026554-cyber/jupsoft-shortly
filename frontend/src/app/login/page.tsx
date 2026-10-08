'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { api, getAuthToken, setAuthToken, setStoredUser } from '../../api';
import { Lock, Mail, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const INITIAL_GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function LoginPage() {
  const router = useRouter();
  const [googleClientId, setGoogleClientId] = useState(INITIAL_GOOGLE_CLIENT_ID);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // If session expired or already authenticated, handle cleanly
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('expired=1')) {
      setInfo('Your session has expired. Please sign in again.');
    }

    // Check if redirected with Google OAuth authorization code in query
    if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        setGoogleLoading(true);
        api
          .googleLogin({
            code,
            redirectUri: 'https://go.jupsoft.com/dashboard',
          })
          .then((res) => {
            if (res.success && res.data?.token) {
              router.replace('/dashboard');
            } else {
              setError(res.error?.message || 'Failed to authenticate with Google code.');
            }
          })
          .catch((err) => {
            setError(err.message || 'Google OAuth callback error.');
          })
          .finally(() => {
            setGoogleLoading(false);
          });
      }
    }

    // Dynamically obtain Google Client ID from backend/environment
    if (!googleClientId) {
      fetch('/api/config')
        .then((r) => r.json())
        .then((cfg) => {
          if (cfg?.googleClientId) {
            setGoogleClientId(cfg.googleClientId);
          }
        })
        .catch(() => {});
    }

    const token = getAuthToken();
    if (token) {
      api.getMe().then((res) => {
        if (res && res.success) {
          router.replace('/dashboard');
        } else {
          setAuthToken(null);
          setStoredUser(null);
        }
      });
    }
  }, [router, googleClientId]);

  // Initialize Google Identity Services
  const initGoogleIdentity = () => {
    if (typeof window === 'undefined' || !googleClientId) return;
    const google = (window as any).google;
    if (!google?.accounts?.id) return;

    try {
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: any) => {
          if (response?.credential) {
            setGoogleLoading(true);
            setError(null);
            try {
              const res = await api.googleLogin({ credential: response.credential });
              if (res.success && res.data?.token) {
                router.replace('/dashboard');
              } else {
                setError(res.error?.message || 'Google authentication failed.');
              }
            } catch (err: any) {
              setError(err.message || 'Network error during Google sign-in.');
            } finally {
              setGoogleLoading(false);
            }
          }
        },
      });

      if (googleBtnContainerRef.current) {
        google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: 'filled_black',
          size: 'large',
          width: 320,
          text: 'continue_with',
          shape: 'rectangular',
        });
      }
    } catch (err) {
      console.warn('Google Identity initialization notice:', err);
    }
  };

  useEffect(() => {
    if (googleClientId) {
      initGoogleIdentity();
    }
  }, [googleClientId]);

  const handleGoogleRedirectFlow = () => {
    if (!googleClientId) {
      setError('Google login is not configured on this server.');
      return;
    }

    setGoogleLoading(true);
    setError(null);

    // If Google GIS is active, try prompt first
    const google = (window as any).google;
    if (google?.accounts?.id) {
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          redirectToOAuth();
        }
      });
    } else {
      redirectToOAuth();
    }
  };

  const redirectToOAuth = () => {
    if (!googleClientId) {
      setError('Google login is not configured on this server.');
      return;
    }
    const redirectUri = encodeURIComponent('https://go.jupsoft.com/dashboard');
    const scope = encodeURIComponent('openid email profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=select_account`;
    window.location.href = authUrl;
  };

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
        router.replace('/dashboard');
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
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initGoogleIdentity}
      />

      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-white rounded-xl mx-auto mb-3 flex items-center justify-center p-2 shadow-sm border border-slate-700/50">
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
          <p className="text-xs text-slate-400 mt-1">
            Enterprise Link Management Platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-6 shadow-xl">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">Sign in to your account</h2>
            <p className="text-xs text-slate-400 mt-0.5">Choose your preferred login method</p>
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

          {/* Google Sign-in Primary Button */}
          <div className="space-y-3">
            <button
              type="button"
              disabled={googleLoading || loading}
              onClick={handleGoogleRedirectFlow}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-2.5 border border-slate-200 cursor-pointer"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                  <span>Signing in with Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                </>
              )}
            </button>

            {/* Hidden container where official GIS button can attach seamlessly */}
            <div ref={googleBtnContainerRef} className="hidden" />
          </div>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700/80" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-slate-800 px-2 text-slate-400 tracking-wider">
                Or sign in with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
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

            {/* Password Field */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign in with Email'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-[11px] text-slate-500">
          &copy; {new Date().getFullYear()} Jupsoft Technologies. All rights reserved.
        </div>
      </div>
    </div>
  );
}
