import { describe, expect, it } from 'vitest';
import { analyzeAts, matchJobDescription, scoreInsights } from '../src/lib/ats.js';
import { SAMPLE } from '../src/sample.js';
import { TEMPLATES, renderCv } from '../src/lib/render.js';
import { htmlToPlainText } from '../src/lib/content.js';

describe('ATS analysis', () => {
  it('scores the sample CV as application-ready', () => {
    const html = renderCv({ ...SAMPLE, photo: null, atsMode: true });
    const previewText = htmlToPlainText(html);
    const insights = analyzeAts({
      state: { ...SAMPLE, photo: null, atsMode: true },
      previewText,
      template: 'ats'
    });
    expect(previewText).toContain('Alexandra Novak');
    expect(previewText).toContain('TechCorp Solutions');
    expect(insights.some((item) => item.type === 'fail')).toBe(false);
    expect(scoreInsights(insights)).toBeGreaterThan(60);
  });

  it('flags missing email and two-column risk', () => {
    const insights = analyzeAts({
      state: {
        fullName: 'Alex',
        jobTitle: '',
        contact: 'City only',
        highlights: '',
        content: 'I did some work',
        atsMode: false,
        photo: 'data:image/jpeg;base64,xx'
      },
      previewText: 'I did some work',
      template: 'sidebar'
    });
    expect(insights.some((item) => item.title.toLowerCase().includes('email'))).toBe(true);
    expect(insights.some((item) => /two-column|photo/i.test(item.title + item.detail))).toBe(true);
  });

  it('matches job-description keywords', () => {
    const result = matchJobDescription(
      'Built kubernetes platforms on aws with typescript',
      'We need Kubernetes, AWS, TypeScript and GraphQL'
    );
    expect(result.found).toEqual(expect.arrayContaining(['kubernetes', 'typescript']));
    expect(result.missing).toContain('graphql');
  });
});

describe('restored templates', () => {
  it('renders every template with the candidate name', () => {
    const ids = TEMPLATES.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([
      'tech', 'creative', 'academic', 'silver', 'monochrome', 'modular',
      'product-lead', 'neon-tech', 'luxury-gold', 'gradient-wave',
      'watermark-pro', 'minimal-glass', 'bold-geometric', 'artistic-portfolio'
    ]));
    for (const template of ids) {
      const html = renderCv({ ...SAMPLE, template, atsMode: false, photo: null });
      expect(html, template).toContain('Alexandra Novak');
      expect(html, template).toContain(`template-${template}`);
      expect(html, template).toContain('visual-mode');
      expect(html, template).not.toContain('ats-mode');
    }
  });
});
