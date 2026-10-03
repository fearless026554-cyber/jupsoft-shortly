import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jupsoft Shortly (JLMP) - Enterprise Console',
  description: 'Enterprise Branded Link Management, Dynamic QR, & Attribution Engine',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/jupsoft-logo.png" as="image" />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
