import { describe, expect, it } from 'vitest';
import {
  enhanceCvHtml,
  htmlToMarkdown,
  htmlToPlainText,
  markdownToHtml,
  parseFrontMatter,
  renderContent,
  sanitizeHtml,
  textToHtml
} from '../src/lib/content.js';

describe('front matter and markdown', () => {
  it('reads YAML-like front matter', () => {
    const raw = `---
name: Ada Lovelace
title: Analyst
contact: ada@example.com
---

## Experience
Hello
`;
    const parsed = parseFrontMatter(raw);
    expect(parsed.meta.name).toBe('Ada Lovelace');
    expect(parsed.body).toContain('## Experience');
  });

  it('converts headings, lists, emphasis and links', () => {
    const html = markdownToHtml(`## Experience

### Engineer — Acme
2020 – Present

- Led a **team** of 4
- See [site](https://example.com)
`);
    expect(html).toContain('<h2>Experience</h2>');
    expect(html).toContain('<h3>Engineer — Acme</h3>');
    expect(html).toContain('<strong>team</strong>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('<li>');
  });

  it('wraps jobs so page breaks can keep them together', () => {
    const html = enhanceCvHtml(`
      <h2>Experience</h2>
      <h3>Engineer — Acme</h3>
      <p>2020 – Present</p>
      <ul><li>Shipped the thing</li></ul>
      <h3>Analyst — Beta</h3>
      <p>2018 – 2020</p>
    `);
    expect(html).toContain('class="cv-section"');
    expect(html.match(/class="cv-job"/g)?.length).toBe(2);
    expect(html).toContain('cv-job-meta');
    expect(html).toContain('keep-with-next');
  });
});

describe('html sanitizer', () => {
  it('strips scripts and unsafe urls', () => {
    const clean = sanitizeHtml(`<p>Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="https://ok.com">ok</a>`);
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('https://ok.com');
    expect(clean).toContain('noopener');
  });

  it('escapes plain text and still allows bullets', () => {
    const html = textToHtml('Hello <b>there</b>\n- one');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('<li>one</li>');
  });
});

describe('round trips', () => {
  it('turns rendered HTML back into readable text and markdown', () => {
    const source = `## Skills

- TypeScript
- Node.js
`;
    const html = renderContent(source, 'markdown');
    expect(html).toMatch(/<h2\b/i);
    const text = htmlToPlainText(html);
    expect(text).toMatch(/Skills/);
    expect(text).toMatch(/TypeScript/);
    const md = htmlToMarkdown(html);
    expect(md).toMatch(/## Skills/);
    expect(md).toMatch(/- TypeScript/);
  });
});
