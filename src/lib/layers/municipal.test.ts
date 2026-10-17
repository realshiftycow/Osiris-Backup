import { describe, it, expect } from 'vitest';
import {
  buildArcgisUrl,
  buildSocrataUrl,
  citiesForBbox,
  cityBboxIntersects,
  mapArcgisQueryToFc,
  mapSocrataRowsToFc,
  mergeMunicipalFc,
  type MunicipalCity,
  type MunicipalEndpoint,
} from './municipal';

const registry: MunicipalCity[] = [
  {
    id: 'nyc',
    name: 'New York City',
    bbox: [-74.3, 40.4, -73.6, 41.0],
    threeOneOne: {
      type: 'socrata',
      url: 'https://data.cityofnewyork.us/resource/erm2-nwe9.json',
      latField: 'latitude',
      lngField: 'longitude',
      idField: 'unique_key',
      nameField: 'complaint_type',
      limit: 100,
    },
  },
  {
    id: 'chicago',
    name: 'Chicago',
    bbox: [-87.95, 41.64, -87.5, 42.03],
    threeOneOne: {
      type: 'socrata',
      url: 'https://data.cityofchicago.org/resource/v6vf-nfxy.json',
      latField: 'latitude',
      lngField: 'longitude',
      limit: 100,
    },
    vacant: {
      type: 'socrata',
      url: 'https://data.cityofchicago.org/resource/yama-9had.json',
      latField: 'latitude',
      lngField: 'longitude',
      limit: 100,
    },
  },
  {
    id: 'disabled-city',
    name: 'Disabled',
    bbox: [-74.3, 40.4, -73.6, 41.0],
    disabled: true,
    threeOneOne: {
      type: 'socrata',
      url: 'https://example.com/x.json',
      latField: 'latitude',
      lngField: 'longitude',
    },
  },
];

const socrataEp: MunicipalEndpoint = {
  type: 'socrata',
  url: 'https://example.com/resource/abc.json',
  latField: 'latitude',
  lngField: 'longitude',
  idField: 'unique_key',
  nameField: 'complaint_type',
  statusField: 'status',
  openedField: 'created_date',
  addressField: 'incident_address',
  limit: 50,
};

const arcgisEp: MunicipalEndpoint = {
  type: 'arcgis',
  url: 'https://services.arcgis.com/example/FeatureServer/0/query',
  latField: 'y',
  lngField: 'x',
  idField: 'objectid',
  nameField: 'address',
  addressField: 'address',
  limit: 50,
};

describe('cityBboxIntersects', () => {
  it('detects overlap', () => {
    expect(
      cityBboxIntersects([-74.3, 40.4, -73.6, 41.0], {
        west: -74.0,
        south: 40.7,
        east: -73.9,
        north: 40.8,
      }),
    ).toBe(true);
  });

  it('rejects disjoint boxes', () => {
    expect(
      cityBboxIntersects([-74.3, 40.4, -73.6, 41.0], {
        west: -87.9,
        south: 41.7,
        east: -87.6,
        north: 41.9,
      }),
    ).toBe(false);
  });
});

describe('citiesForBbox', () => {
  it('returns intersecting enabled cities', () => {
    const hits = citiesForBbox(registry, {
      west: -74.1,
      south: 40.6,
      east: -73.9,
      north: 40.8,
    });
    expect(hits.map((c) => c.id)).toEqual(['nyc']);
  });

  it('skips disabled cities even when bbox overlaps', () => {
    const hits = citiesForBbox(registry, {
      west: -74.1,
      south: 40.6,
      east: -73.9,
      north: 40.8,
    });
    expect(hits.some((c) => c.id === 'disabled-city')).toBe(false);
  });
});

describe('mapSocrataRowsToFc', () => {
  it('maps rows to ground_civic_311 points', () => {
    const fc = mapSocrataRowsToFc(
      [
        {
          unique_key: '1',
          complaint_type: 'Noise',
          status: 'Open',
          created_date: '2026-01-01T00:00:00.000',
          incident_address: '1 Main St',
          latitude: '40.75',
          longitude: '-73.99',
        },
        { unique_key: '2', complaint_type: 'Skip', latitude: 'bad', longitude: '-73.99' },
      ],
      { id: 'nyc', name: 'New York City' },
      socrataEp,
      'ground_civic_311',
    );
    expect(fc.features).toHaveLength(1);
    const f = fc.features[0]!;
    expect(f.properties?.kind).toBe('ground_civic_311');
    expect(f.properties?.name).toBe('Noise');
    expect(f.properties?.city).toBe('New York City');
    expect(f.geometry?.type).toBe('Point');
    const [lng, lat] = (f.geometry as { coordinates: number[] }).coordinates;
    expect(lng).toBeCloseTo(-73.99, 4);
    expect(lat).toBeCloseTo(40.75, 4);
  });

  it('filters by request bbox', () => {
    const fc = mapSocrataRowsToFc(
      [
        { unique_key: 'in', complaint_type: 'A', latitude: 40.75, longitude: -73.99 },
        { unique_key: 'out', complaint_type: 'B', latitude: 41.5, longitude: -73.99 },
      ],
      { id: 'nyc', name: 'NYC' },
      socrataEp,
      'ground_civic_311',
      { west: -74.0, south: 40.7, east: -73.9, north: 40.8 },
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties?.name).toBe('A');
  });
});

describe('mapArcgisQueryToFc', () => {
  it('maps point geometries to ground_vacant', () => {
    const fc = mapArcgisQueryToFc(
      {
        features: [
          {
            attributes: { objectid: 9, address: '100 Vacant St' },
            geometry: { x: -75.15, y: 39.95 },
          },
        ],
      },
      { id: 'philadelphia', name: 'Philadelphia' },
      arcgisEp,
      'ground_vacant',
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties?.kind).toBe('ground_vacant');
    expect(fc.features[0]!.properties?.name).toBe('100 Vacant St');
    const [lng, lat] = (fc.features[0]!.geometry as { coordinates: number[] }).coordinates;
    expect(lng).toBeCloseTo(-75.15, 4);
    expect(lat).toBeCloseTo(39.95, 4);
  });

  it('returns empty FC for malformed payload', () => {
    expect(
      mapArcgisQueryToFc({ error: true }, { id: 'x', name: 'X' }, arcgisEp, 'ground_vacant').features,
    ).toHaveLength(0);
  });
});

describe('buildSocrataUrl / buildArcgisUrl', () => {
  const bbox = { west: -74.0, south: 40.7, east: -73.9, north: 40.8 };

  it('adds $where and $limit for Socrata', () => {
    const url = buildSocrataUrl(socrataEp, bbox);
    expect(url).toContain('$where=');
    expect(url).toContain('latitude');
    expect(url).toContain('$limit=50');
  });

  it('adds envelope geometry for ArcGIS', () => {
    const url = buildArcgisUrl(arcgisEp, bbox);
    expect(url).toContain('geometryType=esriGeometryEnvelope');
    expect(url).toContain('outSR=4326');
    expect(url).toContain('resultRecordCount=50');
  });
});

describe('mergeMunicipalFc', () => {
  it('concatenates collections', () => {
    const a = mapSocrataRowsToFc(
      [{ unique_key: '1', complaint_type: 'A', latitude: 40.75, longitude: -73.99 }],
      { id: 'nyc', name: 'NYC' },
      socrataEp,
      'ground_civic_311',
    );
    const b = mapArcgisQueryToFc(
      { features: [{ attributes: { objectid: 1, address: 'X' }, geometry: { x: -75.1, y: 39.9 } }] },
      { id: 'philadelphia', name: 'Philadelphia' },
      arcgisEp,
      'ground_vacant',
    );
    expect(mergeMunicipalFc([a, b]).features).toHaveLength(2);
  });
});
