import { LitElement, html, css } from 'lit';
import { renderHeatmap } from './renderer';
import type { SensorPoint } from './types';
import { resolveTemperatureRange, type TemperatureScaleMode } from './temperature-scale';

/** A bundled placeholder so a newly added card is useful before configuration. */
const DEFAULT_FLOORPLAN_SVG = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 650">
    <rect width="1000" height="650" fill="#f1f5f9"/>
    <rect x="70" y="70" width="860" height="510" rx="8" fill="#ffffff" stroke="#475569" stroke-width="14"/>
    <path d="M70 300h860M350 70v230M650 70v230M500 300v280M70 450h430M650 300v280" fill="none" stroke="#64748b" stroke-width="10"/>
    <path d="M350 300v60a60 60 0 0 1-60-60M650 300v60a60 60 0 0 0 60-60M500 450h60a60 60 0 0 0-60 60" fill="none" stroke="#94a3b8" stroke-width="6"/>
    <g fill="#64748b" font-family="system-ui, sans-serif" font-size="24" text-anchor="middle">
      <text x="210" y="195">BEDROOM</text><text x="500" y="195">LIVING ROOM</text><text x="790" y="195">BEDROOM</text>
      <text x="285" y="395">KITCHEN</text><text x="715" y="395">BATHROOM</text><text x="285" y="530">DINING</text><text x="715" y="530">OFFICE</text>
    </g>
    <text x="500" y="625" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="20" text-anchor="middle">DEFAULT FLOORPLAN — SET YOUR OWN IMAGE IN THE CARD EDITOR</text>
  </svg>
`)}`;

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
  temperature_scale?: TemperatureScaleMode;
  scale_padding?: number;
  min_span?: number;
  clamp_min?: number;
  clamp_max?: number;
  power?: number;
  resolution_scale?: number;
  opacity?: number;
  marker_size?: number;
  /** Show draggable calibration targets and a Copy YAML control. */
  edit_mode?: boolean;
}

interface ConfigChangedEventDetail {
  config: CardConfig;
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

  static getConfigElement(): HTMLElement {
    return document.createElement('ha-heatmap-card-editor');
  }

  static getStubConfig(): CardConfig {
    return {
      background_image: '',
      entities: [],
    };
  }

  setConfig(config: CardConfig): void {
    // New cards can start as incomplete drafts in Home Assistant's visual
    // editor. Rendering simply remains empty until an image and entities are
    // selected, instead of preventing the editor from being used.
    if (!Array.isArray(config.entities)) {
      throw new Error('ha-heatmap-card: entities must be a list');
    }
    for (const e of config.entities) {
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
    if (config.temperature_scale !== undefined && !['fixed', 'auto'].includes(config.temperature_scale)) {
      throw new Error('ha-heatmap-card: temperature_scale must be fixed or auto');
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
          src=${this._config.background_image || DEFAULT_FLOORPLAN_SVG}
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
      ['temperature_scale', config.temperature_scale],
      ['scale_padding', config.scale_padding],
      ['min_span', config.min_span],
      ['clamp_min', config.clamp_min],
      ['clamp_max', config.clamp_max],
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

    const range = resolveTemperatureRange(points.map((point) => point.value), {
      mode: this._config.temperature_scale ?? 'fixed',
      minValue: this._config.min_value ?? 18,
      maxValue: this._config.max_value ?? 27,
      padding: this._config.scale_padding ?? 2,
      minSpan: this._config.min_span ?? 6,
      clampMin: this._config.clamp_min,
      clampMax: this._config.clamp_max,
    });

    const offscreen = renderHeatmap({
      width,
      height,
      points,
      minValue:        range.min,
      maxValue:        range.max,
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

// ---------------------------------------------------------------------------
// Home Assistant visual card editor
// ---------------------------------------------------------------------------

class HaHeatmapCardEditor extends LitElement {
  private _config: CardConfig = HaHeatmapCard.getStubConfig();
  private _hass: Hass | null = null;

  static override styles = css`
    :host { display: block; }
    .section { margin: 20px 0; }
    h3 { margin: 0 0 12px; font-size: 16px; }
    .help { margin: -6px 0 12px; color: var(--secondary-text-color); font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .sensor-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 76px 76px 38px;
      gap: 8px;
      align-items: end;
      margin: 8px 0;
    }
    .field { display: grid; gap: 4px; }
    label { color: var(--secondary-text-color); font-size: 12px; }
    input {
      width: 100%;
      min-height: 40px;
      padding: 8px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #111);
      font: inherit;
      box-sizing: border-box;
    }
    select {
      width: 100%;
      min-height: 40px;
      padding: 8px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #111);
      font: inherit;
      box-sizing: border-box;
    }
    ha-entity-picker { min-width: 0; }
    button {
      min-height: 36px;
      padding: 0 12px;
      border: 0;
      border-radius: 4px;
      background: var(--primary-color, #03a9f4);
      color: #fff;
      cursor: pointer;
      font: inherit;
    }
    .remove {
      width: 36px;
      padding: 0;
      background: transparent;
      color: var(--error-color, #db4437);
      font-size: 24px;
      line-height: 1;
    }
    .toggle { display: flex; align-items: center; gap: 8px; min-height: 40px; }
    .toggle input { width: 18px; min-height: auto; }
    @media (max-width: 500px) {
      .grid { grid-template-columns: 1fr; }
      .sensor-row { grid-template-columns: minmax(0, 1fr) 62px 62px 38px; }
    }
  `;

  setConfig(config: CardConfig): void {
    this._config = this._cloneConfig(config);
    this.requestUpdate();
  }

  set hass(hass: Hass) {
    this._hass = hass;
    this.requestUpdate();
  }

  override render() {
    return html`
      <div class="section">
        <h3>Floorplan</h3>
        <div class="field">
          <label for="background-image">Image URL or Home Assistant /local/ path</label>
          <input
            id="background-image"
            .value=${this._config.background_image}
            placeholder="/local/images/floorplan.png"
            @input=${(event: Event) => this._setText('background_image', event)}
          />
        </div>
      </div>

      <div class="section">
        <h3>Temperature sensors</h3>
        <p class="help">Search for a sensor, then use the coordinates or Calibration Mode to place it.</p>
        ${this._config.entities.map((entity, index) => html`
          <div class="sensor-row">
            <div class="field">
              <label>Temperature sensor</label>
              <ha-entity-picker
                .hass=${this._hass}
                .value=${entity.entity_id}
                .includeDomains=${['sensor']}
                allow-custom-entity
                @value-changed=${(event: CustomEvent<{ value: string }>) => this._setEntityId(index, event)}
              ></ha-entity-picker>
            </div>
            <div class="field">
              <label>X</label>
              <input type="number" min="0" max="1" step="0.0001" .value=${String(entity.x)} @input=${(event: Event) => this._setCoordinate(index, 'x', event)} />
            </div>
            <div class="field">
              <label>Y</label>
              <input type="number" min="0" max="1" step="0.0001" .value=${String(entity.y)} @input=${(event: Event) => this._setCoordinate(index, 'y', event)} />
            </div>
            <button class="remove" title="Remove sensor" aria-label="Remove sensor" @click=${() => this._removeEntity(index)}>×</button>
          </div>
        `)}
        <button @click=${this._addEntity}>Add temperature sensor</button>
      </div>

      <div class="section">
        <h3>Heatmap settings</h3>
        <div class="field">
          <label>Temperature scale</label>
          <select .value=${this._config.temperature_scale ?? 'fixed'} @change=${this._setScaleMode}>
            <option value="fixed">Fixed range</option>
            <option value="auto">Automatic range from current sensors</option>
          </select>
        </div>
        <div class="grid">
          ${this._numberField('Minimum value', 'min_value', 18, 0.1)}
          ${this._numberField('Maximum value', 'max_value', 27, 0.1)}
          ${this._config.temperature_scale === 'auto' ? html`
            ${this._numberField('Scale padding', 'scale_padding', 2, 0.1, 0)}
            ${this._numberField('Minimum scale span', 'min_span', 6, 0.1, 0)}
            ${this._optionalNumberField('Clamp minimum (optional)', 'clamp_min', 0.1)}
            ${this._optionalNumberField('Clamp maximum (optional)', 'clamp_max', 0.1)}
          ` : ''}
          ${this._numberField('IDW power', 'power', 2, 0.1)}
          ${this._numberField('Resolution scale', 'resolution_scale', 1, 0.05, 0.05, 1)}
          ${this._numberField('Opacity', 'opacity', 0.7, 0.05, 0, 1)}
          ${this._numberField('Marker size', 'marker_size', 16, 1, 8, 48)}
        </div>
        <label class="toggle">
          <input type="checkbox" .checked=${this._config.edit_mode === true} @change=${this._setEditMode} />
          Enable Calibration Mode (drag sensor targets on the floorplan)
        </label>
      </div>
    `;
  }

  private _numberField(
    label: string,
    key: keyof Pick<CardConfig, 'min_value' | 'max_value' | 'scale_padding' | 'min_span' | 'clamp_min' | 'clamp_max' | 'power' | 'resolution_scale' | 'opacity' | 'marker_size'>,
    defaultValue: number,
    step: number,
    min?: number,
    max?: number,
  ) {
    return html`
      <div class="field">
        <label>${label}</label>
        <input
          type="number"
          .value=${String(this._config[key] ?? defaultValue)}
          step=${step}
          min=${min ?? ''}
          max=${max ?? ''}
          @input=${(event: Event) => this._setNumber(key, event)}
        />
      </div>
    `;
  }

  private _optionalNumberField(
    label: string,
    key: 'clamp_min' | 'clamp_max',
    step: number,
  ) {
    return html`
      <div class="field">
        <label>${label}</label>
        <input
          type="number"
          .value=${this._config[key] === undefined ? '' : String(this._config[key])}
          placeholder="No limit"
          step=${step}
          @input=${(event: Event) => this._setOptionalNumber(key, event)}
        />
      </div>
    `;
  }

  private _setText(key: 'background_image', event: Event): void {
    this._updateConfig({ [key]: (event.target as HTMLInputElement).value });
  }

  private _setNumber(
    key: keyof Pick<CardConfig, 'min_value' | 'max_value' | 'scale_padding' | 'min_span' | 'clamp_min' | 'clamp_max' | 'power' | 'resolution_scale' | 'opacity' | 'marker_size'>,
    event: Event,
  ): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isNaN(value)) this._updateConfig({ [key]: value });
  }

  private _setOptionalNumber(key: 'clamp_min' | 'clamp_max', event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this._updateConfig({ [key]: raw === '' ? undefined : Number(raw) });
  }

  private _setEditMode = (event: Event): void => {
    this._updateConfig({ edit_mode: (event.target as HTMLInputElement).checked });
  };

  private _setScaleMode = (event: Event): void => {
    this._updateConfig({ temperature_scale: (event.target as HTMLSelectElement).value as TemperatureScaleMode });
  };

  private _addEntity = (): void => {
    this._updateConfig({
      entities: [...this._config.entities, { entity_id: '', x: 0.5, y: 0.5 }],
    });
  };

  private _removeEntity(index: number): void {
    this._updateConfig({ entities: this._config.entities.filter((_, itemIndex) => itemIndex !== index) });
  }

  private _setEntityId(index: number, event: CustomEvent<{ value: string }>): void {
    this._updateEntity(index, { entity_id: event.detail.value });
  }

  private _setCoordinate(index: number, key: 'x' | 'y', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isNaN(value)) this._updateEntity(index, { [key]: Math.max(0, Math.min(1, value)) });
  }

  private _updateEntity(index: number, change: Partial<EntityConfig>): void {
    this._updateConfig({
      entities: this._config.entities.map((entity, itemIndex) => itemIndex === index ? { ...entity, ...change } : entity),
    });
  }

  private _updateConfig(change: Partial<CardConfig>): void {
    this._config = this._cloneConfig({ ...this._config, ...change });
    this.dispatchEvent(new CustomEvent<ConfigChangedEventDetail>('config-changed', {
      detail: { config: this._cloneConfig(this._config) },
      bubbles: true,
      composed: true,
    }));
    this.requestUpdate();
  }

  private _cloneConfig(config: CardConfig): CardConfig {
    return { ...config, entities: (config.entities ?? []).map((entity) => ({ ...entity })) };
  }
}

customElements.define('ha-heatmap-card', HaHeatmapCard);
customElements.define('ha-heatmap-card-editor', HaHeatmapCardEditor);

// Required by the Lovelace card picker
(window as unknown as Record<string, unknown>)['customCards'] ??= [];
((window as unknown as Record<string, unknown[]>)['customCards']).push({
  type: 'ha-heatmap-card',
  name: 'Heatmap Card',
  description: 'IDW heatmap overlay on a floorplan image',
});

