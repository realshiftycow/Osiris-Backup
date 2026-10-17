import type { Feature, FeatureCollection } from 'geojson';
import { pointFeature, emptyFc, capFeatures } from './geojson';

function prop(
  props: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const k of keys) {
    if (props[k] != null && props[k] !== '') return props[k];
  }
  return undefined;
}

function mapProps(raw: Record<string, unknown>): Record<string, unknown> {
  const featureType =
    prop(raw, 'featureType', 'FeatureType', 'vesslterms', 'VESSLTERMS') ?? null;
  const name =
    prop(raw, 'name', 'NAME', 'history', 'HISTORY', 'vesslterms', 'VESSLTERMS') ??
    'Wreck';
  return {
    kind: 'ground_wrecks',
    name: typeof name === 'string' ? name : String(name),
    featureType: featureType == null ? null : String(featureType),
    depth: prop(raw, 'depth', 'DEPTH') ?? null,
    chart: prop(raw, 'chart', 'CHART') ?? null,
    record: prop(raw, 'recrd', 'RECRD', 'record') ?? null,
    attribution: 'NOAA',
  };
}

/** NOAA ArcGIS GeoJSON is loosely shaped; keep the mapper permissive. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapNoaaWrecksToFc(data: any): FeatureCollection {
  const incoming = data?.features;
  if (!Array.isArray(incoming)) return emptyFc();
  const features: Feature[] = [];
  for (const f of incoming) {
    const geom = f?.geometry;
    const raw = (f?.properties ?? {}) as Record<string, unknown>;
    const mapped = mapProps(raw);
    const idBase =
      prop(raw, 'OBJECTID', 'objectid', 'OBJECTID_1', 'recrd', 'RECRD') ??
      features.length;

    if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
      const [lng, lat] = geom.coordinates;
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        features.push(pointFeature(`wreck-${idBase}`, lng, lat, mapped));
      }
      continue;
    }

    if (geom?.type === 'MultiPoint' && Array.isArray(geom.coordinates)) {
      for (let i = 0; i < geom.coordinates.length; i++) {
        const coord = geom.coordinates[i];
        if (!Array.isArray(coord)) continue;
        const [lng, lat] = coord;
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        features.push(pointFeature(`wreck-${idBase}-${i}`, lng, lat, mapped));
      }
    }
  }
  return capFeatures({ type: 'FeatureCollection', features }, 2000);
}
