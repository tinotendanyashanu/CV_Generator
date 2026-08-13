import { describe, expect, it } from 'vitest';
import { SAMPLE } from '../src/sample.js';
import { buildMarkdownExport, buildStandaloneHtml } from '../src/lib/exports.js';
import { htmlToPdfDefinition } from '../src/lib/pdfmake-export.js';
import { renderCv } from '../src/lib/render.js';
import { paperColor } from '../src/lib/themes.js';

describe('file exports', () => {
  it('writes a self-contained HTML document with print CSS and no app scripts', () => {
    const html = buildStandaloneHtml({ ...SAMPLE, photo: null });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Alexandra Novak');
    expect(html).toContain('@page');
    expect(html).toContain('break-inside: avoid');
    expect(html).not.toContain('src="/src/main.js"');
    expect(html).not.toContain('html2pdf');
  });

  it('writes markdown with front matter', () => {
    const md = buildMarkdownExport(SAMPLE);
    expect(md).toMatch(/^---/);
    expect(md).toContain('name: Alexandra Novak');
    expect(md).toContain('## Experience');
    expect(md).toContain('TechCorp Solutions');
  });

  it('builds a pdfmake story that keeps jobs unbreakable', () => {
    const html = renderCv({ ...SAMPLE, atsMode: true }, { ats: true });
    const definition = htmlToPdfDefinition(html, SAMPLE, { ats: true });
    expect(definition.pageSize).toBe('A4');
    expect(definition.info.author).toBe('Alexandra Novak');
    const jobs = flatten(definition.content).filter((item) => item.unbreakable);
    expect(jobs.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps neon as real text with a dark page fill', () => {
    const state = { ...SAMPLE, template: 'neon-tech', atsMode: false };
    const html = renderCv(state, { ats: false });
    const definition = htmlToPdfDefinition(html, state, { ats: false });
    expect(definition.defaultStyle.color).toBe('#bbf7d0');
    expect(typeof definition.background).toBe('function');
    const bg = definition.background();
    expect(bg.canvas[0].color).toBe('#070b08');
    const header = definition.content[0];
    expect(header.table.body[0][0].fillColor).toBe('#10182a');
  });

  it('maps designed templates to a canvas paper color', () => {
    expect(paperColor('neon-tech')).toBe('#070b08');
    expect(paperColor('luxury-gold')).toBe('#f6ecd7');
    expect(paperColor('ats')).toBe('#ffffff');
  });
});

function flatten(items) {
  const out = [];
  const walk = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === 'object') {
      if (value.unbreakable) out.push(value);
      Object.values(value).forEach(walk);
    }
  };
  walk(items);
  return out;
}
