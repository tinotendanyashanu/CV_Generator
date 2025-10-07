// Global variables
let photoDataUrl = null;

// Track ATS mode
let atsStrict = false;

// Cache for collecting full template styles so print/export match the preview
let templateStylesCache = '';
let templateStylesPromise = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Page loaded, initializing CV generator...');
    setPreviewStatus('loading', 'Preview: checking…');
    
    // Deployment fix: Ensure CSS is loaded before continuing
    const checkCSSLoaded = () => {
        const testElement = document.createElement('div');
        testElement.className = 'cv template-classic';
        testElement.style.position = 'absolute';
        testElement.style.visibility = 'hidden';
        document.body.appendChild(testElement);
        
        const styles = window.getComputedStyle(testElement);
        const hasTemplateStyles = styles.fontFamily !== 'Times' && styles.fontFamily.includes('apple-system');
        
        document.body.removeChild(testElement);
        
        if (hasTemplateStyles) {
            console.log('✅ CSS loaded successfully');
            initializeApp();
        } else {
            console.log('⚠️ CSS not fully loaded, retrying...');
            setTimeout(checkCSSLoaded, 100);
        }
    };
    
    // Wait a bit for CSS to load, then check
    setTimeout(checkCSSLoaded, 50);
});

function initializeApp() {
    
    // Initialize current template from selector (avoids reliance on inline handlers)
    const tplSel = document.getElementById('templateSelect');
    if (tplSel) {
        currentTemplate = tplSel.value || currentTemplate;
        console.log('📋 Initial template:', currentTemplate);
        tplSel.addEventListener('change', changeTemplate);
    }
    
    console.log('🔄 Calling updatePreview on page load...');
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

    // iPhone-specific: visually prefer Export (no headers) and de-emphasize Print
    try {
        const isiPhone = /iPhone|iPod/.test(navigator.userAgent);
        if (isiPhone) {
            const exportBtn = document.getElementById('exportBtn');
            const printBtn = document.getElementById('printBtn');
            if (exportBtn) {
                exportBtn.classList.add('btn-primary');
                exportBtn.classList.remove('btn-success');
                exportBtn.textContent = '📄 Export PDF (Recommended)';
            }
            if (printBtn) {
                printBtn.classList.add('btn-secondary');
                printBtn.classList.remove('btn-primary');
                printBtn.title = 'On iPhone, Export PDF avoids Safari headers/footers';
            }
        }
    } catch (e) {
        console.warn('Device detection failed:', e);
    }

    // Preload PDF engine early so export is instant & update status indicator
    preloadPdfEngine();

    // Preload styles so export/print use the exact preview theme
    ensureTemplateStylesLoaded().catch(err => console.warn('Style preload warning:', err));

    console.log('✅ CV Generator initialized successfully');
    setPreviewStatus('ok', 'Preview: ready');
}

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

async function ensureTemplateStylesLoaded() {
    if (templateStylesCache) return templateStylesCache;
    if (templateStylesPromise) return templateStylesPromise;

    templateStylesPromise = (async () => {
        // Give linked stylesheets a brief moment to register
        for (let attempt = 0; attempt < 5; attempt++) {
            if (document.styleSheets && document.styleSheets.length) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        let combined = '';
        const sheets = Array.from(document.styleSheets || []);

        for (const sheet of sheets) {
            try {
                const rules = sheet.cssRules;
                if (!rules) continue;
                combined += Array.from(rules).map(rule => rule.cssText).join('\n') + '\n';
                continue;
            } catch (cssError) {
                // Accessing cssRules can fail due to CORS; fall through to fetch or ownerNode
                console.warn('Unable to read cssRules for stylesheet:', sheet.href || '[inline]', cssError);
            }

            if (sheet.ownerNode && sheet.ownerNode.tagName === 'STYLE') {
                combined += sheet.ownerNode.textContent + '\n';
            } else if (sheet.href) {
                try {
                    const response = await fetch(sheet.href);
                    if (response.ok) {
                        combined += await response.text();
                        combined += '\n';
                    } else {
                        console.warn('Failed to fetch stylesheet for export:', sheet.href, response.status);
                    }
                } catch (fetchError) {
                    console.warn('Error fetching stylesheet for export:', sheet.href, fetchError);
                }
            }
        }

        // Include inline <style> tags as part of the export styles
        const inlineStyles = Array.from(document.querySelectorAll('style'))
            .map(style => style.textContent)
            .join('\n');
        if (inlineStyles.trim()) {
            combined += inlineStyles + '\n';
        }

        // Final fallback: defer to @import rules so external styles still load
        if (!combined.trim()) {
            const stylesheetLinks = Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))
                .map(link => link.href);
            if (stylesheetLinks.length) {
                combined = stylesheetLinks.map(href => `@import url('${href}');`).join('\n');
            }
        }

        templateStylesCache = combined;
        return combined;
    })();

    try {
        return await templateStylesPromise;
    } catch (err) {
        console.warn('Template style preload failed:', err);
        templateStylesCache = templateStylesCache || '';
        return templateStylesCache;
    }
}

function getTemplateStyles() {
    return templateStylesCache || '';
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

function escapeHtmlBasic(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const MM_TO_PX = 96 / 25.4;

function mmToPx(mm) {
    return Math.round(mm * MM_TO_PX);
}

function sanitizeFileName(name) {
    if (!name) return 'CV';
    const cleaned = name
        .replace(/[^a-z0-9\-\s_()]+/gi, '')
        .trim()
        .replace(/\s+/g, '-');
    return cleaned || 'CV';
}

function hasMeaningfulContent(html) {
    if (!html) return false;
    const text = html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > 0;
}

async function waitForImagesToLoad(element) {
    if (!element) return;
    const images = Array.from(element.querySelectorAll('img'));
    if (!images.length) return;

    await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            const done = () => {
                img.removeEventListener('load', done);
                img.removeEventListener('error', done);
                resolve();
            };
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            setTimeout(done, 3000);
        });
    }));
}

function removeExistingPdfClone() {
    const existing = document.getElementById('cv-pdf-export');
    if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
    }
}

function createPdfExportContainer(source) {
    removeExistingPdfClone();

    const clone = document.createElement('div');
    clone.id = 'cv-pdf-export';
    clone.className = source.className || 'cv';
    clone.innerHTML = source.innerHTML;

    const widthPx = mmToPx(210);
    const heightPx = mmToPx(297);
    const paddingPx = mmToPx(10);

    Object.assign(clone.style, {
        position: 'fixed',
        left: '-9999px',
        top: '0',
        width: `${widthPx}px`,
        minHeight: `${heightPx}px`,
        padding: `${paddingPx}px`,
        background: '#ffffff',
        boxSizing: 'border-box',
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        pointerEvents: 'none',
        zIndex: '-1',
        overflow: 'visible'
    });

    document.body.appendChild(clone);
    return clone;
}

function linkifyText(text) {
    let result = escapeHtmlBasic(text);

    // Emails
    result = result.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" rel="noopener noreferrer">$1</a>');

    // Phone numbers (avoid matching inside existing attributes)
    result = result.replace(/(^|[^"'>])(\+?[\d][\d\s\-\(\)]{6,}\d)/g, (match, prefix, phone) => {
        const normalized = phone.replace(/[^\d+]/g, '');
        return `${prefix}<a href="tel:${normalized}" rel="noopener noreferrer">${phone}</a>`;
    });

    // Full URLs
    result = result.replace(/(^|[^"'>])(https?:\/\/[^\s<]+)/gi, (match, prefix, url) => {
        return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    // www. URLs
    result = result.replace(/(^|[^"'>])(www\.[^\s<]+)/gi, (match, prefix, url) => {
        const href = url.startsWith('http') ? url : `https://${url}`;
        return `${prefix}<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    return result;
}

function stripLeadingSymbols(value) {
    return value.replace(/^[\p{P}\p{S}\s]+/gu, '').trim();
}

function renderContactInfo(raw) {
    const lines = (raw || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (!lines.length) {
        return '<ul class="contact-list"><li>Add your email, phone, and links to make it easy to contact you.</li></ul>';
    }

    const items = lines.map(line => {
        const stripped = atsStrict ? stripLeadingSymbols(line) : line;
        const displayLine = stripped || line;
        return `<li>${linkifyText(displayLine)}</li>`;
    });

    return `<ul class="contact-list">${items.join('')}</ul>`;
}

function updatePreview() {
    console.log('🔄 updatePreview() called - currentTemplate:', currentTemplate);
    setPreviewStatus('loading', 'Preview: refreshing…');
    
    const fullName = document.getElementById('fullName').value || 'Your Name';
    const jobTitle = document.getElementById('jobTitle').value || 'Your Job Title';
    const contactInfoRaw = document.getElementById('contactInfo').value || 'Your contact information';
    const rawCv = document.getElementById('cvContent').value || '';
    const fmtSel = document.getElementById('contentFormat');
    const format = (fmtSel && fmtSel.value) || 'html';
    const cvContent = renderContentByFormat(rawCv, format);
    const highlightsRaw = document.getElementById('highlights')?.value || '';

    console.log('📝 Form data loaded:', {
        fullName: fullName.substring(0, 20) + '...',
        jobTitle: jobTitle.substring(0, 30) + '...',
        cvContentLength: rawCv.length,
        format: format
    });

    const contactHTML = renderContactInfo(contactInfoRaw);

    // Generate HTML based on selected template
    const highlights = renderHighlightsBlock();
    console.log('🎨 About to generate template HTML...');
    const cvHTML = generateTemplateHTML(fullName, jobTitle, contactHTML, cvContent, highlights);
    console.log('✅ Generated HTML length:', cvHTML ? cvHTML.length : 'null/undefined');
    
    // Template styles are now loaded from styles.css - no dynamic injection needed
    console.log('🎭 Template styles loaded from CSS file...');
    
    const cvPreview = document.getElementById('cvPreview');
    if (!cvPreview) {
        console.error('❌ cvPreview element not found!');
        setPreviewStatus('error', 'Preview: element missing');
        return;
    }
    
    console.log('📄 Setting cvPreview innerHTML...');
    cvPreview.innerHTML = cvHTML;
    let classes = `cv ${getTemplateClass()}`;
    if (atsStrict) classes += ' ats-strict';
    cvPreview.className = classes;
    
    // Ensure colors render properly on all platforms
    cvPreview.style.colorAdjust = 'exact';
    cvPreview.style.webkitPrintColorAdjust = 'exact';
    cvPreview.style.printColorAdjust = 'exact';
    
    console.log('🏷️ Applied classes to cvPreview:', classes);
    console.log('🎯 Current cvPreview className:', cvPreview.className);
    console.log('📋 Preview HTML first 200 chars:', cvHTML.substring(0, 200) + '...');
    console.log('✅ updatePreview completed successfully');
    setPreviewStatus('ok', `Preview: ready (${currentTemplate})`);

    updateAtsInsights({
        fullName,
        jobTitle,
        contactInfo: contactInfoRaw,
        rawContent: rawCv,
        highlights: highlightsRaw,
        format
    });
}

// Template styles are now in styles.css - this function is kept for compatibility
function injectTemplateStyles() {
    // All template styles are now properly defined in styles.css
    // This avoids CSP issues and ensures styles load correctly on Netlify
    console.log('✅ Using template styles from styles.css');
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
    console.log('🎨 generateTemplateHTML called with template:', currentTemplate);
    
    const photoSection = photoDataUrl 
        ? `<div class="cv-photo">
                <img src="${photoDataUrl}" alt="Profile photo">
            </div>` 
        : '';
        
    let templateHTML = '';
    
    switch(currentTemplate) {
        case 'classic':
            templateHTML = generateClassicTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'modern':
            templateHTML = generateModernTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'executive':
            templateHTML = generateExecutiveTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'tech':
            templateHTML = generateTechTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'creative':
            console.log('📱 Generating creative template...');
            templateHTML = generateCreativeTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'academic':
            templateHTML = generateAcademicTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'minimal':
            templateHTML = generateMinimalTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'corporate':
            templateHTML = generateCorporateTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'monochrome':
            templateHTML = generateMonochromeTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'modular':
            templateHTML = generateModularTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'ats-essentials':
            templateHTML = generateAtsEssentialsTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'product-lead':
            templateHTML = generateProductLeadTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'silver':
            templateHTML = generateSilverTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'neon-tech':
            console.log('🌟 Generating neon-tech template...');
            templateHTML = generateNeonTechTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'luxury-gold':
            console.log('✨ Generating luxury-gold template...');
            templateHTML = generateLuxuryGoldTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'gradient-wave':
            console.log('🌊 Generating gradient-wave template...');
            templateHTML = generateGradientWaveTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'watermark-pro':
            console.log('💎 Generating watermark-pro template...');
            templateHTML = generateWatermarkProTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'minimal-glass':
            console.log('🔮 Generating minimal-glass template...');
            templateHTML = generateMinimalGlassTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'bold-geometric':
            console.log('🔺 Generating bold-geometric template...');
            templateHTML = generateBoldGeometricTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        case 'artistic-portfolio':
            console.log('🎨 Generating artistic-portfolio template...');
            templateHTML = generateArtisticPortfolioTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
            break;
        default:
            console.warn('⚠️ Unknown template, falling back to classic:', currentTemplate);
            templateHTML = generateClassicTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
    }
    
    console.log('✅ Generated template HTML length:', templateHTML.length);
    console.log('📋 Template HTML preview:', templateHTML.substring(0, 150) + '...');
    return templateHTML;
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

// Template 10b: ATS Essentials
function generateAtsEssentialsTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    const photoMarkup = photoSection ? `<div class="ats-photo">${photoSection}</div>` : '';
    return `
        <article class="ats-essentials">
            <header class="ats-header">
                <div>
                    <h1 class="ats-name">${fullName}</h1>
                    <p class="ats-title">${jobTitle}</p>
                </div>
                ${photoMarkup}
            </header>
            <section class="ats-contact cv-contact">${contactHTML}</section>
            <section class="ats-body">
                ${highlights || ''}
                ${cvContent}
            </section>
        </article>
    `;
}

// Template 10c: Product Lead Spotlight
function generateProductLeadTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    const summaryBlock = highlights
        ? `<aside class="product-lead-summary">${highlights}</aside>`
        : '';
    return `
        <div class="product-lead">
            <header class="product-lead-header">
                <div class="product-lead-primary">
                    <h1 class="product-lead-name">${fullName}</h1>
                    <p class="product-lead-title">${jobTitle}</p>
                </div>
                <div class="product-lead-meta">
                    ${photoSection}
                    <div class="product-lead-contact cv-contact">${contactHTML}</div>
                </div>
            </header>
            <main class="product-lead-body">
                ${summaryBlock}
                <section class="product-lead-content">
                    ${cvContent}
                </section>
            </main>
        </div>
    `;
}

// Template 11: Silver Glass Header
function generateSilverTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="silver-container">
            <header class="silver-header">
                <div class="silver-row">
                    ${photoSection}
                    <div>
                        <div class="silver-name">${fullName}</div>
                        <div class="silver-title">${jobTitle}</div>
                        <div class="silver-contact cv-contact">${contactHTML}</div>
                    </div>
                </div>
            </header>
            <main class="silver-body">
                ${highlights || ''}
                ${cvContent}
            </main>
        </div>
    `;
}

// Template 12: Neon Tech Futuristic
function generateNeonTechTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="neon-tech-container">
            <div class="neon-tech-header">
                <div class="neon-tech-grid">
                    <div class="neon-tech-info">
                        <div class="neon-tech-name">${fullName}</div>
                        <div class="neon-tech-title">${jobTitle}</div>
                        <div class="neon-tech-contact cv-contact">${contactHTML}</div>
                    </div>
                    <div class="neon-tech-photo-section">
                        ${photoSection}
                    </div>
                </div>
                <div class="neon-tech-circuit"></div>
            </div>
            <div class="neon-tech-body">
                ${highlights || ''}
                ${cvContent}
            </div>
        </div>
    `;
}

// Template 13: Luxury Gold Executive
function generateLuxuryGoldTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="luxury-gold-container">
            <div class="luxury-gold-header">
                <div class="luxury-gold-ornament"></div>
                <div class="luxury-gold-content">
                    <div class="luxury-gold-info">
                        <div class="luxury-gold-name">${fullName}</div>
                        <div class="luxury-gold-title">${jobTitle}</div>
                        <div class="luxury-gold-contact cv-contact">${contactHTML}</div>
                    </div>
                    <div class="luxury-gold-photo-section">
                        ${photoSection}
                    </div>
                </div>
                <div class="luxury-gold-ornament luxury-gold-ornament-right"></div>
            </div>
            <div class="luxury-gold-body">
                ${highlights || ''}
                ${cvContent}
            </div>
        </div>
    `;
}

// Template 14: Gradient Wave Modern
function generateGradientWaveTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="gradient-wave-container">
            <div class="gradient-wave-header">
                <div class="gradient-wave-bg"></div>
                <div class="gradient-wave-content">
                    <div class="gradient-wave-info">
                        <div class="gradient-wave-name">${fullName}</div>
                        <div class="gradient-wave-title">${jobTitle}</div>
                        <div class="gradient-wave-contact cv-contact">${contactHTML}</div>
                    </div>
                    <div class="gradient-wave-photo-section">
                        ${photoSection}
                    </div>
                </div>
            </div>
            <div class="gradient-wave-body">
                ${highlights || ''}
                ${cvContent}
            </div>
        </div>
    `;
}

// Template 15: Watermark Professional
function generateWatermarkProTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="watermark-pro-container">
            <div class="watermark-pro-bg">${fullName.charAt(0)}</div>
            <div class="watermark-pro-header">
                <div class="watermark-pro-content">
                    <div class="watermark-pro-info">
                        <div class="watermark-pro-name">${fullName}</div>
                        <div class="watermark-pro-title">${jobTitle}</div>
                        <div class="watermark-pro-contact cv-contact">${contactHTML}</div>
                    </div>
                    <div class="watermark-pro-photo-section">
                        ${photoSection}
                    </div>
                </div>
            </div>
            <div class="watermark-pro-body">
                ${highlights || ''}
                ${cvContent}
            </div>
        </div>
    `;
}

// Template 16: Minimal Glass Design
function generateMinimalGlassTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="minimal-glass-container">
            <div class="minimal-glass-header">
                <div class="minimal-glass-frosted">
                    <div class="minimal-glass-info">
                        <div class="minimal-glass-name">${fullName}</div>
                        <div class="minimal-glass-title">${jobTitle}</div>
                        <div class="minimal-glass-contact cv-contact">${contactHTML}</div>
                    </div>
                    <div class="minimal-glass-photo-section">
                        ${photoSection}
                    </div>
                </div>
            </div>
            <div class="minimal-glass-body">
                ${highlights || ''}
                ${cvContent}
            </div>
        </div>
    `;
}

// Template 17: Bold Geometric Art
function generateBoldGeometricTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="bold-geometric-container">
            <div class="bold-geometric-header">
                <div class="bold-geometric-shapes">
                    <div class="bold-geometric-shape bold-geometric-triangle"></div>
                    <div class="bold-geometric-shape bold-geometric-circle"></div>
                    <div class="bold-geometric-shape bold-geometric-square"></div>
                </div>
                <div class="bold-geometric-content">
                    <div class="bold-geometric-info">
                        <div class="bold-geometric-name">${fullName}</div>
                        <div class="bold-geometric-title">${jobTitle}</div>
                        <div class="bold-geometric-contact cv-contact">${contactHTML}</div>
                    </div>
                    <div class="bold-geometric-photo-section">
                        ${photoSection}
                    </div>
                </div>
            </div>
            <div class="bold-geometric-body">
                ${highlights || ''}
                ${cvContent}
            </div>
        </div>
    `;
}

// Template 18: Artistic Portfolio
function generateArtisticPortfolioTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights) {
    return `
        <div class="artistic-portfolio-container">
            <div class="artistic-portfolio-header">
                <div class="artistic-portfolio-brush-stroke"></div>
                <div class="artistic-portfolio-content">
                    <div class="artistic-portfolio-info">
                        <div class="artistic-portfolio-name">${fullName}</div>
                        <div class="artistic-portfolio-title">${jobTitle}</div>
                        <div class="artistic-portfolio-contact cv-contact">${contactHTML}</div>
                    </div>
                    <div class="artistic-portfolio-photo-section">
                        ${photoSection}
                    </div>
                </div>
                <div class="artistic-portfolio-palette">
                    <div class="artistic-portfolio-color artistic-portfolio-color-1"></div>
                    <div class="artistic-portfolio-color artistic-portfolio-color-2"></div>
                    <div class="artistic-portfolio-color artistic-portfolio-color-3"></div>
                </div>
            </div>
            <div class="artistic-portfolio-body">
                ${highlights || ''}
                ${cvContent}
            </div>
        </div>
    `;
}

// Enhanced print function with better iPhone handling and photo containment
function collectActiveStylesheets() {
    const fragments = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href') || link.href;
        if (href) {
            fragments.push(`<link rel="stylesheet" href="${href}">`);
        }
    });

    document.querySelectorAll('style').forEach(style => {
        const css = style.textContent || '';
        if (css.trim()) {
            fragments.push(`<style>${css}</style>`);
        }
    });

    return fragments.join('\n');
}

async function printCV(options = {}) {
    const { skipExportPrompt = false } = options || {};
    const isGitHubPages = window.location.hostname.includes('github.io') || window.location.hostname.includes('github.com');
    const isiPhone = /iPhone|iPod/.test(navigator.userAgent);

    if (!skipExportPrompt && isiPhone) {
        let message = 'iPhone detected!\n\nSafari print often adds headers/footers with URL and date.\n\n';
        if (isGitHubPages) {
            message += 'GitHub Pages deployment detected - enhanced print will be used.\n\n';
        }
        message += 'Click OK to use Export PDF (no headers) instead.\nClick Cancel to continue with print.';

        const useExport = confirm(message);
        if (useExport) {
            await exportPDF();
            return;
        }
    }

    console.log('🖨️ Starting print process…');
    updatePreview();
    await new Promise(resolve => setTimeout(resolve, 200));

    const cvPreviewElement = document.getElementById('cvPreview');
    if (!cvPreviewElement) {
        alert('Error: CV preview element not found. Please refresh the page and try again.');
        return;
    }

    const cvContent = cvPreviewElement.innerHTML;
    if (!hasMeaningfulContent(cvContent)) {
        alert('Error: CV preview appears to be empty. Please ensure your details are filled in and visible.');
        return;
    }

    const fullNameValue = document.getElementById('fullName')?.value?.trim() || 'CV';
    const safeTitle = escapeHtmlBasic(fullNameValue || 'CV');
    const documentTitle = sanitizeFileName(fullNameValue || 'CV');

    const scaleSel = document.getElementById('printScale');
    const scaleVal = scaleSel ? parseInt(scaleSel.value, 10) : 100;
    const scaleValue = Number.isFinite(scaleVal) ? scaleVal : 100;
    try {
        localStorage.setItem('printScale', String(scaleValue));
    } catch (e) {}

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
    if (!printWindow) {
        alert('Popup blocked! Please allow popups for this site and try again.');
        return;
    }

    const stylesHTML = collectActiveStylesheets();
    const templateClasses = cvPreviewElement.className || 'cv';

    const baseStyles = `
        html, body { margin: 0; padding: 0; background: #ffffff; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; line-height: 1.5; color: #1f2937; }
        @page { size: A4 portrait; margin: 12mm; }
        #printRoot {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            background: #ffffff;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #1f2937;
        }
        #printRoot * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        @media print {
            body { margin: 0; }
            #printRoot { box-shadow: none !important; }
        }
    `;

    const scriptContent = `
        (function() {
            document.title = ${JSON.stringify(documentTitle || 'CV')};
            var scalePercent = ${scaleValue};
            var root = document.getElementById('printRoot');
            if (root && scalePercent && scalePercent !== 100) {
                var factor = scalePercent / 100;
                root.style.transformOrigin = 'top left';
                root.style.transform = 'scale(' + factor + ')';
                root.style.width = (100 / factor) + '%';
            }
            setTimeout(function() {
                window.focus();
                window.print();
            }, 400);
        })();
        window.addEventListener('afterprint', function() {
            setTimeout(function() {
                window.close();
            }, 400);
        });
    `;

    const printHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${safeTitle}</title>
    ${stylesHTML}
    <style>${baseStyles}</style>
</head>
<body>
    <div id="printRoot" class="${templateClasses}">${cvContent}</div>
    <script>${scriptContent}</script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(printHTML);
    printWindow.document.close();
}



function downloadPDF() {
    exportPDF();
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

// Auto-save to localStorage with enhanced error handling
function saveToLocalStorage() {
    try {
        const data = {
            fullName: document.getElementById('fullName')?.value || '',
            jobTitle: document.getElementById('jobTitle')?.value || '',
            contactInfo: document.getElementById('contactInfo')?.value || '',
            cvContent: document.getElementById('cvContent')?.value || '',
            photo: photoDataUrl,
            contentFormat: document.getElementById('contentFormat')?.value || 'html',
            highlights: document.getElementById('highlights')?.value || '',
            atsStrict: document.getElementById('atsStrict')?.checked || false,
            printScale: parseInt(document.getElementById('printScale')?.value, 10) || 100,
            currentTemplate: currentTemplate
        };
        localStorage.setItem('cvGeneratorData', JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
    }
}

// Load from localStorage with enhanced error handling
function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('cvGeneratorData');
        if (saved) {
            const data = JSON.parse(saved);
            
            if (data.fullName && document.getElementById('fullName')) 
                document.getElementById('fullName').value = data.fullName;
            if (data.jobTitle && document.getElementById('jobTitle')) 
                document.getElementById('jobTitle').value = data.jobTitle;
            if (data.contactInfo && document.getElementById('contactInfo')) 
                document.getElementById('contactInfo').value = data.contactInfo;
            if (data.cvContent && document.getElementById('cvContent')) 
                document.getElementById('cvContent').value = data.cvContent;
            
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
            if (data.currentTemplate && document.getElementById('templateSelect')) {
                document.getElementById('templateSelect').value = data.currentTemplate;
                currentTemplate = data.currentTemplate;
            }
            
            // Restore print scale
            const scaleSel = document.getElementById('printScale');
            if (scaleSel && data.printScale) {
                scaleSel.value = String(data.printScale);
            }
            
            updatePreview();
        }
    } catch (e) {
        console.warn('Failed to load from localStorage:', e);
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

// Enhanced device-specific download function
// Enhanced PDF engine loader with better fallback handling
async function ensureHtml2PdfLoaded() {
    if (window.html2pdf) {
        setPdfEngineStatus(true);
        return true;
    }
    
    // Avoid parallel loads
    if (ensureHtml2PdfLoaded._loading) {
        for (let i = 0; i < 50; i++) { // wait up to ~5s
            if (window.html2pdf) { 
                setPdfEngineStatus(true); 
                return true; 
            }
            await new Promise(r => setTimeout(r, 100));
        }
        return !!window.html2pdf;
    }
    
    ensureHtml2PdfLoaded._loading = true;
    setPdfEngineStatus(false, 'loading');
    
    const load = (src) => new Promise((resolve) => {
        // Check if script already exists
        const existing = document.querySelector(`script[src*="html2pdf"]`);
        if (existing && window.html2pdf) { 
            resolve(true);
            return;
        }
        
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => {
            console.log('PDF engine loaded from:', src);
            resolve(!!window.html2pdf);
        };
        s.onerror = () => {
            console.warn('Failed to load PDF engine from:', src);
            resolve(false);
        };
        
        // GitHub Pages fix: Add timeout for stuck requests
        setTimeout(() => {
            if (!window.html2pdf) {
                console.warn('PDF engine loading timeout:', src);
                resolve(false);
            }
        }, 5000);
        
        document.head.appendChild(s);
    });
    
    // GitHub Pages: Try multiple sources with GitHub Pages compatibility
    let ok = false;
    
    // Try local file first (works offline and on GitHub Pages)
    try {
        ok = await load('./html2pdf.bundle.min.js');
    } catch (e) {
        console.warn('Local PDF engine failed:', e);
    }
    
    // If local fails, try CDN with GitHub Pages HTTPS requirement
    if (!ok || !window.html2pdf) {
        console.log('Local PDF engine not found, trying CDN...');
        try {
            ok = await load('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
        } catch (e) {
            console.warn('CDN PDF engine failed:', e);
        }
    }
    
    // GitHub Pages fallback: Try jsdelivr CDN if cloudflare fails
    if (!ok || !window.html2pdf) {
        console.log('Cloudflare CDN failed, trying jsDelivr...');
        try {
            ok = await load('https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js');
        } catch (e) {
            console.warn('jsDelivr PDF engine failed:', e);
        }
    }
    
    ensureHtml2PdfLoaded._loading = false;
    const engineReady = !!window.html2pdf;
    setPdfEngineStatus(engineReady, engineReady ? 'ready' : 'failed - use print instead');
    
    return engineReady;
}

// Enhanced status indicator
function setPdfEngineStatus(ready, status = null) {
    const el = document.getElementById('pdfEngineStatus');
    if (!el) return;
    
    let label = 'Engine: checking…';
    let cssClass = 'status-loading';

    if (status === 'loading') {
        label = 'Engine: loading…';
        cssClass = 'status-loading';
    } else if (ready && status !== 'failed') {
        label = 'Engine: ready ✓';
        cssClass = 'status-ok';
    } else if (status === 'failed') {
        label = 'Engine: using print fallback';
        cssClass = 'status-error';
    }

    el.className = `status-indicator ${cssClass}`;
    el.textContent = label;
}

function setPreviewStatus(state = 'loading', message = '') {
    const el = document.getElementById('previewStatus');
    if (!el) return;

    let cssClass = 'status-loading';
    let label = message || 'Preview: checking…';

    if (state === 'ok') {
        cssClass = 'status-ok';
        label = message || 'Preview: ready ✓';
    } else if (state === 'error') {
        cssClass = 'status-error';
        label = message || 'Preview: needs attention';
    }

    el.className = `status-indicator ${cssClass}`;
    el.textContent = label;
}

async function preloadPdfEngine() {
    try {
        const ok = await ensureHtml2PdfLoaded();
        setPdfEngineStatus(ok, ok ? 'ready' : 'failed');
    } catch (e) {
        console.warn('PDF engine preload failed:', e);
        setPdfEngineStatus(false, 'failed');
    }
}

// Debug function to check CV preview content
function debugCVContent() {
    const preview = document.getElementById('cvPreview');
    // The cvPreview element itself has the .cv class, not a child element
    const cvElement = (preview && preview.classList.contains('cv')) ? preview : preview?.querySelector('.cv');
    
    console.log('=== 🔍 CV DEBUG INFO ===');
    console.log('📋 Current template:', currentTemplate);
    console.log('🎨 Template class:', getTemplateClass());
    console.log('🏷️ Preview element exists:', !!preview);
    console.log('📏 Preview innerHTML length:', preview ? preview.innerHTML.length : 0);
    console.log('✅ Preview has cv class:', preview ? preview.classList.contains('cv') : false);
    console.log('📄 CV element exists:', !!cvElement);
    console.log('🎯 CV element classes:', cvElement ? cvElement.className : 'N/A');
    console.log('🔧 ATS strict:', atsStrict);
    
    if (cvElement && cvElement.innerHTML.trim()) {
        console.log('📝 CV content preview (first 200 chars):', cvElement.innerHTML.substring(0, 200));
        console.log('✅ CV content found and valid');
        
        // Check if template-specific styles are applied
        const hasTemplateClass = cvElement.classList.contains(getTemplateClass());
        console.log('🎨 Has template class applied:', hasTemplateClass);
        
        // Check computed styles
        const computedStyle = window.getComputedStyle(cvElement);
        console.log('🎨 Background color:', computedStyle.backgroundColor);
        console.log('🎨 Color:', computedStyle.color);
        console.log('🎨 Font family:', computedStyle.fontFamily);
        
        setPreviewStatus('ok', `Preview: ready (${currentTemplate})`);
        return true;
    } else {
        console.log('❌ No valid CV content found');
        setPreviewStatus('error', 'Preview: no content detected');
        return false;
    }
    console.log('=========================');
}

// Test function to quickly switch templates and see results
function testTemplate(templateName) {
    console.log(`🧪 Testing template: ${templateName}`);
    const templateSelect = document.getElementById('templateSelect');
    if (templateSelect) {
        templateSelect.value = templateName;
        changeTemplate();
        setTimeout(() => debugCVContent(), 200);
    }
}

// Enhanced PDF export with better error handling and device detection
async function exportPDF() {
    if (window.exportingPDF) {
        console.log('PDF export already in progress – ignoring duplicate request.');
        return;
    }

    window.exportingPDF = true;
    setPreviewStatus('loading', 'Preview: preparing PDF…');

    const exportBtn = document.getElementById('exportBtn');
    const downloadBtn = document.querySelector('button[onclick="downloadPDF()"]');
    const exportOriginal = exportBtn ? exportBtn.textContent : null;
    const downloadOriginal = downloadBtn ? downloadBtn.textContent : null;

    if (exportBtn) {
        exportBtn.textContent = 'Generating PDF…';
        exportBtn.disabled = true;
    }
    if (downloadBtn) {
        downloadBtn.textContent = 'Preparing PDF…';
        downloadBtn.disabled = true;
    }

    try {
        console.log('📄 Starting PDF export…');
        updatePreview();

        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 150)));

        const source = document.getElementById('cvPreview');
        if (!source) {
            throw new Error('CV preview element not found.');
        }

        const markup = source.innerHTML;
        if (!hasMeaningfulContent(markup)) {
            throw new Error('CV preview appears to be empty. Add your details and try again.');
        }

        const fullNameInput = document.getElementById('fullName');
        const fullNameValue = fullNameInput ? fullNameInput.value.trim() : '';
        const fileName = sanitizeFileName(fullNameValue || 'CV');

        let engineReady = await ensureHtml2PdfLoaded();
        if (!engineReady) {
            await new Promise(resolve => setTimeout(resolve, 800));
            engineReady = await ensureHtml2PdfLoaded();
        }

        if (!engineReady || !window.html2pdf) {
            throw new Error('PDF engine is unavailable.');
        }

        const exportContainer = createPdfExportContainer(source);
        await waitForImagesToLoad(exportContainer);

        await new Promise(resolve => setTimeout(resolve, 200));

        const width = exportContainer.scrollWidth || exportContainer.offsetWidth;
        const height = exportContainer.scrollHeight || exportContainer.offsetHeight;

        const opt = {
            margin: [10, 10, 10, 10],
            filename: `${fileName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2.4,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                width,
                height,
                windowWidth: width,
                windowHeight: height
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
                compress: true
            },
            pagebreak: {
                mode: ['css', 'legacy'],
                before: '.page-break-before',
                after: '.page-break-after',
                avoid: ['.page-break-avoid', '.cv-job', '.education-item', '.neon-tech-header', '.luxury-gold-header', '.gradient-wave-header', '.watermark-pro-header', '.minimal-glass-header', '.bold-geometric-header', '.artistic-portfolio-header']
            }
        };

        console.log('Generating PDF with html2pdf…', opt);
        await window.html2pdf().set(opt).from(exportContainer).save();

        setPreviewStatus('ok', `Preview: ready (${currentTemplate})`);
        console.log('✅ PDF generated successfully');
    } catch (error) {
        console.error('PDF export failed:', error);
        setPreviewStatus('error', 'Preview: export failed');

        alert(`PDF export failed: ${error.message || error}.\n\nUsing print method as a fallback.`);

        window.exportingPDF = false;
        removeExistingPdfClone();
        if (exportBtn) {
            exportBtn.textContent = exportOriginal || '🧾 Export PDF (No Headers)';
            exportBtn.disabled = false;
        }
        if (downloadBtn) {
            downloadBtn.textContent = downloadOriginal || '📄 Download PDF';
            downloadBtn.disabled = false;
        }

        await printCV({ skipExportPrompt: true });
        return;
    } finally {
        window.exportingPDF = false;
        removeExistingPdfClone();
        if (exportBtn) {
            exportBtn.textContent = exportOriginal || '🧾 Export PDF (No Headers)';
            exportBtn.disabled = false;
        }
        if (downloadBtn) {
            downloadBtn.textContent = downloadOriginal || '📄 Download PDF';
            downloadBtn.disabled = false;
        }
    }
}

// Template System
let currentTemplate = 'classic';

function changeTemplate() {
    const templateSelect = document.getElementById('templateSelect');
    if (templateSelect) {
        currentTemplate = templateSelect.value;
        console.log('🔄 Template changed to:', currentTemplate);
        console.log('🎨 Template class will be:', `template-${currentTemplate}`);
    }
    updatePreview();
}

function getTemplateClass() {
    return `template-${currentTemplate}`;
}

// Template styles are preloaded from the active stylesheets so exports match the live preview

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

function analyzeAtsReadiness({ fullName, jobTitle, contactInfo, rawContent, highlights }) {
    const insights = [];

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phoneRegex = /\+?[\d][\d\s\-\(\)]{6,}\d/;
    const urlRegex = /(https?:\/\/|www\.)[\w\-]+(\.[\w\-]+)+/i;

    if (emailRegex.test(contactInfo)) {
        insights.push({ type: 'success', message: 'Email detected – recruiters can reach you easily.' });
    } else {
        insights.push({ type: 'warning', message: 'Add a professional email address in your contact section.' });
    }

    if (phoneRegex.test(contactInfo)) {
        insights.push({ type: 'success', message: 'Phone number found – ATS systems prefer numeric contact details.' });
    } else {
        insights.push({ type: 'info', message: 'Consider adding a phone number unless the role/region discourages it.' });
    }

    if (urlRegex.test(contactInfo)) {
        insights.push({ type: 'success', message: 'Online profile detected – LinkedIn or portfolio links boost credibility.' });
    } else {
        insights.push({ type: 'info', message: 'Add a LinkedIn or portfolio link so hiring teams can explore your work.' });
    }

    if ((rawContent || '').length < 1200) {
        insights.push({ type: 'warning', message: 'Your CV looks short – aim for 450–600 words packed with impact.' });
    }

    if (!/(<li>|^[-*•])/im.test(rawContent)) {
        insights.push({ type: 'warning', message: 'Add bullet points to highlight achievements. ATS scoring favours structured bullets.' });
    }

    if (/(\bimproved\b|\bled\b|\bdesigned\b|\bbuilt\b|\bshipped\b|\bscaled\b|\boptimized\b|\bdelivered\b)/i.test(rawContent)) {
        insights.push({ type: 'success', message: 'Strong action verbs detected – keep emphasising impact.' });
    } else {
        insights.push({ type: 'info', message: 'Use action verbs such as “led”, “delivered”, or “optimized” to describe your work.' });
    }

    if (/\b(I|me|my)\b/i.test(rawContent)) {
        insights.push({ type: 'warning', message: 'First-person wording detected. Switch to professional, action-led statements.' });
    }

    const metricRegex = /(\b\d+%\b|\b\d+[\d,]*\b|\b\d+\s?(?:k|m|bn)\b)/i;
    if (metricRegex.test(rawContent) || metricRegex.test(highlights)) {
        insights.push({ type: 'success', message: 'Metrics detected – quantifying results helps you stand out.' });
    } else {
        insights.push({ type: 'info', message: 'Add measurable outcomes (%, revenue, growth, team size) to boost credibility.' });
    }

    if (!jobTitle || jobTitle.length < 3) {
        insights.push({ type: 'warning', message: 'Add a clear target job title so recruiters instantly know your focus.' });
    }

    if (!fullName || fullName.trim().split(/\s+/).length < 2) {
        insights.push({ type: 'info', message: 'Use your full name (first and last) for a polished header.' });
    }

    return insights;
}

function updateAtsInsights(data) {
    const panel = document.getElementById('atsInsights');
    if (!panel) return;

    const insights = analyzeAtsReadiness(data);
    if (!insights.length) {
        panel.innerHTML = '<div class="ats-insight info">Start adding your experience to see tailored ATS tips.</div>';
        return;
    }

    const items = insights.map(item => `<div class="ats-insight ${item.type}">${item.message}</div>`).join('');
    panel.innerHTML = items;
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
    .ats-strict .cv-header-section, .ats-strict .cv-info-bar, .ats-strict .cv-header-card, .ats-strict .cv-left-panel, .ats-strict .cv-hero-section,
    .ats-strict .product-lead, .ats-strict .product-lead-summary, .ats-strict .product-lead-content,
    .ats-strict .ats-essentials { background: transparent !important; border: none !important; }
    .ats-strict .compact-content { columns: 1 !important; column-count: 1 !important; }
    .ats-strict .product-lead-body { grid-template-columns: 1fr !important; }
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

// Download helpers
function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function collectCvHtml() {
    // Ensure preview is current
    updatePreview();
    const wrapper = document.createElement('div');
    const classes = `cv ${getTemplateClass()}${atsStrict ? ' ats-strict' : ''}`;
    wrapper.innerHTML = `<div class="${classes}">${document.getElementById('cvPreview').innerHTML}</div>`;
    return wrapper.innerHTML;
}

function downloadAsHTML() {
    const fullName = (document.getElementById('fullName').value || 'CV').replace(/[^\w\-\s]/g, '').trim() || 'CV';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${fullName}</title><link rel="stylesheet" href="styles.css"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${collectCvHtml()}<script src="script.js"></script></body></html>`;
    downloadBlob(html, `${fullName}.html`, 'text/html');
}

function htmlToPlainText(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    // Remove images and decorative elements
    tmp.querySelectorAll('img, style, script').forEach(el => el.remove());
    return (tmp.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
}

function downloadAsText() {
    const fullName = (document.getElementById('fullName').value || 'CV').replace(/[^\w\-\s]/g, '').trim() || 'CV';
    const html = collectCvHtml();
    const text = htmlToPlainText(html);
    downloadBlob(text, `${fullName}.txt`, 'text/plain');
}

// Manual test function for debugging
function manualTest() {
    console.log('=== MANUAL TEST ===');
    console.log('1. Testing cvPreview element...');
    const preview = document.getElementById('cvPreview');
    console.log('   Preview exists:', !!preview);
    if (preview) {
        console.log('   Preview tagName:', preview.tagName);
        console.log('   Preview className:', preview.className);
        console.log('   Preview innerHTML length:', preview.innerHTML.length);
        console.log('   Preview has cv class:', preview.classList.contains('cv'));
    }
    
    console.log('2. Testing debugCVContent...');
    const result = debugCVContent();
    console.log('   debugCVContent result:', result);
    
    console.log('3. Testing currentTemplate...');
    console.log('   currentTemplate:', currentTemplate);
    console.log('   getTemplateClass():', getTemplateClass());
    
    console.log('=== END MANUAL TEST ===');
    return result;
}

// Make functions available globally for debugging
window.manualTest = manualTest;
window.debugCVContent = debugCVContent;
window.updatePreview = updatePreview;
