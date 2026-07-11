import { describe, expect, it } from 'vitest';
import { resolveTemperatureRange } from './temperature-scale';

const fixed = {
  mode: 'fixed' as const,
  minValue: 18,
  maxValue: 27,
  padding: 2,
  minSpan: 6,
};

describe('resolveTemperatureRange', () => {
  it('keeps configured bounds in fixed mode', () => {
    expect(resolveTemperatureRange([26.9, 28.6, 35], fixed)).toEqual({ min: 18, max: 27 });
  });

  it('pads the readings in auto mode', () => {
    expect(resolveTemperatureRange([26.9, 28.6], { ...fixed, mode: 'auto' }))
      .toEqual({ min: 24.75, max: 30.75 });
  });

  it('enforces a minimum span around a single reading', () => {
    expect(resolveTemperatureRange([28], { ...fixed, mode: 'auto' }))
      .toEqual({ min: 25, max: 31 });
  });

  it('uses fixed bounds with no valid readings', () => {
    expect(resolveTemperatureRange([], { ...fixed, mode: 'auto' }))
      .toEqual({ min: 18, max: 27 });
  });

  it('applies optional safety clamps', () => {
    expect(resolveTemperatureRange([26.9, 35], {
      ...fixed,
      mode: 'auto',
      clampMin: 15,
      clampMax: 35,
    })).toEqual({ min: 24.9, max: 35 });
  });

  it('uses percentiles to reduce the influence of an extreme reading', () => {
    expect(resolveTemperatureRange([26, 27, 28, 29, 35], {
      ...fixed,
      mode: 'percentile',
      padding: 0,
      minSpan: 0,
      lowerPercentile: 25,
      upperPercentile: 75,
    })).toEqual({ min: 27, max: 29 });
  });

  it('constrains invalid percentile values to the available range', () => {
    expect(resolveTemperatureRange([20, 30], {
      ...fixed,
      mode: 'percentile',
      padding: 0,
      minSpan: 0,
      lowerPercentile: -10,
      upperPercentile: 110,
    })).toEqual({ min: 20, max: 30 });
  });

  it('falls back to configured bounds for inverted clamps', () => {
    expect(resolveTemperatureRange([28], {
      ...fixed,
      mode: 'auto',
      clampMin: 30,
      clampMax: 25,
    })).toEqual({ min: 18, max: 27 });
  });
});
