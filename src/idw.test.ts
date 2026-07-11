import { describe, it, expect } from 'vitest';
import { idwInterpolate } from './idw';

describe('idwInterpolate', () => {
  it('returns NaN for empty points array', () => {
    expect(idwInterpolate(0.5, 0.5, [], 2)).toBeNaN();
  });

  it('returns the exact sensor value when query is at sensor location', () => {
    const points = [{ x: 0.5, y: 0.5, value: 21 }];
    expect(idwInterpolate(0.5, 0.5, points, 2)).toBe(21);
  });

  it('returns the only sensor value for any query when there is one point', () => {
    const points = [{ x: 0.5, y: 0.5, value: 21 }];
    expect(idwInterpolate(0.1, 0.9, points, 2)).toBe(21);
  });

  it('returns the average at the midpoint between two equal-distance sensors', () => {
    const points = [
      { x: 0.0, y: 0.0, value: 18 },
      { x: 1.0, y: 0.0, value: 27 },
    ];
    const val = idwInterpolate(0.5, 0.0, points, 2);
    expect(val).toBeCloseTo(22.5, 10);
  });

  it('interpolates towards the nearer sensor', () => {
    const points = [
      { x: 0.0, y: 0.0, value: 18 },
      { x: 1.0, y: 0.0, value: 27 },
    ];
    // Querying close to the cold sensor — result should be well below midpoint
    const val = idwInterpolate(0.1, 0.0, points, 2);
    expect(val).toBeGreaterThan(18);
    expect(val).toBeLessThan(22.5);
  });

  it('higher power sharpens sensor influence (value near cold sensor is lower)', () => {
    const points = [
      { x: 0.0, y: 0.0, value: 0 },
      { x: 1.0, y: 0.0, value: 100 },
    ];
    const lowPower  = idwInterpolate(0.2, 0.0, points, 1);
    const highPower = idwInterpolate(0.2, 0.0, points, 4);
    // With p=4, the nearby cold sensor dominates more → lower value
    expect(highPower).toBeLessThan(lowPower);
  });

  it('handles multiple sensors and returns a value within the sensor value range', () => {
    const points = [
      { x: 0.0, y: 0.0, value: 18 },
      { x: 1.0, y: 0.0, value: 27 },
      { x: 0.5, y: 1.0, value: 22 },
    ];
    const val = idwInterpolate(0.5, 0.5, points, 2);
    expect(val).toBeGreaterThan(18);
    expect(val).toBeLessThan(27);
  });

  it('returns exact value when one of multiple sensors coincides with the query', () => {
    const points = [
      { x: 0.3, y: 0.3, value: 20 },
      { x: 0.7, y: 0.7, value: 25 },
    ];
    expect(idwInterpolate(0.3, 0.3, points, 2)).toBe(20);
    expect(idwInterpolate(0.7, 0.7, points, 2)).toBe(25);
  });
});
