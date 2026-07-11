import type { RGB } from './types';

/**
 * Fixed multi-stop gradient: blue → cyan → green (narrow) → yellow → red.
 * Green occupies only a thin band around the midpoint so that yellow and warm
 * tones are more visually prominent across the upper half of the range.
 * Each stop maps a normalised scalar t ∈ [0, 1] to an RGB triplet.
 */
const GRADIENT_STOPS: Array<{ t: number; rgb: RGB }> = [
  { t: 0.00, rgb: [0,   0,   255] }, // blue
  { t: 0.25, rgb: [0,   255, 255] }, // cyan  (band starts)
  { t: 0.30, rgb: [0,   255, 255] }, // cyan  (band ends)
  { t: 0.40, rgb: [0,   255, 0  ] }, // green (band starts)
  { t: 0.65, rgb: [255, 255, 0  ] }, // yellow (band ends)
  { t: 1.00, rgb: [255, 0,   0  ] }, // red
];

/**
 * Map a normalised scalar t ∈ [0, 1] to an RGB color using the fixed gradient.
 * Values outside [0, 1] are clamped to the nearest endpoint color.
 */
export function gradientColor(t: number): RGB {
  const clamped = Math.max(0, Math.min(1, t));

  for (let i = 1; i < GRADIENT_STOPS.length; i++) {
    const lo = GRADIENT_STOPS[i - 1];
    const hi = GRADIENT_STOPS[i];
    if (clamped <= hi.t) {
      const f = (clamped - lo.t) / (hi.t - lo.t);
      return [
        Math.round(lo.rgb[0] + f * (hi.rgb[0] - lo.rgb[0])),
        Math.round(lo.rgb[1] + f * (hi.rgb[1] - lo.rgb[1])),
        Math.round(lo.rgb[2] + f * (hi.rgb[2] - lo.rgb[2])),
      ];
    }
  }

  return [...GRADIENT_STOPS[GRADIENT_STOPS.length - 1].rgb];
}

/**
 * Map an absolute scalar value to an RGB color given a min/max range.
 * Values outside [minValue, maxValue] are clamped.
 * If minValue === maxValue, returns the midpoint gradient color.
 */
export function valueToColor(value: number, minValue: number, maxValue: number): RGB {
  const range = maxValue - minValue;
  const t = range === 0 ? 0.5 : (value - minValue) / range;
  return gradientColor(t);
}
