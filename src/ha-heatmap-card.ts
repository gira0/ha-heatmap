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
  /** Show draggable calibration targets and a Copy YAML control. */
  edit_mode?: boolean;
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
  private _copyStatus = '';
  private _draggingIndex: number | null = null;
  private _activeDragTarget: HTMLElement | null = null;

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
    .calibration-target {
      position: absolute;
      z-index: 1;
      width: 34px;
      height: 34px;
      border: 2px solid #ffffff;
      border-radius: 50%;
      background: #2563eb;
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.65);
      color: #ffffff;
      cursor: grab;
      touch-action: none;
      transform: translate(-50%, -50%);
    }
    .calibration-target:active { cursor: grabbing; }
    .calibration-target::before,
    .calibration-target::after {
      position: absolute;
      top: 50%;
      left: 50%;
      background: #ffffff;
      content: '';
      transform: translate(-50%, -50%);
    }
    .calibration-target::before { width: 18px; height: 2px; }
    .calibration-target::after { width: 2px; height: 18px; }
    .calibration-label {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      max-width: 180px;
      padding: 4px 6px;
      overflow: hidden;
      border-radius: 4px;
      background: rgba(17, 24, 39, 0.9);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
      transform: translateX(-50%);
    }
    .calibration-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      background: var(--secondary-background-color, #f5f5f5);
      color: var(--primary-text-color, #212121);
      font-size: 13px;
      line-height: 1.3;
    }
    .calibration-panel button {
      flex: 0 0 auto;
      padding: 7px 10px;
      border: 0;
      border-radius: 4px;
      background: var(--primary-color, #03a9f4);
      color: #ffffff;
      cursor: pointer;
      font: inherit;
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
    if (config.edit_mode !== undefined && typeof config.edit_mode !== 'boolean') {
      throw new Error('ha-heatmap-card: edit_mode must be true or false');
    }
    // Home Assistant may freeze the configuration object it passes to cards.
    // Keep a private copy because calibration mode updates entity coordinates.
    this._config = {
      ...config,
      entities: config.entities.map((entity) => ({ ...entity })),
    };
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

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._finishDrag();
  }

  override render() {
    if (!this._config) return html``;
    const isEditing = this._config.edit_mode === true;
    return html`
      <div class="container">
        <img
          src=${this._config.background_image}
          @load=${this._onImageLoad}
          @error=${this._onImageError}
        />
        <canvas></canvas>
        ${isEditing ? this._config.entities.map((entity, index) => html`
          <button
            class="calibration-target"
            style="left: ${entity.x * 100}%; top: ${entity.y * 100}%;"
            title=${`${entity.entity_id}: x ${entity.x.toFixed(3)}, y ${entity.y.toFixed(3)}`}
            aria-label=${`Drag ${entity.entity_id} to set its floorplan position`}
            @pointerdown=${(event: PointerEvent) => this._startDrag(event, index)}
          ><span class="calibration-label">${this._calibrationLabel(entity)}</span></button>
        `) : ''}
      </div>
      ${isEditing ? html`
        <div class="calibration-panel">
          <span>Drag each blue target to its sensor, then copy the updated YAML.</span>
          <button @click=${this._copyYaml}>${this._copyStatus || 'Copy YAML'}</button>
        </div>
      ` : ''}
    `;
  }

  private _startDrag(event: PointerEvent, index: number): void {
    event.preventDefault();
    this._finishDrag();
    this._draggingIndex = index;
    this._activeDragTarget = event.currentTarget as HTMLElement;
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._finishDrag, { once: true });
    window.addEventListener('pointercancel', this._finishDrag, { once: true });
    this._dragTarget(event, index);
  }

  private _calibrationLabel(entity: EntityConfig): string {
    const state = this._hass?.states[entity.entity_id];
    const name = typeof state?.attributes.friendly_name === 'string'
      ? state.attributes.friendly_name
      : entity.entity_id.replace(/^sensor\./, '');
    const value = state?.state;
    return value && !isNaN(Number(value)) ? `${name}: ${value}°` : name;
  }

  private _onPointerMove = (event: PointerEvent): void => {
    if (this._draggingIndex !== null) this._dragTarget(event, this._draggingIndex);
  };

  private _dragTarget(event: PointerEvent, index: number): void {
    if (!this._config) return;

    const container = this.shadowRoot?.querySelector('.container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const entity = this._config.entities[index];
    entity.x = Number(x.toFixed(4));
    entity.y = Number(y.toFixed(4));
    // Rendering the full IDW image is expensive. Move the DOM target smoothly
    // during a drag, then update the canvas once when the pointer is released.
    if (this._activeDragTarget) {
      this._activeDragTarget.style.left = `${entity.x * 100}%`;
      this._activeDragTarget.style.top = `${entity.y * 100}%`;
    }
  }

  private _finishDrag = (): void => {
    const didDrag = this._draggingIndex !== null;
    this._draggingIndex = null;
    this._activeDragTarget = null;
    window.removeEventListener('pointermove', this._onPointerMove);
    if (didDrag) {
      this.requestUpdate();
      this._redraw();
    }
  };

  private async _copyYaml(): Promise<void> {
    if (!this._config) return;
    const yaml = this._toYaml(this._config);
    try {
      await navigator.clipboard.writeText(yaml);
      this._copyStatus = 'Copied!';
    } catch {
      this._copyStatus = 'Copy failed';
    }
    this.requestUpdate();
  }

  private _toYaml(config: CardConfig): string {
    const optional = [
      ['min_value', config.min_value],
      ['max_value', config.max_value],
      ['power', config.power],
      ['resolution_scale', config.resolution_scale],
      ['opacity', config.opacity],
      ['marker_size', config.marker_size],
    ].filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value}`);

    return [
      'type: custom:ha-heatmap-card',
      `background_image: ${config.background_image}`,
      ...optional,
      'entities:',
      ...config.entities.flatMap(({ entity_id, x, y }) => [
        `  - entity_id: ${entity_id}`,
        `    x: ${x}`,
        `    y: ${y}`,
      ]),
    ].join('\n');
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
    const minimumRadius = markerSize * canvasScale;

    ctx.save();
    const fontSize = Math.round(minimumRadius * 0.8);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const { x, y, value } of points) {
      const cx = x * width;
      const cy = y * height;
      const label = `${Number.isInteger(value) ? value : value.toFixed(1)}°`;
      // Decimal values such as "28.2°" are wider than integer labels. Give
      // every label horizontal padding and grow its circle when necessary.
      const labelWidth = ctx.measureText(label).width;
      const radius = Math.max(minimumRadius, labelWidth / 2 + fontSize * 0.45);

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

