import { describe, it, expect } from 'vitest';
import { gradientColor, valueToColor } from './color';

describe('gradientColor', () => {
  it('returns blue at t=0', () => {
    expect(gradientColor(0)).toEqual([0, 0, 255]);
  });

  it('returns cyan at t=0.25 (cyan band start)', () => {
    expect(gradientColor(0.25)).toEqual([0, 255, 255]);
  });

  it('returns cyan at t=0.30 (cyan band end)', () => {
    expect(gradientColor(0.30)).toEqual([0, 255, 255]);
  });

  it('returns green at t=0.40 (green stop)', () => {
    expect(gradientColor(0.40)).toEqual([0, 255, 0]);
  });

  it('returns yellow at t=0.65 (yellow stop)', () => {
    expect(gradientColor(0.65)).toEqual([255, 255, 0]);
  });

  it('returns a yellow-green blend at t=0.5 (midpoint of green band)', () => {
    // Between green(0.40) and yellow(0.65): f=(0.5-0.40)/(0.65-0.40)=0.4 → [102,255,0]
    expect(gradientColor(0.5)).toEqual([102, 255, 0]);
  });

  it('returns an orange at t=0.825 (midpoint of yellow→red band)', () => {
    // Halfway between yellow(0.65)=[255,255,0] and red(1.0)=[255,0,0] → [255,128,0]
    expect(gradientColor(0.825)).toEqual([255, 128, 0]);
  });

  it('returns red at t=1', () => {
    expect(gradientColor(1)).toEqual([255, 0, 0]);
  });

  it('clamps t < 0 to blue', () => {
    expect(gradientColor(-5)).toEqual([0, 0, 255]);
  });

  it('clamps t > 1 to red', () => {
    expect(gradientColor(99)).toEqual([255, 0, 0]);
  });

  it('linearly interpolates between stops', () => {
    // t=0.125 is halfway between blue (0) and cyan (0.25)
    // blue=[0,0,255], cyan=[0,255,255] → midpoint=[0,128,255]
    const [r, g, b] = gradientColor(0.125);
    expect(r).toBe(0);
    expect(g).toBe(128); // Math.round(127.5) = 128 in JS
    expect(b).toBe(255);
  });

  it('linearly interpolates in the yellow→red band', () => {
    // t=0.825 is halfway between yellow(0.65) and red(1.0)
    // yellow=[255,255,0], red=[255,0,0] → midpoint=[255,128,0]
    const [r, g, b] = gradientColor(0.825);
    expect(r).toBe(255);
    expect(g).toBe(128); // IEEE 754: 0.175/0.35 = 0.5 → Math.round(127.5) = 128
    expect(b).toBe(0);
  });
});

describe('valueToColor', () => {
  it('maps minValue to blue', () => {
    expect(valueToColor(18, 18, 27)).toEqual([0, 0, 255]);
  });

  it('maps maxValue to red', () => {
    expect(valueToColor(27, 18, 27)).toEqual([255, 0, 0]);
  });

  it('maps the midpoint value to a yellow-green blend', () => {
    // 22.5°C is the midpoint of [18, 27] → t=0.5 → between green(0.40) and yellow(0.65): f=0.4 → [102,255,0]
    expect(valueToColor(22.5, 18, 27)).toEqual([102, 255, 0]);
  });

  it('clamps values below minValue to blue', () => {
    expect(valueToColor(0, 18, 27)).toEqual([0, 0, 255]);
  });

  it('clamps values above maxValue to red', () => {
    expect(valueToColor(100, 18, 27)).toEqual([255, 0, 0]);
  });

  it('returns the midpoint gradient color when range is zero (no divide-by-zero)', () => {
    // degenerate range → t=0.5 → between green(0.40) and yellow(0.65): f=0.4 → [102,255,0]
    expect(valueToColor(20, 20, 20)).toEqual([102, 255, 0]);
  });
});
