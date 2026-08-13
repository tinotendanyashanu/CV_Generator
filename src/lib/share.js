import { saveAs } from 'file-saver';

export function isAppleTouch() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
}

export async function shareOrSave(blob, filename) {
  const type = blob.type || 'application/octet-stream';
  const file = new File([blob], filename, { type });

  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return 'share';
      }
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancel';
    }
  }

  if (isAppleTouch()) {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    return 'open';
  }

  saveAs(blob, filename);
  return 'download';
}

export function saveTextFile(content, filename, type) {
  return shareOrSave(new Blob([content], { type }), filename);
}
