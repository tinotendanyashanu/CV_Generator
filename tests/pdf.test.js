import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { SAMPLE } from '../src/sample.js';
import { buildPrintDocument } from '../src/lib/render.js';
import { closeBrowser, htmlToPdfBuffer } from '../server/render-pdf.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-pdf-'));

function pdfText(file, extraArgs = []) {
  return execFileSync('pdftotext', ['-layout', ...extraArgs, file, '-'], { encoding: 'utf8' });
}

describe('Chromium text-layer PDF', () => {
  it('creates a selectable A4 PDF that ATS tools can read', async () => {
    const html = buildPrintDocument({ ...SAMPLE, photo: null, atsMode: true, template: 'ats' }, { ats: true });
    const buffer = await htmlToPdfBuffer(html, { title: 'Alexandra Novak — CV' });
    const file = path.join(tmp, 'ats.pdf');
    fs.writeFileSync(file, buffer);
    fs.mkdirSync('test-output', { recursive: true });
    fs.writeFileSync('test-output/sample-ats.pdf', buffer);

    const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
    expect(info).toMatch(/Page size:.*A4/);
    expect(info).toMatch(/Tagged:\s+yes/);
    expect(Number(info.match(/Pages:\s+(\d+)/)[1])).toBeGreaterThanOrEqual(1);

    const text = pdfText(file);
    expect(text.length).toBeGreaterThan(400);
    expect(text).toMatch(/Alexandra Novak/);
    expect(text).toMatch(/Senior Software Engineer/);
    expect(text).toMatch(/TechCorp Solutions/);
    expect(text).toMatch(/alexandra\.novak@email\.com/);
    expect(text).toMatch(/EXPERIENCE|Experience/);
    expect(text).toMatch(/EDUCATION|Education/);
  }, 45000);

  it('keeps later jobs readable on a long two-page CV', async () => {
    const extraJobs = Array.from({ length: 6 }, (_, index) => `
### Staff Engineer — ExtraCorp ${index + 1}
201${index} – 201${index + 1} | Remote

- Delivered platform work stream ${index + 1} with measurable reliability gains
- Mentored engineers and wrote design documents for service ${index + 1}
`).join('\n');

    const html = buildPrintDocument({
      ...SAMPLE,
      atsMode: true,
      template: 'ats',
      content: `${SAMPLE.content}\n## Additional experience\n${extraJobs}`
    }, { ats: true });

    const buffer = await htmlToPdfBuffer(html);
    const file = path.join(tmp, 'long.pdf');
    fs.writeFileSync(file, buffer);

    const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
    const pages = Number(info.match(/Pages:\s+(\d+)/)[1]);
    expect(pages).toBeGreaterThanOrEqual(2);

    const page1 = pdfText(file, ['-f', '1', '-l', '1']);
    const page2 = pdfText(file, ['-f', '2', '-l', '2']);
    expect(page1).toMatch(/Alexandra Novak/);
    expect(page2.trim().length).toBeGreaterThan(80);
    expect(page1 + page2).toMatch(/ExtraCorp 6/);
    expect(page2).not.toMatch(/Alexandra Novak/);
  }, 45000);
});

afterAll(async () => {
  await closeBrowser();
});
