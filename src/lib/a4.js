export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export function fitA4Scale(availableWidthPx, a4WidthPx) {
  if (!availableWidthPx || !a4WidthPx) return 1;
  return Math.min(1, Math.max(0.28, availableWidthPx / a4WidthPx));
}

export function pageCount(contentHeightPx, pageHeightPx) {
  if (!pageHeightPx || pageHeightPx < 1) return 1;
  return Math.max(1, Math.ceil((contentHeightPx - 2) / pageHeightPx));
}

export function measureMmInPx(mm) {
  if (typeof document === 'undefined') {
    return (mm * 96) / 25.4;
  }
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = `position:absolute;left:-9999px;top:0;width:0;height:${mm}mm;`;
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return px || (mm * 96) / 25.4;
}

export function applyA4Fit({ stage, zoom, sheet, inner, guides, actualSize = false }) {
  if (!stage || !sheet || !inner) {
    return { scale: 1, pages: 1, pageHeight: 0 };
  }

  const pageHeight = measureMmInPx(A4_HEIGHT_MM);
  const pageWidth = measureMmInPx(A4_WIDTH_MM);
  const contentHeight = Math.max(inner.scrollHeight, 1);
  const pages = pageCount(contentHeight, pageHeight);
  const naturalHeight = pages * pageHeight;
  const host = stage.parentElement || stage;
  const gutter = 20;
  const available = Math.max(160, host.clientWidth - gutter);
  const scale = actualSize ? 1 : fitA4Scale(available, pageWidth);

  sheet.style.width = `${pageWidth}px`;
  sheet.style.minHeight = `${naturalHeight}px`;
  sheet.style.height = `${naturalHeight}px`;

  if (zoom) {
    zoom.style.width = `${pageWidth}px`;
    zoom.style.height = `${naturalHeight}px`;
    zoom.style.transform = `scale(${scale})`;
  }

  stage.classList.toggle('is-actual', actualSize);
  stage.style.width = `${pageWidth * scale}px`;
  stage.style.height = `${naturalHeight * scale}px`;
  stage.style.overflow = actualSize && scale === 1 && available < pageWidth ? 'auto' : 'hidden';

  if (guides) {
    guides.innerHTML = Array.from({ length: Math.max(0, pages - 1) }, (_, index) => {
      const top = (index + 1) * pageHeight;
      return `<i style="top:${top}px"><span>Page ${index + 2}</span></i>`;
    }).join('');
  }

  return { scale, pages, pageHeight, pageWidth, naturalHeight };
}
