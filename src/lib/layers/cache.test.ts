// src/lib/layers/cache.test.ts
import { describe, it, expect, vi } from 'vitest';
import { cachedFc, _resetLayerCacheForTests } from './cache';
import { emptyFc } from './geojson';

describe('cachedFc', () => {
  it('dedupes inflight and serves TTL', async () => {
    _resetLayerCacheForTests();
    let n = 0;
    const fetcher = vi.fn(async () => { n++; return emptyFc(); });
    const a = cachedFc('t', 60_000, fetcher);
    const b = cachedFc('t', 60_000, fetcher);
    await Promise.all([a, b]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await cachedFc('t', 60_000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
