export type TemperatureScaleMode = 'fixed' | 'auto' | 'percentile';

export interface TemperatureScaleOptions {
  mode: TemperatureScaleMode;
  minValue: number;
  maxValue: number;
  padding: number;
  minSpan: number;
  lowerPercentile?: number;
  upperPercentile?: number;
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
 * Fixed mode always returns the configured min/max. Auto mode uses the full
 * valid reading range; percentile mode uses configurable quantiles to reduce
 * the influence of extreme readings. Both adaptive modes add padding, enforce
 * a minimum span, then apply optional safety clamps.
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

  const sortedValues = [...finiteValues].sort((a, b) => a - b);
  const lower = options.mode === 'percentile'
    ? quantile(sortedValues, options.lowerPercentile ?? 10)
    : sortedValues[0];
  const upper = options.mode === 'percentile'
    ? quantile(sortedValues, options.upperPercentile ?? 90)
    : sortedValues[sortedValues.length - 1];

  let min = lower - Math.max(0, options.padding);
  let max = upper + Math.max(0, options.padding);
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

/** Linear-interpolated percentile with inputs constrained to [0, 100]. */
function quantile(sortedValues: readonly number[], percentile: number): number {
  const p = Math.max(0, Math.min(100, percentile)) / 100;
  const index = (sortedValues.length - 1) * p;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const fraction = index - lowerIndex;
  return sortedValues[lowerIndex] + fraction * (sortedValues[upperIndex] - sortedValues[lowerIndex]);
}
