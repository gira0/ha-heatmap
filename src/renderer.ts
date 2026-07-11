import type { RenderConfig } from './types';
import { idwInterpolate } from './idw';
import { valueToColor } from './color';

/**
 * Render an IDW heatmap onto an OffscreenCanvas and return it.
 *
 * The canvas is sized to config.width × config.height.  IDW computation runs
 * on a downsampled grid (resolutionScale) to cap the O(N×P) cost; each
 * full-resolution pixel is then assigned the color of its nearest grid cell.
 *
 * The resulting canvas contains a semi-transparent RGBA overlay suitable for
 * compositing over a floorplan image.
 */
export type HeatmapCanvas = OffscreenCanvas | HTMLCanvasElement;

const WORKER_GRID_THRESHOLD = 100_000;

function createCanvas(width: number, height: number): HeatmapCanvas {
  return typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });
}

function paintPixels(width: number, height: number, pixels: Uint8ClampedArray): HeatmapCanvas {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('ha-heatmap-card: 2D canvas context is unavailable');
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function renderHeatmap(config: RenderConfig): HeatmapCanvas {
  const { width, height, points, minValue, maxValue, power, resolutionScale, opacity } = config;
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255);

  // Clamp scale to a sensible range
  const scale = Math.max(0.05, Math.min(1, resolutionScale));
  const gridW = Math.max(1, Math.round(width * scale));
  const gridH = Math.max(1, Math.round(height * scale));

  // Step 1: compute IDW on the downsampled grid
  const grid = new Float32Array(gridW * gridH);
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      // Centre of this grid cell in normalised image space
      const nx = (gx + 0.5) / gridW;
      const ny = (gy + 0.5) / gridH;
      grid[gy * gridW + gx] = idwInterpolate(nx, ny, points, power);
    }
  }

  // Step 2: paint the full-resolution pixel buffer
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('ha-heatmap-card: 2D canvas context is unavailable');
  const imageData = ctx.createImageData(width, height);
  const buf = imageData.data; // Uint8ClampedArray, RGBA

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Map full-res pixel back to its grid cell
      const gx = Math.min(gridW - 1, Math.floor((px / width) * gridW));
      const gy = Math.min(gridH - 1, Math.floor((py / height) * gridH));
      const value = grid[gy * gridW + gx];

      const [r, g, b] = valueToColor(value, minValue, maxValue);
      const idx = (py * width + px) * 4;
      buf[idx]     = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = alpha;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Calculate expensive, high-resolution heatmaps in a short-lived Web Worker
 * when the browser supports Workers. Canvas painting remains on the main
 * thread, which avoids transferring an OffscreenCanvas and preserves the DOM
 * canvas fallback. Small grids stay synchronous because worker setup costs
 * more than their calculation.
 */
export async function renderHeatmapAsync(config: RenderConfig): Promise<HeatmapCanvas> {
  const scale = Math.max(0.05, Math.min(1, config.resolutionScale));
  const gridPixels = Math.max(1, Math.round(config.width * scale)) * Math.max(1, Math.round(config.height * scale));
  const canUseWorker = typeof Worker !== 'undefined'
    && typeof Blob !== 'undefined'
    && typeof URL.createObjectURL === 'function';

  if (!canUseWorker || gridPixels < WORKER_GRID_THRESHOLD) return renderHeatmap(config);

  try {
    const pixels = await calculatePixelsInWorker(config);
    return paintPixels(config.width, config.height, pixels);
  } catch {
    // Blob workers can be blocked by a host Content Security Policy. Rendering
    // still works correctly through the synchronous implementation.
    return renderHeatmap(config);
  }
}

function calculatePixelsInWorker(config: RenderConfig): Promise<Uint8ClampedArray> {
  const source = `
self.onmessage = ({ data: c }) => {
  const scale = Math.max(0.05, Math.min(1, c.resolutionScale));
  const gridW = Math.max(1, Math.round(c.width * scale));
  const gridH = Math.max(1, Math.round(c.height * scale));
  const grid = new Float32Array(gridW * gridH);
  const interpolate = (x, y) => {
    let numerator = 0, denominator = 0;
    for (const point of c.points) {
      const dx = x - point.x, dy = y - point.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared === 0) return point.value;
      const weight = 1 / Math.pow(Math.sqrt(distanceSquared), c.power);
      numerator += weight * point.value;
      denominator += weight;
    }
    return denominator === 0 ? NaN : numerator / denominator;
  };
  const colour = (value) => {
    const range = c.maxValue - c.minValue;
    const t = Math.max(0, Math.min(1, range === 0 ? .5 : (value - c.minValue) / range));
    const stops = [[0,0,0,255],[.25,0,255,255],[.30,0,255,255],[.4,0,255,0],[.65,255,255,0],[1,255,0,0]];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i], f = (t - a[0]) / (b[0] - a[0]);
        return [Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f), Math.round(a[3] + (b[3] - a[3]) * f)];
      }
    }
    return [255, 0, 0];
  };
  for (let gy = 0; gy < gridH; gy++) for (let gx = 0; gx < gridW; gx++) grid[gy * gridW + gx] = interpolate((gx + .5) / gridW, (gy + .5) / gridH);
  const pixels = new Uint8ClampedArray(c.width * c.height * 4);
  const alpha = Math.round(Math.max(0, Math.min(1, c.opacity)) * 255);
  for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) {
    const value = grid[Math.min(gridH - 1, Math.floor(py / c.height * gridH)) * gridW + Math.min(gridW - 1, Math.floor(px / c.width * gridW))];
    const [r, g, b] = colour(value), index = (py * c.width + px) * 4;
    pixels[index] = r; pixels[index + 1] = g; pixels[index + 2] = b; pixels[index + 3] = alpha;
  }
  self.postMessage(pixels.buffer, [pixels.buffer]);
};`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    worker.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      cleanup();
      resolve(new Uint8ClampedArray(event.data));
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('ha-heatmap-card: worker rendering failed'));
    };
    worker.postMessage({ ...config, points: config.points.map(({ x, y, value }) => ({ x, y, value })) });
  });
}
