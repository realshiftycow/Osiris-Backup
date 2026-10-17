import { describe, it, expect } from 'vitest';
import { bboxToOverpass, fillBbox } from './overpass';
import { nightlifeQl, mapNightlifeElementsToFc } from './nightlife';
import { abandonedQl, mapAbandonedElementsToFc } from './abandoned';
import type { BBox } from './types';

const bbox: BBox = { west: -71.5, south: 41.7, east: -71.2, north: 42.0 };

describe('bboxToOverpass / fillBbox', () => {
  it('formats south,west,north,east', () => {
    expect(bboxToOverpass(bbox)).toBe('41.7,-71.5,42,-71.2');
  });

  it('substitutes {{bbox}} in QL', () => {
    expect(fillBbox('n({{bbox}});', bbox)).toBe('n(41.7,-71.5,42,-71.2);');
  });
});

describe('nightlifeQl', () => {
  it('embeds Overpass bbox and amenity filters', () => {
    const ql = nightlifeQl(bbox);
    expect(ql).toContain('41.7,-71.5,42,-71.2');
    expect(ql).toContain('amenity');
    expect(ql).not.toContain('{{bbox}}');
  });
});

describe('mapNightlifeElementsToFc', () => {
  it('maps amenity nodes to ground_nightlife points', () => {
    const fc = mapNightlifeElementsToFc({
      elements: [
        {
          type: 'node',
          id: 101,
          lat: 41.82,
          lon: -71.41,
          tags: { name: 'The Tap', amenity: 'bar' },
        },
        {
          type: 'node',
          id: 102,
          lat: 41.83,
          lon: -71.42,
          tags: { place: 'square', name: 'City Plaza' },
        },
      ],
    });
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [-71.41, 41.82],
    });
    expect(fc.features[0].properties).toMatchObject({
      kind: 'ground_nightlife',
      name: 'The Tap',
      amenity: 'bar',
      osmId: 101,
      attribution: 'OpenStreetMap',
    });
    expect(fc.features[1].properties).toMatchObject({
      kind: 'ground_nightlife',
      place: 'square',
      name: 'City Plaza',
    });
  });

  it('returns empty for missing elements / bad coords', () => {
    expect(mapNightlifeElementsToFc({}).features).toHaveLength(0);
    expect(mapNightlifeElementsToFc(null).features).toHaveLength(0);
    expect(
      mapNightlifeElementsToFc({
        elements: [{ type: 'node', id: 1, tags: { amenity: 'bar' } }],
      }).features,
    ).toHaveLength(0);
  });
});

describe('abandonedQl', () => {
  it('embeds railway and industrial filters', () => {
    const ql = abandonedQl(bbox);
    expect(ql).toContain('railway');
    expect(ql).toContain('abandoned:industrial');
    expect(ql).toContain('41.7,-71.5,42,-71.2');
  });
});

describe('mapAbandonedElementsToFc', () => {
  it('maps ways with geometry to LineString rail', () => {
    const fc = mapAbandonedElementsToFc({
      elements: [
        {
          type: 'way',
          id: 501,
          center: { lat: 41.8, lon: -71.4 },
          geometry: [
            { lat: 41.801, lon: -71.401 },
            { lat: 41.802, lon: -71.402 },
            { lat: 41.803, lon: -71.403 },
          ],
          tags: { railway: 'abandoned', name: 'Old Spur' },
        },
      ],
    });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.type).toBe('LineString');
    expect(fc.features[0].geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [-71.401, 41.801],
        [-71.402, 41.802],
        [-71.403, 41.803],
      ],
    });
    expect(fc.features[0].properties).toMatchObject({
      kind: 'ground_abandoned',
      subkind: 'rail',
      name: 'Old Spur',
      osmId: 501,
      attribution: 'OpenStreetMap',
    });
  });

  it('falls back to center Point when way has no geometry', () => {
    const fc = mapAbandonedElementsToFc({
      elements: [
        {
          type: 'way',
          id: 502,
          center: { lat: 41.81, lon: -71.41 },
          tags: { railway: 'disused' },
        },
      ],
    });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [-71.41, 41.81],
    });
    expect(fc.features[0].properties?.subkind).toBe('rail');
  });

  it('maps industrial nodes with subkind industrial', () => {
    const fc = mapAbandonedElementsToFc({
      elements: [
        {
          type: 'node',
          id: 601,
          lat: 41.9,
          lon: -71.3,
          tags: { 'abandoned:industrial': 'factory', name: 'Mill' },
        },
        {
          type: 'node',
          id: 602,
          lat: 41.91,
          lon: -71.31,
          tags: { industrial: 'warehouse', disused: 'yes' },
        },
      ],
    });
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].properties).toMatchObject({
      kind: 'ground_abandoned',
      subkind: 'industrial',
      name: 'Mill',
    });
    expect(fc.features[1].properties?.subkind).toBe('industrial');
  });

  it('returns empty for missing elements', () => {
    expect(mapAbandonedElementsToFc({}).features).toHaveLength(0);
    expect(mapAbandonedElementsToFc(null).features).toHaveLength(0);
  });
});
