import './styles/fonts.css';
import './styles/app.css';
import './styles/cv.css';
import './styles/templates.css';
import { compressPhoto, defaultState, loadState, readForm, saveState, writeForm } from './state.js';
import { TEMPLATES, renderCv } from './lib/render.js';
import { htmlToPlainText, parseFrontMatter } from './lib/content.js';
import { analyzeAts, matchJobDescription, scoreInsights } from './lib/ats.js';
import {
  downloadDocx,
  downloadMarkdown,
  downloadPdf,
  downloadPlainText,
  downloadSelfContainedHtml,
  printCv
} from './lib/exports.js';
import { applyA4Fit } from './lib/a4.js';
import { isAppleTouch } from './lib/share.js';

const form = document.getElementById('cvForm');
const preview = document.getElementById('preview');
const pageGuides = document.getElementById('pageGuides');
const pageStatus = document.getElementById('pageStatus');
const engineStatus = document.getElementById('engineStatus');
const insightsEl = document.getElementById('insights');
const parsePreview = document.getElementById('parsePreview');
const atsScore = document.getElementById('atsScore');
const toast = document.getElementById('toast');
const templateList = document.getElementById('templateList');
const exportMenu = document.getElementById('exportMenu');
const formatHint = document.getElementById('formatHint');
const layout = document.querySelector('.layout');
const a4Stage = document.getElementById('a4Stage');
const a4Zoom = document.getElementById('a4Zoom');
const a4Sheet = document.getElementById('a4');
const sizeToggle = document.getElementById('sizeToggle');
const previewHint = document.getElementById('previewHint');
const header = document.querySelector('.app-header');

const HINTS = {
  markdown: 'Markdown: ## Experience, ### Role — Company, a date line, then - bullets. Import a .md file anytime.',
  html: 'HTML: headings, paragraphs, lists, links. Unsafe tags are removed before preview and export.',
  text: 'Plain text: one paragraph per line. Use -, * or • for bullets. Headings can still use #.'
};

let state = loadState();
let renderTimer = 0;
let actualSize = false;

function currentState() {
  return { ...readForm(form), photo: form.dataset.photo || null };
}

function paintTemplates() {
  const groups = [];
  for (const item of TEMPLATES) {
    const last = groups[groups.length - 1];
    if (!last || last.family !== item.family) groups.push({ family: item.family, items: [item] });
    else last.items.push(item);
  }
  templateList.innerHTML = groups.map((group) => `
    <p class="template-family">${group.family}</p>
    <div class="templates-grid">
      ${group.items.map((item) => `
        <button type="button" class="template-option ${item.id === state.template ? 'active' : ''}" data-template="${item.id}">
          <span class="swatch" style="background:${item.swatch || '#999'}"></span>
          ${item.label}
          <small>${item.blurb}</small>
        </button>
      `).join('')}
    </div>
  `).join('');
}

function refresh(nextState = currentState()) {
  state = nextState;
  saveState(state);
  preview.innerHTML = renderCv(state);
  if (a4Sheet) {
    a4Sheet.dataset.template = state.template || 'ats';
    a4Sheet.classList.toggle('designed', !state.atsMode && state.template !== 'ats');
  }
  const text = htmlToPlainText(preview.innerHTML);
  const insights = analyzeAts({ state, previewText: text, template: state.template });
  atsScore.textContent = `${scoreInsights(insights)}/100`;
  insightsEl.innerHTML = insights.map((item) => `
    <div class="insight ${item.type}">
      <strong>${item.title}</strong>
      ${item.detail}
    </div>
  `).join('');

  if (state.jobDescription.trim()) {
    const match = matchJobDescription(text, state.jobDescription);
    insightsEl.insertAdjacentHTML('beforeend', `
      <div class="insight info">
        <strong>Job description coverage · ${match.found.length}/${match.keywords.length}</strong>
        <div class="keywords">
          ${match.found.slice(0, 10).map((word) => `<b>${word}</b>`).join('')}
          ${match.missing.map((word) => `<i>${word}</i>`).join('')}
        </div>
      </div>
    `);
  }

  parsePreview.textContent = text;
  formatHint.textContent = HINTS[state.format] || HINTS.markdown;
  paintTemplates();
  requestAnimationFrame(() => measurePages());
}

function measurePages() {
  if (header) {
    document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  }
  if (preview.closest('.preview-pane')?.offsetParent === null) return;

  const metrics = applyA4Fit({
    stage: a4Stage,
    zoom: a4Zoom,
    sheet: a4Sheet,
    inner: preview,
    guides: pageGuides,
    actualSize
  });

  const percent = Math.round(metrics.scale * 100);
  const note = metrics.pages > 2
    ? 'Longer than two pages — tighten density or cut older roles.'
    : metrics.pages === 2
      ? 'Two A4 pages. Many portals still prefer one if you can keep the proof points.'
      : 'One A4 page.';
  pageStatus.textContent = `${metrics.pages} × A4 (210×297 mm) · ${percent}% view · ${note}`;
  if (sizeToggle) {
    sizeToggle.textContent = actualSize ? 'Fit to screen' : 'Actual size';
  }
  if (previewHint) {
    previewHint.textContent = isAppleTouch()
      ? 'Scaled A4 preview. Save PDF for a clean file — Safari Print adds a header unless you turn it off.'
      : 'This is a real A4 sheet scaled to your screen. Export always writes 210 × 297 mm pages.';
  }
}

function setPane(pane) {
  if (!layout) return;
  layout.dataset.pane = pane;
  document.getElementById('tabEdit')?.setAttribute('aria-selected', String(pane === 'edit'));
  document.getElementById('tabPreview')?.setAttribute('aria-selected', String(pane === 'preview'));
  const dock = document.getElementById('dockPreview');
  if (dock) dock.textContent = pane === 'preview' ? 'Edit CV' : 'A4 preview';
  if (pane === 'preview') {
    requestAnimationFrame(() => measurePages());
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function scheduleRefresh() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => refresh(), 160);
}

writeForm(form, state);
paintTemplates();
if (window.matchMedia('(max-width: 820px)').matches) {
  setPane('preview');
}
refresh(state);

form.addEventListener('input', scheduleRefresh);
form.addEventListener('change', scheduleRefresh);

templateList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-template]');
  if (!button) return;
  const id = button.dataset.template;
  form.elements.template.value = id;
  const meta = TEMPLATES.find((item) => item.id === id);
  if (meta?.family !== 'Apply') form.elements.atsMode.checked = false;
  else if (id === 'ats') form.elements.atsMode.checked = true;
  refresh();
});

document.getElementById('photoFile').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  form.dataset.photo = await compressPhoto(file);
  refresh();
});

document.getElementById('clearPhotoBtn').addEventListener('click', () => {
  form.dataset.photo = '';
  form.elements.photoFile.value = '';
  refresh();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Replace the current CV with the sample?')) return;
  state = defaultState();
  writeForm(form, state);
  refresh(state);
});

document.getElementById('importFile').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const text = await file.text();
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) {
    const parsed = JSON.parse(text);
    state = { ...currentState(), ...parsed };
  } else if (name.endsWith('.html') || name.endsWith('.htm')) {
    state = { ...currentState(), format: 'html', content: text };
  } else if (name.endsWith('.txt')) {
    state = { ...currentState(), format: 'text', content: text };
  } else {
    const { meta, body } = parseFrontMatter(text);
    state = {
      ...currentState(),
      format: 'markdown',
      content: body,
      fullName: meta.name || currentState().fullName,
      jobTitle: meta.title || currentState().jobTitle,
      contact: (meta.contact || '').replace(/\s+\|\s+/g, '\n') || currentState().contact
    };
  }
  writeForm(form, state);
  refresh(state);
  showToast(`Imported ${file.name}`);
});

document.getElementById('printBtn')?.addEventListener('click', () => {
  try {
    printCv(currentState());
  } catch (error) {
    showToast(error.message || 'Print failed');
  }
});

document.getElementById('tabEdit')?.addEventListener('click', () => setPane('edit'));
document.getElementById('tabPreview')?.addEventListener('click', () => setPane('preview'));
document.getElementById('dockPreview')?.addEventListener('click', () => {
  setPane(layout?.dataset.pane === 'preview' ? 'edit' : 'preview');
});
document.getElementById('dockExport')?.addEventListener('click', async () => {
  const snapshot = currentState();
  const exportBtn = document.getElementById('exportToggle');
  if (exportBtn) exportBtn.disabled = true;
  try {
    const result = await downloadPdf(snapshot, { ats: snapshot.atsMode || snapshot.template === 'ats' });
    if (result.action !== 'cancel') showToast(exportMessage(result.filename, result.engine, result.action));
  } catch (error) {
    showToast(error.message || 'Export failed');
  } finally {
    if (exportBtn) exportBtn.disabled = false;
  }
});

sizeToggle?.addEventListener('click', () => {
  actualSize = !actualSize;
  measurePages();
});

document.getElementById('exportToggle').addEventListener('click', () => {
  exportMenu.classList.toggle('open');
});

document.addEventListener('click', (event) => {
  if (!exportMenu.contains(event.target)) exportMenu.classList.remove('open');
});

exportMenu.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-export]');
  if (!button) return;
  exportMenu.classList.remove('open');
  const kind = button.dataset.export;
  const snapshot = currentState();
  const exportBtn = document.getElementById('exportToggle');
  exportBtn.disabled = true;
  try {
    if (kind === 'print') {
      printCv(snapshot);
    } else if (kind === 'pdf') {
      const result = await downloadPdf(snapshot, { ats: snapshot.atsMode || snapshot.template === 'ats' });
      if (result.action !== 'cancel') showToast(exportMessage(result.filename, result.engine, result.action));
    } else if (kind === 'ats-pdf') {
      const result = await downloadPdf(snapshot, { ats: true });
      if (result.action !== 'cancel') showToast(exportMessage(result.filename, result.engine, result.action));
    } else if (kind === 'docx') {
      const action = await downloadDocx(snapshot);
      if (action !== 'cancel') showToast('Word document ready');
    } else if (kind === 'html') {
      const action = await downloadSelfContainedHtml(snapshot);
      if (action !== 'cancel') showToast('HTML ready');
    } else if (kind === 'md') {
      const action = await downloadMarkdown(snapshot);
      if (action !== 'cancel') showToast('Markdown ready');
    } else if (kind === 'txt') {
      const action = await downloadPlainText(snapshot);
      if (action !== 'cancel') showToast('Plain text ready');
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Export failed');
  } finally {
    exportBtn.disabled = false;
  }
});

function exportMessage(filename, engine, action) {
  if (action === 'share') return `Share sheet opened for ${filename}`;
  if (action === 'open') return `${filename} opened — use Share to save to Files`;
  return `Saved ${filename} via ${engine}`;
}

window.addEventListener('resize', measurePages);
window.visualViewport?.addEventListener('resize', measurePages);
const orientation = window.matchMedia('(orientation: portrait)');
const onOrientation = () => requestAnimationFrame(() => measurePages());
if (orientation.addEventListener) orientation.addEventListener('change', onOrientation);
else if (orientation.addListener) orientation.addListener(onOrientation);

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e') {
    event.preventDefault();
    exportMenu.classList.toggle('open');
  }
});

async function pingEngine() {
  const candidates = [
    new URL('api/health', window.location.origin + import.meta.env.BASE_URL).href,
    '/api/health'
  ];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) continue;
      const data = await response.json();
      if (data?.ok) {
        engineStatus.textContent = 'PDF engine: Chromium (selectable text, no browser header)';
        return;
      }
    } catch {
      // try next
    }
  }
  engineStatus.textContent = 'PDF engine: client text PDF (works on GitHub Pages)';
}

if (document.fonts?.ready) {
  document.fonts.ready.then(() => measurePages()).catch(() => {});
}

pingEngine();
setInterval(pingEngine, 15000);
