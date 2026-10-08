import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    defaultShortDomain: process.env.NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN || process.env.DEFAULT_SHORT_DOMAIN || '',
    cnameDomain: process.env.NEXT_PUBLIC_CNAME_DOMAIN || process.env.CNAME_DOMAIN || '',
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
  });
}
