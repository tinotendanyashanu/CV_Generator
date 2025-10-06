// Global variables
let photoDataUrl = null;

// Track ATS mode
let atsStrict = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Page loaded, initializing CV generator...');
    setPreviewStatus('loading', 'Preview: checking…');
    
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
    console.log('🔄 updatePreview() called - currentTemplate:', currentTemplate);
    setPreviewStatus('loading', 'Preview: refreshing…');
    
    const fullName = document.getElementById('fullName').value || 'Your Name';
    const jobTitle = document.getElementById('jobTitle').value || 'Your Job Title';
    const contactInfo = document.getElementById('contactInfo').value || 'Your contact information';
    const rawCv = document.getElementById('cvContent').value || '';
    const fmtSel = document.getElementById('contentFormat');
    const format = (fmtSel && fmtSel.value) || 'html';
    const cvContent = renderContentByFormat(rawCv, format);
    
    console.log('📝 Form data loaded:', {
        fullName: fullName.substring(0, 20) + '...',
        jobTitle: jobTitle.substring(0, 30) + '...',
        cvContentLength: rawCv.length,
        format: format
    });
    
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
    console.log('🎨 About to generate template HTML...');
    const cvHTML = generateTemplateHTML(fullName, jobTitle, contactHTML, cvContent, highlights);
    console.log('✅ Generated HTML length:', cvHTML ? cvHTML.length : 'null/undefined');
    
    // Inject template styles if not already present
    console.log('🎭 Injecting template styles...');
    injectTemplateStyles();
    
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
    console.log('🏷️ Applied classes to cvPreview:', classes);
    console.log('✅ updatePreview completed successfully');
    setPreviewStatus('ok', `Preview: ready (${currentTemplate})`);
}

// Inject template styles into the page head
function injectTemplateStyles() {
    const existingStyle = document.getElementById('template-styles');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    const style = document.createElement('style');
    style.id = 'template-styles';
    style.textContent = getTemplateStyles();
    document.head.appendChild(style);
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
    console.log('generateTemplateHTML called with template:', currentTemplate);
    
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
            console.log('Generating creative template...');
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
        case 'silver':
            return generateSilverTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'neon-tech':
            return generateNeonTechTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'luxury-gold':
            return generateLuxuryGoldTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'gradient-wave':
            return generateGradientWaveTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'watermark-pro':
            return generateWatermarkProTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'minimal-glass':
            return generateMinimalGlassTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'bold-geometric':
            return generateBoldGeometricTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        case 'artistic-portfolio':
            return generateArtisticPortfolioTemplate(fullName, jobTitle, contactHTML, cvContent, photoSection, highlights);
        default:
            console.warn('Unknown template, falling back to classic:', currentTemplate);
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
function printCV() {
    // iPhone detection and routing
    const isiPhone = /iPhone|iPod/.test(navigator.userAgent);
    if (isiPhone) {
        const useExport = confirm('iPhone detected!\n\nSafari print often adds headers/footers with URL and date.\n\nClick OK to use Export PDF (no headers) instead.\nClick Cancel to continue with print anyway.');
        if (useExport) {
            exportPDF();
            return;
        }
    }
    
    const cvContent = document.getElementById('cvPreview').innerHTML;
    const fullName = document.getElementById('fullName').value || 'CV';
    const scaleSel = document.getElementById('printScale');
    const scaleVal = scaleSel ? parseInt(scaleSel.value, 10) : 100;
    
    try { 
        localStorage.setItem('printScale', String(scaleVal)); 
    } catch (e) {}
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Popup blocked! Please allow popups for this site and try again.');
        return;
    }
    
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
                    line-height: 1.4; 
                    color: #1f2937; 
                    background: white;
                    margin: 0;
                    padding: 0;
                }
                
                /* Print-specific styles */
                @page {
                    size: A4 portrait;
                    margin: 0.25in 0.3in;
                    /* Completely hide browser headers/footers */
                    @top-left { content: ""; }
                    @top-center { content: ""; }  
                    @top-right { content: ""; }
                    @bottom-left { content: ""; }
                    @bottom-center { content: ""; }
                    @bottom-right { content: ""; }
                }
                
                @media print {
                    body { 
                        margin: 0 !important; 
                        padding: 0 !important;
                        font-size: 11px !important;
                        line-height: 1.35 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    
                    /* Force exact color printing */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    
                    /* Hide browser print elements */
                    @page :first {
                        margin-top: 0;
                        @top-left { content: ""; }
                        @top-center { content: ""; }
                        @top-right { content: ""; }
                        @bottom-left { content: ""; }
                        @bottom-center { content: ""; }
                        @bottom-right { content: ""; }
                    }
                    
                    /* iPhone-specific header layout fixes */
                    @supports (-webkit-touch-callout: none) {
                        .cv-header,
                        .cv-header-section,
                        .cv-header-card,
                        .cv-header-compact {
                            display: block !important;
                            text-align: center !important;
                        }
                        
                        .cv-photo {
                            margin: 10px auto !important;
                            display: block !important;
                        }
                        
                        .cv-name,
                        .cv-title,
                        .cv-contact {
                            text-align: center !important;
                            margin-left: auto !important;
                            margin-right: auto !important;
                        }
                    }
                }
                
                .cv { 
                    max-width: 100%;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                }
                
                /* Photo stays circular and contained - CRITICAL FIX */
                .cv-photo { 
                    width: 90px !important; 
                    height: 90px !important; 
                    border-radius: 50% !important; 
                    overflow: hidden !important;
                    border: 2px solid #e5e7eb !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    flex-shrink: 0 !important;
                    background: #f9fafb !important;
                    position: relative !important;
                }
                
                .cv-photo img { 
                    width: 100% !important; 
                    height: 100% !important; 
                    object-fit: cover !important;
                    object-position: center !important;
                    border-radius: 50% !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                }
                
                /* Header layouts that don't break */
                .cv-header { 
                    display: flex; 
                    align-items: center; 
                    gap: 15px; 
                    padding-bottom: 12px; 
                    margin-bottom: 15px; 
                    border-bottom: 2px solid #e5e7eb; 
                    page-break-inside: avoid;
                    page-break-after: auto;
                }
                
                .cv-name { 
                    font-size: 22px; 
                    font-weight: 700; 
                    margin-bottom: 4px; 
                    color: #1f2937;
                }
                
                .cv-title { 
                    font-size: 13px; 
                    font-weight: 500; 
                    color: #2563eb; 
                    margin-bottom: 8px; 
                }
                
                .cv-contact { 
                    font-size: 11px; 
                    color: #6b7280; 
                    line-height: 1.4;
                }
                
                .cv-contact a { 
                    color: #2563eb; 
                    text-decoration: none; 
                }
                
                /* Section spacing optimized for fewer pages */
                .cv-section {
                    margin-bottom: 12px;
                    page-break-inside: auto;
                }
                
                .cv h3 { 
                    font-size: 13px; 
                    font-weight: 700; 
                    color: #374151; 
                    margin: 12px 0 6px 0; 
                    text-transform: uppercase; 
                    letter-spacing: 0.5px;
                    border-bottom: 2px solid #2563eb; 
                    padding-bottom: 2px; 
                    display: inline-block; 
                    page-break-after: avoid;
                }
                
                .cv p { margin: 6px 0; }
                .cv ul { margin: 6px 0 6px 16px; }
                .cv li { margin: 2px 0; }
                .cv hr { margin: 8px 0; }
                
                /* Keep critical blocks together */
                .cv-job,
                .education-item,
                .cert-list li {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                
                /* Allow sections to break to reduce page gaps */
                .cv-section,
                .cv-content,
                .cards-content,
                .infographic-content,
                .compact-content,
                .timeline-content {
                    page-break-inside: auto;
                    break-inside: auto;
                }
                
                /* Template Styles */
                ${getTemplateStyles()}
                
                /* ATS Strict Styles */
                ${getAtsStrictStyles()}
            </style>
        </head>
        <body>
            <div class="cv ${getTemplateClass()}${atsStrict ? ' ats-strict' : ''}" id="printRoot">${cvContent}</div>
            <script>
                window.onload = function() {
                    try {
                        var scalePercent = ${scaleVal};
                        var root = document.getElementById('printRoot');
                        if (root && scalePercent && scalePercent !== 100) {
                            var factor = scalePercent / 100;
                            root.style.transformOrigin = 'top left';
                            root.style.transform = 'scale(' + factor + ')';
                            root.style.width = (100 / factor) + '%';
                        }
                    } catch (e) {
                        console.log('Scale error:', e);
                    }
                    
                    // Auto-print after brief delay
                    setTimeout(function() {
                        window.print();
                    }, 800);
                };
                
                window.onafterprint = function() {
                    setTimeout(function() {
                        window.close();
                    }, 1000);
                };
            </script>
        </body>
        </html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
}

function downloadPDF() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
        // iOS: Prefer HTML export to avoid Safari print metadata headers/footers
        exportPDF();
    } else {
        alert('📱 For best results on all devices:\n\n1. Use the "Print CV" button\n2. In print dialog, choose "Save as PDF"\n3. Your PDF will be saved to Downloads\n\nThis method works reliably on all devices including iPhone and iPad!');
        printCV();
    }
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
function downloadPDF() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid;
    
    if (isIOS) {
        // iOS: Always prefer Export PDF to avoid Safari metadata
        exportPDF();
        return;
    }
    
    if (isAndroid) {
        // Android: Show brief instruction then export
        const useExport = confirm('For best results on Android:\n\n• Click OK to use direct PDF export (recommended)\n• Click Cancel to use print method\n\nDirect export avoids browser headers/footers.');
        if (useExport) {
            exportPDF();
        } else {
            printCV();
        }
        return;
    }
    
    // Desktop: Show options
    const message = `Choose your preferred PDF method:\n\n✅ Export PDF (Recommended)\n• No browser headers/footers\n• Clean, professional output\n• Works offline after first load\n\n📄 Print to PDF (Alternative)\n• Uses browser print dialog\n• Turn OFF "Headers and footers"\n• Use scale control for fewer pages`;
    
    if (confirm(message + '\n\nClick OK for Export PDF, Cancel for Print method')) {
        exportPDF();
    } else {
        printCV();
    }
}

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
        document.head.appendChild(s);
    });
    
    // Try local file first (works offline)
    let ok = await load('./html2pdf.bundle.min.js');
    
    // If local fails, try CDN (requires internet)
    if (!ok || !window.html2pdf) {
        console.log('Local PDF engine not found, trying CDN...');
        ok = await load('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
    }
    
    ensureHtml2PdfLoaded._loading = false;
    const engineReady = !!window.html2pdf;
    setPdfEngineStatus(engineReady, engineReady ? 'ready' : 'failed');
    
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
    
    console.log('=== CV DEBUG INFO ===');
    console.log('Preview element exists:', !!preview);
    console.log('Preview innerHTML length:', preview ? preview.innerHTML.length : 0);
    console.log('Preview has cv class:', preview ? preview.classList.contains('cv') : false);
    console.log('CV element exists:', !!cvElement);
    console.log('CV element classes:', cvElement ? cvElement.className : 'N/A');
    console.log('Template class:', getTemplateClass());
    console.log('Current template:', currentTemplate);
    console.log('ATS strict:', atsStrict);
    
    if (cvElement && cvElement.innerHTML.trim()) {
        console.log('CV content preview (first 200 chars):', cvElement.innerHTML.substring(0, 200));
        console.log('✅ CV content found and valid');
        setPreviewStatus('ok', `Preview: ready (${currentTemplate})`);
        return true;
    } else {
        console.log('❌ No valid CV content found');
        setPreviewStatus('error', 'Preview: no content detected');
        return false;
    }
}

        // Enhanced PDF export with better error handling and device detection
            async function exportPDF() {
                try {
                    // Set PDF export flag for CSS adjustments
                    window.exportingPDF = true;
                    
                    // First, ensure we have content
                    updatePreview();
                    
                    // Wait for styles to be injected
                    await new Promise(resolve => setTimeout(resolve, 200));
                
                    // Debug the CV content
                    const hasContent = debugCVContent();
                    if (!hasContent) {
                        setPreviewStatus('error', 'Preview: no content detected');
                        alert('Error: No CV content found. Please make sure the preview is showing your CV and try again.');
                        return;
                    }
                
                    const fullName = (document.getElementById('fullName').value || 'CV').replace(/[^\w\-\s]/g, '').trim();
                    const source = document.getElementById('cvPreview');
                    if (!source || !source.innerHTML.trim()) {
                        setPreviewStatus('error', 'Preview: empty after update');
                        alert('Error: CV preview is empty. Please add some content and try again.');
                        return;
                    }
                
                    // Show loading indicator
                    const exportBtn = document.getElementById('exportBtn');
                    const originalText = exportBtn ? exportBtn.textContent : '🧾 Export PDF (No Headers)';
                    if (exportBtn) exportBtn.textContent = 'Generating PDF...';
                
                    let ok = await ensureHtml2PdfLoaded();
                    if (!ok) {
                        // Retry once after small delay (SW might still be installing/caching)
                        await new Promise(r=>setTimeout(r,1000));
                        ok = await ensureHtml2PdfLoaded();
                    }
                    if (!ok) {
                        // Final fallback to print method
                        if (exportBtn) exportBtn.textContent = originalText;
                        alert('PDF engine unavailable. Using print method instead...');
                        printCV();
                        return;
                    }
                
                    // Get the current CV content with all styling
                    // The cvPreview element itself has the .cv class
                    const cvElement = source.classList.contains('cv') ? source : source.querySelector('.cv');
                    if (!cvElement) {
                        console.error('CV element not found. Source element:', source);
                        console.error('Source classList:', source ? source.classList.toString() : 'N/A');
                        setPreviewStatus('error', 'Preview: template missing');
                        alert('Error: CV template not found. Please refresh and try again.');
                        if (exportBtn) exportBtn.textContent = originalText;
                        return;
                    }
                
                    console.log('Found CV element:', cvElement.tagName, cvElement.className);
                
                    // Clone the CV element directly for PDF generation
                    const cvClone = cvElement.cloneNode(true);
                    
                    // Set styles for PDF capture
                    cvClone.style.position = 'absolute';
                    cvClone.style.top = '-9999px';
                    cvClone.style.left = '0';
                    cvClone.style.width = '210mm';
                    cvClone.style.minHeight = '297mm';
                    cvClone.style.background = 'white';
                    cvClone.style.padding = '15mm';
                    cvClone.style.boxSizing = 'border-box';
                    cvClone.style.opacity = '1';
                    cvClone.style.visibility = 'visible';
                    cvClone.style.zIndex = '-1';
                    cvClone.style.pointerEvents = 'none';
                    cvClone.style.display = 'block';
                    cvClone.style.overflow = 'visible';
                    
                    // Fix specific styling issues for PDF
                    cvClone.style.transform = 'none';
                    cvClone.style.filter = 'none';
                    cvClone.style.backdropFilter = 'none';
                    
                    // Ensure all child elements are visible and properly styled for PDF
                    const allElements = cvClone.querySelectorAll('*');
                    allElements.forEach(el => {
                        // Fix common PDF rendering issues
                        const computedStyle = window.getComputedStyle(el);
                        if (computedStyle.position === 'fixed') {
                            el.style.position = 'absolute';
                        }
                        if (computedStyle.transform && computedStyle.transform !== 'none') {
                            el.style.transform = 'none';
                        }
                        if (computedStyle.filter && computedStyle.filter !== 'none') {
                            el.style.filter = 'none';
                        }
                        if (computedStyle.backdropFilter && computedStyle.backdropFilter !== 'none') {
                            el.style.backdropFilter = 'none';
                            // Replace backdrop blur with solid background
                            if (el.style.background.includes('rgba')) {
                                el.style.background = 'rgba(255, 255, 255, 0.95)';
                            }
                        }
                        // Ensure text is visible
                        if (computedStyle.opacity === '0') {
                            el.style.opacity = '1';
                        }
                        if (computedStyle.visibility === 'hidden') {
                            el.style.visibility = 'visible';
                        }
                    });
                    
                    setPreviewStatus('ok', `Preview: ready (${currentTemplate})`);
                    document.body.appendChild(cvClone);
                    console.log('CV clone appended to body, dimensions:', cvClone.offsetWidth, 'x', cvClone.offsetHeight);
                
                    console.log('PDF content prepared, element length:', cvClone.innerHTML.length);
                
                    // Wait for any images to load
                    const images = cvClone.querySelectorAll('img');
                    if (images.length > 0) {
                        console.log('Loading', images.length, 'images...');
                        await Promise.all(Array.from(images).map(img => {
                            if (img.complete) return Promise.resolve();
                            return new Promise(resolve => {
                                img.onload = resolve;
                                img.onerror = resolve;
                                setTimeout(resolve, 2000); // timeout fallback
                            });
                        }));
                        console.log('Images loaded');
                    }
                
                    // Wait for layout to stabilize
                    await new Promise(resolve => setTimeout(resolve, 500));
                
                    const opt = {
                        margin:       [5, 5, 5, 5], // Reduced margins for more content space
                        filename:     `${fullName || 'CV'}.pdf`,
                        image:        { type: 'jpeg', quality: 0.98 },
                        html2canvas:  {
                            scale: 3, // Higher scale for better quality
                            useCORS: true,
                            backgroundColor: '#ffffff',
                            logging: false,
                            allowTaint: true,
                            foreignObjectRendering: true,
                            letterRendering: true,
                            width: cvClone.offsetWidth,
                            height: cvClone.offsetHeight,
                            scrollX: 0,
                            scrollY: 0,
                            windowWidth: cvClone.offsetWidth,
                            windowHeight: cvClone.offsetHeight
                        },
                        jsPDF:        {
                            unit: 'mm',
                            format: 'a4',
                            orientation: 'portrait',
                            compress: true,
                            precision: 16
                        },
                        pagebreak:    {
                            mode: ['css', 'legacy'],
                            before: '.page-break-before',
                            after: '.page-break-after',
                            avoid: ['.page-break-avoid', '.cv-job', '.education-item', '.neon-tech-header', '.luxury-gold-header', '.gradient-wave-header', '.watermark-pro-header', '.minimal-glass-header', '.bold-geometric-header', '.artistic-portfolio-header']
                        }
                    };
                
                console.log('Generating PDF with html2pdf...', opt);
                
                // Generate the PDF
                await window.html2pdf().set(opt).from(cvClone).save();
                
                console.log('PDF generated successfully!');
        
                // Cleanup
                window.exportingPDF = false;
                document.body.removeChild(cvClone);
                if (exportBtn) exportBtn.textContent = originalText;
                
    } catch (e) {
        console.error('PDF export failed:', e);
        
        // Cleanup flag
        window.exportingPDF = false;
        
        // Cleanup clone if it exists
        try {
            const existingClone = document.querySelector('.cv');
            if (existingClone && existingClone.style.position === 'absolute') {
                document.body.removeChild(existingClone);
            }
        } catch (cleanupError) {
            console.warn('Cleanup failed:', cleanupError);
        }
        
        // Restore button text
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.textContent = '🧾 Export PDF (No Headers)';
        
        // Provide detailed error info
        let errorMsg = 'PDF export failed: ';
        if (e.message) errorMsg += e.message;
        else errorMsg += 'Unknown error occurred';
        
        alert(`${errorMsg}\n\nTrying print method as backup...`);
        printCV();
    }
}

// Template System
let currentTemplate = 'classic';

function changeTemplate() {
    const templateSelect = document.getElementById('templateSelect');
    if (templateSelect) {
        currentTemplate = templateSelect.value;
        console.log('Template changed to:', currentTemplate);
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
            .cv.template-modern .cv-header-section { display: flex; align-items: center; background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; padding: 30px; margin-bottom: 30px; -webkit-print-color-adjust: exact; print-color-adjust: exact; text-shadow: 0 1px 2px rgba(0,0,0,0.1); }
            .cv.template-modern .cv-header-content { flex: 1; }
            .cv.template-modern .cv-name { font-size: 30px; font-weight: 700; margin-bottom: 8px; }
            .cv.template-modern .cv-title { font-size: 16px; opacity: 0.95; margin-bottom: 12px; }
            .cv.template-modern .cv-contact { font-size: 12px; opacity: 0.95; } .cv.template-modern .cv-contact a { color: #bfdbfe; text-decoration: underline; }
            .cv.template-modern .cv-photo { width: 100px; height: 100px; border: 3px solid rgba(255,255,255,0.4); margin-left: 20px; }
            .cv.template-modern .cv-timeline { position: relative; padding-left: 30px; }
            .cv.template-modern .timeline-line { position: absolute; left: 15px; top: 0; bottom: 0; width: 2px; background: #3b82f6; }
            .cv.template-modern .timeline-content h1,
            .cv.template-modern .timeline-content h2,
            .cv.template-modern .timeline-content h3,
            .cv.template-modern .timeline-content h4 { position: relative; background: white; padding: 10px 15px; margin: 0 0 12px 0; border-left: 4px solid #3b82f6; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-radius: 4px; }
            .cv.template-modern .timeline-content h1 { font-size: 18px; font-weight: 700; }
            .cv.template-modern .timeline-content h2 { font-size: 16px; font-weight: 700; }
            .cv.template-modern .timeline-content h3 { font-size: 14px; font-weight: 700; }
            .cv.template-modern .timeline-content h4 { font-size: 13px; font-weight: 600; }
            .cv.template-modern .timeline-content h1:before,
            .cv.template-modern .timeline-content h2:before,
            .cv.template-modern .timeline-content h3:before,
            .cv.template-modern .timeline-content h4:before { content: ""; position: absolute; left: -26px; top: 15px; width: 10px; height: 10px; background: #3b82f6; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 2px #3b82f6; }
            .cv.template-modern .timeline-content hr { border: 0; border-top: 1px solid #e5e7eb; margin: 12px 0; }
            .cv.template-modern .timeline-content ul { margin: 8px 0 8px 16px; }
            .cv.template-modern .timeline-content li { margin: 3px 0; }
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
            .cv.template-tech .cv-hero-section { background: linear-gradient(135deg, #0969da 0%, #21262d 100%); color: white; padding: 30px; -webkit-print-color-adjust: exact; print-color-adjust: exact; text-shadow: 0 1px 2px rgba(0,0,0,0.1); }
            .cv.template-tech .hero-content { display: flex; align-items: center; gap: 20px; }
            .cv.template-tech .hero-text .cv-name { font-size: 26px; font-weight: 700; margin-bottom: 5px; }
            .cv.template-tech .hero-text .cv-title { font-size: 14px; opacity: 0.95; }
            .cv.template-tech .cv-photo { width: 80px; height: 80px; border: 2px solid rgba(255,255,255,0.4); }
            .cv.template-tech .cv-info-bar { background: #21262d; color: #f0f6fc; padding: 12px 30px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .cv.template-tech .cv-info-bar .cv-contact { font-size: 12px; } .cv.template-tech .cv-info-bar .cv-contact a { color: #79c0ff; text-decoration: underline; }
            .cv.template-tech .infographic-content { padding: 20px 30px; }
            .cv.template-tech .infographic-content h3 { background: #dbeafe; color: #0969da; padding: 8px 15px; border-radius: 6px; border: none; margin: 20px 0 12px 0; font-size: 14px; font-weight: 700; }
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
        `,
        'neon-tech': `
            .cv.template-neon-tech { font-family: "Orbitron", "Courier New", monospace; background: #0a0a0a; color: #00ff41; padding: 20px; }
            .cv.template-neon-tech .neon-tech-container { position: relative; }
            .cv.template-neon-tech .neon-tech-header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 30px; margin-bottom: 20px; border: 2px solid #00ff41; box-shadow: 0 0 20px rgba(0, 255, 65, 0.3); }
            .cv.template-neon-tech .neon-tech-grid { display: flex; justify-content: space-between; align-items: center; }
            .cv.template-neon-tech .neon-tech-name { font-size: 32px; font-weight: 900; color: #00ff41; text-shadow: 0 0 10px #00ff41, 0 0 20px #00ff41, 0 0 30px #00ff41; margin-bottom: 8px; }
            .cv.template-neon-tech .neon-tech-title { font-size: 16px; color: #00d4ff; text-shadow: 0 0 5px #00d4ff; margin-bottom: 12px; }
            .cv.template-neon-tech .neon-tech-contact { font-size: 12px; color: #ff6b00; } .cv.template-neon-tech .neon-tech-contact a { color: #ff6b00; text-shadow: 0 0 3px #ff6b00; }
            .cv.template-neon-tech .neon-tech-photo-section .cv-photo { width: 100px; height: 100px; border: 3px solid #00ff41; box-shadow: 0 0 15px rgba(0, 255, 65, 0.5); }
            .cv.template-neon-tech .neon-tech-circuit { height: 2px; background: linear-gradient(90deg, transparent 0%, #00ff41 20%, #00d4ff 50%, #ff6b00 80%, transparent 100%); margin-top: 20px; animation: pulse 2s infinite; }
            .cv.template-neon-tech .neon-tech-body { background: rgba(26, 26, 46, 0.8); padding: 25px; border: 1px solid #00ff41; }
            .cv.template-neon-tech .neon-tech-body h3 { color: #00ff41; text-shadow: 0 0 5px #00ff41; border-bottom: 1px solid #00ff41; padding-bottom: 5px; margin-bottom: 12px; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        `,
        'luxury-gold': `
            .cv.template-luxury-gold { font-family: "Playfair Display", Georgia, serif; background: linear-gradient(135deg, #f8f1e4 0%, #f5e6d3 100%); color: #2c1810; }
            .cv.template-luxury-gold .luxury-gold-container { position: relative; }
            .cv.template-luxury-gold .luxury-gold-header { background: linear-gradient(135deg, #d4af37 0%, #ffd700 50%, #b8860b 100%); padding: 40px; margin-bottom: 25px; position: relative; border: 3px solid #b8860b; }
            .cv.template-luxury-gold .luxury-gold-content { display: flex; justify-content: space-between; align-items: center; }
            .cv.template-luxury-gold .luxury-gold-ornament { position: absolute; top: 10px; left: 10px; width: 30px; height: 30px; background: radial-gradient(circle, #ffd700 0%, #b8860b 100%); border-radius: 50%; }
            .cv.template-luxury-gold .luxury-gold-ornament-right { left: auto; right: 10px; }
            .cv.template-luxury-gold .luxury-gold-name { font-size: 36px; font-weight: 700; color: #2c1810; text-shadow: 1px 1px 2px rgba(255, 215, 0, 0.3); margin-bottom: 8px; }
            .cv.template-luxury-gold .luxury-gold-title { font-size: 18px; color: #2c1810; font-style: italic; margin-bottom: 15px; }
            .cv.template-luxury-gold .luxury-gold-contact { font-size: 14px; color: #2c1810; } .cv.template-luxury-gold .luxury-gold-contact a { color: #8b4513; }
            .cv.template-luxury-gold .luxury-gold-photo-section .cv-photo { width: 120px; height: 120px; border: 4px solid #b8860b; box-shadow: 0 0 20px rgba(184, 134, 11, 0.4); }
            .cv.template-luxury-gold .luxury-gold-body { background: white; padding: 30px; border: 2px solid #d4af37; box-shadow: 0 10px 30px rgba(212, 175, 55, 0.2); }
            .cv.template-luxury-gold .luxury-gold-body h3 { color: #b8860b; border-bottom: 2px solid #d4af37; padding-bottom: 8px; margin-bottom: 15px; font-size: 18px; }
        `,
        'gradient-wave': `
            .cv.template-gradient-wave { font-family: "Inter", -apple-system, sans-serif; color: #1e293b; }
            .cv.template-gradient-wave .gradient-wave-container { position: relative; overflow: hidden; }
            .cv.template-gradient-wave .gradient-wave-header { position: relative; padding: 40px; margin-bottom: 25px; overflow: hidden; }
            .cv.template-gradient-wave .gradient-wave-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%); background-size: 300% 300%; animation: gradientShift 8s ease infinite; }
            .cv.template-gradient-wave .gradient-wave-content { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; }
            .cv.template-gradient-wave .gradient-wave-name { font-size: 34px; font-weight: 800; color: white; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); margin-bottom: 8px; }
            .cv.template-gradient-wave .gradient-wave-title { font-size: 18px; color: rgba(255,255,255,0.95); margin-bottom: 15px; }
            .cv.template-gradient-wave .gradient-wave-contact { font-size: 14px; color: rgba(255,255,255,0.9); } .cv.template-gradient-wave .gradient-wave-contact a { color: white; }
            .cv.template-gradient-wave .gradient-wave-photo-section .cv-photo { width: 110px; height: 110px; border: 4px solid rgba(255,255,255,0.8); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }
            .cv.template-gradient-wave .gradient-wave-body { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
            .cv.template-gradient-wave .gradient-wave-body h3 { background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-bottom: 15px; }
            @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        `,
        'watermark-pro': `
            .cv.template-watermark-pro { font-family: "Roboto", Arial, sans-serif; color: #2d3748; position: relative; }
            .cv.template-watermark-pro .watermark-pro-container { position: relative; }
            .cv.template-watermark-pro .watermark-pro-bg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 300px; font-weight: 900; color: rgba(45, 55, 72, 0.03); z-index: 1; pointer-events: none; user-select: none; }
            .cv.template-watermark-pro .watermark-pro-header { position: relative; z-index: 2; background: linear-gradient(135deg, #edf2f7 0%, #e2e8f0 100%); padding: 35px; margin-bottom: 20px; border-left: 8px solid #4299e1; }
            .cv.template-watermark-pro .watermark-pro-content { display: flex; justify-content: space-between; align-items: center; }
            .cv.template-watermark-pro .watermark-pro-name { font-size: 32px; font-weight: 700; color: #2d3748; margin-bottom: 8px; }
            .cv.template-watermark-pro .watermark-pro-title { font-size: 16px; color: #4a5568; margin-bottom: 15px; }
            .cv.template-watermark-pro .watermark-pro-contact { font-size: 13px; color: #718096; } .cv.template-watermark-pro .watermark-pro-contact a { color: #4299e1; }
            .cv.template-watermark-pro .watermark-pro-photo-section .cv-photo { width: 100px; height: 100px; border: 3px solid #4299e1; }
            .cv.template-watermark-pro .watermark-pro-body { position: relative; z-index: 2; background: white; padding: 30px; border: 1px solid #e2e8f0; }
            .cv.template-watermark-pro .watermark-pro-body h3 { color: #2d3748; border-bottom: 2px solid #4299e1; padding-bottom: 6px; margin-bottom: 15px; }
        `,
        'minimal-glass': `
            .cv.template-minimal-glass { font-family: "SF Pro Display", -apple-system, sans-serif; color: #1a202c; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .cv.template-minimal-glass .minimal-glass-container { padding: 30px; }
            .cv.template-minimal-glass .minimal-glass-header { margin-bottom: 25px; }
            .cv.template-minimal-glass .minimal-glass-frosted { background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 20px; padding: 35px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); }
            .cv.template-minimal-glass .minimal-glass-name { font-size: 30px; font-weight: 600; color: white; margin-bottom: 8px; text-shadow: 0 2px 10px rgba(0,0,0,0.2); }
            .cv.template-minimal-glass .minimal-glass-title { font-size: 16px; color: rgba(255, 255, 255, 0.9); margin-bottom: 15px; }
            .cv.template-minimal-glass .minimal-glass-contact { font-size: 13px; color: rgba(255, 255, 255, 0.8); } .cv.template-minimal-glass .minimal-glass-contact a { color: white; }
            .cv.template-minimal-glass .minimal-glass-photo-section .cv-photo { width: 100px; height: 100px; border: 3px solid rgba(255, 255, 255, 0.6); border-radius: 15px; }
            .cv.template-minimal-glass .minimal-glass-body { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius: 15px; padding: 30px; border: 1px solid rgba(255, 255, 255, 0.3); }
            .cv.template-minimal-glass .minimal-glass-body h3 { color: #4a5568; border-bottom: 2px solid rgba(102, 126, 234, 0.3); padding-bottom: 8px; margin-bottom: 15px; }
        `,
        'bold-geometric': `
            .cv.template-bold-geometric { font-family: "Montserrat", Arial, sans-serif; color: #2d3748; background: #f7fafc; }
            .cv.template-bold-geometric .bold-geometric-container { padding: 25px; }
            .cv.template-bold-geometric .bold-geometric-header { background: white; padding: 35px; margin-bottom: 25px; position: relative; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); overflow: hidden; }
            .cv.template-bold-geometric .bold-geometric-shapes { position: absolute; top: 0; right: 0; display: flex; gap: 10px; padding: 15px; }
            .cv.template-bold-geometric .bold-geometric-shape { width: 40px; height: 40px; }
            .cv.template-bold-geometric .bold-geometric-triangle { background: linear-gradient(135deg, #ff6b6b, #ff8e53); clip-path: polygon(50% 0%, 0% 100%, 100% 100%); }
            .cv.template-bold-geometric .bold-geometric-circle { background: linear-gradient(135deg, #4ecdc4, #44a08d); border-radius: 50%; }
            .cv.template-bold-geometric .bold-geometric-square { background: linear-gradient(135deg, #a8edea, #fed6e3); transform: rotate(45deg); }
            .cv.template-bold-geometric .bold-geometric-name { font-size: 32px; font-weight: 800; color: #2d3748; margin-bottom: 8px; }
            .cv.template-bold-geometric .bold-geometric-title { font-size: 16px; color: #4a5568; margin-bottom: 15px; font-weight: 500; }
            .cv.template-bold-geometric .bold-geometric-contact { font-size: 13px; color: #718096; } .cv.template-bold-geometric .bold-geometric-contact a { color: #4299e1; }
            .cv.template-bold-geometric .bold-geometric-photo-section .cv-photo { width: 100px; height: 100px; border: 4px solid #4ecdc4; border-radius: 15px; }
            .cv.template-bold-geometric .bold-geometric-body { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.08); }
            .cv.template-bold-geometric .bold-geometric-body h3 { color: #2d3748; border-left: 5px solid #4ecdc4; padding-left: 15px; margin-bottom: 15px; background: linear-gradient(90deg, rgba(78, 205, 196, 0.1), transparent); padding: 8px 15px; }
        `,
        'artistic-portfolio': `
            .cv.template-artistic-portfolio { font-family: "Crimson Text", Georgia, serif; color: #2d3748; background: #fffbf7; }
            .cv.template-artistic-portfolio .artistic-portfolio-container { padding: 25px; }
            .cv.template-artistic-portfolio .artistic-portfolio-header { background: white; padding: 40px; margin-bottom: 25px; position: relative; border-radius: 15px; box-shadow: 0 15px 40px rgba(0,0,0,0.1); overflow: hidden; }
            .cv.template-artistic-portfolio .artistic-portfolio-brush-stroke { position: absolute; top: 0; left: 0; right: 0; height: 8px; background: linear-gradient(90deg, #ff6b6b 0%, #ffa726 25%, #42a5f5 50%, #ab47bc 75%, #ef5350 100%); }
            .cv.template-artistic-portfolio .artistic-portfolio-content { display: flex; justify-content: space-between; align-items: center; }
            .cv.template-artistic-portfolio .artistic-portfolio-name { font-size: 36px; font-weight: 700; color: #2d3748; margin-bottom: 8px; }
            .cv.template-artistic-portfolio .artistic-portfolio-title { font-size: 18px; color: #4a5568; margin-bottom: 15px; font-style: italic; }
            .cv.template-artistic-portfolio .artistic-portfolio-contact { font-size: 14px; color: #718096; } .cv.template-artistic-portfolio .artistic-portfolio-contact a { color: #ff6b6b; }
            .cv.template-artistic-portfolio .artistic-portfolio-photo-section .cv-photo { width: 110px; height: 110px; border: 5px solid #ff6b6b; border-radius: 20px; }
            .cv.template-artistic-portfolio .artistic-portfolio-palette { position: absolute; bottom: 15px; right: 15px; display: flex; gap: 8px; }
            .cv.template-artistic-portfolio .artistic-portfolio-color { width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
            .cv.template-artistic-portfolio .artistic-portfolio-color-1 { background: #ff6b6b; }
            .cv.template-artistic-portfolio .artistic-portfolio-color-2 { background: #42a5f5; }
            .cv.template-artistic-portfolio .artistic-portfolio-color-3 { background: #ab47bc; }
            .cv.template-artistic-portfolio .artistic-portfolio-body { background: white; padding: 35px; border-radius: 15px; border: 3px solid #ff6b6b; box-shadow: 0 10px 30px rgba(255, 107, 107, 0.1); }
            .cv.template-artistic-portfolio .artistic-portfolio-body h3 { color: #ff6b6b; border-bottom: 3px solid #ff6b6b; padding-bottom: 8px; margin-bottom: 15px; font-size: 20px; }
        `
    };
    
    // Add PDF-specific CSS overrides
    if (typeof window !== 'undefined' && window.exportingPDF) {
        styles['pdf-fixes'] = `
            /* PDF Export Fixes - Apply to all templates */
            .cv, .cv * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            
            /* Fix backdrop filters for PDF */
            .cv .minimal-glass-frosted,
            .cv .minimal-glass-header,
            .cv .minimal-glass-body {
                backdrop-filter: none !important;
                background: rgba(255, 255, 255, 0.95) !important;
            }
            
            /* Fix transforms for PDF */
            .cv .bold-geometric-square {
                transform: none !important;
                border-radius: 8px !important;
            }
            
            /* Fix animations for PDF */
            .cv * {
                animation: none !important;
                transition: none !important;
            }
            
            /* Fix gradient backgrounds for PDF */
            .cv .gradient-wave-bg {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                animation: none !important;
            }
            
            .cv .bold-geometric-header {
                background: linear-gradient(45deg, #ff6b6b, #4ecdc4) !important;
                animation: none !important;
            }
            
            /* Fix neon effects for PDF */
            .cv .neon-tech-name {
                text-shadow: none !important;
                color: #00ff41 !important;
            }
            
            .cv .neon-tech-circuit {
                animation: none !important;
            }
            
            /* Fix positioning issues */
            .cv .watermark-pro-bg {
                position: absolute !important;
                opacity: 0.05 !important;
            }
            
            /* Ensure proper spacing */
            .cv .cv-section {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            /* Fix photo rendering */
            .cv .cv-photo {
                display: block !important;
                max-width: 100% !important;
                height: auto !important;
            }
            
            /* Fix container layouts */
            .cv .neon-tech-container,
            .cv .luxury-gold-container,
            .cv .gradient-wave-container,
            .cv .watermark-pro-container,
            .cv .minimal-glass-container,
            .cv .bold-geometric-container,
            .cv .artistic-portfolio-container {
                position: relative !important;
                overflow: visible !important;
            }
        `;
        return styles[currentTemplate] + styles['pdf-fixes'];
    }
    
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
