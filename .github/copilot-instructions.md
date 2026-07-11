### `copilot-instructions.md`

**Project:** Home Assistant Canvas Heatmap Card
**Objective:** Build a Lovelace custom card rendering IDW heatmaps via `OffscreenCanvas` and `LitElement`.

#### Phase 1: Environment & HACS Scaffolding

* Initialize standard GitHub repository structure.
* Build configuration: Use `esbuild` for module bundling and minification. Output target is the `dist/` directory.
* Generate `hacs.json` defining `name`, `render_readme`, and `filename` pointing to the compiled `dist` output.
* Generate `README.md` defining Lovelace YAML configuration syntax.

#### Phase 2: Core IDW Algorithm & Rendering Engine

* Implement Inverse Distance Weighting (IDW) mathematics.
* Input: Array of `[x, y, temperature_value]`.
* Rendering Target: `OffscreenCanvas` to prevent main-thread blocking during recalculation.
* Pixel Manipulation: Execute matrix recalculation using `Uint8ClampedArray` directly on the pixel buffer.
* Color Interpolation: Implement a fixed RGB gradient mapping array (e.g., 18°C = `[0,0,255]`, 27°C = `[139,0,0]`) to translate state values into pixel definitions.

#### Phase 3: LitElement Web Component Integration

* Extend `LitElement` to construct the custom Lovelace card.
* `setConfig(config)`: Parse YAML configuration (background image path, entity IDs, coordinate mappings).
* `set hass(hass)`: Intercept state transitions.
* State Control: Implement strict delta checks within the `hass` setter. Trigger the canvas redraw function exclusively when the state of a mapped `entity_id` changes.

#### Phase 4: Optimization

* Implement a `resolution_scale` parameter in the configuration to downsample the canvas rendering grid. This mitigates the $O(N \times P)$ computation cost.
* Implement a DOM `onload` listener for the base floorplan image. Defer the initial canvas overlay execution until the image load resolves to prevent scaling mismatches.

---

### Module Bundler Selection

`esbuild`.

For a single-file custom web component interacting with the Home Assistant DOM, `esbuild` is optimal. It requires zero configuration for standard TypeScript/JavaScript bundling, handles minification natively, and executes compilation in sub-milliseconds. `rollup.js` introduces unnecessary dependency overhead and configuration complexity for a frontend asset of this footprint.