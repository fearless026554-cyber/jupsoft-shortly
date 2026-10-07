'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LandingPageView } from '../components/views/LandingPageView';
import { getStoredUser, getAuthToken, api } from '../api';

export default function RootHomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const token = getAuthToken();
    const stored = getStoredUser();
    if (stored) {
      setCurrentUser(stored);
    }

    if (token) {
      api.getMe().then((res) => {
        if (res && res.success && res.data?.user) {
          setCurrentUser(res.data.user);
        }
      }).catch(() => {});
    }
  }, []);

  return (
    <LandingPageView
      currentUser={currentUser}
      onGoToDashboard={() => router.push('/dashboard')}
      onLoginClick={() => router.push('/login')}
    />
  );
}
