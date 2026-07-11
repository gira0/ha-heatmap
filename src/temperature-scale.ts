export type TemperatureScaleMode = 'fixed' | 'auto';

export interface TemperatureScaleOptions {
  mode: TemperatureScaleMode;
  minValue: number;
  maxValue: number;
  padding: number;
  minSpan: number;
  clampMin?: number;
  clampMax?: number;
}

export interface TemperatureRange {
  min: number;
  max: number;
}

/**
 * Resolve the color range for the current sensor readings.
 *
 * Fixed mode always returns the configured min/max. Auto mode expands the
 * current valid reading range by padding, ensures a minimum span around its
 * midpoint, then applies optional safety clamps.
 */
export function resolveTemperatureRange(
  values: readonly number[],
  options: TemperatureScaleOptions,
): TemperatureRange {
  if (options.mode === 'fixed' || values.length === 0) {
    return { min: options.minValue, max: options.maxValue };
  }

  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) {
    return { min: options.minValue, max: options.maxValue };
  }

  let min = Math.min(...finiteValues) - Math.max(0, options.padding);
  let max = Math.max(...finiteValues) + Math.max(0, options.padding);
  const minimumSpan = Math.max(0, options.minSpan);

  if (max - min < minimumSpan) {
    const midpoint = (min + max) / 2;
    min = midpoint - minimumSpan / 2;
    max = midpoint + minimumSpan / 2;
  }

  if (options.clampMin !== undefined) min = Math.max(min, options.clampMin);
  if (options.clampMax !== undefined) max = Math.min(max, options.clampMax);

  // Invalid or inverted clamps must not break color interpolation.
  if (max <= min) {
    return { min: options.minValue, max: options.maxValue };
  }

  return { min, max };
}
