export interface SensorPoint {
  /** Normalised horizontal position on the image (0.0 – 1.0) */
  x: number;
  /** Normalised vertical position on the image (0.0 – 1.0) */
  y: number;
  /** Scalar value (e.g. temperature in °C) */
  value: number;
}

export interface RenderConfig {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Sensor data points with normalised coordinates */
  points: SensorPoint[];
  /** Value mapped to the cold (blue) end of the gradient */
  minValue: number;
  /** Value mapped to the hot (red) end of the gradient */
  maxValue: number;
  /** IDW distance-decay exponent — higher values sharpen boundaries */
  power: number;
  /** Downsample factor for the render grid (0.0–1.0]; lower = faster */
  resolutionScale: number;
  /** Heatmap overlay opacity (0.0–1.0); default 0.7 */
  opacity: number;
}

export type RGB = [number, number, number];
