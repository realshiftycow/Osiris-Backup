// src/lib/layers/bbox.test.ts
import { describe, it, expect } from 'vitest';
import { parseBbox, roundBbox } from './bbox';

describe('parseBbox', () => {
  it('parses west,south,east,north', () => {
    expect(parseBbox('-71.5,41.7,-71.2,42.0')).toEqual({
      west: -71.5, south: 41.7, east: -71.2, north: 42.0,
    });
  });
  it('rejects inverted or out-of-range', () => {
    expect(parseBbox('1,2,0,3')).toBeNull();
    expect(parseBbox('')).toBeNull();
    expect(parseBbox(null)).toBeNull();
  });
});

describe('roundBbox', () => {
  it('rounds for cache keys', () => {
    const r = roundBbox({ west: -71.12345, south: 41.98765, east: -71.1, north: 42.0 }, 2);
    expect(r.west).toBe(-71.13);
    expect(r.south).toBe(41.98);
    expect(r.east).toBe(-71.09);
    expect(r.north).toBe(42);
  });
});
