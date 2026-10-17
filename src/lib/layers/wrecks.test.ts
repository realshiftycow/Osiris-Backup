import { describe, it, expect } from 'vitest';
import { mapNoaaWrecksToFc } from './wrecks';

describe('mapNoaaWrecksToFc', () => {
  it('maps Point features to ground_wrecks', () => {
    const fc = mapNoaaWrecksToFc({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            OBJECTID: 42,
            vesslterms: 'Wreck',
            history: 'SS Example',
            depth: 12,
            chart: '13270',
            recrd: 1001,
          },
          geometry: { type: 'Point', coordinates: [-70.95, 42.35] },
        },
      ],
    });
    expect(fc.features).toHaveLength(1);
    const p = fc.features[0].properties;
    expect(p?.kind).toBe('ground_wrecks');
    expect(p?.name).toBe('SS Example');
    expect(p?.featureType).toBe('Wreck');
    expect(p?.attribution).toBe('NOAA');
    expect(p?.depth).toBe(12);
    expect(fc.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [-70.95, 42.35],
    });
  });

  it('expands MultiPoint into one feature per coordinate', () => {
    const fc = mapNoaaWrecksToFc({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { OBJECTID: 7, VESSLTERMS: 'Obstruction' },
          geometry: {
            type: 'MultiPoint',
            coordinates: [
              [-71.0, 42.3],
              [-71.01, 42.31],
            ],
          },
        },
      ],
    });
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].properties?.featureType).toBe('Obstruction');
    expect(fc.features[0].properties?.kind).toBe('ground_wrecks');
    expect(fc.features[1].geometry).toEqual({
      type: 'Point',
      coordinates: [-71.01, 42.31],
    });
  });

  it('returns empty for missing features', () => {
    expect(mapNoaaWrecksToFc({}).features).toHaveLength(0);
    expect(mapNoaaWrecksToFc(null).features).toHaveLength(0);
  });

  it('skips non-point geometries and bad coordinates', () => {
    const fc = mapNoaaWrecksToFc({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { OBJECTID: 1, vesslterms: 'Wreck' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [-71, 42],
              [-71.1, 42.1],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { OBJECTID: 2, vesslterms: 'Wreck' },
          geometry: { type: 'Point', coordinates: ['x', 42] },
        },
      ],
    });
    expect(fc.features).toHaveLength(0);
  });

  it('coastal MA fixture has wrecks; inland empty fixture has none', () => {
    const coastal = mapNoaaWrecksToFc({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { OBJECTID: 1, vesslterms: 'Wreck', history: 'Boston Harbor' },
          geometry: { type: 'Point', coordinates: [-70.95, 42.35] },
        },
      ],
    });
    const inland = mapNoaaWrecksToFc({
      type: 'FeatureCollection',
      features: [],
    });
    expect(coastal.features.length).toBeGreaterThan(0);
    expect(inland.features).toHaveLength(0);
  });
});
