import { renderHeatmap } from './renderer';
import { gradientColor } from './color';
import type { RenderConfig, SensorPoint } from './types';

const W = 400;
const H = 300;

interface Scenario {
  title: string;
  description: string;
  points: SensorPoint[];
  minValue: number;
  maxValue: number;
  power: number;
  resolutionScale: number;
  opacity: number;
}

const SCENARIOS: Scenario[] = [
  {
    title: 'Mixed temperatures',
    description: '4 sensors spanning 18–27 °C',
    points: [
      { x: 0.15, y: 0.20, value: 18 },
      { x: 0.80, y: 0.15, value: 21 },
      { x: 0.25, y: 0.80, value: 24 },
      { x: 0.75, y: 0.75, value: 27 },
    ],
    minValue: 18, maxValue: 27, power: 2, resolutionScale: 1.0, opacity: 0.7,
  },
  {
    title: 'Single hot spot',
    description: '27 °C centre sensor, 18 °C corners',
    points: [
      { x: 0.50, y: 0.50, value: 27 },
      { x: 0.05, y: 0.05, value: 18 },
      { x: 0.95, y: 0.05, value: 18 },
      { x: 0.05, y: 0.95, value: 18 },
      { x: 0.95, y: 0.95, value: 18 },
    ],
    minValue: 18, maxValue: 27, power: 2, resolutionScale: 1.0, opacity: 0.7,
  },
  {
    title: 'Single cold spot',
    description: '18 °C centre sensor, 27 °C corners',
    points: [
      { x: 0.50, y: 0.50, value: 18 },
      { x: 0.05, y: 0.05, value: 27 },
      { x: 0.95, y: 0.05, value: 27 },
      { x: 0.05, y: 0.95, value: 27 },
      { x: 0.95, y: 0.95, value: 27 },
    ],
    minValue: 18, maxValue: 27, power: 2, resolutionScale: 1.0, opacity: 0.7,
  },
  {
    title: 'Low resolution (scale = 0.12)',
    description: 'Same sensors as "Mixed" — downsampled grid',
    points: [
      { x: 0.15, y: 0.20, value: 18 },
      { x: 0.80, y: 0.15, value: 21 },
      { x: 0.25, y: 0.80, value: 24 },
      { x: 0.75, y: 0.75, value: 27 },
    ],
    minValue: 18, maxValue: 27, power: 2, resolutionScale: 0.12, opacity: 0.7,
  },
];

function drawScenario(canvas: HTMLCanvasElement, scenario: Scenario): void {
  canvas.width = W;
  canvas.height = H;

  const config: RenderConfig = {
    width: W,
    height: H,
    points: scenario.points,
    minValue: scenario.minValue,
    maxValue: scenario.maxValue,
    power: scenario.power,
    resolutionScale: scenario.resolutionScale,
    opacity: scenario.opacity,
  };

  const offscreen = renderHeatmap(config);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(offscreen, 0, 0);

  // Sensor dots with temperature labels
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const pt of scenario.points) {
    const cx = pt.x * W;
    const cy = pt.y * H;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.fillText(`${pt.value}°`, cx, cy);
  }
}

function drawLegend(canvas: HTMLCanvasElement): void {
  const LW = 600;
  canvas.width = LW;
  canvas.height = 40;
  const ctx = canvas.getContext('2d')!;

  for (let x = 0; x < LW; x++) {
    const [r, g, b] = gradientColor(x / (LW - 1));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, 0, 1, 40);
  }

  const labels: Array<{ t: number; label: string; align: CanvasTextAlign }> = [
    { t: 0,    label: 'cold (min)',  align: 'left'   },
    { t: 0.25, label: '25%',        align: 'center' },
    { t: 0.5,  label: 'mid (50%)',  align: 'center' },
    { t: 0.75, label: '75%',        align: 'center' },
    { t: 1.0,  label: 'hot (max)',  align: 'right'  },
  ];
  ctx.font = 'bold 11px sans-serif';
  ctx.textBaseline = 'middle';
  for (const { t, label, align } of labels) {
    const x = Math.round(t * (LW - 1));
    ctx.textAlign = align;
    // Use perceived luminance to auto-select legible text color
    const [lr, lg, lb] = gradientColor(t);
    const lum = 0.299 * lr + 0.587 * lg + 0.114 * lb;
    const textColor = lum > 150 ? '#111' : '#fff';
    // Draw a subtle shadow for legibility on mid-lum backgrounds
    ctx.shadowColor = lum > 150 ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = textColor;
    ctx.fillText(label, x + (align === 'left' ? 4 : align === 'right' ? -4 : 0), 20);
  }
  ctx.shadowBlur = 0;
}

window.addEventListener('DOMContentLoaded', () => {
  drawLegend(document.getElementById('legend') as HTMLCanvasElement);
  SCENARIOS.forEach((scenario, i) => {
    drawScenario(document.getElementById(`canvas-${i}`) as HTMLCanvasElement, scenario);
  });
});
