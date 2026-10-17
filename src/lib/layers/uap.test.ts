import { describe, it, expect } from 'vitest';
import { filterUapRecordsByBbox, mapUapRecordsToFc } from './uap';
import type { BBox } from './types';

const FIXTURE = [
  {
    id: 'nuforc-a',
    datetime: '2015-01-01',
    lat: 42.35,
    lng: -71.05,
    shape: 'light',
    city: 'Boston',
    country: 'USA',
    sourceUrl: 'https://nuforc.org/sighting/?id=1',
  },
  {
    id: 'nuforc-b',
    datetime: '2016-06-15',
    lat: 41.82,
    lng: -71.41,
    shape: 'disk',
    city: 'Providence',
    country: 'USA',
    sourceUrl: 'https://nuforc.org/sighting/?id=2',
  },
  {
    id: 'nuforc-c',
    datetime: '2018-03-20',
    lat: 34.05,
    lng: -118.25,
    shape: 'fireball',
    city: 'Los Angeles',
    country: 'USA',
    sourceUrl: 'https://nuforc.org/sighting/?id=3',
  },
  {
    id: 'nuforc-bad',
    datetime: '2019-01-01',
    lat: 'n/a',
    lng: -71,
    shape: 'other',
    country: 'USA',
  },
];

const NE_BBOX: BBox = { west: -72, south: 41, east: -70, north: 43 };

describe('filterUapRecordsByBbox', () => {
  it('keeps only points inside bbox', () => {
    const fc = filterUapRecordsByBbox(FIXTURE, NE_BBOX);
    expect(fc.features).toHaveLength(2);
    const ids = fc.features.map((f) => f.id);
    expect(ids).toEqual(['nuforc-a', 'nuforc-b']);
  });

  it('sets city precision and NUFORC attribution', () => {
    const fc = filterUapRecordsByBbox(FIXTURE, NE_BBOX);
    const p = fc.features[0].properties;
    expect(p?.kind).toBe('ground_uap');
    expect(p?.precision).toBe('city');
    expect(p?.attribution).toBe('NUFORC via The UAP Atlas');
    expect(p?.city).toBe('Boston');
    expect(p?.shape).toBe('light');
    expect(p?.date).toBe('2015-01-01');
    expect(p?.sourceUrl).toBe('https://nuforc.org/sighting/?id=1');
  });

  it('returns empty for empty bbox hit / bad input', () => {
    const emptyBbox: BBox = { west: 0, south: 0, east: 1, north: 1 };
    expect(filterUapRecordsByBbox(FIXTURE, emptyBbox).features).toHaveLength(0);
    expect(filterUapRecordsByBbox(null, NE_BBOX).features).toHaveLength(0);
    expect(filterUapRecordsByBbox([], NE_BBOX).features).toHaveLength(0);
  });

  it('skips rows without finite coordinates', () => {
    const fc = filterUapRecordsByBbox(FIXTURE, {
      west: -180,
      south: -90,
      east: 180,
      north: 90,
    });
    // world bbox but still skips bad coords; LA + Boston + Providence = 3
    expect(fc.features).toHaveLength(3);
  });

  it('caps at 2000 features', () => {
    const many = Array.from({ length: 2500 }, (_, i) => ({
      id: `nuforc-${i}`,
      lat: 42,
      lng: -71,
      shape: 'light',
      country: 'USA',
    }));
    const fc = filterUapRecordsByBbox(many, NE_BBOX);
    expect(fc.features).toHaveLength(2000);
  });
});

describe('mapUapRecordsToFc', () => {
  it('maps all valid rows without bbox filter', () => {
    const fc = mapUapRecordsToFc(FIXTURE);
    expect(fc.features).toHaveLength(3);
  });

  it('returns empty for missing records', () => {
    expect(mapUapRecordsToFc({}).features).toHaveLength(0);
    expect(mapUapRecordsToFc(null).features).toHaveLength(0);
  });
});
