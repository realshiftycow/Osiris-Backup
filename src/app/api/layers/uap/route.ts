import { NextRequest, NextResponse } from 'next/server';
import { parseBbox } from '@/lib/layers/bbox';
import { emptyFc } from '@/lib/layers/geojson';
import { getUapForBbox } from '@/lib/layers/uap';

export async function GET(req: NextRequest) {
  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (!bbox) return NextResponse.json(emptyFc());
  const fc = await getUapForBbox(bbox);
  return NextResponse.json(fc, {
    headers: { 'Cache-Control': 'public, s-maxage=1800' },
  });
}
