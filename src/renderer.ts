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
export function renderHeatmap(config: RenderConfig): OffscreenCanvas {
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
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
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
