import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getPrintCss, renderCv } from './render.js';
import { fontFaceCss } from './fonts.js';
import { shareOrSave } from './share.js';
import { A4_HEIGHT_MM, A4_WIDTH_MM, measureMmInPx } from './a4.js';

const PAPER = {
  'neon-tech': '#070b08',
  'luxury-gold': '#f6ecd7',
  'product-lead': '#0b1220',
  'gradient-wave': '#eef2ff',
  'minimal-glass': '#5b4bdb',
  tech: '#0b1220',
  silver: '#eceff3',
  'bold-geometric': '#f4f1ea',
  executive: '#f4f6fb',
  academic: '#edf2f7',
  sidebar: '#eef1f4',
  'artistic-portfolio': '#fff7fb',
  creative: '#f5f3ff',
  'watermark-pro': '#f7fafc'
};

export function paperColor(template) {
  return PAPER[template] || '#ffffff';
}

export async function downloadVisualPdf(state, options = {}) {
  const filename = options.filename || 'CV.pdf';
  const blob = await renderVisualPdfBlob(state, options);
  return shareOrSave(blob, filename);
}

export async function renderVisualPdfBlob(state, options = {}) {
  const template = state.template || 'ats';
  const background = paperColor(template);
  const widthPx = measureMmInPx(A4_WIDTH_MM);
  const minHeightPx = measureMmInPx(A4_HEIGHT_MM);
  const mount = document.createElement('div');
  mount.id = 'visual-pdf-mount';
  mount.setAttribute('aria-hidden', 'true');
  Object.assign(mount.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${widthPx}px`,
    minHeight: `${minHeightPx}px`,
    background,
    zIndex: '0',
    opacity: '0.01',
    overflow: 'visible',
    pointerEvents: 'none'
  });
  mount.innerHTML = `<style>
    ${fontFaceCss()}
    ${getPrintCss()}
    #visual-pdf-mount .cv,
    #visual-pdf-mount .canvas {
      min-height: 0 !important;
      margin: 0 !important;
    }
  </style>${renderCv(state, { ...options, ats: false })}`;
  document.body.appendChild(mount);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await waitForImages(mount);
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));

    const width = Math.max(mount.scrollWidth, mount.offsetWidth);
    const height = Math.max(mount.scrollHeight, mount.offsetHeight, 1);
    const dataUrl = await toJpeg(mount, {
      quality: 0.95,
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: background,
      width,
      height,
      style: {
        transform: 'none',
        left: '0',
        top: '0',
        position: 'relative',
        opacity: '1'
      }
    });

    const image = await loadImage(dataUrl);
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true
    });
    const pageWidth = 210;
    const pageHeight = 297;
    const imageHeight = (image.height / image.width) * pageWidth;
    let offset = 0;
    let page = 0;
    while (offset < imageHeight - 0.4) {
      if (page > 0) pdf.addPage();
      pdf.addImage(dataUrl, 'JPEG', 0, -offset, pageWidth, imageHeight, undefined, 'FAST');
      offset += pageHeight;
      page += 1;
    }
    if (page === 0) {
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, imageHeight, undefined, 'FAST');
    }

    const title = `${state.fullName || 'CV'}${state.jobTitle ? ` — ${state.jobTitle}` : ''}`;
    pdf.setProperties({
      title,
      author: state.fullName || '',
      creator: 'CV Generator'
    });
    return pdf.output('blob');
  } finally {
    mount.remove();
  }
}

function waitForImages(root) {
  return Promise.all(Array.from(root.querySelectorAll('img')).map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
      setTimeout(resolve, 2000);
    });
  }));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not rasterize the CV'));
    image.src = src;
  });
}
