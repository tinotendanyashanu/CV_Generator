import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = path.join(ROOT, 'public', 'fonts');

let browserPromise = null;

export async function launchBrowser() {
  if (browserPromise) {
    try {
      const existing = await browserPromise;
      if (existing.isConnected()) return existing;
    } catch {
      browserPromise = null;
    }
  }

  browserPromise = (async () => {
    const candidates = [
      { channel: 'chrome' },
      { channel: 'chromium' },
      { executablePath: '/usr/bin/google-chrome-stable' },
      { executablePath: '/usr/bin/google-chrome' },
      { executablePath: '/snap/bin/chromium' }
    ];

    let lastError;
    for (const option of candidates) {
      try {
        return await chromium.launch({
          ...option,
          headless: true,
          args: ['--disable-dev-shm-usage', '--font-render-hinting=medium']
        });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Unable to launch Chrome/Chromium for PDF export');
  })();

  return browserPromise;
}

export async function htmlToPdfBuffer(html, meta = {}) {
  const browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 }
  });

  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const match = url.match(/\/fonts\/([^/?#]+)$/);
    if (match) {
      const filePath = path.join(FONT_DIR, match[1]);
      try {
        const body = await fs.readFile(filePath);
        await route.fulfill({
          status: 200,
          contentType: 'font/ttf',
          body
        });
        return;
      } catch {
        await route.abort();
        return;
      }
    }
    if (route.request().resourceType() === 'document' || url.startsWith('data:')) {
      await route.continue();
      return;
    }
    await route.continue();
  });

  await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    tagged: true,
    outline: false
  });

  await page.close();

  if (meta.title || meta.author) {
    // Playwright already writes a tagged text PDF. Title is set from <title>.
  }

  return pdf;
}

export async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    // ignore
  } finally {
    browserPromise = null;
  }
}
