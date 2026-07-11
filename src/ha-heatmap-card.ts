import { LitElement, html, css } from 'lit';
import { renderHeatmap } from './renderer';
import type { SensorPoint } from './types';

// ---------------------------------------------------------------------------
// Types matching the Home Assistant JS API surface
// ---------------------------------------------------------------------------

interface HassEntity {
  state: string;
  attributes: Record<string, unknown>;
}

interface Hass {
  states: Record<string, HassEntity>;
}

interface EntityConfig {
  entity_id: string;
  x: number;
  y: number;
}

interface CardConfig {
  background_image: string;
  entities: EntityConfig[];
  min_value?: number;
  max_value?: number;
  power?: number;
  resolution_scale?: number;
  opacity?: number;
  marker_size?: number;
}

// ---------------------------------------------------------------------------
// Card implementation
// ---------------------------------------------------------------------------

class HaHeatmapCard extends LitElement {
  private _config: CardConfig | null = null;
  private _hass: Hass | null = null;
  /** Last-seen state string per entity_id, for delta checking */
  private _lastStates: Record<string, string> = {};
  private _imageLoaded = false;

  static override styles = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
    }
    .container {
      position: relative;
      width: 100%;
      line-height: 0;
    }
    img {
      width: 100%;
      display: block;
    }
    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  `;

  setConfig(config: CardConfig): void {
    if (!config.background_image) {
      throw new Error('ha-heatmap-card: background_image is required');
    }
    if (!Array.isArray(config.entities) || config.entities.length === 0) {
      throw new Error('ha-heatmap-card: at least one entity is required');
    }
    for (const e of config.entities) {
      if (!e.entity_id) throw new Error('ha-heatmap-card: each entity needs an entity_id');
      if (typeof e.x !== 'number' || typeof e.y !== 'number') {
        throw new Error(`ha-heatmap-card: entity ${e.entity_id} needs numeric x and y`);
      }
    }
    if (config.marker_size !== undefined && typeof config.marker_size !== 'number') {
      throw new Error('ha-heatmap-card: marker_size must be a number');
    }
    this._config = config;
    this._lastStates = {};
    this._imageLoaded = false;
    this.requestUpdate();
  }

  set hass(hass: Hass) {
    if (!this._config) return;

    // Delta check: only re-render if a mapped entity's state has changed
    let changed = false;
    for (const { entity_id } of this._config.entities) {
      const state = hass.states[entity_id]?.state;
      if (state !== this._lastStates[entity_id]) {
        this._lastStates[entity_id] = state;
        changed = true;
      }
    }

    this._hass = hass;
    if (changed && this._imageLoaded) {
      this._redraw();
    }
  }

  override render() {
    if (!this._config) return html``;
    return html`
      <div class="container">
        <img
          src=${this._config.background_image}
          @load=${this._onImageLoad}
          @error=${this._onImageError}
        />
        <canvas></canvas>
      </div>
    `;
  }

  private _onImageLoad(): void {
    this._imageLoaded = true;
    this._redraw();
  }

  private _onImageError(): void {
    console.error('ha-heatmap-card: failed to load background image', this._config?.background_image);
  }

  private _redraw(): void {
    if (!this._config || !this._hass) return;

    const img = this.shadowRoot?.querySelector('img');
    const canvas = this.shadowRoot?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!img || !canvas) return;

    const width = img.naturalWidth || img.clientWidth;
    const height = img.naturalHeight || img.clientHeight;
    if (width === 0 || height === 0) return;

    canvas.width = width;
    canvas.height = height;

    const points: SensorPoint[] = [];
    for (const { entity_id, x, y } of this._config.entities) {
      const raw = this._hass.states[entity_id]?.state;
      const value = parseFloat(raw);
      if (isNaN(value)) continue;
      points.push({ x, y, value });
    }

    if (points.length === 0) return;

    const offscreen = renderHeatmap({
      width,
      height,
      points,
      minValue:        this._config.min_value        ?? 18,
      maxValue:        this._config.max_value        ?? 27,
      power:           this._config.power            ?? 2,
      resolutionScale: this._config.resolution_scale ?? 1.0,
      opacity:         this._config.opacity          ?? 0.7,
    });

    const bitmap = offscreen.transferToImageBitmap();
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    this._drawSensorMarkers(ctx, points, width, height, img.clientWidth);
  }

  private _drawSensorMarkers(
    ctx: CanvasRenderingContext2D,
    points: readonly SensorPoint[],
    width: number,
    height: number,
    displayWidth: number,
  ): void {
    // Canvas pixels use the image's intrinsic dimensions, while the image is
    // displayed at a CSS width. Convert a desired displayed-pixel radius to
    // canvas pixels so markers remain a consistent visible size.
    const markerSize = Math.max(8, Math.min(48, this._config?.marker_size ?? 16));
    const canvasScale = width / (displayWidth || width);
    const radius = markerSize * canvasScale;

    ctx.save();
    ctx.font = `bold ${Math.round(radius * 0.8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const { x, y, value } of points) {
      const cx = x * width;
      const cy = y * height;
      const label = `${Number.isInteger(value) ? value : value.toFixed(1)}°`;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.fill();
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = Math.max(1.5, radius * 0.1);
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.fillText(label, cx, cy);
    }

    ctx.restore();
  }
}

customElements.define('ha-heatmap-card', HaHeatmapCard);

// Required by the Lovelace card picker
(window as unknown as Record<string, unknown>)['customCards'] ??= [];
((window as unknown as Record<string, unknown[]>)['customCards']).push({
  type: 'ha-heatmap-card',
  name: 'Heatmap Card',
  description: 'IDW heatmap overlay on a floorplan image',
});

