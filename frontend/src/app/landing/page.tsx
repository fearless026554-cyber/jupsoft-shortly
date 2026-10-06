'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LandingPageView } from '../../components/views/LandingPageView';

export default function StandaloneLandingPage() {
  const router = useRouter();

  return (
    <LandingPageView
      onLoginClick={() => {
        router.push('/login');
      }}
    />
  );
}
