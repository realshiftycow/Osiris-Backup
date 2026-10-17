import { describe, it, expect } from 'vitest';
import {
  bboxesOverlap,
  featureBbox,
  filterHistoricMapsByBbox,
} from './historic-maps';
import type { FeatureCollection } from 'geojson';

const fixture: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'prov',
      properties: {
        title: 'Sanborn Fire Insurance Map, Providence, 1900',
        city: 'Providence, RI',
        year: 1900,
        locUrl: 'https://www.loc.gov/item/sanborn08096_001/',
        attribution: 'Library of Congress',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-71.45, 41.80], [-71.38, 41.80], [-71.38, 41.86], [-71.45, 41.86], [-71.45, 41.80],
        ]],
      },
    },
    {
      type: 'Feature',
      id: 'sf',
      properties: {
        title: 'Sanborn Fire Insurance Map, San Francisco, 1913',
        city: 'San Francisco, CA',
        year: 1913,
        locUrl: 'https://www.loc.gov/item/sanborn00868_005/',
        attribution: 'Library of Congress',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-122.52, 37.70], [-122.35, 37.70], [-122.35, 37.82], [-122.52, 37.82], [-122.52, 37.70],
        ]],
      },
    },
  ],
};

describe('bboxesOverlap', () => {
  it('detects overlap and separation', () => {
    expect(
      bboxesOverlap(
        { west: -72, south: 41, east: -71, north: 42 },
        { west: -71.5, south: 41.5, east: -70.5, north: 42.5 },
      ),
    ).toBe(true);
    expect(
      bboxesOverlap(
        { west: -72, south: 41, east: -71, north: 42 },
        { west: -70, south: 41, east: -69, north: 42 },
      ),
    ).toBe(false);
  });
});

describe('featureBbox', () => {
  it('computes polygon envelope', () => {
    expect(featureBbox(fixture.features[0]!.geometry)).toEqual({
      west: -71.45,
      south: 41.8,
      east: -71.38,
      north: 41.86,
    });
  });
});

describe('filterHistoricMapsByBbox', () => {
  it('returns only intersecting footprints', () => {
    const ri = filterHistoricMapsByBbox(fixture, {
      west: -71.6,
      south: 41.7,
      east: -71.2,
      north: 42.0,
    });
    expect(ri.features).toHaveLength(1);
    expect(ri.features[0]!.id).toBe('prov');

    const none = filterHistoricMapsByBbox(fixture, {
      west: -100,
      south: 30,
      east: -99,
      north: 31,
    });
    expect(none.features).toHaveLength(0);
  });

  it('handles null/invalid input', () => {
    expect(filterHistoricMapsByBbox(null, { west: 0, south: 0, east: 1, north: 1 }).features).toEqual([]);
  });
});
