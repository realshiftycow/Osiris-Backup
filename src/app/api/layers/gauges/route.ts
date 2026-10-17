import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { mapUsgsIvToFc } from '@/lib/layers/gauges';

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const key = bboxKey('gauges', bbox);
  const fc = await cachedFc(key, 5 * 60_000, async () => {
    const b = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${b}&parameterCd=00060,00065&siteStatus=active`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'osiris-layers/1.0' },
    });
    if (!res.ok) return emptyFc();
    return mapUsgsIvToFc(await res.json());
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
}
