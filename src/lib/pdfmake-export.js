import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { renderCv } from './render.js';
import { shareOrSave } from './share.js';

const vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs || pdfFonts;
if (vfs) pdfMake.vfs = vfs;

export async function downloadPdfMake(state, options = {}) {
  const html = renderCv({ ...state, photo: options.ats ? null : state.photo }, options);
  const definition = htmlToPdfDefinition(html, state, options);
  const filename = options.filename || 'CV.pdf';
  const blob = await new Promise((resolve, reject) => {
    pdfMake.createPdf(definition).getBlob(resolve);
    setTimeout(() => reject(new Error('PDF timed out')), 8000);
  });
  return shareOrSave(blob, filename);
}

export function htmlToPdfDefinition(html, state, options = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const content = [];

  const name = doc.querySelector('.cv-name')?.textContent?.trim() || state.fullName || 'CV';
  const title = doc.querySelector('.cv-title')?.textContent?.trim() || state.jobTitle || '';
  const contact = Array.from(doc.querySelectorAll('.cv-contact li, .cv-contact a, .cv-contact .contact-text'))
    .map((el) => el.textContent.trim())
    .filter(Boolean);

  content.push({ text: name, style: 'name' });
  if (title) content.push({ text: title, style: 'role' });
  if (contact.length) {
    content.push({ text: unique(contact).join('  ·  '), style: 'contact', margin: [0, 2, 0, 10] });
  }

  doc.querySelectorAll('.grid-overlay, .circuit, .ornament, .cv-watermark, .geo-shapes, .brush, .palette').forEach((el) => el.remove());
  const body = doc.querySelector('.cv-body, .cv-main, .product-main') || doc.querySelector('.cv') || doc.body;
  collectBlocks(body, content);

  return {
    pageSize: 'A4',
    pageMargins: [42, 42, 42, 48],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      lineHeight: 1.25,
      color: '#111111'
    },
    info: {
      title: `${name}${title ? ` — ${title}` : ''}`,
      author: name,
      creator: 'CV Generator',
      producer: 'CV Generator'
    },
    content,
    styles: {
      name: { fontSize: 20, bold: true, margin: [0, 0, 0, 2] },
      role: { fontSize: 12, color: '#333333', margin: [0, 0, 0, 2] },
      contact: { fontSize: 9, color: '#333333' },
      h2: { fontSize: 11, bold: true, margin: [0, 12, 0, 4], characterSpacing: 0.6 },
      h3: { fontSize: 11, bold: true, margin: [0, 8, 0, 1] },
      meta: { fontSize: 9, color: '#444444', margin: [0, 0, 0, 3] },
      para: { margin: [0, 0, 0, 4] }
    }
  };
}

function collectBlocks(root, content) {
  const blocks = [];
  const visit = (node) => {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (node.matches?.('article.cv-job, article.education-item')) {
      blocks.push(jobStack(node));
      return;
    }
    if (tag === 'h2') {
      blocks.push({ text: node.textContent.trim().toUpperCase(), style: 'h2' });
      return;
    }
    if (tag === 'h3') {
      blocks.push({ text: node.textContent.trim(), style: 'h3' });
      return;
    }
    if (tag === 'p') {
      blocks.push({
        text: inline(node),
        style: node.classList.contains('cv-job-meta') ? 'meta' : 'para'
      });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(node.children)
        .filter((child) => child.tagName.toLowerCase() === 'li')
        .map((li) => inline(li));
      if (items.length) blocks.push({ ul: items, margin: [0, 0, 0, 6] });
      return;
    }
    Array.from(node.children).forEach(visit);
  };

  Array.from(root.children).forEach(visit);
  content.push(...blocks.filter(Boolean));
}

function jobStack(article) {
  const stack = [];
  Array.from(article.children).forEach((child) => {
    const tag = child.tagName.toLowerCase();
    if (tag === 'h3') stack.push({ text: child.textContent.trim(), style: 'h3' });
    else if (tag === 'p') {
      stack.push({
        text: inline(child),
        style: child.classList.contains('cv-job-meta') ? 'meta' : 'para'
      });
    } else if (tag === 'ul' || tag === 'ol') {
      stack.push({
        ul: Array.from(child.children).map((li) => inline(li)),
        margin: [0, 0, 0, 4]
      });
    }
  });
  return {
    unbreakable: true,
    stack,
    margin: [0, 0, 0, 6]
  };
}

function inline(el) {
  const parts = [];
  const walk = (node, style = {}) => {
    if (node.nodeType === 3) {
      const text = node.textContent.replace(/\s+/g, ' ');
      if (text) parts.push({ text, ...style });
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    const next = { ...style };
    if (tag === 'strong' || tag === 'b') next.bold = true;
    if (tag === 'em' || tag === 'i') next.italics = true;
    Array.from(node.childNodes).forEach((child) => walk(child, next));
  };
  walk(el);
  return parts.length ? parts : (el.textContent || '').trim();
}

function unique(items) {
  return [...new Set(items)];
}
