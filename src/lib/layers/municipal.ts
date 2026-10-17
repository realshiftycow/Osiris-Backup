import type { Feature, FeatureCollection } from 'geojson';
import type { BBox } from './types';
import { pointFeature, emptyFc, capFeatures } from './geojson';

export type CityBBox = [west: number, south: number, east: number, north: number];

export type MunicipalEndpointType = 'socrata' | 'arcgis';

export interface MunicipalEndpoint {
  type: MunicipalEndpointType;
  url: string;
  latField: string;
  lngField: string;
  idField?: string;
  nameField?: string;
  statusField?: string;
  openedField?: string;
  addressField?: string;
  limit?: number;
}

export interface MunicipalCity {
  id: string;
  name: string;
  bbox: CityBBox;
  threeOneOne?: MunicipalEndpoint;
  vacant?: MunicipalEndpoint;
  disabled?: boolean;
}

export type MunicipalKind = 'ground_civic_311' | 'ground_vacant';

export function cityBboxIntersects(cityBbox: CityBBox, bbox: BBox): boolean {
  const [west, south, east, north] = cityBbox;
  return west < bbox.east && east > bbox.west && south < bbox.north && north > bbox.south;
}

/** Cities whose registry bbox intersects the request viewport. */
export function citiesForBbox(registry: MunicipalCity[], bbox: BBox): MunicipalCity[] {
  return registry.filter(
    (c) =>
      !c.disabled &&
      Array.isArray(c.bbox) &&
      c.bbox.length === 4 &&
      cityBboxIntersects(c.bbox, bbox),
  );
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function str(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v);
}

function pick(row: Record<string, unknown>, field?: string): unknown {
  if (!field) return undefined;
  return row[field];
}

function ringCentroid(ring: number[][]): { lng: number; lat: number } | null {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j]!;
    const [x1, y1] = ring[i]!;
    if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
    const f = x0 * y1 - x1 * y0;
    area += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-12) {
    const [x, y] = ring[0]!;
    return Number.isFinite(x) && Number.isFinite(y) ? { lng: x, lat: y } : null;
  }
  return { lng: cx / (6 * area), lat: cy / (6 * area) };
}

function coordsFromArcgisFeature(
  feature: { geometry?: { x?: number; y?: number; rings?: number[][][] }; attributes?: Record<string, unknown> },
  ep: MunicipalEndpoint,
): { lng: number; lat: number } | null {
  const g = feature.geometry;
  if (g && Number.isFinite(g.x) && Number.isFinite(g.y)) {
    return { lng: g.x as number, lat: g.y as number };
  }
  if (g?.rings?.[0]) {
    const c = ringCentroid(g.rings[0]);
    if (c) return c;
  }
  const attrs = (feature.attributes ?? {}) as Record<string, unknown>;
  const lat = num(attrs[ep.latField]);
  const lng = num(attrs[ep.lngField]);
  if (lat != null && lng != null) return { lng, lat };
  return null;
}

function coordsFromSocrataRow(row: Record<string, unknown>, ep: MunicipalEndpoint): { lng: number; lat: number } | null {
  const lat = num(row[ep.latField]);
  const lng = num(row[ep.lngField]);
  if (lat != null && lng != null) return { lng, lat };
  const loc = row.location;
  if (loc && typeof loc === 'object') {
    const L = loc as Record<string, unknown>;
    const la = num(L.latitude ?? L.lat);
    const ln = num(L.longitude ?? L.lng ?? L.lon);
    if (la != null && ln != null) return { lng: ln, lat: la };
  }
  return null;
}

function buildProps(
  kind: MunicipalKind,
  city: Pick<MunicipalCity, 'id' | 'name'>,
  ep: MunicipalEndpoint,
  row: Record<string, unknown>,
  sourceUrl: string,
): Record<string, unknown> {
  const name =
    str(pick(row, ep.nameField)) ??
    str(pick(row, ep.addressField)) ??
    (kind === 'ground_civic_311' ? '311 Request' : 'Vacant Property');
  return {
    kind,
    name,
    category: str(pick(row, ep.nameField)),
    status: str(pick(row, ep.statusField)),
    openedAt: str(pick(row, ep.openedField)),
    address: str(pick(row, ep.addressField)),
    city: city.name,
    cityId: city.id,
    sourceUrl,
    attribution: city.name,
  };
}

/** Map Socrata JSON rows to ground_* point features. */
export function mapSocrataRowsToFc(
  rows: unknown,
  city: Pick<MunicipalCity, 'id' | 'name'>,
  ep: MunicipalEndpoint,
  kind: MunicipalKind,
  bbox?: BBox | null,
): FeatureCollection {
  if (!Array.isArray(rows)) return emptyFc();
  const features: Feature[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const coords = coordsFromSocrataRow(r, ep);
    if (!coords) continue;
    if (bbox) {
      if (
        coords.lng < bbox.west ||
        coords.lng > bbox.east ||
        coords.lat < bbox.south ||
        coords.lat > bbox.north
      ) {
        continue;
      }
    }
    const idVal = str(pick(r, ep.idField)) ?? String(i);
    features.push(
      pointFeature(`${city.id}-${kind}-${idVal}`, coords.lng, coords.lat, buildProps(kind, city, ep, r, ep.url)),
    );
  }
  return { type: 'FeatureCollection', features };
}

/** Map ArcGIS REST query JSON to ground_* point features. */
export function mapArcgisQueryToFc(
  data: unknown,
  city: Pick<MunicipalCity, 'id' | 'name'>,
  ep: MunicipalEndpoint,
  kind: MunicipalKind,
  bbox?: BBox | null,
): FeatureCollection {
  const featuresIn =
    data && typeof data === 'object' && Array.isArray((data as { features?: unknown }).features)
      ? ((data as { features: unknown[] }).features)
      : null;
  if (!featuresIn) return emptyFc();
  const features: Feature[] = [];
  for (let i = 0; i < featuresIn.length; i++) {
    const f = featuresIn[i];
    if (!f || typeof f !== 'object') continue;
    const feat = f as {
      geometry?: { x?: number; y?: number; rings?: number[][][] };
      attributes?: Record<string, unknown>;
    };
    const coords = coordsFromArcgisFeature(feat, ep);
    if (!coords) continue;
    if (bbox) {
      if (
        coords.lng < bbox.west ||
        coords.lng > bbox.east ||
        coords.lat < bbox.south ||
        coords.lat > bbox.north
      ) {
        continue;
      }
    }
    const attrs = (feat.attributes ?? {}) as Record<string, unknown>;
    const idVal = str(pick(attrs, ep.idField)) ?? String(i);
    features.push(
      pointFeature(
        `${city.id}-${kind}-${idVal}`,
        coords.lng,
        coords.lat,
        buildProps(kind, city, ep, attrs, ep.url),
      ),
    );
  }
  return { type: 'FeatureCollection', features };
}

export function buildSocrataUrl(ep: MunicipalEndpoint, bbox: BBox): string {
  const limit = ep.limit ?? 1000;
  const where = `${ep.latField} between ${bbox.south} and ${bbox.north} AND ${ep.lngField} between ${bbox.west} and ${bbox.east}`;
  const u = new URL(ep.url);
  // Keep SoQL `$` params unescaped (URLSearchParams would encode as %24).
  const qs = [`$where=${encodeURIComponent(where)}`, `$limit=${limit}`].join('&');
  const base = `${u.origin}${u.pathname}`;
  const existing = u.searchParams.toString();
  return existing ? `${base}?${existing}&${qs}` : `${base}?${qs}`;
}

export function buildArcgisUrl(ep: MunicipalEndpoint, bbox: BBox): string {
  const limit = ep.limit ?? 1000;
  const u = new URL(ep.url);
  const envelope = JSON.stringify({
    xmin: bbox.west,
    ymin: bbox.south,
    xmax: bbox.east,
    ymax: bbox.north,
    spatialReference: { wkid: 4326 },
  });
  u.searchParams.set('where', '1=1');
  u.searchParams.set('geometry', envelope);
  u.searchParams.set('geometryType', 'esriGeometryEnvelope');
  u.searchParams.set('inSR', '4326');
  u.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  u.searchParams.set('outFields', '*');
  u.searchParams.set('returnGeometry', 'true');
  u.searchParams.set('outSR', '4326');
  u.searchParams.set('resultRecordCount', String(limit));
  u.searchParams.set('f', 'json');
  return u.toString();
}

export async function fetchMunicipalEndpoint(
  city: MunicipalCity,
  ep: MunicipalEndpoint,
  kind: MunicipalKind,
  bbox: BBox,
  fetchImpl: typeof fetch = fetch,
): Promise<FeatureCollection> {
  try {
    const url = ep.type === 'socrata' ? buildSocrataUrl(ep, bbox) : buildArcgisUrl(ep, bbox);
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'osiris-layers/1.0', Accept: 'application/json' },
    });
    if (!res.ok) return emptyFc();
    const data = await res.json();
    if (ep.type === 'socrata') return mapSocrataRowsToFc(data, city, ep, kind, bbox);
    return mapArcgisQueryToFc(data, city, ep, kind, bbox);
  } catch {
    return emptyFc();
  }
}

export function mergeMunicipalFc(parts: FeatureCollection[], max = 5000): FeatureCollection {
  const features: Feature[] = [];
  for (const part of parts) {
    if (Array.isArray(part?.features)) features.push(...part.features);
  }
  return capFeatures({ type: 'FeatureCollection', features }, max);
}
