# CV Generator

A polished, browser-based CV generator that ships with ATS-aware templates, instant PDF export and live guidance while you type.

## Key features

- **Template library** – switch between classic layouts, creative designs, and brand new templates such as _ATS Essentials_ (single-column, parser friendly) and _Product Leader Spotlight_.
- **ATS insights** – real-time checks for contact data, action verbs, metrics, and writing style so you always know how recruiters and Applicant Tracking Systems will read your resume.
- **Flexible authoring** – compose content in HTML, Markdown, or plain text. Highlights are auto-formatted into bullet points with metric emphasis.
- **Export options** – print-ready layout, PDF export (with and without browser headers), downloadable HTML and plain-text versions for online submissions.
- **Offline friendly** – optional service worker keeps assets cached when the app is installed as a PWA.

## Getting started locally

1. Serve the project with any static HTTP server. For example:
   ```bash
   npx serve .
   # or
   python3 -m http.server 8000
   ```
2. Open `http://localhost:8000` in your browser.
3. Edit the fields in the builder panel – the preview updates automatically. The ATS insights panel refreshes with each change.

## Tips for great results

- Keep the contact block complete: professional email, direct phone number, and a LinkedIn/portfolio link.
- Use action verbs (led, shipped, optimized) and quantify achievements (%, revenue, users) to trigger positive ATS feedback.
- Toggle **ATS-Friendly Mode** when submitting to strict parsers; it simplifies colors, keeps fonts neutral, and removes decorative elements.
- Try multiple templates – content is shared, so you can export several tailored versions fast.

## Project structure

- `index.html` – markup for the editor, preview, and control panels.
- `styles.css` – layout, theme styling, and template-specific rules.
- `script.js` – live preview logic, template rendering, export helpers, and ATS analysis utilities.
- `enhanced-print.js`, `html2pdf.bundle.min.js`, `sw.js` – auxiliary scripts for PDF/export flows and offline support.

Contributions and template ideas are welcome!
