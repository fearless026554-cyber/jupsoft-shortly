'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ConsoleApp } from '../../components/ConsoleApp';

export default function ConsoleTabPage() {
  const params = useParams();
  const rawTab = (params?.tab as string) || 'dashboard';

  return <ConsoleApp initialTab={rawTab} />;
}
