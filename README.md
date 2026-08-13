# CV Generator

A commercial-grade resume builder that exports **real text PDFs**, not screenshots.

Applicant Tracking Systems need selectable text, standard headings, and a single column. This app is built around that constraint, then adds designed templates for humans.

## What you get

- **Chromium text-layer PDF** via Playwright (`page.pdf`) — copy/paste works, parsers can read it
- **ATS PDF** — single column, Arial/Liberation, no photo, no icons
- **Word (.docx)** — still the safest file type for many portals
- **Self-contained HTML** with `@page` and keep-together rules
- **Markdown import/export**, including simple front matter
- Live **A4 preview** with page guides
- Live **parser preview** — the plain text an ATS is likely to extract
- Job-description keyword coverage

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

`npm run dev` starts the Vite app and a local Chromium PDF service on port 3847. The web app proxies `/api/pdf` to that service.

```bash
npm test          # content, ATS, export, and PDF quality checks
npm run build
npm start         # serves dist + PDF API
```

Chrome or Chromium must be installed for the high-quality PDF engine. If the API is down, export falls back to a **pdfmake** text PDF so downloads still work on static hosts.

## Authoring

Prefer **Markdown**:

```md
## Experience

### Senior Engineer — Acme
2022 – Present | Warsaw

- Led a rewrite that cut p95 latency 35%
```

HTML and plain text are also supported. Import `.md`, `.html`, `.txt`, or a saved JSON snapshot.

Use **ATS Essential** (or ATS-safe mode) when you apply online. Use Sidebar only for networking packets.

## Stack

| Job | Tool |
|---|---|
| App | Vite |
| Markdown | `marked` |
| HTML sanitizing | DOMPurify |
| Screen + print layout | Semantic HTML + CSS Paged Media |
| Production PDF | Playwright + installed Chrome |
| Offline PDF fallback | pdfmake (vector/text) |
| Word | `docx` |
| Tests | Vitest + `pdftotext` / `pdfinfo` |

`html2pdf.js` / `html2canvas` were removed. Those libraries rasterize the page, which ATS software cannot parse reliably.

## Deploy

### GitHub Pages (current host)

The site is a static Vite app at `/CV_Generator/`. A push to `master` builds and publishes `dist` via `.github/workflows/pages.yml`.

```bash
npm run build:pages
```

On GitHub Pages there is no Chromium PDF server, so **Save PDF uses the pdfmake text engine**. That still produces a selectable A4 PDF. Word, HTML, Markdown and print work entirely in the browser.

If the live site still shows the old app, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**, or to the `gh-pages` branch `/` root.

### Local / Netlify

`netlify.toml` publishes `dist`. On a static host the client PDF fallback is used. For Chromium-quality PDFs that match the preview exactly, run `npm start` on a host with Chrome, or put `/api/pdf` behind a Playwright worker.
