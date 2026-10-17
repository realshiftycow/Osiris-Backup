import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import {
  citiesForBbox,
  fetchMunicipalEndpoint,
  mergeMunicipalFc,
  type MunicipalCity,
} from '@/lib/layers/municipal';

const REGISTRY_PATH = join(process.cwd(), 'public', 'data', 'layers', 'municipal-endpoints.json');
const MIN_ZOOM = 10;
const TTL_MS = 3 * 60_000;

async function loadRegistry(): Promise<MunicipalCity[]> {
  try {
    const raw = await readFile(REGISTRY_PATH, 'utf8');
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as MunicipalCity[]) : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());

  const zRaw = req.nextUrl.searchParams.get('z');
  const z = zRaw != null ? Number(zRaw) : NaN;
  if (!Number.isFinite(z) || z < MIN_ZOOM) {
    return NextResponse.json(emptyFc());
  }

  const key = bboxKey('vacant', bbox);
  const fc = await cachedFc(key, TTL_MS, async () => {
    const registry = await loadRegistry();
    const cities = citiesForBbox(registry, bbox).filter((c) => c.vacant);
    if (cities.length === 0) return emptyFc();
    const parts = await Promise.all(
      cities.map((c) => fetchMunicipalEndpoint(c, c.vacant!, 'ground_vacant', bbox)),
    );
    return mergeMunicipalFc(parts);
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
}
