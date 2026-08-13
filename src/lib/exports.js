import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { sanitizeFileName, stripEmoji } from './escape.js';
import { htmlToMarkdown, htmlToPlainText } from './content.js';
import { buildPrintDocument, getPrintCss, isAtsExport, renderCv } from './render.js';
import { isAppleTouch, saveTextFile, shareOrSave } from './share.js';

export function documentBaseName(state) {
  const parts = [state.fullName, state.jobTitle].filter(Boolean).join(' ');
  return sanitizeFileName(parts || 'CV');
}

export function downloadSelfContainedHtml(state, options = {}) {
  const html = buildStandaloneHtml(state, options);
  return saveTextFile(html, `${documentBaseName(state)}.html`, 'text/html;charset=utf-8');
}

export function buildStandaloneHtml(state, options = {}) {
  const printHtml = buildPrintDocument(state, options);
  return printHtml.replace(
    /@font-face\s*\{[\s\S]*?\}\s*/g,
    ''
  ).replaceAll('url("/fonts/', 'url("./fonts/');
}

export function downloadMarkdown(state) {
  const md = buildMarkdownExport(state);
  return saveTextFile(md, `${documentBaseName(state)}.md`, 'text/markdown;charset=utf-8');
}

export function buildMarkdownExport(state) {
  const contact = String(state.contact || '')
    .split(/\r?\n/)
    .map((line) => stripEmoji(line).trim())
    .filter(Boolean)
    .join(' | ');

  const highlights = String(state.highlights || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n');

  const body = state.format === 'markdown'
    ? String(state.content || '').replace(/^---[\s\S]*?---\n/, '').trim()
    : htmlToMarkdown(renderCv({ ...state, photo: null }));

  return [
    '---',
    `name: ${state.fullName || ''}`,
    `title: ${state.jobTitle || ''}`,
    `contact: ${contact}`,
    '---',
    '',
    `# ${state.fullName || 'Curriculum vitae'}`,
    state.jobTitle || '',
    contact,
    '',
    highlights ? `## Highlights\n\n${highlights}\n` : '',
    body,
    ''
  ].filter((line, index, arr) => !(line === '' && arr[index - 1] === '')).join('\n');
}

export function downloadPlainText(state) {
  const text = htmlToPlainText(renderCv({ ...state, atsMode: true }, { ats: true }));
  return saveTextFile(`${text}\n`, `${documentBaseName(state)}.txt`, 'text/plain;charset=utf-8');
}

export async function downloadDocx(state) {
  const atsState = { ...state, atsMode: true, photo: null };
  const html = renderCv(atsState, { ats: true });
  const doc = htmlToDocx(html, atsState);
  const blob = await Packer.toBlob(doc);
  return shareOrSave(blob, `${documentBaseName(state)}.docx`);
}

export async function downloadPdf(state, options = {}) {
  const ats = isAtsExport(state, options);
  const filename = `${documentBaseName(state)}${ats ? '-ATS' : ''}.pdf`;
  const html = buildPrintDocument(state, { ...options, ats });

  try {
    const blob = await requestChromiumPdf(html, filename, state);
    const action = await shareOrSave(blob, filename);
    return { engine: 'chromium', filename, action };
  } catch (error) {
    const { downloadPdfMake } = await import('./pdfmake-export.js');
    const action = await downloadPdfMake(state, { ...options, ats, filename });
    return { engine: 'pdfmake', filename, action, fallbackReason: String(error.message || error) };
  }
}

function pdfApiUrls() {
  const urls = [];
  if (typeof window !== 'undefined') {
    urls.push(new URL('api/pdf', window.location.origin + (import.meta.env.BASE_URL || '/')).href);
    urls.push(`${window.location.origin}/api/pdf`);
  }
  return [...new Set(urls)];
}

async function requestChromiumPdf(html, filename, state) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  let lastError = new Error('PDF API unavailable');
  try {
    for (const url of pdfApiUrls()) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            html,
            filename,
            title: `${state.fullName || 'CV'}${state.jobTitle ? ` — ${state.jobTitle}` : ''}`,
            author: state.fullName || 'CV Generator'
          })
        });
        if (!response.ok) {
          lastError = new Error(`PDF API ${response.status}`);
          continue;
        }
        const blob = await response.blob();
        if (blob.size < 1000 || blob.type.includes('text/html')) {
          lastError = new Error('Empty PDF');
          continue;
        }
        return blob;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  } finally {
    clearTimeout(timer);
  }
}

export function printCv(state, options = {}) {
  const html = buildPrintDocument(state, options);

  if (isAppleTouch()) {
    const win = window.open('', '_blank');
    if (!win) {
      throw new Error('Allow pop-ups to open the A4 print view, or use Save PDF.');
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0'
  });
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  const doc = win.document;
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => {
    setTimeout(() => frame.remove(), 400);
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => {
    win.focus();
    win.print();
  }, 350);
}

export function getSharedCss() {
  return getPrintCss();
}

function htmlToDocx(html, state) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const children = [];

  const pushText = (el, factory) => {
    const runs = inlineRuns(el);
    if (!runs.length) return;
    children.push(factory(runs));
  };

  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    children: [new TextRun({ text: state.fullName || 'Curriculum vitae', bold: true })]
  }));

  if (state.jobTitle) {
    children.push(new Paragraph({
      children: [new TextRun({ text: state.jobTitle, italics: true })]
    }));
  }

  const walk = (node) => {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (['h1'].includes(tag)) return;
    if (tag === 'h2') {
      pushText(node, (runs) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs }));
      return;
    }
    if (tag === 'h3') {
      pushText(node, (runs) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs }));
      return;
    }
    if (tag === 'p') {
      pushText(node, (runs) => new Paragraph({ children: runs, spacing: { after: 80 } }));
      return;
    }
    if (tag === 'li') {
      pushText(node, (runs) => new Paragraph({ children: runs, bullet: { level: 0 } }));
      return;
    }
    Array.from(node.children).forEach(walk);
  };

  walk(doc.body);

  return new Document({
    creator: 'CV Generator',
    title: `${state.fullName || 'CV'}`,
    description: 'ATS-oriented resume export',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 21 }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, bottom: 720, left: 720, right: 720 }
        }
      },
      children
    }]
  });
}

function inlineRuns(el) {
  const runs = [];
  const visit = (node, style = {}) => {
    if (node.nodeType === 3) {
      const text = node.textContent.replace(/\s+/g, ' ');
      if (text) runs.push(new TextRun({ text, ...style }));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    const next = { ...style };
    if (tag === 'strong' || tag === 'b') next.bold = true;
    if (tag === 'em' || tag === 'i') next.italics = true;
    if (tag === 'a') next.style = 'Hyperlink';
    Array.from(node.childNodes).forEach((child) => visit(child, next));
  };
  visit(el);
  return runs;
}


