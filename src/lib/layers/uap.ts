import type { Feature, FeatureCollection } from 'geojson';
import type { BBox } from './types';
import { cachedFc } from './cache';
import { pointFeature, emptyFc, capFeatures } from './geojson';

const EXPORT_CACHE_KEY = 'uap:export:v1';
const EXPORT_TTL_MS = 30 * 60_000;
const PAGE_LIMIT = 5000;
const FEATURE_CAP = 2000;
const EXPORT_URL =
  'https://theuapatlas.com/api/export?format=json&from=2015&to=2026';

const ATTRIBUTION = 'NUFORC via The UAP Atlas';

/** Row shape from The UAP Atlas /api/export (NUFORC-derived). */
export type UapRecord = {
  id?: string;
  datetime?: string;
  lat?: number;
  lng?: number;
  shape?: string;
  city?: string;
  country?: string;
  sourceUrl?: string;
  locationPrecision?: string;
  durationSec?: number;
  status?: string;
};

function pointInBbox(lng: number, lat: number, bbox: BBox): boolean {
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

function recordToFeature(row: UapRecord, index: number): Feature | null {
  const lat = row.lat;
  const lng = row.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const id = row.id ?? `uap-${index}`;
  return pointFeature(id, lng as number, lat as number, {
    kind: 'ground_uap',
    date: row.datetime ?? null,
    shape: row.shape ?? null,
    city: row.city ?? null,
    country: row.country ?? null,
    sourceUrl: row.sourceUrl ?? null,
    precision: 'city',
    attribution: ATTRIBUTION,
  });
}

/** Map export rows to a FeatureCollection (no bbox filter, no cap). */
export function mapUapRecordsToFc(records: unknown): FeatureCollection {
  if (!Array.isArray(records)) return emptyFc();
  const features: Feature[] = [];
  for (let i = 0; i < records.length; i++) {
    const f = recordToFeature(records[i] as UapRecord, i);
    if (f) features.push(f);
  }
  return { type: 'FeatureCollection', features };
}

/** Filter fixture/export rows by bbox → capped FeatureCollection for tests and route. */
export function filterUapRecordsByBbox(
  records: unknown,
  bbox: BBox,
): FeatureCollection {
  if (!Array.isArray(records)) return emptyFc();
  const features: Feature[] = [];
  for (let i = 0; i < records.length; i++) {
    const row = records[i] as UapRecord;
    const lat = row.lat;
    const lng = row.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!pointInBbox(lng as number, lat as number, bbox)) continue;
    const f = recordToFeature(row, i);
    if (f) features.push(f);
  }
  return capFeatures({ type: 'FeatureCollection', features }, FEATURE_CAP);
}

function filterFcByBbox(fc: FeatureCollection, bbox: BBox): FeatureCollection {
  const features = fc.features.filter((f) => {
    if (f.geometry?.type !== 'Point') return false;
    const [lng, lat] = f.geometry.coordinates;
    return Number.isFinite(lng) && Number.isFinite(lat) && pointInBbox(lng, lat, bbox);
  });
  return capFeatures({ type: 'FeatureCollection', features }, FEATURE_CAP);
}

async function fetchAllUapRecords(): Promise<UapRecord[]> {
  const all: UapRecord[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const url = `${EXPORT_URL}&limit=${PAGE_LIMIT}&offset=${offset}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(25_000),
      headers: {
        'User-Agent': 'osiris-layers/1.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`uap export HTTP ${res.status}`);
    const data = await res.json();
    const records = Array.isArray(data?.records) ? (data.records as UapRecord[]) : [];
    if (typeof data?.total === 'number') total = data.total;
    else total = offset + records.length;
    all.push(...records);
    if (records.length === 0 || records.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }
  return all;
}

async function getCachedExportFc(): Promise<FeatureCollection> {
  return cachedFc(EXPORT_CACHE_KEY, EXPORT_TTL_MS, async () => {
    const records = await fetchAllUapRecords();
    return mapUapRecordsToFc(records);
  });
}

/** Fetch/cache full export, then filter by bbox in memory. Soft-fails to empty FC. */
export async function getUapForBbox(bbox: BBox): Promise<FeatureCollection> {
  try {
    const all = await getCachedExportFc();
    return filterFcByBbox(all, bbox);
  } catch {
    return emptyFc();
  }
}
