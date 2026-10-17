import { describe, it, expect } from 'vitest';
import { LANDING_CITIES, STARTUP_CITY, STARTUP_ZOOM, randomLandingCity } from './landing-cities';

describe('STARTUP_CITY', () => {
  it('is North Attleboro at a town-scale zoom', () => {
    expect(STARTUP_CITY.name).toBe('North Attleboro');
    expect(STARTUP_CITY.lat).toBeCloseTo(41.9834, 3);
    expect(STARTUP_CITY.lng).toBeCloseTo(-71.3328, 3);
    expect(STARTUP_ZOOM).toBeGreaterThanOrEqual(10);
    expect(STARTUP_ZOOM).toBeLessThanOrEqual(14);
  });
});

describe('LANDING_CITIES', () => {
  it('holds real, distinct coordinates', () => {
    const names = new Set<string>();
    for (const c of LANDING_CITIES) {
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lng)).toBeLessThanOrEqual(180);
      names.add(c.name);
    }
    expect(names.size).toBe(LANDING_CITIES.length);
  });
});

describe('randomLandingCity', () => {
  it('can land on every city, from the first to the last', () => {
    expect(randomLandingCity(null, () => 0)).toBe(LANDING_CITIES[0]);
    expect(randomLandingCity(null, () => 0.999999)).toBe(LANDING_CITIES[LANDING_CITIES.length - 1]);
  });

  it('never repeats the city it was told to avoid', () => {
    const last = LANDING_CITIES[0].name;
    for (let i = 0; i < 50; i++) {
      expect(randomLandingCity(last, () => i / 50).name).not.toBe(last);
    }
  });

  it('stays in range even if the random source returns exactly 1', () => {
    expect(LANDING_CITIES).toContain(randomLandingCity(null, () => 1));
  });
});
