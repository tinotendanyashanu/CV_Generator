import { describe, expect, it } from 'vitest';
import { SAMPLE } from '../src/sample.js';
import { buildMarkdownExport, buildStandaloneHtml } from '../src/lib/exports.js';
import { htmlToPdfDefinition } from '../src/lib/pdfmake-export.js';
import { renderCv } from '../src/lib/render.js';
import { paperColor } from '../src/lib/visual-pdf.js';

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
    const jobs = definition.content.filter((item) => item.unbreakable);
    expect(jobs.length).toBeGreaterThanOrEqual(3);
  });

  it('maps designed templates to a canvas paper color', () => {
    expect(paperColor('neon-tech')).toBe('#070b08');
    expect(paperColor('luxury-gold')).toBe('#f6ecd7');
    expect(paperColor('ats')).toBe('#ffffff');
  });
});
