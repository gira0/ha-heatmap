import type { SensorPoint } from './types';

/**
 * Compute the IDW-interpolated value at (px, py) from a set of sensor points.
 *
 * Uses the standard Shepard formula:
 *   z(x) = Σ w_i·z_i / Σ w_i   where w_i = 1 / dist(x, x_i)^power
 *
 * If the query point coincides exactly with a sensor (distance = 0), that
 * sensor's value is returned immediately to avoid a division-by-zero.
 *
 * Returns NaN if points is empty.
 */
export function idwInterpolate(
  px: number,
  py: number,
  points: readonly SensorPoint[],
  power: number,
): number {
  if (points.length === 0) return NaN;

  let numerator = 0;
  let denominator = 0;

  for (const pt of points) {
    const dx = px - pt.x;
    const dy = py - pt.y;
    const distSq = dx * dx + dy * dy;

    // Exact hit — return the sensor value directly to avoid 1/0
    if (distSq === 0) return pt.value;

    // w = 1 / dist^power = 1 / distSq^(power/2)
    const w = 1 / Math.pow(distSq, power / 2);
    numerator += w * pt.value;
    denominator += w;
  }

  return numerator / denominator;
}
