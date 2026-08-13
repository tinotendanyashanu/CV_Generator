import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { htmlToPdfBuffer } from './render-pdf.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PDF_PORT || 3847);
const serveDist = process.argv.includes('--serve-dist');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, engine: 'chromium' });
});

app.post('/api/pdf', async (req, res) => {
  try {
    const html = String(req.body?.html || '');
    if (html.length < 40) {
      res.status(400).json({ error: 'Missing HTML' });
      return;
    }
    const pdf = await htmlToPdfBuffer(html, {
      title: req.body?.title,
      author: req.body?.author
    });
    const filename = String(req.body?.filename || 'CV.pdf').replace(/[^\w.\-]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdf.length));
    res.send(Buffer.from(pdf));
  } catch (error) {
    console.error('PDF export failed', error);
    res.status(500).json({ error: error.message || 'PDF export failed' });
  }
});

if (serveDist) {
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(dist)) {
    console.warn('dist/ missing — run npm run build');
  } else {
    app.use(express.static(dist));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`PDF engine listening on http://127.0.0.1:${PORT}`);
});
