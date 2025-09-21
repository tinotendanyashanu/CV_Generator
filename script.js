// Global variables
let photoDataUrl = null;

// Track ATS mode
let atsStrict = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize current template from selector (avoids reliance on inline handlers)
    const tplSel = document.getElementById('templateSelect');
    if (tplSel) {
        currentTemplate = tplSel.value || currentTemplate;
        tplSel.addEventListener('change', changeTemplate);
    }
    updatePreview();
    
    // Auto-update on input changes
    const inputs = ['fullName', 'jobTitle', 'contactInfo', 'cvContent'];
    inputs.forEach(id => {
        const element = document.getElementById(id);
        element.addEventListener('input', debounce(updatePreview, 500));
    });
    const formatSel = document.getElementById('contentFormat');
    if (formatSel) {
        formatSel.addEventListener('change', () => {
            updateContentPlaceholder();
            updatePreview();
        });
        updateContentPlaceholder();
    }
    
    // Photo upload handler
    const photoUpload = document.getElementById('photoUpload');
    photoUpload.addEventListener('change', handlePhotoUpload);
    
    // iOS-specific functionality
    detectiOSAndSetup();
    
    // Check for PWA install prompt
    setupPWAInstall();
    
    // Listen to highlights and ATS toggle
    const highlights = document.getElementById('highlights');
    if (highlights) highlights.addEventListener('input', debounce(updatePreview, 500));
    const atsBox = document.getElementById('atsStrict');
    if (atsBox) atsBox.addEventListener('change', toggleAtsMode);
});

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            photoDataUrl = e.target.result;
            updatePreview();
        };
        reader.readAsDataURL(file);
    }
}

function updatePreview() {
    const fullName = document.getElementById('fullName').value || 'Your Name';
    const jobTitle = document.getElementById('jobTitle').value || 'Your Job Title';
    const contactInfo = document.getElementById('contactInfo').value || 'Your contact information';
    const rawCv = document.getElementById('cvContent').value || '';
    const fmtSel = document.getElementById('contentFormat');
    const format = (fmtSel && fmtSel.value) || 'html';
    const cvContent = renderContentByFormat(rawCv, format);
    
    // Format contact info (make links clickable and embedded)
    let contactHTML = contactInfo.replace(/\n/g, '<br>');
    
    // Handle emoji-prefixed LinkedIn links first
    contactHTML = contactHTML.replace(/🔗\s*(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s<>]+)/gi, '🔗 <a href="$1" target="_blank">LinkedIn Profile</a>');
    
    // Handle emoji-prefixed GitHub links
    contactHTML = contactHTML.replace(/💻\s*(https?:\/\/(?:www\.)?github\.com\/[^\s<>]+)/gi, '💻 <a href="$1" target="_blank">GitHub Profile</a>');
    
    // Handle email addresses (make them clickable) - do this before other URL processing
    contactHTML = contactHTML.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1">$1</a>');
    
    // Handle phone numbers (make them clickable)
    contactHTML = contactHTML.replace(/📞\s*(\+?[\d\s\-\(\)]+)/g, '📞 <a href="tel:$1">$1</a>');
    
    // Handle standalone LinkedIn URLs (only if not already in a link)
    contactHTML = contactHTML.replace(/(^|[^"'>])(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s<>]+)/gi, '$1<a href="$2" target="_blank">LinkedIn Profile</a>');
    
    // Handle standalone GitHub URLs (only if not already in a link)
    contactHTML = contactHTML.replace(/(^|[^"'>])(https?:\/\/(?:www\.)?github\.com\/[^\s<>]+)/gi, '$1<a href="$2" target="_blank">GitHub Profile</a>');
    
    // Handle any remaining URLs (that haven't been processed yet)
    contactHTML = contactHTML.replace(/(^|[^"'>])(https?:\/\/[^\s<>]+)/g, '$1<a href="$2" target="_blank">$2</a>');
    
    // Generate HTML based on selected template
    const highlights = renderHighlightsBlock();
    const cvHTML = generateTemplateHTML(fullName, jobTitle, contactHTML, cvContent, highlights);
    
    const cvPreview = document.getElementById('cvPreview');
    cvPreview.innerHTML = cvHTML;
    let classes = `cv ${getTemplateClass()}`;
    if (atsStrict) classes += ' ats-strict';
    cvPreview.className = classes;
}

// Render pipeline: HTML (sanitized), Markdown -> HTML, Text -> HTML paragraphs/lists
function renderContentByFormat(raw, format) {
    const fallback = '<div class="cv-section"><h3>CV Content</h3><p>Enter your CV content in the editor...</p></div>';
    if (!raw.trim()) return fallback;
    switch (format) {
        case 'markdown':
            return `<div class="cv-section">${sanitizeHtml(markdownToHtml(raw))}</div>`;
        case 'text':
            return textToHtml(raw);
        case 'html':
        default:
            return sanitizeHtml(raw);
    }
}

// Very small Markdown converter (headings, bold, italics, lists, code blocks, links)
function markdownToHtml(md) {
    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inlineMd = (s) => s
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Extract fenced code blocks first
    const codeBlocks = [];
    let src = md;
    src = src.replace(/```([\s\S]*?)```/g, (m, code) => {
        const idx = codeBlocks.push(code) - 1;
        return `{{CODEBLOCK_${idx}}}`;
    });

    const lines = src.split(/\r?\n/);
    let html = '';
    let inUl = false, inOl = false;
    const closeLists = () => { if (inUl) { html += '</ul>'; inUl = false; } if (inOl) { html += '</ol>'; inOl = false; } };
    for (let rawLine of lines) {
        const line = rawLine.trim();
        if (!line) { closeLists(); continue; }
        // Horizontal rule (---, ***, ___)
        if (/^(\*\s*\*\s*\*|[-_]{3,})\s*$/.test(line)) {
            closeLists();
            html += '<hr />';
            continue;
        }
        // Headings
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
            closeLists();
            const level = h[1].length;
            html += `<h${level}>${inlineMd(escapeHtml(h[2]))}</h${level}>`;
            continue;
        }
        // Ordered list
        if (/^\d+\.\s+/.test(line)) {
            if (!inOl) { closeLists(); html += '<ol>'; inOl = true; }
            html += `<li>${inlineMd(escapeHtml(line.replace(/^\d+\.\s+/, '')))}</li>`;
            continue;
        }
        // Unordered list
        if (/^[-*+]\s+/.test(line)) {
            if (!inUl) { closeLists(); html += '<ul>'; inUl = true; }
            html += `<li>${inlineMd(escapeHtml(line.replace(/^[-*+]\s+/, '')))}</li>`;
            continue;
        }
        // Paragraph
        closeLists();
        html += `<p>${inlineMd(escapeHtml(line))}</p>`;
    }
    closeLists();
    // Restore code blocks (escaped)
    html = html.replace(/\{\{CODEBLOCK_(\d+)\}\}/g, (m, i) => `<pre><code>${escapeHtml(codeBlocks[i])}</code></pre>`);
    return html;
}

// Text to HTML: create paragraphs, support simple bullets (-, *, •) -> list
function textToHtml(txt) {
    const lines = txt.split(/\r?\n/);
    let html = '';
    let inList = false;
    const flushList = () => { if (inList) { html += '</ul>'; inList = false; } };
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { flushList(); continue; }
        if (/^([-*•])\s+/.test(trimmed)) {
            if (!inList) { html += '<ul>'; inList = true; }
            html += `<li>${trimmed.replace(/^([-*•])\s+/, '')}</li>`;
        } else {
            flushList();
            html += `<p>${trimmed}</p>`;
        }
    }
    flushList();
    // Wrap lone content in a cv-section for consistency
    return `<div class="cv-section">${html}</div>`;
}

// Basic sanitizer: allow a safe subset of tags/attributes used by CV content
function sanitizeHtml(html) {
    const allowedTags = ['div','section','h1','h2','h3','h4','h5','h6','p','ul','ol','li','strong','em','b','i','u','span','br','code','pre','a','hr'];
    const allowedAttrs = { 'a': ['href','target','rel'], 'div': ['class'], 'section': ['class'], 'p': ['class'], 'h3': ['class'] };
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const walker = (node) => {
        const children = Array.from(node.children || []);
        for (const el of children) {
            const tag = el.tagName.toLowerCase();
            if (!allowedTags.includes(tag)) {
                // Replace disallowed element with its text content
                const text = document.createTextNode(el.textContent || '');
                el.replaceWith(text);
                continue;
            }
            // Clean attributes
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
                const name = attr.name.toLowerCase();
                const ok = (allowedAttrs[tag] || []).includes(name);
                if (!ok) el.removeAttribute(name);
            }
            // Safe links
            if (tag === 'a') {
                const href = el.getAttribute('href') || '';
                if (!/^https?:\/\//i.test(href) && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                    el.removeAttribute('href');
                } else {
                    el.setAttribute('rel', 'noopener noreferrer');
                    el.setAttribute('target', '_blank');
                }
            }
            walker(el);
        }
    };
    walker(doc.body.firstElementChild);
    return doc.body.firstElementChild.innerHTML;
}

function generateTemplateHTML(fullName, jobTitle, contactHTML, cvContent, highlights) {
    const photoSection = photoDataUrl 
        ? `<div class="cv-photo">
                <img src="${photoDataUrl}" alt="Profile photo">
            </div>` 
        : '';
        
    switch(currentTemplate) {
        case 'classic':
            return generateClassicTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'modern':
            return generateModernTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'executive':
            return generateExecutiveTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'tech':
            return generateTechTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'creative':
            return generateCreativeTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'academic':
            return generateAcademicTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'minimal':
            return generateMinimalTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'corporate':
            return generateCorporateTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'monochrome':
            return generateMonochromeTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'modular':
            return generateModularTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        default:
            return generateClassicTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
    }
}

// Template 1: Two-Column Layout
function generateClassicTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="cv-container">
            <div class="cv-sidebar">
                <div class="cv-photo-section">
                    ${photoSection}
                </div>
                <div class="cv-contact-section">
                    <h3>Contact</h3>
                    <div class="cv-contact">${contactHTML}</div>
                </div>
                <div class="cv-sidebar-content">
                    <!-- Skills and other sidebar content will be extracted here -->
                </div>
            </div>
            <div class="cv-main">
                <div class="cv-header">
                    <div class="cv-name">${fullName}</div>
                    <div class="cv-title">${jobTitle}</div>
                </div>
                <div class="cv-content">
                    ${highlights || ''}
                    ${cvContent}
                </div>
            </div>
        </div>
    `;
}

// Template 2: Timeline Design
function generateModernTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="cv-timeline-container">
            <div class="cv-header-section">
                <div class="cv-header-content">
                    <div class="cv-name">${fullName}</div>
                    <div class="cv-title">${jobTitle}</div>
                    <div class="cv-contact">${contactHTML}</div>
                </div>
                ${photoSection}
            </div>
            <div class="cv-timeline">
                <div class="timeline-line"></div>
                <div class="cv-content timeline-content">
                    ${highlights || ''}
                    ${cvContent}
                </div>
            </div>
        </div>
    `;
}

// Template 3: Card-Based Layout  
function generateExecutiveTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="cv-cards-container">
            <div class="cv-header-card">
                <div class="cv-info">
                    <div class="cv-name">${fullName}</div>
                    <div class="cv-title">${jobTitle}</div>
                    <div class="cv-contact">${contactHTML}</div>
                </div>
                ${photoSection}
            </div>
            <div class="cv-cards-grid">
                <div class="cv-content cards-content">
                    ${highlights || ''}
                    ${cvContent}
                </div>
            </div>
        </div>
    `;
}

// Template 4: Infographic Style
function generateTechTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="cv-infographic-container">
            <div class="cv-hero-section">
                <div class="hero-background"></div>
                <div class="hero-content">
                    ${photoSection}
                    <div class="hero-text">
                        <div class="cv-name">${fullName}</div>
                        <div class="cv-title">${jobTitle}</div>
                    </div>
                </div>
            </div>
            <div class="cv-info-bar">
                <div class="cv-contact">${contactHTML}</div>
            </div>
            <div class="cv-content infographic-content">
                ${highlights || ''}
                ${cvContent}
            </div>
        </div>
    `;
}

// Template 5: Compact Layout
function generateCreativeTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="cv-compact-container">
            <div class="cv-header-compact">
                <div class="header-left">
                    <div class="cv-name">${fullName}</div>
                    <div class="cv-title">${jobTitle}</div>
                </div>
                <div class="header-center">
                    <div class="cv-contact">${contactHTML}</div>
                </div>
                <div class="header-right">
                    ${photoSection}
                </div>
            </div>
            <div class="cv-content compact-content">
                ${highlights || ''}
                ${cvContent}
            </div>
        </div>
    `;
}

// Template 6: Split-Screen Design
function generateAcademicTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="cv-split-container">
            <div class="cv-left-panel">
                <div class="panel-header">
                    ${photoSection}
                    <div class="cv-name">${fullName}</div>
                    <div class="cv-title">${jobTitle}</div>
                </div>
                <div class="panel-contact">
                    <div class="cv-contact">${contactHTML}</div>
                </div>
            </div>
            <div class="cv-right-panel">
                <div class="cv-content split-content">
                    ${highlights || ''}
                    ${cvContent}
                </div>
            </div>
        </div>
    `;
}

// Template 7: Minimal Professional
function generateMinimalTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="cv-minimal">
            <header class="min-header">
                <div class="min-name">${fullName}</div>
                <div class="min-title">${jobTitle}</div>
                <div class="min-contact cv-contact">${contactHTML}</div>
            </header>
            <main class="min-body">
                ${highlights || ''}
                ${cvContent}
            </main>
        </div>
    `;
}

// Template 8: Corporate Clean
function generateCorporateTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="cv-corporate">
            <header class="corp-header">
                <div class="corp-left">
                    <div class="corp-name">${fullName}</div>
                    <div class="corp-title">${jobTitle}</div>
                </div>
                <div class="corp-right cv-contact">${contactHTML}</div>
            </header>
            <main class="corp-body">
                ${highlights || ''}
                ${cvContent}
            </main>
        </div>
    `;
}

// Template 9: Monochrome Elegant
function generateMonochromeTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="cv-mono">
            <div class="mono-header">
                <div class="mono-name">${fullName}</div>
                <div class="mono-title">${jobTitle}</div>
                <div class="mono-contact cv-contact">${contactHTML}</div>
            </div>
            <div class="mono-body">
                ${highlights || ''}
                ${cvContent}
            </div>
        </div>
    `;
}

// Template 10: Modular Grid
function generateModularTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="cv-modular">
            <header class="mod-header">
                <div class="mod-top">
                    <div class="mod-name">${fullName}</div>
                    <div class="mod-title">${jobTitle}</div>
                </div>
                <div class="mod-contact cv-contact">${contactHTML}</div>
            </header>
            <main class="mod-grid">
                ${highlights || ''}
                ${cvContent}
            </main>
        </div>
    `;
}

function printCV() {
    const cvContent = document.getElementById('cvPreview').innerHTML;
    const fullName = document.getElementById('fullName').value || 'CV';
    
    const printWindow = window.open('', '_blank');
    
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>CV - ${fullName}</title>
            <style>
                /* Reset and base styles */
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #1f2937; 
                    background: white;
                }
                
                /* Print-specific styles - no margins, clean layout */
                @page {
                    size: A4;
                    margin: 0.3in 0.4in; /* Minimal margins for maximum content */
                    /* Hide browser default headers and footers */
                    @top-left { content: ""; }
                    @top-center { content: ""; }
                    @top-right { content: ""; }
                    @bottom-left { content: ""; }
                    @bottom-center { content: ""; }
                    @bottom-right { content: ""; }
                }
                
                /* Alternative method for hiding headers/footers */
                @page :first {
                    @top-left { content: ""; }
                    @top-center { content: ""; }
                    @top-right { content: ""; }
                    @bottom-left { content: ""; }
                    @bottom-center { content: ""; }
                    @bottom-right { content: ""; }
                }
                
                .cv { 
                    max-width: 100%;
                    width: 100%;
                    page-break-inside: avoid;
                }
                
                .cv-header { 
                    display: flex; 
                    align-items: center; 
                    gap: 20px; 
                    padding-bottom: 15px; 
                    margin-bottom: 20px; 
                    border-bottom: 2px solid #e5e7eb; 
                    flex-direction: row-reverse; 
                    page-break-after: avoid;
                }
                
                .cv-info { flex: 1; }
                
                .cv-name { 
                    font-size: 28px; 
                    font-weight: 700; 
                    margin-bottom: 5px; 
                    color: #1f2937;
                }
                
                .cv-title { 
                    font-size: 16px; 
                    font-weight: 600; 
                    color: #2563eb; 
                    margin-bottom: 10px; 
                }
                
                .cv-contact { 
                    font-size: 13px; 
                    color: #6b7280; 
                    line-height: 1.4;
                }
                
                .cv-contact a { 
                    color: #2563eb; 
                    text-decoration: none; 
                }
                
                .cv-photo { 
                    width: 120px; 
                    height: 120px; 
                    border-radius: 50%; 
                    border: 3px solid #e5e7eb; 
                    background: #f3f4f6; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 12px; 
                    color: #6b7280; 
                    overflow: hidden;
                    flex-shrink: 0;
                }
                
                .cv-photo img { 
                    width: 100%; 
                    height: 100%; 
                    object-fit: cover; 
                }
                
                .cv h3 { 
                    font-size: 16px; 
                    font-weight: 700; 
                    color: #374151; 
                    margin: 25px 0 12px 0; 
                    text-transform: uppercase; 
                    letter-spacing: 0.5px;
                    border-bottom: 2px solid #2563eb; 
                    padding-bottom: 5px; 
                    display: inline-block; 
                    page-break-after: avoid;
                }
                
                .cv-section {
                    margin-bottom: 25px;
                    page-break-inside: avoid;
                }
                
                .cv-summary { 
                    background: #f8fafc; 
                    padding: 20px; 
                    border-radius: 8px; 
                    border-left: 4px solid #2563eb; 
                    font-size: 15px;
                }
                
                .cv-skills { 
                    display: flex; 
                    flex-wrap: wrap; 
                    gap: 8px; 
                    margin-top: 10px; 
                }
                
                .cv-skill { 
                    background: #eef2ff; 
                    color: #1e40af; 
                    padding: 6px 12px; 
                    border-radius: 20px; 
                    font-size: 12px; 
                    border: 1px solid #c7d2fe; 
                }
                
                /* Enhanced HTML content styles */
                .skill-category {
                    margin-bottom: 20px;
                    page-break-inside: avoid;
                }
                
                .skill-category h4 {
                    font-size: 14px;
                    font-weight: 600;
                    color: #374151;
                    margin: 0 0 10px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .skill-tag {
                    display: inline-block;
                    background: #eef2ff;
                    color: #1e40af;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    border: 1px solid #c7d2fe;
                    margin: 4px 6px 4px 0;
                }
                
                .education-section {
                    margin-bottom: 25px;
                    page-break-inside: avoid;
                }
                
                .education-section h4 {
                    font-size: 14px;
                    font-weight: 600;
                    color: #374151;
                    margin: 0 0 15px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #e5e7eb;
                    padding-bottom: 5px;
                }
                
                .education-item {
                    background: #f9fafb;
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 3px solid #2563eb;
                    margin-bottom: 15px;
                    page-break-inside: avoid;
                }
                
                .degree {
                    font-size: 16px;
                    font-weight: 700;
                    color: #1f2937;
                    margin-bottom: 5px;
                }
                
                .institution {
                    font-size: 14px;
                    color: #6b7280;
                    margin-bottom: 3px;
                }
                
                .date {
                    font-size: 13px;
                    color: #9ca3af;
                    font-style: italic;
                }
                
                .cert-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                
                .cert-list li {
                    background: #f0f9ff;
                    padding: 10px 15px;
                    border-radius: 6px;
                    border-left: 3px solid #0ea5e9;
                    margin: 8px 0;
                    font-size: 14px;
                    page-break-inside: avoid;
                }
                
                .language-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 10px;
                    margin-top: 10px;
                }
                
                .language-item {
                    background: #fef3c7;
                    padding: 8px 12px;
                    border-radius: 6px;
                    border-left: 3px solid #f59e0b;
                    font-size: 13px;
                    color: #92400e;
                }
                
                .cv-job { 
                    margin-bottom: 20px; 
                    padding: 15px; 
                    border-left: 3px solid #10b981; 
                    background: #f9fafb;
                    page-break-inside: avoid;
                }
                
                .cv-job-title { 
                    font-weight: 700; 
                    font-size: 16px; 
                    color: #1f2937;
                }
                
                .cv-job-meta { 
                    color: #6b7280; 
                    font-size: 14px; 
                    margin-bottom: 10px; 
                    font-style: italic; 
                }
                
                .cv ul { 
                    margin: 10px 0 10px 20px; 
                }
                
                .cv li { 
                    margin: 5px 0; 
                }
                
                .cv p {
                    margin: 10px 0;
                    line-height: 1.6;
                }
                
                .cv strong {
                    font-weight: 600;
                    color: #1f2937;
                }
                
                .cv em {
                    font-style: italic;
                    color: #4b5563;
                }
                /* Code blocks and inline code */
                .cv code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
                .cv pre { background: #f8fafc; padding: 10px 12px; border-radius: 6px; overflow: auto; border-left: 3px solid #9ca3af; }
                .cv pre code { background: transparent; padding: 0; }
                .cv hr { border: 0; border-top: 1px solid #e5e7eb; margin: 12px 0; }
                
                /* Print optimizations */
                @media print {
                    body { 
                        margin: 0; 
                        padding: 0;
                        font-size: 11px; /* Smaller base font for print */
                        line-height: 1.35; /* Tighter line height */
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    
                    .cv {
                        margin: 0;
                        padding: 0;
                    }
                    
                    .cv-header { 
                        flex-direction: row-reverse; 
                        /* Do not force keeping the next block with the header to avoid isolating header on a page */
                        page-break-after: auto !important;
                        break-after: auto !important;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    
                    .cv-section {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    
                    .cv h3 {
                        page-break-after: avoid;
                        break-after: avoid;
                    }
                    
                    /* Ensure colors print */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* Page density adjustments to reduce page count */
                    .cv-section { 
                        margin-bottom: 12px !important; 
                        page-break-inside: avoid; 
                        orphans: 2; 
                        widows: 2; 
                    }
                    .cv h3 { margin: 15px 0 8px 0 !important; }
                    .cv ul, .cv-job, .education-item { page-break-inside: avoid; margin-bottom: 10px !important; }
                    .cv li { margin: 3px 0 !important; }
                    .cv p { margin: 8px 0 !important; }
                    .cv-photo { width: 90px !important; height: 90px !important; border-width: 2px !important; }
                    /* Force tighter top margins to avoid accidental whitespace */
                    * { margin-top: 0 !important; }

                    /* Keep headers and first content together for all templates */
                    .cv.template-modern .cv-header-section { page-break-after: auto !important; break-after: auto !important; page-break-inside: avoid; break-inside: avoid; }
                    .cv.template-modern .cv-timeline { page-break-before: avoid !important; break-before: avoid !important; page-break-inside: avoid; break-inside: avoid; }

                    .cv.template-executive .cv-header-card { page-break-after: auto !important; break-after: auto !important; page-break-inside: avoid; break-inside: avoid; }
                    .cv.template-executive .cards-content { page-break-before: avoid !important; break-before: avoid !important; page-break-inside: avoid; break-inside: avoid; }

                    .cv.template-tech .cv-hero-section { page-break-after: auto !important; break-after: auto !important; page-break-inside: avoid; break-inside: avoid; }
                    .cv.template-tech .cv-info-bar { page-break-after: auto !important; break-after: auto !important; page-break-before: avoid !important; break-before: avoid !important; page-break-inside: avoid; break-inside: avoid; }
                    .cv.template-tech .infographic-content { page-break-before: avoid !important; break-before: avoid !important; page-break-inside: avoid; break-inside: avoid; }

                    .cv.template-creative .cv-header-compact { page-break-after: auto !important; break-after: auto !important; page-break-inside: avoid; break-inside: avoid; }
                    .cv.template-creative .compact-content { page-break-before: avoid !important; break-before: avoid !important; page-break-inside: avoid; break-inside: avoid; }

                    .cv.template-classic .cv-main { page-break-before: avoid; break-before: avoid; }
                    .cv.template-academic .cv-right-panel { page-break-before: avoid; break-before: avoid; page-break-inside: avoid; break-inside: avoid; }

                    /* Reduce chance of unexpected clipping forcing breaks */
                    .cv, .cv * { overflow: visible !important; }
                }
                
                /* Template Styles */
                ${getTemplateStyles()}
                /* ATS Strict Styles */
                ${getAtsStrictStyles()}
            </style>
        </head>
        <body>
            <div class="cv ${getTemplateClass()}${atsStrict ? ' ats-strict' : ''}">${cvContent}</div>
            <script>
                // Auto-print when page loads
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
                
                // Close window after printing
                window.onafterprint = function() {
                    window.close();
                };
            </script>
        </body>
        </html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
}

function downloadPDF() {
    alert('📱 For best results on all devices:\n\n1. Use the "Print CV" button\n2. In print dialog, choose "Save as PDF"\n3. Your PDF will be saved to Downloads\n\nThis method works reliably on all devices including iPhone and iPad!');
    printCV();
}

function clearAll() {
    if (confirm('Are you sure you want to clear all fields? This action cannot be undone.')) {
        document.getElementById('fullName').value = '';
        document.getElementById('jobTitle').value = '';
        document.getElementById('contactInfo').value = '';
        document.getElementById('cvContent').value = '';
        document.getElementById('photoUpload').value = '';
        photoDataUrl = null;
        updatePreview();
    }
}

// Auto-save to localStorage
function saveToLocalStorage() {
    const data = {
        fullName: document.getElementById('fullName').value,
        jobTitle: document.getElementById('jobTitle').value,
        contactInfo: document.getElementById('contactInfo').value,
        cvContent: document.getElementById('cvContent').value,
        photo: photoDataUrl,
    contentFormat: (document.getElementById('contentFormat') && document.getElementById('contentFormat').value) || 'html',
    highlights: (document.getElementById('highlights') && document.getElementById('highlights').value) || '',
    atsStrict: (document.getElementById('atsStrict') && document.getElementById('atsStrict').checked) || false
    };
    localStorage.setItem('cvGeneratorData', JSON.stringify(data));
}

// Load from localStorage
function loadFromLocalStorage() {
    const saved = localStorage.getItem('cvGeneratorData');
    if (saved) {
        const data = JSON.parse(saved);
        document.getElementById('fullName').value = data.fullName || '';
        document.getElementById('jobTitle').value = data.jobTitle || '';
        document.getElementById('contactInfo').value = data.contactInfo || '';
        document.getElementById('cvContent').value = data.cvContent || '';
        photoDataUrl = data.photo || null;
        if (data.contentFormat && document.getElementById('contentFormat')) {
            document.getElementById('contentFormat').value = data.contentFormat;
            updateContentPlaceholder();
        }
        if (typeof data.highlights === 'string' && document.getElementById('highlights')) {
            document.getElementById('highlights').value = data.highlights;
        }
        if (typeof data.atsStrict === 'boolean' && document.getElementById('atsStrict')) {
            document.getElementById('atsStrict').checked = data.atsStrict;
            atsStrict = data.atsStrict;
        }
        updatePreview();
    }
}

// Save every 10 seconds
setInterval(saveToLocalStorage, 10000);

// Load on page load
document.addEventListener('DOMContentLoaded', loadFromLocalStorage);

// iOS Detection and Setup
function detectiOSAndSetup() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    if (isIOS) {
        // Show iOS-specific features
        console.log('iOS device detected');
        
        // Auto-show help if opened from file protocol
        if (window.location.protocol === 'file:') {
            setTimeout(() => {
                if (confirm('iOS detected! Would you like to see setup instructions for better experience?')) {
                    showIosHelp();
                }
            }, 2000);
        }
    }
}

// PWA Install Setup
let deferredPrompt;
function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const addToHomeBtn = document.getElementById('addToHomeBtn');
        addToHomeBtn.classList.remove('hidden');
        addToHomeBtn.style.display = 'inline-block';
    });
}

// Add to Home Screen
function addToHomeScreen() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            document.getElementById('addToHomeBtn').style.display = 'none';
        });
    } else if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        // iOS Safari instructions
        alert('To add to home screen:\n\n1. Tap the Share button ⬆️ in Safari\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to confirm\n\nThis creates an app-like icon for easy access!');
    }
}

// Show iOS Help Modal
function showIosHelp() {
    const modal = document.getElementById('iosHelpModal');
    modal.classList.remove('hidden');
    modal.style.display = 'block';
}

// Close iOS Help Modal
function closeIosHelp() {
    const modal = document.getElementById('iosHelpModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('iosHelpModal');
    if (event.target === modal) {
        closeIosHelp();
    }
}

// Enhanced download function for mobile
function downloadPDF() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
        alert('📱 iOS PDF Instructions:\n\n1. Use "Print CV" button below\n2. In print dialog, pinch to zoom out to see full page\n3. Tap "Share" in top-right corner\n4. Select "Save to Files" or "Save PDF to Books"\n5. Choose your location\n\n💡 Tip: For best results, hold device in landscape mode!\n\nResult: Clean PDF with no headers/footers - just your CV!');
    } else if (isAndroid) {
        alert('📱 Android PDF Instructions:\n\n1. Use "Print CV" button below\n2. Select "Save as PDF" from printer options\n3. Tap "PDF" button in top bar\n4. Choose "Download" or select save location\n\n💡 Tip: Make sure "Headers and footers" is turned OFF in print settings!\n\nResult: Professional PDF ready for applications!');
    } else {
        alert('💻 Desktop PDF Instructions:\n\n1. Use "Print CV" button below\n2. Select "Save as PDF" or "Microsoft Print to PDF"\n3. In print preview, ensure:\n   • Margins: Minimum or None\n   • Headers and footers: OFF\n   • Background graphics: ON\n4. Click "Save" and choose location\n\nResult: Professional, clean PDF perfect for job applications!');
    }
    
    printCV();
}

// Direct PDF export (no browser headers/footers)
async function exportPDF() {
    try {
        const fullName = (document.getElementById('fullName').value || 'CV').replace(/[^\w\-\s]/g, '').trim();
        const source = document.getElementById('cvPreview');
        if (!source) return;

        // Clone content into an isolated, sized container for PDF rendering
        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.left = '-10000px';
        wrapper.style.top = '0';
        wrapper.style.zIndex = '-1';
        wrapper.className = 'pdf-export';

        // Build a fresh CV root with same classes to ensure styles apply
        const cvRoot = document.createElement('div');
        cvRoot.className = source.className.replace('cv', 'cv'); // keep classes
        cvRoot.innerHTML = source.innerHTML;
        wrapper.appendChild(cvRoot);
        document.body.appendChild(wrapper);

        // Ensure images are loaded before rendering
        await new Promise(resolve => setTimeout(resolve, 150));

        const opt = {
            margin:       [0.25, 0.35, 0.25, 0.35], // inches: top, right, bottom, left
            filename:     `${fullName || 'CV'}.pdf`,
            image:        { type: 'jpeg', quality: 0.96 },
            html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['css', 'legacy'] }
        };

        // Use html2pdf to generate the PDF without browser print UI
        if (window.html2pdf) {
            await window.html2pdf().set(opt).from(wrapper).save();
        } else {
            alert('PDF engine not loaded. Please ensure internet connection to load html2pdf.js, or use Print CV.');
        }
        
        document.body.removeChild(wrapper);
    } catch (e) {
        console.error('PDF export failed', e);
        alert('Sorry, exporting PDF failed. Try using Print CV → Save as PDF instead.');
    }
}

// Template System
let currentTemplate = 'classic';

function changeTemplate() {
    const templateSelect = document.getElementById('templateSelect');
    if (templateSelect) {
        currentTemplate = templateSelect.value;
    }
    updatePreview();
}

function getTemplateClass() {
    return `template-${currentTemplate}`;
}

function getTemplateStyles() {
    const styles = {
        classic: `
            .cv.template-classic { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #2c3e50; }
            .cv.template-classic .cv-container { display: grid; grid-template-columns: 200px 1fr; gap: 0; }
            .cv.template-classic .cv-sidebar { background: #34495e; color: white; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .cv.template-classic .cv-sidebar h3 { color: #ecf0f1; font-size: 12px; text-transform: uppercase; margin: 20px 0 10px 0; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
            .cv.template-classic .cv-photo { width: 120px; height: 120px; border: 3px solid #3498db; margin: 0 auto 15px; }
            .cv.template-classic .cv-contact { font-size: 11px; line-height: 1.5; } .cv.template-classic .cv-contact a { color: #3498db; }
            .cv.template-classic .cv-main { padding: 30px; background: white; }
            .cv.template-classic .cv-main .cv-name { font-size: 28px; font-weight: 700; color: #2c3e50; margin-bottom: 5px; }
            .cv.template-classic .cv-main .cv-title { font-size: 16px; color: #7f8c8d; margin-bottom: 20px; font-style: italic; }
        `,
        modern: `
            .cv.template-modern { font-family: "Helvetica Neue", Arial, sans-serif; color: #333; }
            .cv.template-modern .cv-header-section { display: flex; align-items: center; background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; padding: 30px; margin-bottom: 30px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .cv.template-modern .cv-header-content { flex: 1; }
            .cv.template-modern .cv-name { font-size: 30px; font-weight: 300; margin-bottom: 8px; }
            .cv.template-modern .cv-title { font-size: 16px; opacity: 0.9; margin-bottom: 12px; }
            .cv.template-modern .cv-contact { font-size: 12px; opacity: 0.9; } .cv.template-modern .cv-contact a { color: #e0f2fe; text-decoration: underline; }
            .cv.template-modern .cv-photo { width: 100px; height: 100px; border: 3px solid rgba(255,255,255,0.3); margin-left: 20px; }
            .cv.template-modern .cv-timeline { position: relative; padding-left: 30px; }
            .cv.template-modern .timeline-line { position: absolute; left: 15px; top: 0; bottom: 0; width: 2px; background: #3b82f6; }
            .cv.template-modern .timeline-content h1,
            .cv.template-modern .timeline-content h2,
            .cv.template-modern .timeline-content h3,
            .cv.template-modern .timeline-content h4 { position: relative; background: white; padding: 10px 15px; margin: 0 0 12px 0; border-left: 4px solid #3b82f6; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
            .cv.template-modern .timeline-content h1 { font-size: 20px; }
            .cv.template-modern .timeline-content h2 { font-size: 18px; }
            .cv.template-modern .timeline-content h3 { font-size: 16px; }
            .cv.template-modern .timeline-content h4 { font-size: 14px; }
            .cv.template-modern .timeline-content h1:before,
            .cv.template-modern .timeline-content h2:before,
            .cv.template-modern .timeline-content h3:before,
            .cv.template-modern .timeline-content h4:before { content: ""; position: absolute; left: -26px; top: 15px; width: 10px; height: 10px; background: #3b82f6; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 2px #3b82f6; }
            .cv.template-modern .timeline-content hr { border: 0; border-top: 1px solid #e5e7eb; margin: 12px 0; }
            .cv.template-modern .timeline-content ul { margin: 10px 0 10px 20px; }
            .cv.template-modern .timeline-content li { margin: 4px 0; }
        `,
        executive: `
            .cv.template-executive { font-family: "Georgia", Times, serif; color: #1a1a1a; }
            .cv.template-executive .cv-cards-container { padding: 15px; background: #f8f9fa; }
            .cv.template-executive .cv-header-card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin-bottom: 20px; display: flex; align-items: center; border-top: 4px solid #8b4513; }
            .cv.template-executive .cv-info { flex: 1; }
            .cv.template-executive .cv-name { font-size: 28px; color: #8b4513; font-weight: 700; margin-bottom: 5px; }
            .cv.template-executive .cv-title { font-size: 16px; color: #5d4e75; margin-bottom: 12px; }
            .cv.template-executive .cv-contact { font-size: 12px; color: #666; } .cv.template-executive .cv-contact a { color: #8b4513; }
            .cv.template-executive .cv-photo { width: 100px; height: 100px; border: 3px solid #8b4513; margin-left: 30px; }
            .cv.template-executive .cards-content .cv-section { background: white; padding: 20px; margin-bottom: 15px; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); border-left: 3px solid #8b4513; }
            .cv.template-executive .cards-content h3 { color: #8b4513; font-size: 16px; margin-bottom: 12px; border-bottom: none; }
        `,
        tech: `
            .cv.template-tech { font-family: "SF Pro Display", -apple-system, sans-serif; color: #0d1117; }
            .cv.template-tech .cv-infographic-container { background: #f6f8fa; }
            .cv.template-tech .cv-hero-section { background: linear-gradient(135deg, #0969da 0%, #21262d 100%); color: white; padding: 30px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .cv.template-tech .hero-content { display: flex; align-items: center; gap: 20px; }
            .cv.template-tech .hero-text .cv-name { font-size: 26px; font-weight: 600; margin-bottom: 5px; }
            .cv.template-tech .hero-text .cv-title { font-size: 14px; opacity: 0.9; }
            .cv.template-tech .cv-photo { width: 80px; height: 80px; border: 2px solid rgba(255,255,255,0.3); }
            .cv.template-tech .cv-info-bar { background: #21262d; color: #f0f6fc; padding: 12px 30px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .cv.template-tech .cv-info-bar .cv-contact { font-size: 12px; } .cv.template-tech .cv-info-bar .cv-contact a { color: #58a6ff; }
            .cv.template-tech .infographic-content { padding: 20px 30px; }
            .cv.template-tech .infographic-content h3 { background: #dbeafe; color: #0969da; padding: 8px 15px; border-radius: 6px; border: none; margin: 20px 0 12px 0; font-size: 14px; }
        `,
        creative: `
            .cv.template-creative { font-family: "Avenir", Arial, sans-serif; color: #2d3748; }
            .cv.template-creative .cv-header-compact { display: grid; grid-template-columns: 1fr auto auto; gap: 20px; align-items: center; padding: 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .cv.template-creative .header-left .cv-name { font-size: 24px; font-weight: 700; margin-bottom: 3px; }
            .cv.template-creative .header-left .cv-title { font-size: 14px; opacity: 0.9; }
            .cv.template-creative .header-center .cv-contact { font-size: 11px; text-align: center; } .cv.template-creative .header-center .cv-contact a { color: white; }
            .cv.template-creative .header-right .cv-photo { width: 60px; height: 60px; border: 2px solid rgba(255,255,255,0.3); }
            .cv.template-creative .compact-content { padding: 20px 25px; columns: 1; }
            .cv.template-creative .compact-content .cv-section { break-inside: avoid; margin-bottom: 15px; }
            .cv.template-creative .compact-content h3 { color: #667eea; font-size: 14px; margin-bottom: 8px; border-bottom: 2px solid #667eea; padding-bottom: 3px; }
        `,
        academic: `
            .cv.template-academic { font-family: "Crimson Text", Times, serif; color: #1a202c; }
            .cv.template-academic .cv-split-container { display: grid; grid-template-columns: 200px 1fr; }
            .cv.template-academic .cv-left-panel { background: #2d3748; color: #e2e8f0; padding: 30px 20px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .cv.template-academic .panel-header .cv-photo { width: 120px; height: 120px; margin: 0 auto 20px auto; border: 3px solid #4a5568; }
            .cv.template-academic .panel-header .cv-name { font-size: 22px; color: #e2e8f0; margin-bottom: 8px; font-weight: 400; }
            .cv.template-academic .panel-header .cv-title { font-size: 14px; color: #a0aec0; font-style: italic; margin-bottom: 20px; }
            .cv.template-academic .panel-contact .cv-contact { font-size: 11px; line-height: 1.6; } .cv.template-academic .panel-contact .cv-contact a { color: #63b3ed; }
            .cv.template-academic .cv-right-panel { background: white; padding: 30px; }
            .cv.template-academic .split-content h3 { color: #2d3748; font-size: 16px; border-bottom: 2px solid #4a5568; padding-bottom: 5px; margin: 25px 0 12px 0; text-transform: none; }
        `,
        minimal: `
            .cv.template-minimal { font-family: "Inter", Arial, sans-serif; color: #111827; }
            .cv.template-minimal .cv-minimal { padding: 28px; }
            .cv.template-minimal .min-header { border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 16px; }
            .cv.template-minimal .min-name { font-size: 26px; font-weight: 700; }
            .cv.template-minimal .min-title { font-size: 14px; color: #4b5563; margin-top: 2px; }
            .cv.template-minimal .min-contact { font-size: 12px; color: #6b7280; margin-top: 8px; }
            .cv.template-minimal .min-body .cv-section { margin-bottom: 16px; }
            .cv.template-minimal h3 { border: none; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 14px 0 8px 0; }
        `,
        corporate: `
            .cv.template-corporate { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; }
            .cv.template-corporate .cv-corporate { padding: 24px 28px; }
            .cv.template-corporate .corp-header { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: end; border-bottom: 3px solid #0ea5e9; padding-bottom: 10px; margin-bottom: 16px; }
            .cv.template-corporate .corp-name { font-size: 26px; font-weight: 800; letter-spacing: 0.2px; }
            .cv.template-corporate .corp-title { font-size: 14px; color: #334155; }
            .cv.template-corporate .corp-right { font-size: 12px; color: #475569; text-align: right; }
            .cv.template-corporate .corp-body h3 { color: #0ea5e9; border-bottom: none; border-left: 3px solid #0ea5e9; padding: 4px 0 4px 10px; margin: 14px 0 8px 0; }
        `,
        monochrome: `
            .cv.template-monochrome { font-family: "Source Sans Pro", Arial, sans-serif; color: #111; }
            .cv.template-monochrome .cv-mono { padding: 28px; }
            .cv.template-monochrome .mono-header { text-align: center; border-bottom: 1px solid #000; margin-bottom: 16px; padding-bottom: 8px; }
            .cv.template-monochrome .mono-name { font-size: 24px; font-weight: 700; }
            .cv.template-monochrome .mono-title { font-size: 13px; color: #222; margin-top: 2px; }
            .cv.template-monochrome .mono-contact { font-size: 12px; color: #333; margin-top: 8px; }
            .cv.template-monochrome .mono-body h3 { border: none; text-transform: uppercase; font-size: 13px; letter-spacing: 1px; border-bottom: 1px solid #000; padding-bottom: 4px; margin: 14px 0 8px 0; }
        `,
        modular: `
            .cv.template-modular { font-family: "Nunito Sans", Arial, sans-serif; color: #0b132b; }
            .cv.template-modular .cv-modular { padding: 26px; }
            .cv.template-modular .mod-header { border-bottom: 2px solid #3a506b; margin-bottom: 14px; padding-bottom: 6px; }
            .cv.template-modular .mod-name { font-size: 24px; font-weight: 800; }
            .cv.template-modular .mod-title { font-size: 14px; color: #3a506b; }
            .cv.template-modular .mod-contact { font-size: 12px; color: #5c6b73; margin-top: 6px; }
            .cv.template-modular .mod-grid { display: block; }
            .cv.template-modular .mod-grid h3 { border: none; color: #3a506b; border-left: 3px solid #3a506b; padding-left: 10px; margin: 14px 0 8px 0; }
        `
    };
    return styles[currentTemplate] || styles.classic;
}

// Toggle ATS Mode
function toggleAtsMode() {
    const box = document.getElementById('atsStrict');
    atsStrict = !!(box && box.checked);
    updatePreview();
}

function renderHighlightsBlock() {
    var hlEl = document.getElementById('highlights');
    const raw = ((hlEl && hlEl.value) || '').trim();
    if (!raw) return '';
    const lines = raw.split(/\n|•/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) return '';
    const items = lines.map(l => `<li>${emphasizeMetrics(l)}</li>`).join('');
    return `<div class="cv-section highlights"><h3>Key Highlights</h3><ul>${items}</ul></div>`;
}

function emphasizeMetrics(text) {
    // Bold numbers, percentages, timeframes
    return text
        .replace(/(\b\d+[\d,\.]*\b)/g, '<strong>$1</strong>')
        .replace(/(\b\d+%\b)/g, '<strong>$1</strong>')
        .replace(/(\b\d{4}\b)/g, '<strong>$1</strong>');
}

// ATS Strict CSS injected into print window; preview uses styles.css version
function getAtsStrictStyles() {
    return `
    .ats-strict { font-family: Arial, Helvetica, sans-serif !important; color: #000 !important; }
    .ats-strict * { color: #000 !important; background: transparent !important; box-shadow: none !important; }
    .ats-strict a { color: inherit !important; text-decoration: underline !important; }
    .ats-strict .cv h3 { border: none !important; border-bottom: 1px solid #000 !important; color: #000 !important; }
    .ats-strict .cv-photo { border-color: #bbb !important; }
    .ats-strict .timeline-line, .ats-strict .hero-background { display: none !important; }
    .ats-strict .cv-header-section, .ats-strict .cv-info-bar, .ats-strict .cv-header-card, .ats-strict .cv-left-panel, .ats-strict .cv-hero-section { background: transparent !important; border: none !important; }
    .ats-strict .compact-content { columns: 1 !important; column-count: 1 !important; }
    `;
}

function updateContentPlaceholder() {
    const sel = document.getElementById('contentFormat');
    const ta = document.getElementById('cvContent');
    if (!sel || !ta) return;
    const fmt = sel.value;
    if (fmt === 'markdown') {
        ta.placeholder = 'Markdown supported: headings (#), lists (-, *), **bold**, *italic*, `code`, [link](https://)';
    } else if (fmt === 'text') {
        ta.placeholder = 'Plain text: lines become paragraphs; use -, * or • for bullets';
    } else {
        ta.placeholder = 'HTML: Use div/p/h3/ul/li, strong/em, a, code/pre';
    }
}
