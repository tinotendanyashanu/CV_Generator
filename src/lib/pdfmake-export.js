import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { renderCv } from './render.js';
import { shareOrSave } from './share.js';
import { themeFor } from './themes.js';

const vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs || pdfFonts;
if (vfs) pdfMake.vfs = vfs;

export async function downloadPdfMake(state, options = {}) {
  const html = renderCv(state, options);
  const definition = htmlToPdfDefinition(html, state, options);
  const filename = options.filename || 'CV.pdf';
  const blob = await new Promise((resolve, reject) => {
    pdfMake.createPdf(definition).getBlob(resolve);
    setTimeout(() => reject(new Error('PDF timed out')), 8000);
  });
  return shareOrSave(blob, filename);
}

export function htmlToPdfDefinition(html, state, options = {}) {
  const ats = Boolean(options.ats);
  const theme = themeFor(state.template, ats);
  const extracted = extractCv(html, state);
  const content = [];

  content.push(headerBlock(extracted, theme, ats));

  if (theme.sidebar && !ats) {
    content.push({
      columns: [
        {
          width: '32%',
          stack: bodyBlocks(extracted.sideBlocks, theme),
          fillColor: theme.side,
          margin: [-36, 0, 8, 0],
          padding: [10, 8, 10, 8]
        },
        {
          width: '*',
          stack: bodyBlocks(extracted.blocks, theme)
        }
      ],
      columnGap: 14
    });
  } else {
    content.push(...bodyBlocks(extracted.blocks, theme));
  }

  return {
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 40],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      lineHeight: 1.28,
      color: theme.text
    },
    background() {
      return {
        canvas: [{
          type: 'rect',
          x: 0,
          y: 0,
          w: 595.28,
          h: 841.89,
          color: theme.page
        }]
      };
    },
    info: {
      title: `${extracted.name}${extracted.title ? ` — ${extracted.title}` : ''}`,
      author: extracted.name,
      creator: 'CV Generator',
      producer: 'CV Generator'
    },
    content,
    styles: {
      name: { fontSize: 20, bold: true, color: theme.name, margin: [0, 0, 0, 3] },
      role: { fontSize: 11, color: theme.title, margin: [0, 0, 0, 4] },
      contact: { fontSize: 9, color: theme.contact, margin: [0, 2, 0, 0] },
      h2: {
        fontSize: 11,
        bold: true,
        color: theme.accent,
        margin: [0, 12, 0, 4],
        characterSpacing: 0.5
      },
      h3: { fontSize: 11, bold: true, color: theme.text, margin: [0, 8, 0, 1] },
      meta: { fontSize: 9, color: theme.muted, margin: [0, 0, 0, 3] },
      para: { color: theme.text, margin: [0, 0, 0, 4] }
    }
  };
}

function headerBlock(extracted, theme, ats) {
  const stack = [
    { text: extracted.name, style: 'name' }
  ];
  if (extracted.title) stack.push({ text: extracted.title, style: 'role' });
  if (extracted.contact.length) {
    stack.push({ text: unique(extracted.contact).join('   ·   '), style: 'contact' });
  }

  if (ats || theme.header === '#ffffff') {
    return { stack, margin: [0, 0, 0, 10] };
  }

  return {
    table: {
      widths: ['*'],
      body: [[{
        stack,
        fillColor: theme.header,
        margin: [14, 12, 14, 12]
      }]]
    },
    layout: 'noBorders',
    margin: [-36, -12, -36, 12]
  };
}

function bodyBlocks(blocks, theme) {
  return (blocks || []).map((block) => {
    if (block.type === 'h2') return { text: block.text, style: 'h2' };
    if (block.type === 'h3') return { text: block.text, style: 'h3' };
    if (block.type === 'meta') return { text: block.text, style: 'meta' };
    if (block.type === 'p') return { text: block.text, style: 'para' };
    if (block.type === 'ul') {
      return {
        ul: block.items,
        color: theme.text,
        margin: [0, 0, 0, 6]
      };
    }
    if (block.type === 'job') {
      return {
        unbreakable: true,
        stack: [
          { text: block.title, style: 'h3' },
          block.meta ? { text: block.meta, style: 'meta' } : null,
          block.items?.length ? { ul: block.items, color: theme.text, margin: [0, 0, 0, 4] } : null
        ].filter(Boolean),
        margin: [0, 0, 0, 6]
      };
    }
    return null;
  }).filter(Boolean);
}

function extractCv(html, state) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  doc.querySelectorAll('.grid-overlay, .circuit, .ornament, .cv-watermark, .geo-shapes, .brush, .palette').forEach((el) => el.remove());

  const name = doc.querySelector('.cv-name')?.textContent?.trim() || state.fullName || 'CV';
  const title = doc.querySelector('.cv-title')?.textContent?.trim() || state.jobTitle || '';
  const contact = Array.from(doc.querySelectorAll('.cv-contact .contact-text, .cv-contact a, .cv-contact li'))
    .map((el) => el.textContent.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const sideRoot = doc.querySelector('.cv-side');
  const bodyRoot = doc.querySelector('.product-main, .cv-main, .cv-body') || doc.querySelector('.cv');
  const highlightRoot = doc.querySelector('.highlights, .product-summary');

  const blocks = [];
  if (highlightRoot && !sideRoot?.contains(highlightRoot)) {
    blocks.push(...nodesToBlocks(highlightRoot));
  }
  if (bodyRoot) blocks.push(...nodesToBlocks(bodyRoot));

  return {
    name,
    title,
    contact: unique(contact),
    blocks: dedupeBlocks(blocks),
    sideBlocks: sideRoot ? dedupeBlocks(nodesToBlocks(sideRoot)) : []
  };
}

function nodesToBlocks(root) {
  const blocks = [];
  const visit = (node) => {
    if (node.nodeType !== 1) return;
    if (node.matches?.('header, .cv-header, .cv-contact, .tech-info')) return;
    const tag = node.tagName.toLowerCase();
    if (node.matches?.('article.cv-job, article.education-item')) {
      const heading = node.querySelector('h3');
      const meta = node.querySelector('.cv-job-meta, p');
      const items = Array.from(node.querySelectorAll('li')).map((li) => inlinePlain(li)).filter(Boolean);
      blocks.push({
        type: 'job',
        title: heading ? inlinePlain(heading) : '',
        meta: meta && !meta.closest('li') ? inlinePlain(meta) : '',
        items
      });
      return;
    }
    if (tag === 'h2') {
      blocks.push({ type: 'h2', text: inlinePlain(node).toUpperCase() });
      return;
    }
    if (tag === 'h3') {
      blocks.push({ type: 'h3', text: inlinePlain(node) });
      return;
    }
    if (tag === 'p') {
      const text = inlinePlain(node);
      if (text) blocks.push({ type: node.classList.contains('cv-job-meta') ? 'meta' : 'p', text });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(node.children)
        .filter((child) => child.tagName.toLowerCase() === 'li')
        .map((li) => inlinePlain(li))
        .filter(Boolean);
      if (items.length) blocks.push({ type: 'ul', items });
      return;
    }
    Array.from(node.children).forEach(visit);
  };
  Array.from(root.children).forEach(visit);
  return blocks;
}

function inlinePlain(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function dedupeBlocks(blocks) {
  const seen = new Set();
  return blocks.filter((block) => {
    const key = JSON.stringify(block);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(items) {
  return [...new Set(items)];
}
