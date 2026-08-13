import { escapeHtml } from './escape.js';
import { renderContact } from './contact.js';
import { renderContent, renderHighlights } from './content.js';
import cvCss from '../styles/cv.css?raw';
import printCss from '../styles/print.css?raw';
import { resolvePrintableCss } from './css-text.js';
import { fontFaceCss } from './fonts.js';

export const TEMPLATES = [
  { id: 'ats', label: 'ATS Essential', family: 'Apply', blurb: 'Single column, standard headings, maximum parse rate.' },
  { id: 'classic', label: 'Classic', family: 'Apply', blurb: 'Serif name, quiet rules, still parser-safe.' },
  { id: 'modern', label: 'Modern', family: 'Apply', blurb: 'Sans header with a restrained accent bar.' },
  { id: 'executive', label: 'Executive', family: 'Apply', blurb: 'Navy masthead for senior and leadership roles.' },
  { id: 'minimal', label: 'Minimal', family: 'Apply', blurb: 'Wide margins and small-caps section labels.' },
  { id: 'corporate', label: 'Corporate', family: 'Apply', blurb: 'Teal rule, compact header, consulting-friendly.' },
  { id: 'sidebar', label: 'Sidebar', family: 'Visual', blurb: 'Two columns for networking. Do not send to ATS portals.' }
];

export function isAtsExport(state, options = {}) {
  if (options.ats === true) return true;
  if (options.ats === false) return false;
  return Boolean(state.atsMode || state.template === 'ats');
}

export function renderCv(state, options = {}) {
  const ats = isAtsExport(state, options);
  const template = ats && state.template === 'sidebar' ? 'ats' : (state.template || 'ats');
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
  return resolvePrintableCss(cvCss, printCss);
}

const templateFns = {
  ats({ name, title, contact, highlights, body }) {
    return `
      <header class="cv-header">
        <h1 class="cv-name">${name}</h1>
        ${title ? `<p class="cv-title">${title}</p>` : ''}
        ${contact}
      </header>
      <div class="cv-body">
        ${highlights}
        ${body}
      </div>`;
  },

  classic({ name, title, contact, highlights, body, photo }) {
    return `
      <header class="cv-header">
        <div class="cv-identity">
          <h1 class="cv-name">${name}</h1>
          ${title ? `<p class="cv-title">${title}</p>` : ''}
        </div>
        ${photo}
        ${contact}
      </header>
      <div class="cv-body">
        ${highlights}
        ${body}
      </div>`;
  },

  modern({ name, title, contact, highlights, body, photo }) {
    return `
      <header class="cv-header">
        <div class="cv-identity">
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
  },

  executive({ name, title, contact, highlights, body, photo }) {
    return `
      <header class="cv-header">
        <div class="cv-identity">
          <h1 class="cv-name">${name}</h1>
          ${title ? `<p class="cv-title">${title}</p>` : ''}
        </div>
        ${photo}
        ${contact}
      </header>
      <div class="cv-body">
        ${highlights}
        ${body}
      </div>`;
  },

  minimal({ name, title, contact, highlights, body }) {
    return `
      <header class="cv-header">
        <h1 class="cv-name">${name}</h1>
        ${title ? `<p class="cv-title">${title}</p>` : ''}
        ${contact}
      </header>
      <div class="cv-body">
        ${highlights}
        ${body}
      </div>`;
  },

  corporate({ name, title, contact, highlights, body, photo }) {
    return `
      <header class="cv-header">
        <div class="cv-identity">
          <p class="cv-kicker">Curriculum vitae</p>
          <h1 class="cv-name">${name}</h1>
          ${title ? `<p class="cv-title">${title}</p>` : ''}
        </div>
        <div class="cv-header-side">
          ${photo}
          ${contact}
        </div>
      </header>
      <div class="cv-body">
        ${highlights}
        ${body}
      </div>`;
  },

  sidebar({ name, title, contact, highlights, body, photo }) {
    return `
      <div class="cv-split">
        <aside class="cv-side">
          ${photo}
          <h1 class="cv-name">${name}</h1>
          ${title ? `<p class="cv-title">${title}</p>` : ''}
          <h2>Contact</h2>
          ${contact}
          ${highlights}
        </aside>
        <div class="cv-main">
          ${body}
        </div>
      </div>`;
  }
};
