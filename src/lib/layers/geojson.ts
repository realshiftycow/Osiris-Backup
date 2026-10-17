import type { Feature, FeatureCollection, Geometry } from 'geojson';

export function emptyFc(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

export function pointFeature(
  id: string | number,
  lng: number,
  lat: number,
  properties: Record<string, unknown>,
): Feature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { ...properties, id },
  };
}

export function featureOf(
  id: string | number,
  geometry: Geometry,
  properties: Record<string, unknown>,
): Feature {
  return { type: 'Feature', id, geometry, properties: { ...properties, id } };
}

export function capFeatures(fc: FeatureCollection, max: number): FeatureCollection {
  if (fc.features.length <= max) return fc;
  return { type: 'FeatureCollection', features: fc.features.slice(0, max) };
}
