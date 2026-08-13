import { escapeHtml } from './escape.js';
import { renderContact } from './contact.js';
import { renderContent, renderHighlights } from './content.js';
import cvCss from '../styles/cv.css?raw';
import templateCss from '../styles/templates.css?raw';
import printCss from '../styles/print.css?raw';
import { resolvePrintableCss } from './css-text.js';
import { fontFaceCss } from './fonts.js';

export const TEMPLATES = [
  { id: 'ats', label: 'ATS Essential', family: 'Apply', blurb: 'Single column, standard headings, maximum parse rate.', swatch: '#111111' },
  { id: 'classic', label: 'Classic', family: 'Apply', blurb: 'Serif name, quiet rules, still parser-safe.', swatch: '#1f2937' },
  { id: 'monochrome', label: 'Monochrome', family: 'Apply', blurb: 'Centered black-and-white editorial.', swatch: '#000000' },
  { id: 'modular', label: 'Modular', family: 'Apply', blurb: 'Slate rules and left-accent section labels.', swatch: '#3a506b' },
  { id: 'minimal', label: 'Minimal', family: 'Apply', blurb: 'Wide margins and small-caps section labels.', swatch: '#6b7280' },
  { id: 'corporate', label: 'Corporate', family: 'Apply', blurb: 'Teal rule, compact header, consulting-friendly.', swatch: '#0f766e' },
  { id: 'modern', label: 'Timeline', family: 'Modern', blurb: 'Accent rail and a clean timeline body.', swatch: '#2563eb' },
  { id: 'tech', label: 'Tech Infographic', family: 'Modern', blurb: 'Indigo hero bar and a compact info strip.', swatch: '#0969da' },
  { id: 'silver', label: 'Silver Glass', family: 'Modern', blurb: 'Frosted silver header with a thin metal rule.', swatch: '#9ca3af' },
  { id: 'product-lead', label: 'Product Lead', family: 'Modern', blurb: 'Dark slate masthead for product and leadership roles.', swatch: '#0f172a' },
  { id: 'gradient-wave', label: 'Gradient Wave', family: 'Modern', blurb: 'Indigo-to-violet header wash.', swatch: '#667eea' },
  { id: 'executive', label: 'Executive', family: 'Modern', blurb: 'Navy masthead for senior roles.', swatch: '#0b1f44' },
  { id: 'creative', label: 'Creative Portfolio', family: 'Creative', blurb: 'Three-part header used by designers and makers.', swatch: '#7c3aed' },
  { id: 'academic', label: 'Academic Split', family: 'Creative', blurb: 'Left rail for identity, main column for writing.', swatch: '#4a5568' },
  { id: 'sidebar', label: 'Sidebar', family: 'Creative', blurb: 'Two columns for networking packs.', swatch: '#64748b' },
  { id: 'neon-tech', label: 'Neon Tech', family: 'Creative', blurb: 'Dark canvas with green terminal accents.', swatch: '#00ff41' },
  { id: 'luxury-gold', label: 'Luxury Gold', family: 'Creative', blurb: 'Warm cream paper and gold rules.', swatch: '#c9a227' },
  { id: 'watermark-pro', label: 'Watermark Pro', family: 'Creative', blurb: 'Large initial mark behind the name.', swatch: '#334155' },
  { id: 'minimal-glass', label: 'Minimal Glass', family: 'Creative', blurb: 'Frosted header on a cool grey sheet.', swatch: '#94a3b8' },
  { id: 'bold-geometric', label: 'Bold Geometric', family: 'Creative', blurb: 'Hard shapes and a high-contrast header.', swatch: '#ef4444' },
  { id: 'artistic-portfolio', label: 'Artistic Portfolio', family: 'Creative', blurb: 'Brush bar and a studio palette.', swatch: '#db2777' }
];

const FLAT_FOR_ATS = new Set(['sidebar', 'academic']);

export function isAtsExport(state, options = {}) {
  if (options.ats === true) return true;
  if (options.ats === false) return false;
  return Boolean(state.atsMode || state.template === 'ats');
}

export function renderCv(state, options = {}) {
  const ats = isAtsExport(state, options);
  const requested = state.template || 'ats';
  const template = ats && FLAT_FOR_ATS.has(requested) ? 'ats' : requested;
  const density = state.density || 'comfortable';
  const name = escapeHtml(state.fullName || 'Your Name');
  const title = escapeHtml(state.jobTitle || '');
  const contact = renderContact(state.contact, { ats });
  const highlights = renderHighlights(state.highlights);
  const body = renderContent(state.content, state.format || 'markdown');
  const photo = !ats && state.photo
    ? `<div class="cv-photo"><img src="${state.photo}" alt=""></div>`
    : '';

  const inner = templateFns[template]
    ? templateFns[template]({ name, title, contact, highlights, body, photo, ats })
    : templateFns.ats({ name, title, contact, highlights, body, photo, ats });

  const classes = [
    'cv',
    `template-${template}`,
    `density-${density}`,
    ats ? 'ats-mode' : 'visual-mode'
  ].join(' ');

  return `<article class="${classes}" data-template="${template}">${inner}</article>`;
}

export function buildPrintDocument(state, options = {}) {
  const ats = isAtsExport(state, options);
  const name = state.fullName || 'CV';
  const title = `${name}${state.jobTitle ? ` — ${state.jobTitle}` : ''}`.replace(/\s+/g, ' ').trim();
  const markup = renderCv(state, { ...options, ats });
  const extra = options.extraCss || '';
  const css = `${fontFaceCss()}\n${getPrintCss()}\n${extra}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body class="print-root ${ats ? 'ats-root' : ''}">
  ${markup}
</body>
</html>`;
}

export function getPrintCss() {
  return resolvePrintableCss(`${cvCss}\n${templateCss}`, printCss);
}

function stackLayout({ name, title, contact, highlights, body, photo }) {
  return `
    <header class="cv-header">
      <div class="cv-identity">
        <p class="cv-kicker">Curriculum vitae</p>
        <h1 class="cv-name">${name}</h1>
        ${title ? `<p class="cv-title">${title}</p>` : ''}
        ${contact}
      </div>
      ${photo}
    </header>
    <div class="cv-body">
      ${highlights}
      ${body}
    </div>`;
}

const templateFns = {
  ats: stackLayout,
  classic: stackLayout,
  modern: stackLayout,
  executive: stackLayout,
  minimal: stackLayout,
  corporate: stackLayout,
  monochrome: stackLayout,
  modular: stackLayout,
  silver: stackLayout,
  'gradient-wave': stackLayout,
  'watermark-pro': ({ name, title, contact, highlights, body, photo }) => `
    <header class="cv-header">
      <div class="cv-watermark" aria-hidden="true">${(name || '?').trim().charAt(0)}</div>
      <div class="cv-identity">
        <h1 class="cv-name">${name}</h1>
        ${title ? `<p class="cv-title">${title}</p>` : ''}
        ${contact}
      </div>
      ${photo}
    </header>
    <div class="cv-body">${highlights}${body}</div>`,
  'neon-tech': stackLayout,
  'luxury-gold': stackLayout,
  'minimal-glass': stackLayout,
  'bold-geometric': ({ name, title, contact, highlights, body, photo }) => `
    <header class="cv-header">
      <div class="geo-shapes" aria-hidden="true">
        <span class="geo geo-tri"></span>
        <span class="geo geo-circle"></span>
        <span class="geo geo-sq"></span>
      </div>
      <div class="cv-identity">
        <h1 class="cv-name">${name}</h1>
        ${title ? `<p class="cv-title">${title}</p>` : ''}
        ${contact}
      </div>
      ${photo}
    </header>
    <div class="cv-body">${highlights}${body}</div>`,
  'artistic-portfolio': ({ name, title, contact, highlights, body, photo }) => `
    <header class="cv-header">
      <div class="brush" aria-hidden="true"></div>
      <div class="cv-identity">
        <h1 class="cv-name">${name}</h1>
        ${title ? `<p class="cv-title">${title}</p>` : ''}
        ${contact}
      </div>
      ${photo}
      <div class="palette" aria-hidden="true">
        <i></i><i></i><i></i>
      </div>
    </header>
    <div class="cv-body">${highlights}${body}</div>`,
  tech: ({ name, title, contact, highlights, body, photo }) => `
    <header class="cv-header tech-hero">
      <div class="cv-identity">
        <h1 class="cv-name">${name}</h1>
        ${title ? `<p class="cv-title">${title}</p>` : ''}
      </div>
      ${photo}
    </header>
    <div class="tech-info">${contact}</div>
    <div class="cv-body">${highlights}${body}</div>`,
  creative: ({ name, title, contact, highlights, body, photo }) => `
    <header class="cv-header creative-head">
      <div class="cv-identity">
        <h1 class="cv-name">${name}</h1>
        ${title ? `<p class="cv-title">${title}</p>` : ''}
      </div>
      ${contact}
      ${photo}
    </header>
    <div class="cv-body">${highlights}${body}</div>`,
  academic: ({ name, title, contact, highlights, body, photo }) => `
    <div class="cv-split">
      <aside class="cv-side">
        ${photo}
        <h1 class="cv-name">${name}</h1>
        ${title ? `<p class="cv-title">${title}</p>` : ''}
        <h2>Contact</h2>
        ${contact}
        ${highlights}
      </aside>
      <div class="cv-main">${body}</div>
    </div>`,
  sidebar: ({ name, title, contact, highlights, body, photo }) => `
    <div class="cv-split">
      <aside class="cv-side">
        ${photo}
        <h1 class="cv-name">${name}</h1>
        ${title ? `<p class="cv-title">${title}</p>` : ''}
        <h2>Contact</h2>
        ${contact}
        ${highlights}
      </aside>
      <div class="cv-main">${body}</div>
    </div>`,
  'product-lead': ({ name, title, contact, highlights, body, photo }) => `
    <header class="cv-header">
      <div class="cv-identity">
        <h1 class="cv-name">${name}</h1>
        ${title ? `<p class="cv-title">${title}</p>` : ''}
      </div>
      <div class="cv-header-side">
        ${photo}
        ${contact}
      </div>
    </header>
    <div class="cv-body product-body">
      ${highlights ? `<aside class="product-summary">${highlights}</aside>` : ''}
      <div class="product-main">${body}</div>
    </div>`
};
