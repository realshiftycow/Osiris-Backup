import { NextRequest, NextResponse } from 'next/server';
import { parseBbox, bboxKey } from '@/lib/layers/bbox';
import { cachedFc } from '@/lib/layers/cache';
import { emptyFc } from '@/lib/layers/geojson';
import { mapNoaaWrecksToFc } from '@/lib/layers/wrecks';

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const key = bboxKey('wrecks', bbox);
  const fc = await cachedFc(key, 5 * 60_000, async () => {
    const geometry = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
    const url =
      'https://gis.charttools.noaa.gov/arcgis/rest/services/public_wrecks/Wrecks_And_Obstructions/MapServer/0/query?' +
      new URLSearchParams({
        where: '1=1',
        geometry,
        geometryType: 'esriGeometryEnvelope',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: 'true',
        f: 'geojson',
        resultRecordCount: '2000',
      }).toString();
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12_000),
        headers: { 'User-Agent': 'osiris-layers/1.0', Accept: 'application/json' },
      });
      if (!res.ok) return emptyFc();
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('json') && !ct.includes('geojson')) {
        // NOAA sometimes returns HTML error pages with 200
        const text = await res.text();
        try {
          return mapNoaaWrecksToFc(JSON.parse(text));
        } catch {
          return emptyFc();
        }
      }
      return mapNoaaWrecksToFc(await res.json());
    } catch {
      return emptyFc();
    }
  });
  return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
}
