import type { FeatureCollection } from 'geojson';

type Entry = { fc: FeatureCollection; expiresAt: number; inflight: Promise<FeatureCollection> | null };
const store = new Map<string, Entry>();

export function _resetLayerCacheForTests(): void { store.clear(); }

export async function cachedFc(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<FeatureCollection>,
): Promise<FeatureCollection> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now < hit.expiresAt) return hit.fc;
  if (hit?.inflight) return hit.inflight;
  const inflight = fetcher()
    .then((fc) => {
      store.set(key, { fc, expiresAt: Date.now() + ttlMs, inflight: null });
      return fc;
    })
    .catch((err) => {
      const stale = store.get(key)?.fc;
      store.set(key, { fc: stale ?? { type: 'FeatureCollection', features: [] }, expiresAt: Date.now() + Math.min(ttlMs, 30_000), inflight: null });
      console.warn('[layers-cache]', key, err);
      return store.get(key)!.fc;
    });
  store.set(key, { fc: hit?.fc ?? { type: 'FeatureCollection', features: [] }, expiresAt: 0, inflight });
  return inflight;
}
