'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, getAuthToken } from '../../api';
import { Lock, Mail, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [gsiRendered, setGsiRendered] = useState(false);

  const handleGoogleLoginCredential = useCallback(
    async (credential: string, nonce?: string) => {
      setGoogleLoading(true);
      setError(null);
      setInfo('Authenticating with Google...');

      try {
        const res = await api.googleLogin({ credential, nonce });
        if (res.success && res.data?.token) {
          router.replace('/');
        } else {
          setError(res.error?.message || 'Google authentication failed');
          setInfo(null);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to authenticate with Google');
        setInfo(null);
      } finally {
        setGoogleLoading(false);
      }
    },
    [router]
  );

  const handleGoogleLoginCode = useCallback(
    async (code: string, state?: string, nonce?: string) => {
      setGoogleLoading(true);
      setError(null);
      setInfo('Exchanging Google authorization code...');

      try {
        const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/login` : '';
        const res = await api.googleLogin({ code, redirectUri, state, nonce });
        if (res.success && res.data?.token) {
          router.replace('/');
        } else {
          setError(res.error?.message || 'Google authorization failed');
          setInfo(null);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to authenticate with Google');
        setInfo(null);
      } finally {
        setGoogleLoading(false);
      }
    },
    [router]
  );

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

  // Load Google Auth Config & Handle OAuth Callback
  useEffect(() => {
    // 1. Check for OAuth callback in URL hash or query params
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      const idTokenFromHash = hashParams.get('id_token');

      const searchParams = new URLSearchParams(window.location.search);
      const codeFromQuery = searchParams.get('code');
      const credentialFromQuery = searchParams.get('credential');
      const stateFromQuery = searchParams.get('state') || hashParams.get('state');

      // State parameter CSRF protection
      const expectedState = sessionStorage.getItem('oauth_state');
      const savedNonce = sessionStorage.getItem('oauth_nonce') || undefined;

      if (idTokenFromHash || credentialFromQuery || codeFromQuery) {
        if (stateFromQuery && expectedState && stateFromQuery !== expectedState) {
          setError('OAuth state verification failed. Possible CSRF attack detected.');
          sessionStorage.removeItem('oauth_state');
          sessionStorage.removeItem('oauth_nonce');
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('oauth_nonce');
      }

      if (idTokenFromHash || credentialFromQuery) {
        window.history.replaceState(null, '', window.location.pathname);
        handleGoogleLoginCredential((idTokenFromHash || credentialFromQuery)!, savedNonce);
        return;
      }

      if (codeFromQuery) {
        window.history.replaceState(null, '', window.location.pathname);
        handleGoogleLoginCode(codeFromQuery, stateFromQuery || undefined, savedNonce);
        return;
      }
    }

    // 2. Load Google Auth Configuration
    api.getGoogleAuthConfig().then((cfg) => {
      const clientId = cfg.clientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (clientId) {
        setGoogleClientId(clientId);

        // Inject Google Identity Services script if not present
        if (!document.getElementById('google-gsi-script')) {
          const script = document.createElement('script');
          script.id = 'google-gsi-script';
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            initGoogleGsi(clientId);
          };
          document.body.appendChild(script);
        } else if ((window as any).google?.accounts?.id) {
          initGoogleGsi(clientId);
        }
      }
    });
  }, [handleGoogleLoginCredential, handleGoogleLoginCode]);

  const initGoogleGsi = (clientId: string) => {
    if (typeof window === 'undefined' || !(window as any).google?.accounts?.id) return;
    try {
      const nonce = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      sessionStorage.setItem('oauth_nonce_gsi', nonce);

      (window as any).google.accounts.id.initialize({
        client_id: clientId,
        nonce: nonce,
        callback: (response: any) => {
          if (response?.credential) {
            handleGoogleLoginCredential(response.credential, nonce);
          }
        },
      });

      const btnContainer = document.getElementById('google-gsi-container');
      if (btnContainer) {
        btnContainer.innerHTML = '';
        (window as any).google.accounts.id.renderButton(btnContainer, {
          theme: 'outline',
          size: 'large',
          width: 336,
          text: 'continue_with',
          shape: 'rectangular',
        });
        setGsiRendered(true);
      }
    } catch (e) {
      console.warn('Google GSI initialization notice:', e);
    }
  };

  const handleGoogleSignInClick = () => {
    if (!googleClientId) {
      setError(
        'Google Client ID is not configured. Please add GOOGLE_CLIENT_ID to backend .env or NEXT_PUBLIC_GOOGLE_CLIENT_ID to frontend .env.local.'
      );
      return;
    }

    // Try Google Identity prompt if available
    if ((window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to standard Google OAuth redirect
          redirectToGoogleOAuth(googleClientId);
        }
      });
    } else {
      redirectToGoogleOAuth(googleClientId);
    }
  };

  const redirectToGoogleOAuth = (clientId: string) => {
    const redirectUri = `${window.location.origin}/login`;
    const state = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const nonce = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_nonce', nonce);

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=token%20id_token&scope=openid%20email%20profile&state=${encodeURIComponent(
      state
    )}&nonce=${encodeURIComponent(nonce)}`;
    window.location.href = oauthUrl;
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
            <p className="text-xs text-slate-400 mt-0.5">Choose your preferred login method to continue</p>
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

          {/* Google Sign In Section */}
          <div className="mb-4">
            <div id="google-gsi-container" className="empty:hidden flex justify-center" />
            {!gsiRendered && (
              <button
                type="button"
                onClick={handleGoogleSignInClick}
                disabled={loading || googleLoading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-medium text-xs rounded-lg shadow-sm transition border border-slate-300 cursor-pointer"
              >
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
                <span>{googleLoading ? 'Signing in with Google...' : 'Continue with Google'}</span>
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-slate-400">
              <span className="bg-slate-800 px-2.5">or continue with email</span>
            </div>
          </div>

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
                  placeholder="admin@jupsoft.com"
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

            {/* Clean, Confident Submit Button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
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
