export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function sanitizeFileName(name) {
  const cleaned = String(name || '')
    .replace(/[^a-z0-9\-\s_()]+/gi, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned || 'CV';
}

export function stripEmoji(text) {
  return String(text || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[📍📧📞🔗💻🌐✉☎☎️📱•●▪▸►]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function looksLikeDateLine(text) {
  const value = String(text || '').trim();
  if (!value || value.length > 80) return false;
  return /(\b(19|20)\d{2}\b|\bpresent\b|\bcurrent\b|[–—-]|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)/i.test(value);
}
