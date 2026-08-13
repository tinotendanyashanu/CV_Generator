import { escapeAttribute, escapeHtml, stripEmoji } from './escape.js';

const ICON_MAP = [
  { test: /@/, icon: 'email' },
  { test: /^(tel:|\+?\d[\d\s().-]{6,}$)/i, icon: 'phone' },
  { test: /linkedin/i, icon: 'link' },
  { test: /github/i, icon: 'link' },
  { test: /https?:|www\./i, icon: 'link' }
];

export function parseContactLines(raw, { ats = false } = {}) {
  return String(raw || '')
    .split(/\r?\n|[|•]/)
    .map((line) => (ats ? stripEmoji(line) : line).trim())
    .filter(Boolean)
    .map((line) => {
      const cleaned = ats ? stripEmoji(line) : line.replace(/^[📍📧📞🔗💻🌐✉☎☎️📱]\s*/, '').trim();
      return buildContactItem(cleaned || line, ats);
    });
}

export function renderContact(raw, { ats = false } = {}) {
  const items = parseContactLines(raw, { ats });
  if (!items.length) return '';
  return `<ul class="cv-contact">${items.map((item) => `<li>${item.html}</li>`).join('')}</ul>`;
}

export function contactPlainText(raw) {
  return parseContactLines(raw, { ats: true }).map((item) => item.text).join('  ·  ');
}

function buildContactItem(text, ats) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) {
    return linkItem(text, `mailto:${email[0]}`, ats);
  }

  const urlMatch = text.match(/(https?:\/\/[^\s<]+)|((?:www\.)[^\s<]+)/i);
  if (urlMatch) {
    const rawUrl = urlMatch[0];
    const href = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    return linkItem(text, href, ats);
  }

  const phone = text.match(/(\+?[0-9][0-9\s().-]{6,}\d)/);
  if (phone) {
    const digits = phone[1].replace(/[^\d+]/g, '');
    if (digits.length >= 7) {
      return linkItem(text, `tel:${digits}`, ats);
    }
  }

  return {
    text,
    html: `<span class="contact-text">${escapeHtml(text)}</span>`
  };
}

function linkItem(text, href, ats) {
  const isWeb = /^https?:/i.test(href);
  const attrs = isWeb ? ' target="_blank" rel="noopener noreferrer"' : '';
  return {
    text,
    href,
    html: `<a href="${escapeAttribute(href)}"${attrs}><span class="contact-text">${escapeHtml(text)}</span></a>`
  };
}

export function detectContactKind(text) {
  return ICON_MAP.find((item) => item.test.test(text))?.icon || 'text';
}
