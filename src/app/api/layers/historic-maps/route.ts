import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import type { FeatureCollection } from 'geojson';
import { parseBbox } from '@/lib/layers/bbox';
import { emptyFc } from '@/lib/layers/geojson';
import { filterHistoricMapsByBbox } from '@/lib/layers/historic-maps';

const DATA_PATH = join(process.cwd(), 'public', 'data', 'layers', 'historic-map-footprints.geojson');

let cached: FeatureCollection | null = null;

async function loadFootprints(): Promise<FeatureCollection> {
  if (cached) return cached;
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const data = JSON.parse(raw) as FeatureCollection;
    if (data?.type === 'FeatureCollection' && Array.isArray(data.features)) {
      cached = data;
      return cached;
    }
  } catch {
    /* soft-fail */
  }
  return emptyFc();
}

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());

  const all = await loadFootprints();
  const fc = filterHistoricMapsByBbox(all, bbox);
  return NextResponse.json(fc, {
    headers: { 'Cache-Control': 'public, s-maxage=3600' },
  });
}
