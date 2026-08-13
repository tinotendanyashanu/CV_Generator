import { matchSectionType } from './content.js';

const ACTION_VERBS = [
  'led', 'built', 'shipped', 'designed', 'launched', 'optimized', 'reduced',
  'increased', 'improved', 'delivered', 'owned', 'scaled', 'automated',
  'migrated', 'implemented', 'mentored', 'negotiated', 'architected'
];

const STOPWORDS = new Set([
  'with', 'that', 'this', 'from', 'your', 'have', 'will', 'were', 'been',
  'they', 'their', 'them', 'into', 'using', 'work', 'role', 'team', 'plus',
  'and', 'the', 'for', 'you', 'our', 'are', 'was', 'but', 'not', 'all'
]);

export function analyzeAts({ state, previewText, template }) {
  const insights = [];
  const contact = state.contact || '';
  const content = `${state.highlights || ''}\n${state.content || ''}\n${previewText || ''}`;
  const words = previewText ? previewText.trim().split(/\s+/).filter(Boolean) : [];

  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(contact)) {
    insights.push({ type: 'pass', title: 'Email', detail: 'A professional email is present and parseable.' });
  } else {
    insights.push({ type: 'fail', title: 'Email missing', detail: 'Add a plain-text email address. Icons-only contact lines are dropped by ATS software.' });
  }

  if (/\+?[0-9][0-9\s().-]{6,}\d/.test(contact)) {
    insights.push({ type: 'pass', title: 'Phone', detail: 'Numeric phone number detected.' });
  } else {
    insights.push({ type: 'warn', title: 'Phone', detail: 'Add an international phone number unless the market discourages it.' });
  }

  if (/(https?:\/\/|www\.|linkedin\.com|github\.com)/i.test(contact)) {
    insights.push({ type: 'pass', title: 'Profile link', detail: 'LinkedIn or portfolio URL found.' });
  } else {
    insights.push({ type: 'info', title: 'Profile link', detail: 'Add a LinkedIn or portfolio URL as plain text, not a QR code or icon.' });
  }

  if ((state.fullName || '').trim().split(/\s+/).length < 2) {
    insights.push({ type: 'warn', title: 'Full name', detail: 'Use first and last name in the header so parsers can map the candidate.' });
  }

  if (words.length < 250) {
    insights.push({ type: 'warn', title: 'Thin content', detail: `About ${words.length} words. Strong mid-level CVs usually land between 350 and 700 words.` });
  } else if (words.length > 900) {
    insights.push({ type: 'warn', title: 'Long CV', detail: `${words.length} words. Most ATS reviewers prefer one or two pages.` });
  } else {
    insights.push({ type: 'pass', title: 'Length', detail: `${words.length} words — a workable length for both humans and parsers.` });
  }

  if (!/(^|\n)\s*[-*•]|\<li\>/m.test(state.content || '') && !/^- /m.test(previewText || '')) {
    insights.push({ type: 'fail', title: 'No bullets', detail: 'Use bullet lists for achievements. Parsers and recruiters both scan bullets first.' });
  } else {
    insights.push({ type: 'pass', title: 'Structured bullets', detail: 'Achievement bullets are present.' });
  }

  const verbHits = ACTION_VERBS.filter((verb) => new RegExp(`\\b${verb}\\b`, 'i').test(content));
  if (verbHits.length) {
    insights.push({ type: 'pass', title: 'Action verbs', detail: `Found ${verbHits.slice(0, 5).join(', ')}.` });
  } else {
    insights.push({ type: 'warn', title: 'Action verbs', detail: 'Start bullets with verbs such as led, shipped, reduced, or launched.' });
  }

  if (/\b(I|me|my)\b/.test(content)) {
    insights.push({ type: 'warn', title: 'First person', detail: 'Drop “I/me/my”. ATS scoring and recruiter style both prefer implied-subject bullets.' });
  }

  if (/(\b\d+%|\b\d+[,\d]*\+?|\b\d+\s?(k|m|bn)\b)/i.test(content)) {
    insights.push({ type: 'pass', title: 'Metrics', detail: 'Quantified results detected.' });
  } else {
    insights.push({ type: 'warn', title: 'Metrics', detail: 'Add numbers: %, revenue, users, time saved, team size.' });
  }

  const headingTypes = findHeadingTypes(previewText || state.content || '');
  ['experience', 'education', 'skills'].forEach((type) => {
    if (headingTypes.has(type)) {
      insights.push({ type: 'pass', title: `“${capitalize(type)}” heading`, detail: 'Standard section name — parsers can file this block.' });
    } else {
      insights.push({ type: 'warn', title: `Add a ${capitalize(type)} heading`, detail: 'Use a conventional label such as Experience, Education, or Skills.' });
    }
  });

  if (state.photo && (state.atsMode || template === 'ats')) {
    insights.push({ type: 'info', title: 'Photo hidden', detail: 'ATS export omits photos. They do not parse and can trigger bias filters.' });
  } else if (state.photo && template === 'sidebar') {
    insights.push({ type: 'warn', title: 'Photo + columns', detail: 'Two-column layouts and photos are the most common parse failures. Use ATS Essential when applying online.' });
  }

  if (template === 'sidebar' && !state.atsMode) {
    insights.push({ type: 'warn', title: 'Two-column layout', detail: 'Keep Sidebar for networking PDFs. Submit the ATS Essential file to job portals.' });
  }

  if (/[📍📧📞🔗💻🌐]/.test(state.contact || '')) {
    insights.push({ type: 'info', title: 'Contact icons', detail: 'Decorative symbols are stripped from ATS and Word exports so the raw email and phone remain.' });
  }

  return insights;
}

export function extractKeywords(jobDescription) {
  return Array.from(new Set(
    String(jobDescription || '')
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s-]/g, ' ')
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word) && !/^\d+$/.test(word))
  ));
}

export function matchJobDescription(previewText, jobDescription) {
  const keywords = extractKeywords(jobDescription);
  if (!keywords.length) return { keywords: [], found: [], missing: [] };
  const haystack = String(previewText || '').toLowerCase();
  const found = keywords.filter((word) => haystack.includes(word));
  const missing = keywords.filter((word) => !haystack.includes(word));
  return { keywords, found, missing: missing.slice(0, 16) };
}

export function scoreInsights(insights) {
  const weights = { pass: 1, info: 0.5, warn: 0, fail: -1 };
  const total = insights.reduce((sum, item) => sum + (weights[item.type] ?? 0), 0);
  const max = insights.length;
  return Math.max(0, Math.min(100, Math.round(((total + max) / (max * 2)) * 100)));
}

function findHeadingTypes(text) {
  const types = new Set();
  String(text)
    .split(/\n/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .forEach((line) => {
      const type = matchSectionType(line);
      if (type !== 'other') types.add(type);
    });
  return types;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
