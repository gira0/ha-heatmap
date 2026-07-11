# ha-heatmap-card

A Home Assistant Lovelace custom card that renders IDW (Inverse Distance Weighting) heatmaps over a floorplan image. Sensor temperatures are interpolated across the image using IDW mathematics and painted via `OffscreenCanvas` for non-blocking rendering.

## Installation

### HACS

1. Add this repository to HACS as a custom frontend resource.
2. Install **ha-heatmap-card**.
3. Add the resource to your Lovelace configuration (done automatically by HACS).

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
