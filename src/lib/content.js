import { marked } from 'marked';
import createDOMPurify from 'dompurify';
import { escapeHtml, looksLikeDateLine } from './escape.js';

marked.use({
  gfm: true,
  breaks: true
});

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u',
  'a', 'br', 'hr', 'span', 'div', 'section', 'article',
  'blockquote', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

const ALLOWED_ATTR = ['href', 'class', 'rel', 'target', 'title'];

export const SECTION_ALIASES = {
  summary: ['summary', 'profile', 'professional summary', 'about', 'objective'],
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'work history'],
  education: ['education', 'education & certifications', 'education and certifications', 'academic'],
  skills: ['skills', 'core skills', 'technical skills', 'expertise'],
  projects: ['projects', 'selected projects', 'projects & achievements'],
  certifications: ['certifications', 'certificates', 'licenses'],
  languages: ['languages']
};

export function parseFrontMatter(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: text };
  }

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) meta[key] = value;
  }

  return { meta, body: match[2] };
}

export function sanitizeHtml(html) {
  const stripped = String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  const purify = getPurify();
  const clean = purify.sanitize(stripped, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'img', 'svg', 'math'],
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload']
  });

  const root = parseRoot(clean);
  root.querySelectorAll('a').forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    if (!/^(https?:|mailto:|tel:)/i.test(href)) {
      anchor.removeAttribute('href');
    } else {
      if (/^https?:/i.test(href)) {
        anchor.setAttribute('target', '_blank');
      }
      anchor.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return root.innerHTML;
}

export function markdownToHtml(markdown) {
  const { body } = parseFrontMatter(markdown);
  return marked.parse(body || '', { async: false });
}

export function textToHtml(text) {
  const lines = String(text || '').split(/\r?\n/);
  let html = '';
  let inList = false;

  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      closeList();
      const level = line.match(/^#+/)[0].length;
      html += `<h${level}>${escapeHtml(line.replace(/^#+\s+/, ''))}</h${level}>`;
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${escapeHtml(line.replace(/^[-*•]\s+/, ''))}</li>`;
      continue;
    }
    closeList();
    html += `<p>${escapeHtml(line)}</p>`;
  }
  closeList();
  return html;
}

export function renderContent(raw, format = 'markdown') {
  const source = String(raw || '').trim();
  if (!source) return '';

  let html;
  if (format === 'html') {
    html = source;
  } else if (format === 'text') {
    html = textToHtml(source);
  } else {
    html = markdownToHtml(source);
  }

  return enhanceCvHtml(sanitizeHtml(html));
}

export function enhanceCvHtml(html) {
  const root = parseRoot(html);
  if (!root.childNodes.length) return html;

  wrapHeadingGroups(root, ['H2'], 'section', 'cv-section');
  root.querySelectorAll('section.cv-section').forEach((section) => {
    wrapHeadingGroups(section, ['H3'], 'article', inferBlockClass(section));
  });

  if (!root.querySelector('section.cv-section')) {
    wrapHeadingGroups(root, ['H3'], 'article', 'cv-job');
  }

  root.querySelectorAll('article.cv-job, article.education-item').forEach((block) => {
    const firstPara = block.querySelector(':scope > p') || block.querySelector('p');
    if (firstPara && looksLikeDateLine(firstPara.textContent)) {
      firstPara.classList.add('cv-job-meta');
    }
  });

  root.querySelectorAll('h1, h2, h3, h4').forEach((heading) => {
    heading.classList.add('keep-with-next');
  });

  return root.innerHTML;
}

export function htmlToPlainText(html) {
  const root = parseRoot(html);
  const lines = [];

  const walk = (node) => {
    if (node.nodeType === 3) {
      const text = node.textContent.replace(/\s+/g, ' ');
      if (text.trim()) lines.push(text.trim());
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (['script', 'style'].includes(tag)) return;
    if (['h1', 'h2', 'h3', 'h4', 'p', 'li'].includes(tag)) {
      const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) lines.push(tag === 'li' ? `- ${text}` : text);
      return;
    }
    Array.from(node.childNodes).forEach(walk);
  };

  Array.from(root.childNodes).forEach(walk);
  return uniqueKeepOrder(lines).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function htmlToMarkdown(html) {
  const root = parseRoot(html);
  const parts = [];

  const convertInline = (el) => {
    let text = '';
    el.childNodes.forEach((node) => {
      if (node.nodeType === 3) {
        text += node.textContent;
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      const inner = convertInline(node).trim();
      if (tag === 'strong' || tag === 'b') text += `**${inner}**`;
      else if (tag === 'em' || tag === 'i') text += `*${inner}*`;
      else if (tag === 'a') {
        const href = node.getAttribute('href') || '';
        text += href ? `[${inner}](${href})` : inner;
      } else if (tag === 'br') text += '  \n';
      else text += inner;
    });
    return text;
  };

  const walk = (node) => {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      const level = Number(tag[1]);
      parts.push(`${'#'.repeat(level)} ${convertInline(node).trim()}`);
      parts.push('');
      return;
    }
    if (tag === 'p') {
      const text = convertInline(node).trim();
      if (text) parts.push(text, '');
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      Array.from(node.children).forEach((li, index) => {
        if (li.tagName.toLowerCase() !== 'li') return;
        const prefix = tag === 'ol' ? `${index + 1}.` : '-';
        parts.push(`${prefix} ${convertInline(li).trim()}`);
      });
      parts.push('');
      return;
    }
    if (tag === 'hr') {
      parts.push('---', '');
      return;
    }
    Array.from(node.childNodes).forEach(walk);
  };

  Array.from(root.childNodes).forEach(walk);
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function normalizeHeading(text) {
  return String(text || '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function matchSectionType(heading) {
  const key = normalizeHeading(heading);
  for (const [type, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.includes(key)) return type;
  }
  return 'other';
}

export function renderHighlights(raw) {
  const lines = String(raw || '')
    .split(/\r?\n|•/)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  if (!lines.length) return '';
  const items = lines.map((line) => `<li>${inlineFormat(line)}</li>`).join('');
  return `<section class="cv-section highlights"><h2>Highlights</h2><ul>${items}</ul></section>`;
}

function inlineFormat(text) {
  return escapeHtml(text).replace(/(\b\d+[\d,.]*%?)/g, '<strong>$1</strong>');
}

function wrapHeadingGroups(root, headingTags, wrapperTag, className) {
  const nodes = Array.from(root.childNodes);
  const groups = [];
  let bucket = null;

  for (const node of nodes) {
    const isHeading = node.nodeType === 1 && headingTags.includes(node.tagName);
    if (isHeading) {
      bucket = [node];
      groups.push(bucket);
    } else if (bucket) {
      bucket.push(node);
    }
  }

  for (const group of groups) {
    const heading = group[0];
    const wrapper = root.ownerDocument.createElement(wrapperTag);
    wrapper.className = typeof className === 'function' ? className(heading) : className;
    heading.replaceWith(wrapper);
    group.forEach((node) => wrapper.appendChild(node));
  }
}

function inferBlockClass(section) {
  const heading = section.querySelector('h2');
  const type = matchSectionType(heading ? heading.textContent : '');
  return type === 'education' || type === 'certifications' ? 'education-item' : 'cv-job';
}

function parseRoot(html) {
  if (typeof DOMParser === 'undefined') {
    throw new Error('DOMParser is required to process CV HTML');
  }
  const doc = new DOMParser().parseFromString('<!DOCTYPE html><html><body></body></html>', 'text/html');
  const root = doc.createElement('div');
  root.innerHTML = String(html || '').replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return root;
}

function getPurify() {
  if (typeof window === 'undefined') {
    throw new Error('DOMPurify requires a window');
  }
  return createDOMPurify(window);
}

function uniqueKeepOrder(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}
