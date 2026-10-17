import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { overpassQuery } from '@/lib/layers/overpass';
import { abandonedQl, mapAbandonedElementsToFc } from '@/lib/layers/abandoned';

const MIN_ZOOM = 10;
const TTL_MS = 10 * 60_000;

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());

  const zRaw = req.nextUrl.searchParams.get('z');
  const z = zRaw != null ? Number(zRaw) : NaN;
  if (!Number.isFinite(z) || z < MIN_ZOOM) {
    return NextResponse.json(emptyFc());
  }

  const key = bboxKey('abandoned', bbox);
  const fc = await cachedFc(key, TTL_MS, async () => {
    try {
      const data = await overpassQuery(abandonedQl(bbox));
      return mapAbandonedElementsToFc(data);
    } catch {
      return emptyFc();
    }
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
}
