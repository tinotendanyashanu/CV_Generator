import { describe, expect, it } from 'vitest';
import { A4_HEIGHT_MM, A4_WIDTH_MM, fitA4Scale, pageCount } from '../src/lib/a4.js';

describe('A4 fit and pagination', () => {
  it('keeps the ISO A4 ratio', () => {
    expect(A4_WIDTH_MM / A4_HEIGHT_MM).toBeCloseTo(210 / 297, 5);
  });

  it('scales an iPhone-width screen down instead of reflowing the page', () => {
    const a4Width = 794;
    const iphone = fitA4Scale(390, a4Width);
    const ipad = fitA4Scale(820, a4Width);
    const desktop = fitA4Scale(1200, a4Width);
    expect(iphone).toBeCloseTo(390 / 794, 3);
    expect(iphone).toBeLessThan(0.55);
    expect(ipad).toBeGreaterThan(0.95);
    expect(desktop).toBe(1);
  });

  it('never scales below a readable floor', () => {
    expect(fitA4Scale(40, 794)).toBe(0.28);
  });

  it('counts A4 pages from content height', () => {
    expect(pageCount(800, 1123)).toBe(1);
    expect(pageCount(1123, 1123)).toBe(1);
    expect(pageCount(1200, 1123)).toBe(2);
    expect(pageCount(3000, 1123)).toBe(3);
  });
});
