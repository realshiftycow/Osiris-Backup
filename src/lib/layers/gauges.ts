import type { Feature, FeatureCollection } from 'geojson';
import { pointFeature, emptyFc, capFeatures } from './geojson';

/** USGS NWIS IV JSON is loosely shaped; keep the mapper permissive. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapUsgsIvToFc(data: any): FeatureCollection {
  const series = data?.value?.timeSeries;
  if (!Array.isArray(series)) return emptyFc();
  const features: Feature[] = [];
  for (const s of series) {
    const lat = s?.sourceInfo?.geoLocation?.geogLocation?.latitude;
    const lng = s?.sourceInfo?.geoLocation?.geogLocation?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const code = s?.sourceInfo?.siteCode?.[0]?.value ?? String(features.length);
    const v = s?.values?.[0]?.value?.[0];
    features.push(
      pointFeature(`usgs-${code}`, lng, lat, {
        kind: 'ground_gauges',
        siteName: s?.sourceInfo?.siteName ?? code,
        siteCode: code,
        value: v?.value ?? null,
        unit: s?.variable?.unit?.unitCode ?? null,
        parameter: s?.variable?.variableName ?? null,
        observedAt: v?.dateTime ?? null,
        url: `https://waterdata.usgs.gov/monitoring-location/${code}/`,
        attribution: 'USGS',
      }),
    );
  }
  return capFeatures({ type: 'FeatureCollection', features }, 2000);
}
