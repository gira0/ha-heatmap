# TODO — Home Assistant Canvas Heatmap Card

## Phase 1: Environment & HACS Scaffolding

- [x] Initialize standard GitHub repository structure
- [x] Configure `esbuild` for module bundling and minification (output to `dist/`)
- [x] Generate `hacs.json` (`name`, `render_readme`, `filename`)
- [x] Generate `README.md` with Lovelace YAML configuration syntax

## Phase 2: Core IDW Algorithm & Rendering Engine

- [x] Implement Inverse Distance Weighting (IDW) mathematics
- [x] Accept input as array of `[x, y, temperature_value]`
- [x] Target `OffscreenCanvas` for off-main-thread rendering
- [x] Execute matrix recalculation using `Uint8ClampedArray` on the pixel buffer
- [x] Implement fixed RGB gradient color interpolation (e.g. 18°C → `[0,0,255]`, 27°C → `[139,0,0]`)

## Phase 3: LitElement Web Component Integration

- [x] Extend `LitElement` to build the custom Lovelace card
- [x] Implement `setConfig(config)` to parse background image path, entity IDs, and coordinate mappings
- [x] Implement `set hass(hass)` to intercept state transitions
- [x] Add strict delta checks in `hass` setter — only redraw canvas when a mapped `entity_id` state changes

## Phase 4: Optimization

- [x] Implement `resolution_scale` config parameter to downsample the rendering grid
- [x] Add `onload` listener for the floorplan image — defer initial canvas render until image is loaded

## Post-MVP Validation & Release

- [ ] Test the card in a real Home Assistant dashboard
- [ ] Add card-level lifecycle and configuration tests
- [x] Initialize Git repository and add CI for tests, typecheck, and build
- [ ] Tag and publish the first HACS release
