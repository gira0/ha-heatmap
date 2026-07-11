# Home Assistant QA Checklist

Use this checklist after copying `dist/ha-heatmap-card.js` to Home Assistant or installing through HACS.

## Installation

- [ ] The browser resource loads as a JavaScript module without dashboard errors.
- [ ] Adding `type: custom:ha-heatmap-card` shows the card in the dashboard.
- [ ] The floorplan image loads at the expected aspect ratio.

## Configuration

- [ ] Every configured sensor entity resolves to a numeric state.
- [ ] The overlay aligns with the floorplan using normalised `x` and `y` coordinates.
- [ ] `min_value` and `max_value` map expected temperatures to blue and red.
- [ ] `opacity` produces the desired floorplan visibility.
- [ ] Reducing `resolution_scale` improves redraw speed while preserving acceptable visual quality.

## Updates and resilience

- [ ] Changing a mapped sensor state redraws the heatmap.
- [ ] Updating an unrelated Home Assistant entity does not visibly redraw the heatmap.
- [ ] A sensor with `unknown`, `unavailable`, or non-numeric state does not break the card.
- [ ] Reloading the dashboard restores the heatmap after the background image loads.

## Browser checks

- [ ] No browser console errors are reported.
- [ ] The card behaves correctly on the target wall panel / mobile browser, if applicable.

## Notes

```
```
