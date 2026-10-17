import { describe, it, expect } from 'vitest';
import {
  GROUND_API,
  GROUND_DEBOUNCE_MS,
  GROUND_LAYER_KEYS,
  GROUND_MIN_ZOOM,
  boundsToBboxParam,
  buildGroundLayerUrl,
  meetsGroundMinZoom,
  type GroundLayerKey,
} from './ground-layers-client';

describe('GROUND_LAYER_KEYS / maps', () => {
  it('lists nine ground keys', () => {
    expect(GROUND_LAYER_KEYS).toHaveLength(9);
  });

  it('has min-zoom and API entry for every key', () => {
    for (const key of GROUND_LAYER_KEYS) {
      expect(typeof GROUND_MIN_ZOOM[key]).toBe('number');
      expect(GROUND_API[key]).toMatch(/^\/api\/layers\//);
    }
  });

  it('uses hyphenated API paths for civic_311 and historic_maps', () => {
    expect(GROUND_API.civic_311).toBe('/api/layers/civic-311');
    expect(GROUND_API.historic_maps).toBe('/api/layers/historic-maps');
  });
});

describe('GROUND_DEBOUNCE_MS', () => {
  it('is 400ms for moveend debounce', () => {
    expect(GROUND_DEBOUNCE_MS).toBe(400);
  });
});

describe('meetsGroundMinZoom', () => {
  const cases: Array<[GroundLayerKey, number, boolean]> = [
    ['uap', 0, true],
    ['wrecks', 5.9, false],
    ['wrecks', 6, true],
    ['abandoned', 9.9, false],
    ['abandoned', 10, true],
    ['nightlife', 10, true],
    ['gtfs', 0, true],
    ['gauges', 4.9, false],
    ['gauges', 5, true],
    ['civic_311', 9, false],
    ['civic_311', 10, true],
    ['vacant', 10, true],
    ['historic_maps', 0, true],
  ];

  it.each(cases)('%s at zoom %s → %s', (key, zoom, expected) => {
    expect(meetsGroundMinZoom(key, zoom)).toBe(expected);
  });
});

describe('boundsToBboxParam', () => {
  it('formats west,south,east,north', () => {
    const b = {
      getWest: () => -71.5,
      getSouth: () => 41.7,
      getEast: () => -71.2,
      getNorth: () => 42.0,
    };
    expect(boundsToBboxParam(b)).toBe('-71.5,41.7,-71.2,42');
  });
});

describe('buildGroundLayerUrl', () => {
  it('encodes bbox and floors zoom', () => {
    expect(buildGroundLayerUrl('gauges', '-71.5,41.7,-71.2,42', 7.8)).toBe(
      '/api/layers/gauges?bbox=-71.5%2C41.7%2C-71.2%2C42&z=7',
    );
  });
});
