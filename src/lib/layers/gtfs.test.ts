import { describe, it, expect } from 'vitest';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import {
  agenciesForBbox,
  agencyBboxIntersects,
  decodeVehiclePositions,
  mergeGtfsFc,
  type GtfsAgency,
} from './gtfs';

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;

function encodeFixture(): Uint8Array {
  const msg = FeedMessage.create({
    header: { gtfsRealtimeVersion: '2.0', timestamp: 1 },
    entity: [
      {
        id: 'v1',
        vehicle: {
          trip: { tripId: 't1', routeId: 'Red' },
          vehicle: { id: 'bus1', label: '1' },
          position: { latitude: 42.36, longitude: -71.06, bearing: 90, speed: 5 },
          timestamp: 1234567890,
        },
      },
      {
        id: 'v2',
        vehicle: {
          vehicle: { id: 'bus2' },
          position: { latitude: 40.75, longitude: -73.99 },
        },
      },
      {
        id: 'skip-no-pos',
        vehicle: { vehicle: { id: 'bus3' } },
      },
    ],
  });
  return FeedMessage.encode(msg).finish();
}

const registry: GtfsAgency[] = [
  {
    id: 'mbta',
    name: 'MBTA',
    vehicleUrl: 'https://cdn.mbta.com/realtime/VehiclePositions.pb',
    bbox: [-71.9, 41.5, -69.9, 42.9],
  },
  {
    id: 'mta-bus',
    name: 'MTA NYCT Bus',
    vehicleUrl: 'https://gtfsrt.prod.obanyc.com/vehiclePositions',
    bbox: [-74.3, 40.4, -73.6, 41.0],
  },
  {
    id: 'riptide',
    name: 'RIPTA',
    vehicleUrl: '',
    bbox: [-71.9, 41.3, -71.1, 42.0],
    disabled: true,
  },
];

describe('agencyBboxIntersects', () => {
  it('detects overlap', () => {
    expect(
      agencyBboxIntersects([-71.9, 41.5, -69.9, 42.9], {
        west: -71.5,
        south: 42.0,
        east: -71.0,
        north: 42.5,
      }),
    ).toBe(true);
  });

  it('rejects disjoint boxes', () => {
    expect(
      agencyBboxIntersects([-71.9, 41.5, -69.9, 42.9], {
        west: -74,
        south: 40,
        east: -73,
        north: 41,
      }),
    ).toBe(false);
  });
});

describe('agenciesForBbox', () => {
  it('returns enabled agencies intersecting bbox with a URL', () => {
    const hits = agenciesForBbox(registry, {
      west: -71.5,
      south: 42.0,
      east: -71.0,
      north: 42.5,
    });
    expect(hits.map((a) => a.id)).toEqual(['mbta']);
  });

  it('skips disabled and empty URL even when bbox overlaps', () => {
    // South of MBTA min-lat (41.5) so only RIPTA's disabled entry intersects.
    const hits = agenciesForBbox(registry, {
      west: -71.8,
      south: 41.3,
      east: -71.2,
      north: 41.45,
    });
    expect(hits).toHaveLength(0);
  });
});

describe('decodeVehiclePositions', () => {
  it('maps VehiclePosition entities to ground_gtfs points', () => {
    const fc = decodeVehiclePositions(encodeFixture(), { id: 'mbta', name: 'MBTA' });
    expect(fc.features).toHaveLength(2);
    const f = fc.features[0];
    expect(f.properties?.kind).toBe('ground_gtfs');
    expect(f.properties?.agencyId).toBe('mbta');
    expect(f.properties?.routeId).toBe('Red');
    expect(f.geometry?.type).toBe('Point');
    const [lng, lat] = (f.geometry as { coordinates: number[] }).coordinates;
    expect(lng).toBeCloseTo(-71.06, 4);
    expect(lat).toBeCloseTo(42.36, 4);
  });

  it('filters by request bbox when provided', () => {
    const fc = decodeVehiclePositions(encodeFixture(), { id: 'mbta', name: 'MBTA' }, {
      west: -71.2,
      south: 42.3,
      east: -70.9,
      north: 42.4,
    });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.vehicleId).toBe('bus1');
  });

  it('returns empty FC for invalid protobuf', () => {
    expect(decodeVehiclePositions(new Uint8Array([1, 2, 3]), { id: 'x', name: 'X' }).features).toHaveLength(0);
  });
});

describe('mergeGtfsFc', () => {
  it('concatenates feature collections', () => {
    const a = decodeVehiclePositions(encodeFixture(), { id: 'mbta', name: 'MBTA' }, {
      west: -72,
      south: 42,
      east: -70,
      north: 43,
    });
    const b = decodeVehiclePositions(encodeFixture(), { id: 'mta-bus', name: 'MTA' }, {
      west: -74,
      south: 40,
      east: -73,
      north: 41,
    });
    const merged = mergeGtfsFc([a, b]);
    expect(merged.features).toHaveLength(2);
  });
});
