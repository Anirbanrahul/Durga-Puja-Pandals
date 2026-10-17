import { NextResponse } from 'next/server';
import { DOMParser } from '@xmldom/xmldom';
import * as toGeoJSON from '@tmcw/togeojson';
import fs from 'fs/promises';
import path from 'path';

const SHORT_MAP_URL = 'https://goo.gl/maps/jB2cW6c9L27WFVs56?g_st=aw';

// Read static fallback dataset
async function getFallbackDataset() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'pujo-pandals.geojson');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Failed to read fallback GeoJSON file:', err);
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }
}

export async function GET() {
  try {
    // Attempt to follow redirect and fetch KML from Google MyMaps with a 3.5s timeout
    const redirectRes = await fetch(SHORT_MAP_URL, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(3500),
    });

    const finalUrl = new URL(redirectRes.url);
    const mid = finalUrl.searchParams.get('mid');

    if (mid) {
      const kmlUrl = `https://www.google.com/maps/d/kml?mid=${mid}&forcekml=1`;
      const kmlRes = await fetch(kmlUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        signal: AbortSignal.timeout(4000),
      });

      if (kmlRes.ok) {
        const kmlText = await kmlRes.text();
        const xmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml');
        const geoJson = toGeoJSON.kml(xmlDoc);

        if (geoJson && geoJson.features && geoJson.features.length > 0) {
          return NextResponse.json(geoJson, {
            headers: {
              'x-data-source': 'google-mymaps-live',
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          });
        }
      }
    }
  } catch (err) {
    console.warn('Live Google MyMaps fetch timed out or unavailable, using verified fallback dataset:', err);
  }

  // Graceful fallback to verified Kolkata pandals dataset
  const fallbackData = await getFallbackDataset();
  return NextResponse.json(fallbackData, {
    status: 200,
    headers: {
      'x-data-source': 'static-fallback',
      'Cache-Control': 'public, s-maxage=86400',
    },
  });
}
