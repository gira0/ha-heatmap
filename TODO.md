# Roadmap Ideas

## Flexible Temperature Scale

- [x] Decide temperature-scale strategy: fixed or automatic per card
- [x] Add `temperature_scale` option with `fixed` and `auto` modes
- [x] Support `min_value` / `max_value` for fixed mode
- [x] In `auto` mode, derive the scale from current valid sensor values with a configurable padding
- [x] In `percentile` mode, ignore extreme outliers when deriving the colour scale
- [x] Add a `min_span` setting so near-identical temperatures still produce visible contrast
- [x] Add optional `clamp_min` / `clamp_max` safety limits for automatic scaling
- [x] Display a compact colour legend with the active low and high temperatures
- [x] Add a scale lock control to freeze the current automatic range temporarily
- [x] Add unit tests for scale calculation, padding, outliers, clamping, and minimum span

## Sensor Marker Improvements

- [x] Optionally show the sensor friendly name below each temperature marker
- [x] Add marker styles: boxed temperature (default) or circle
- [x] Add an optional colour swatch on each marker matching its interpolated heatmap colour

## Editor and Calibration Improvements

- [x] Add a visual-editor control for the temperature scale and automatic range settings
- [x] Show sensor values and calculated active range in Calibration Mode
- [x] Add an editor action to distribute new sensor markers automatically before calibration

## Performance and Reliability

- [x] Move heatmap matrix calculation to a dedicated worker when supported
- [x] Add a fallback renderer for browsers without `OffscreenCanvas`
- [x] Add component-level tests for visual-editor configuration and calibration interactions
