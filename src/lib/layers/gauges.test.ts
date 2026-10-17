import { describe, it, expect } from 'vitest';
import { mapUsgsIvToFc } from './gauges';

describe('mapUsgsIvToFc', () => {
  it('maps timeSeries to points', () => {
    const fc = mapUsgsIvToFc({
      value: {
        timeSeries: [
          {
            sourceInfo: {
              siteName: 'Test River',
              siteCode: [{ value: '01100000' }],
              geoLocation: { geogLocation: { latitude: 41.9, longitude: -71.3 } },
            },
            variable: { variableName: 'Streamflow', unit: { unitCode: 'ft3/s' } },
            values: [{ value: [{ value: '12.3', dateTime: '2026-10-14T12:00:00Z' }] }],
          },
        ],
      },
    });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.siteName).toBe('Test River');
  });

  it('returns empty for missing timeSeries', () => {
    expect(mapUsgsIvToFc({}).features).toHaveLength(0);
    expect(mapUsgsIvToFc(null).features).toHaveLength(0);
  });

  it('skips series without finite coordinates', () => {
    const fc = mapUsgsIvToFc({
      value: {
        timeSeries: [
          {
            sourceInfo: {
              siteName: 'Bad',
              siteCode: [{ value: 'x' }],
              geoLocation: { geogLocation: { latitude: 'n/a', longitude: -71 } },
            },
            variable: { variableName: 'Streamflow', unit: { unitCode: 'ft3/s' } },
            values: [{ value: [{ value: '1', dateTime: '2026-10-14T12:00:00Z' }] }],
          },
        ],
      },
    });
    expect(fc.features).toHaveLength(0);
  });
});
