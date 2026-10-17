import type { Feature, FeatureCollection } from 'geojson';
import type { BBox } from './types';
import { fillBbox } from './overpass';
import { pointFeature, emptyFc, capFeatures } from './geojson';

const NIGHTLIFE_QL = `[out:json][timeout:25];
(
  node["amenity"~"^(bar|pub|nightclub|biergarten)$"]({{bbox}});
  node["place"="square"]({{bbox}});
  node["highway"="pedestrian"]["area"="yes"]({{bbox}});
);
out center body;
`;

export function nightlifeQl(bbox: BBox): string {
  return fillBbox(NIGHTLIFE_QL, bbox);
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

/** Map Overpass JSON elements to nightlife Point features. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapNightlifeElementsToFc(data: any): FeatureCollection {
  const elements = data?.elements;
  if (!Array.isArray(elements)) return emptyFc();
  const features: Feature[] = [];
  for (const el of elements) {
    const pt = elementPoint(el);
    if (!pt) continue;
    const tags = (el?.tags ?? {}) as Record<string, string>;
    const id = el?.id ?? features.length;
    features.push(
      pointFeature(`nightlife-${el?.type ?? 'n'}-${id}`, pt.lng, pt.lat, {
        kind: 'ground_nightlife',
        name: tags.name ?? tags['name:en'] ?? null,
        amenity: tags.amenity ?? null,
        place: tags.place ?? null,
        highway: tags.highway ?? null,
        osmId: id,
        osmType: el?.type ?? 'node',
        attribution: 'OpenStreetMap',
      }),
    );
  }
  return capFeatures({ type: 'FeatureCollection', features }, 2000);
}
