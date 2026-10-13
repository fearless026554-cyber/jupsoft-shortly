'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, getAuthToken, setAuthToken, setStoredUser } from '../../api';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

const INITIAL_GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [googleClientId, setGoogleClientId] = useState(INITIAL_GOOGLE_CLIENT_ID);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Forgot & Reset Password states
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Check query parameters (session expired, OAuth code, or resetToken)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);

      if (urlParams.get('expired') === '1') {
        setInfo('Your session has expired. Please sign in again.');
      }

      const tokenFromUrl = urlParams.get('resetToken') || urlParams.get('token');
      if (tokenFromUrl) {
        setResetToken(tokenFromUrl);
        setMode('reset');
        setInfo('Please enter and confirm your new password below.');
      }

      // Check if redirected with Google OAuth authorization code in query
      const code = urlParams.get('code');
      if (code) {
        setGoogleLoading(true);
        const redirectUri =
          typeof window !== 'undefined'
            ? `${window.location.origin}/dashboard`
            : 'https://go.jupsoft.com/dashboard';
        api
          .googleLogin({
            code,
            redirectUri,
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
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://go.jupsoft.com';
    const redirectUri = encodeURIComponent(`${origin}/dashboard`);
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

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your account email address.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await api.forgotPassword(email.trim().toLowerCase());
      if (res.success) {
        setForgotSent(true);
        setInfo('If an account exists with this email address, a password reset link has been dispatched via email.');
      } else {
        setError(res.error?.message || 'Failed to request password reset. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim()) {
      setError('Reset token is required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please ensure both passwords match.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await api.resetPasswordWithToken({
        token: resetToken.trim(),
        newPassword,
      });

      if (res.success) {
        setInfo('Your password has been successfully reset! Please sign in with your new password.');
        setMode('login');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setResetToken('');
        setForgotSent(false);
      } else {
        setError(res.error?.message || 'Failed to reset password. The link may have expired or is invalid.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo and Brand */}
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
          {/* Header by Mode */}
          <div className="mb-4">
            {mode === 'login' && (
              <>
                <h2 className="text-base font-semibold text-white">Sign in to your account</h2>
                <p className="text-xs text-slate-400 mt-0.5">Choose your preferred login method</p>
              </>
            )}
            {mode === 'forgot' && (
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setInfo(null);
                  }}
                  className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition mt-0.5 cursor-pointer"
                  title="Back to login"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-base font-semibold text-white">Reset password</h2>
                  <p className="text-xs text-slate-400 mt-0.5">We will send a secure reset link to your email</p>
                </div>
              </div>
            )}
            {mode === 'reset' && (
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setInfo(null);
                  }}
                  className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition mt-0.5 cursor-pointer"
                  title="Back to login"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-base font-semibold text-white">Set new password</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Enter and confirm your new account password</p>
                </div>
              </div>
            )}
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

          {/* MODE: LOGIN */}
          {mode === 'login' && (
            <>
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setInfo(null);
                        setForgotSent(false);
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300 transition font-medium cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
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
            </>
          )}

          {/* MODE: FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              {forgotSent ? (
                <div className="space-y-4 text-center py-2">
                  <div className="w-12 h-12 rounded-full bg-blue-950/80 border border-blue-800 text-blue-400 mx-auto flex items-center justify-center">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">Check your email</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      If an account exists for <strong className="text-white">{email}</strong>, you will receive a password reset link shortly.
                    </p>
                  </div>
                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotSent(false);
                        setEmail('');
                      }}
                      className="w-full py-2 px-3 border border-slate-700 hover:bg-slate-750 text-slate-300 text-xs rounded-lg transition cursor-pointer"
                    >
                      Try another email
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                        setInfo(null);
                      }}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
                    >
                      Return to sign in
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Registered email address
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Sending reset link...</span>
                      </>
                    ) : (
                      'Send Reset Link via Email'
                    )}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                        setInfo(null);
                      }}
                      className="text-xs text-slate-400 hover:text-white transition font-medium cursor-pointer"
                    >
                      Back to sign in
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* MODE: RESET PASSWORD */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reset Token
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Paste 64-character token"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition p-1 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Re-type new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  'Set New Password & Sign In'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white transition font-medium cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-[11px] text-slate-500">
          &copy; {new Date().getFullYear()} Jupsoft Technologies. All rights reserved.
        </div>
      </div>
    </div>
  );
}
