'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ConsoleApp } from '../../components/ConsoleApp';
import { api } from '../../api';
import { Loader2 } from 'lucide-react';

function ConsoleTabContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = (params?.tab as string) || 'dashboard';

  const [isExchangingGoogleCode, setIsExchangingGoogleCode] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setIsExchangingGoogleCode(true);
      api
        .googleLogin({
          code,
          redirectUri: 'https://go.jupsoft.com/dashboard',
        })
        .then((res) => {
          if (res.success && res.data?.token) {
            // Clean up code from browser URL bar without page refresh
            window.history.replaceState({}, '', '/dashboard');
            setIsExchangingGoogleCode(false);
          } else {
            setGoogleError(res.error?.message || 'Google authorization failed');
            setIsExchangingGoogleCode(false);
          }
        })
        .catch((err) => {
          setGoogleError(err.message || 'Google login error');
          setIsExchangingGoogleCode(false);
        });
    }
  }, [searchParams]);

  if (isExchangingGoogleCode) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm font-medium">Authenticating with Google...</p>
        <p className="text-xs text-slate-400 mt-1">Please wait while your session is established.</p>
      </div>
    );
  }

  if (googleError) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-slate-800 border border-red-500/50 p-6 rounded-xl max-w-md text-center shadow-xl">
          <h2 className="text-base font-bold text-red-400 mb-2">Google Sign-In Failed</h2>
          <p className="text-xs text-slate-300 mb-4">{googleError}</p>
          <button
            onClick={() => router.replace('/login')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold cursor-pointer transition"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return <ConsoleApp initialTab={rawTab} />;
}

export default function ConsoleTabPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-xs">
          Loading...
        </div>
      }
    >
      <ConsoleTabContent />
    </Suspense>
  );
}
