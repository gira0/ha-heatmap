# ha-heatmap-card

A Home Assistant Lovelace custom card that renders IDW (Inverse Distance Weighting) heatmaps over a floorplan image. Sensor temperatures are interpolated across the image using IDW mathematics and painted via `OffscreenCanvas` for non-blocking rendering.

## Installation

### HACS

1. In **HACS → Frontend**, open the overflow menu and select **Custom repositories**.
2. Add `https://github.com/gira0/ha-heatmap` with category **Dashboard**.
3. Find and install **ha-heatmap-card**.
4. Add the resource to your Lovelace configuration if HACS does not register it automatically.

### Manual

1. Copy `dist/ha-heatmap-card.js` to `<config>/www/ha-heatmap-card.js`.
2. Add the resource in your Lovelace dashboard settings:
   ```yaml
   url: /local/ha-heatmap-card.js
   type: module
   ```

## Configuration

```yaml
type: custom:ha-heatmap-card
background_image: /local/floorplan.png
min_value: 18
max_value: 27
power: 2
resolution_scale: 0.5
opacity: 0.7
entities:
  - entity_id: sensor.living_room_temperature
    x: 0.30
    y: 0.55
  - entity_id: sensor.bedroom_temperature
    x: 0.72
    y: 0.20
  - entity_id: sensor.kitchen_temperature
    x: 0.15
    y: 0.80
```

### Options

| Key | Type | Required | Description |
|---|---|---|---|
| `background_image` | `string` | yes | Path to the floorplan image (relative to HA `www/`). |
| `entities` | `list` | yes | List of sensor entities with their coordinates. |
| `entities[].entity_id` | `string` | yes | HA entity ID of a temperature sensor. |
| `entities[].x` | `float` | yes | Normalised horizontal position on the image (0.0 – 1.0). |
| `entities[].y` | `float` | yes | Normalised vertical position on the image (0.0 – 1.0). |
| `min_value` | `float` | no | Value mapped to the cold end of the gradient (default `18`). |
| `max_value` | `float` | no | Value mapped to the hot end of the gradient (default `27`). |
| `power` | `float` | no | IDW distance-decay exponent (default `2`). Higher values create sharper transitions around sensors. |
| `resolution_scale` | `float` | no | Downsample factor for the heatmap grid (default `1.0`). Lower values improve performance at the cost of resolution. |
| `opacity` | `float` | no | Heatmap overlay opacity from `0.0` (transparent) to `1.0` (opaque), default `0.7`. |
| `marker_size` | `float` | no | Minimum radius of each sensor marker in displayed pixels (default `16`, allowed range `8`–`48`). Markers automatically grow to fit decimal values. |
| `edit_mode` | `boolean` | no | Show draggable calibration targets and a button to copy the updated YAML (default `false`). |

Each configured sensor is shown as a white circular marker labelled with its current numeric value.

### Position calibration

Set `edit_mode: true` temporarily to show a blue draggable target for every configured sensor. Drag each target to the real sensor location, then select **Copy YAML** and replace the card configuration with the copied result. The card cannot modify Lovelace configuration automatically.

```yaml
type: custom:ha-heatmap-card
edit_mode: true
background_image: /local/floorplan.png
entities:
  - entity_id: sensor.living_room_temperature
    x: 0.30
    y: 0.55
```

Remove `edit_mode: true` once the positions are saved to hide the calibration controls.

## Color Scale

The heatmap uses this fixed RGB gradient:

| Relative value | Color |
|---|---|
| Minimum | Blue `[0, 0, 255]` |
| 25% | Cyan `[0, 255, 255]` |
| Mid-range | Green `[0, 255, 0]` |
| 65% | Yellow `[255, 255, 0]` |
| Maximum | Red `[255, 0, 0]` |

Values outside this range are clamped to the nearest endpoint.

## Disclaimer

This is a vibe-coded project built with AI assistance. It is provided as an experimental community project; review the code and test it in your own Home Assistant environment before relying on it for important automations. It is not affiliated with, endorsed by, or supported by Home Assistant.
