'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseCoordinatesFromText, isShortUrl } from '@/lib/geoUtils';
import { MapPin, Loader2, ArrowRight, AlertCircle, Compass } from 'lucide-react';

function ShareTargetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'analyzing' | 'resolved' | 'failed'>('analyzing');
  const [details, setDetails] = useState<{
    text?: string;
    url?: string;
    coords?: { lat: number; lng: number };
    error?: string;
  }>({});

  useEffect(() => {
    async function processSharedData() {
      const title = searchParams.get('title') || '';
      const text = searchParams.get('text') || '';
      const url = searchParams.get('url') || '';

      const combinedText = `${title} ${text} ${url}`.trim();

      if (!combinedText) {
        setStatus('failed');
        setDetails({ error: 'No location information received from share' });
        return;
      }

      // Check if coordinates can be directly parsed
      const direct = parseCoordinatesFromText(combinedText);
      if (direct) {
        setDetails({ text: combinedText, coords: direct });
        setStatus('resolved');
        // Redirect to main app with query parameters
        setTimeout(() => {
          router.push(`/?lat=${direct.lat}&lng=${direct.lng}&source=share&addr=${encodeURIComponent(direct.label || 'Shared Location')}`);
        }, 1200);
        return;
      }

      // Check for shortened URL or any URL in text
      const urlMatch = /(https?:\/\/[^\s]+)/g.exec(combinedText);
      const extractedUrl = urlMatch ? urlMatch[0] : url;

      if (extractedUrl) {
        try {
          const res = await fetch('/api/resolve-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: extractedUrl }),
          });
          const data = await res.json();

          if (data.success && data.coordinates) {
            setDetails({ text: combinedText, url: extractedUrl, coords: data.coordinates });
            setStatus('resolved');
            setTimeout(() => {
              router.push(`/?lat=${data.coordinates.lat}&lng=${data.coordinates.lng}&source=share&addr=Shared%20Map%20Pin`);
            }, 1200);
            return;
          }
        } catch {
          // Ignore fetch error
        }
      }

      setStatus('failed');
      setDetails({
        text: combinedText,
        error: 'Could not extract valid geographic coordinates from the shared message or link.',
      });
    }

    processSharedData();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/90 border border-amber-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-md relative z-10 text-center">
        {/* Festive Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-700 to-amber-500 p-0.5 mx-auto mb-4 flex items-center justify-center shadow-lg">
          <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
            {status === 'analyzing' && <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />}
            {status === 'resolved' && <MapPin className="w-8 h-8 text-emerald-400 animate-bounce" />}
            {status === 'failed' && <AlertCircle className="w-8 h-8 text-rose-400" />}
          </div>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-amber-200 mb-1">
          {status === 'analyzing' && 'Analyzing Shared Location...'}
          {status === 'resolved' && 'Location Detected!'}
          {status === 'failed' && 'Could Not Read Location'}
        </h1>

        <p className="text-sm text-slate-300 mb-6">
          {status === 'analyzing' && 'Parsing coordinates, notification text, or Google Maps link...'}
          {status === 'resolved' && 'Opening Pujo Parikrama & Companion around this location...'}
          {status === 'failed' && details.error}
        </p>

        {details.coords && (
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-xs text-amber-300 font-mono mb-6 flex items-center justify-center gap-2">
            <Compass className="w-4 h-4 text-amber-400" />
            {details.coords.lat.toFixed(5)}, {details.coords.lng.toFixed(5)}
          </div>
        )}

        {status === 'resolved' && details.coords && (
          <button
            onClick={() =>
              router.push(`/?lat=${details.coords!.lat}&lng=${details.coords!.lng}&source=share&addr=Shared%20Map%20Pin`)
            }
            className="w-full py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
          >
            <span>Proceed to Parikrama</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {status === 'failed' && (
          <div className="space-y-3">
            {details.text && (
              <div className="text-left text-xs bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-400 break-words line-clamp-3">
                &ldquo;{details.text}&rdquo;
              </div>
            )}
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 px-4 rounded-xl font-medium bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-2 border border-slate-700 transition-colors"
            >
              <span>Go to Main App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShareTargetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      }
    >
      <ShareTargetContent />
    </Suspense>
  );
}
