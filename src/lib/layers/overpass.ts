import type { BBox } from './types';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
] as const;

const TIMEOUT_MS = 25_000;
const USER_AGENT = 'osiris-layers/1.0';

/** Overpass bbox filter fragment: south,west,north,east */
export function bboxToOverpass(b: BBox): string {
  return `${b.south},${b.west},${b.north},${b.east}`;
}

export function fillBbox(ql: string, b: BBox): string {
  return ql.replaceAll('{{bbox}}', bboxToOverpass(b));
}

/**
 * POST Overpass QL to primary interpreter, then kumi fallback.
 * Throws if both endpoints fail.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function overpassQuery(ql: string): Promise<any> {
  let lastError: unknown;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(ql)}`,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        lastError = new Error(`Overpass ${url} HTTP ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Overpass query failed on all endpoints');
}
