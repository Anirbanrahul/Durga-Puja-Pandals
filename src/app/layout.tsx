import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pujo Parikrama & Companion | Kolkata Durga Puja Guide',
  description:
    'Free production-ready PWA for Kolkata Durga Puja parikrama. Live GPS tracking, nearby pandals, Overpass restaurants, and offline SOS emergency assistance.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  keywords: [
    'Durga Puja',
    'Kolkata Durga Puja',
    'Pujo Parikrama',
    'Kolkata Pandals',
    'Overpass Food',
    'Emergency SOS',
    'PWA',
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#881337',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-amber-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
