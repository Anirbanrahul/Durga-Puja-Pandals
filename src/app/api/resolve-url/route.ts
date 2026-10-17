import { NextRequest, NextResponse } from 'next/server';
import { parseCoordinatesFromText } from '@/lib/geoUtils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Missing "url" parameter' },
      { status: 400 }
    );
  }

  return resolveUrlInternal(targetUrl);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetUrl = body.url;

    if (!targetUrl || typeof targetUrl !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "url" in JSON body' },
        { status: 400 }
      );
    }

    return resolveUrlInternal(targetUrl);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request payload' },
      { status: 400 }
    );
  }
}

async function resolveUrlInternal(targetUrl: string) {
  try {
    // First, check if the string itself already contains clear coordinates
    const directCoords = parseCoordinatesFromText(targetUrl);
    if (directCoords) {
      return NextResponse.json({
        success: true,
        originalUrl: targetUrl,
        resolvedUrl: targetUrl,
        coordinates: directCoords,
      });
    }

    // Follow redirects with timeout
    const redirectRes = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(4000),
    });

    const finalUrl = redirectRes.url || targetUrl;
    const coords = parseCoordinatesFromText(finalUrl);

    if (coords) {
      return NextResponse.json({
        success: true,
        originalUrl: targetUrl,
        resolvedUrl: finalUrl,
        coordinates: coords,
      });
    }

    return NextResponse.json({
      success: false,
      originalUrl: targetUrl,
      resolvedUrl: finalUrl,
      error: 'Could not extract coordinates from resolved URL',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resolve URL';
    return NextResponse.json(
      {
        success: false,
        originalUrl: targetUrl,
        error: message,
      },
      { status: 500 }
    );
  }
}
