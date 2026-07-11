# Visual QA — ha-heatmap-card Smoke Test

Open `preview.html` in a browser after running `npm run build:preview`.

---

## 1. Color Gradient Legend (strip at the top)

- [X] Does the strip transition **left → right** in this exact order: **blue → cyan → green → yellow → red**?
- [ ] Is the transition smooth — no abrupt jumps or missing color bands?
  -  perhaps a bit more yellow, green seems a bit much
- [X] Is the leftmost pixel clearly **blue** and the rightmost clearly **red**?
- [ ] Are the "25%" and "75%" tick labels visible and positioned correctly?
  - 25% is white on light blue, not very visible. Is there perhaps a invert 
---

## 2. Mixed Temperatures (top-left canvas)

Sensors: 18 °C (top-left), 21 °C (top-right), 24 °C (bottom-left), 27 °C (bottom-right).

- [X] Is the **top-left** region predominantly **blue**?
- [X] Is the **bottom-right** region predominantly **red**?
- [ ] Do the colors transition smoothly from cool to warm across the diagonal?
  - could use more yellow. the red has a yellow outline and then is green. blue also has a light blue outline and then becomes green
- [ ] Are all **4 sensor dots** visible, each labelled with its temperature value?
  - the circles are too small for the text

---

## 3. Single Hot Spot (top-right canvas)

One 27 °C sensor in the centre; 18 °C sensors at all four corners.

- [X] Is there a clear **red/orange core** centred on the canvas?
- [X] Does the color radiate outward through: yellow → green → cyan → **blue** at the corners?
- [X] Does the pattern look roughly **radially symmetric**?
- [X] Are all **5 sensor dots** visible?

---

## 4. Single Cold Spot (bottom-left canvas)

One 18 °C sensor in the centre; 27 °C sensors at all four corners.

- [X] Is the **centre region clearly blue** (cold)?
- [X] Does the color radiate outward through: cyan → green → yellow → **red** at the corners?
- [X] Does this look like the **visual inverse** of the hot spot scenario?
- [X] Are all **5 sensor dots** visible?

---

## 5. Low Resolution (bottom-right canvas)

Same sensor layout as "Mixed" but `resolutionScale = 0.12`.

- [X] Is the heatmap **visibly blocky / pixelated** compared to the Mixed canvas?
- [X] Despite the lower resolution, are the **same hot/cold regions** in the same general areas as "Mixed"?
- [X] Can you see individual large rectangular color patches?

---

## 6. General

- [ ] Is the heatmap overlay **semi-transparent** — can you faintly see the dark card background through it?
  - I don't think I understand the question. The Top of the cards is brighter than the background?
- [X] Do all **four canvases render** without errors (no blank, black, or white screens)?
- [X] Are sensor dots rendered as **white circles** with a dark temperature label inside?
- [ ] No browser console errors?
  - I dont have the console in this vscode browser

---

## Notes

Record anything unexpected here:

```
```
