import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import type { BBox } from './types';
import { emptyFc } from './geojson';

export type HistoricMapProps = {
  title: string;
  city: string;
  year: number;
  locUrl: string;
  attribution: string;
};

/** Axis-aligned bbox overlap (half-open edges via strict inequalities). */
export function bboxesOverlap(a: BBox, b: BBox): boolean {
  return a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south;
}

function extendFromPosition(
  pos: Position,
  acc: { west: number; south: number; east: number; north: number },
): void {
  const lng = pos[0];
  const lat = pos[1];
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
  if (lng < acc.west) acc.west = lng;
  if (lng > acc.east) acc.east = lng;
  if (lat < acc.south) acc.south = lat;
  if (lat > acc.north) acc.north = lat;
}

function walkCoords(coords: unknown, acc: { west: number; south: number; east: number; north: number }): void {
  if (!Array.isArray(coords) || coords.length === 0) return;
  if (typeof coords[0] === 'number') {
    extendFromPosition(coords as Position, acc);
    return;
  }
  for (const c of coords) walkCoords(c, acc);
}

/** Compute feature bbox from Polygon/MultiPolygon (or any nested coordinate rings). */
export function featureBbox(geometry: Geometry | null | undefined): BBox | null {
  if (!geometry || geometry.type === 'GeometryCollection') return null;
  const coords = 'coordinates' in geometry ? geometry.coordinates : null;
  if (!coords) return null;
  const acc = {
    west: Infinity,
    south: Infinity,
    east: -Infinity,
    north: -Infinity,
  };
  walkCoords(coords, acc);
  if (!Number.isFinite(acc.west) || !Number.isFinite(acc.east)) return null;
  if (acc.west >= acc.east || acc.south >= acc.north) return null;
  return acc;
}

/** Keep features whose geometry bbox overlaps the request viewport. */
export function filterHistoricMapsByBbox(
  fc: FeatureCollection | null | undefined,
  bbox: BBox,
): FeatureCollection {
  if (!fc || !Array.isArray(fc.features)) return emptyFc();
  const features: Feature[] = [];
  for (const f of fc.features) {
    const fb = featureBbox(f.geometry);
    if (fb && bboxesOverlap(fb, bbox)) features.push(f);
  }
  return { type: 'FeatureCollection', features };
}
