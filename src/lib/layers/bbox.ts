import type { BBox } from './types';

export function parseBbox(raw: string | null): BBox | null {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) return null;
  if (west < -180 || east > 180 || south < -90 || north > 90) return null;
  // Cap span to avoid world-sized Overpass bombs
  if (east - west > 40 || north - south > 40) return null;
  return { west, south, east, north };
}

export function roundBbox(b: BBox, decimals = 2): BBox {
  const f = 10 ** decimals;
  return {
    west: Math.floor(b.west * f) / f,
    south: Math.floor(b.south * f) / f,
    east: Math.ceil(b.east * f) / f,
    north: Math.ceil(b.north * f) / f,
  };
}

export function bboxKey(layer: string, b: BBox): string {
  const r = roundBbox(b);
  return `${layer}:${r.west},${r.south},${r.east},${r.north}`;
}
