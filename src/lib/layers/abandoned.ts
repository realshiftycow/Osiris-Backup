import type { Feature, FeatureCollection, LineString, Position } from 'geojson';
import type { BBox } from './types';
import { fillBbox } from './overpass';
import { pointFeature, featureOf, emptyFc, capFeatures } from './geojson';

const ABANDONED_QL = `[out:json][timeout:25];
(
  way["railway"~"^(abandoned|disused)$"]({{bbox}});
  node["railway"~"^(abandoned|disused)$"]({{bbox}});
  node["abandoned:industrial"]({{bbox}});
  node["industrial"]["disused"="yes"]({{bbox}});
);
out center body geom;
`;

export function abandonedQl(bbox: BBox): string {
  return fillBbox(ABANDONED_QL, bbox);
}

function isRail(tags: Record<string, string>): boolean {
  const rw = tags.railway;
  return rw === 'abandoned' || rw === 'disused';
}

function elementPoint(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el: any,
): { lng: number; lat: number } | null {
  const lat = el?.lat ?? el?.center?.lat;
  const lng = el?.lon ?? el?.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lng, lat };
}

function wayLineGeometry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el: any,
): LineString | null {
  const geom = el?.geometry;
  if (!Array.isArray(geom) || geom.length < 2) return null;
  const coordinates: Position[] = [];
  for (const g of geom) {
    const lat = g?.lat;
    const lon = g?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    coordinates.push([lon, lat]);
  }
  if (coordinates.length < 2) return null;
  return { type: 'LineString', coordinates };
}

/** Map Overpass JSON elements to abandoned rail/industrial features. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapAbandonedElementsToFc(data: any): FeatureCollection {
  const elements = data?.elements;
  if (!Array.isArray(elements)) return emptyFc();
  const features: Feature[] = [];
  for (const el of elements) {
    const tags = (el?.tags ?? {}) as Record<string, string>;
    const subkind = isRail(tags) ? 'rail' : 'industrial';
    const id = el?.id ?? features.length;
    const props = {
      kind: 'ground_abandoned',
      subkind,
      name: tags.name ?? tags['name:en'] ?? null,
      railway: tags.railway ?? null,
      industrial: tags.industrial ?? tags['abandoned:industrial'] ?? null,
      osmId: id,
      osmType: el?.type ?? 'node',
      attribution: 'OpenStreetMap',
    };

    if (el?.type === 'way') {
      const line = wayLineGeometry(el);
      if (line) {
        features.push(featureOf(`abandoned-way-${id}`, line, props));
        continue;
      }
      const pt = elementPoint(el);
      if (pt) {
        features.push(pointFeature(`abandoned-way-${id}`, pt.lng, pt.lat, props));
      }
      continue;
    }

    const pt = elementPoint(el);
    if (!pt) continue;
    features.push(
      pointFeature(`abandoned-${el?.type ?? 'n'}-${id}`, pt.lng, pt.lat, props),
    );
  }
  return capFeatures({ type: 'FeatureCollection', features }, 2000);
}
