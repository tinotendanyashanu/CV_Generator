import { SAMPLE } from './sample.js';

const KEY = 'cv-studio-v2';
const PHOTO_MAX = 900_000;

export function defaultState() {
  return {
    ...SAMPLE,
    photo: null
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  try {
    const payload = { ...state };
    if (payload.photo && payload.photo.length > PHOTO_MAX) {
      payload.photo = null;
    }
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Could not persist CV', error);
  }
}

export function readForm(form) {
  const data = new FormData(form);
  return {
    fullName: String(data.get('fullName') || ''),
    jobTitle: String(data.get('jobTitle') || ''),
    contact: String(data.get('contact') || ''),
    highlights: String(data.get('highlights') || ''),
    content: String(data.get('content') || ''),
    format: String(data.get('format') || 'markdown'),
    template: String(data.get('template') || 'ats'),
    atsMode: form.elements.atsMode?.checked ?? true,
    density: String(data.get('density') || 'comfortable'),
    jobDescription: String(data.get('jobDescription') || ''),
    photo: form.dataset.photo || null
  };
}

export function writeForm(form, state) {
  form.elements.fullName.value = state.fullName || '';
  form.elements.jobTitle.value = state.jobTitle || '';
  form.elements.contact.value = state.contact || '';
  form.elements.highlights.value = state.highlights || '';
  form.elements.content.value = state.content || '';
  form.elements.format.value = state.format || 'markdown';
  form.elements.template.value = state.template || 'ats';
  form.elements.atsMode.checked = Boolean(state.atsMode);
  form.elements.density.value = state.density || 'comfortable';
  form.elements.jobDescription.value = state.jobDescription || '';
  form.dataset.photo = state.photo || '';
}

export async function compressPhoto(file) {
  const source = await loadImageSource(file);
  const max = 420;
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source.close) source.close();
  return canvas.toDataURL('image/jpeg', 0.84);
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // iOS Safari can reject some HEIC/camera files
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not read that photo'));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
