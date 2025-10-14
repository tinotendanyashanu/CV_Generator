/**
 * UNIVERSAL PDF EXPORT - Works on ALL devices and deployments
 * Uses inline CSS extraction to ensure perfect template rendering
 * Maintains ATS compatibility and template styles
 */

(function() {
    'use strict';

    console.log('🚀 Loading Universal PDF Export...');

    /**
     * Copy computed styles from source to target element
     * Ensures all visual styles are preserved in export
     */
    function copyComputedStyles(sourceElement, targetElement) {
        if (!sourceElement || !targetElement) return;

        const computed = window.getComputedStyle(sourceElement);
        
        // Critical style properties to preserve
        const criticalProps = [
            'color', 'background-color', 'background', 'background-image',
            'border', 'border-color', 'border-width', 'border-style', 'border-radius',
            'font-family', 'font-size', 'font-weight', 'font-style',
            'padding', 'margin', 'width', 'height', 'max-width', 'max-height',
            'display', 'flex', 'flex-direction', 'align-items', 'justify-content',
            'grid-template-columns', 'gap', 'text-align',
            'line-height', 'letter-spacing', 'text-transform',
            'opacity', 'box-shadow', 'text-shadow'
        ];

        criticalProps.forEach(prop => {
            const value = computed.getPropertyValue(prop);
            if (value && value !== 'initial' && value !== 'normal' && value !== 'none') {
                targetElement.style.setProperty(prop, value, 'important');
            }
        });

        // Force color printing
        targetElement.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
        targetElement.style.setProperty('print-color-adjust', 'exact', 'important');
        targetElement.style.setProperty('color-adjust', 'exact', 'important');
    }

    /**
     * Get critical CSS rules directly from stylesheets
     */
    async function getCriticalCSS() {
        let cssText = '';
        let methodUsed = '';

        // Method 1: Extract from CSSOM (works best with file:// protocol)
        try {
            const styleSheets = Array.from(document.styleSheets);
            console.log(`📋 Found ${styleSheets.length} stylesheets in document`);
            
            for (let i = 0; i < styleSheets.length; i++) {
                const sheet = styleSheets[i];
                try {
                    console.log(`  Stylesheet ${i}: href=${sheet.href || 'inline'}`);
                    
                    // Try to access stylesheet rules
                    const rules = Array.from(sheet.cssRules || sheet.rules || []);
                    console.log(`    Rules count: ${rules.length}`);
                    
                    if (rules.length > 0) {
                        const sheetCSS = rules.map(rule => rule.cssText).join('\n');
                        cssText += sheetCSS + '\n';
                        
                        // Check if this is the main styles.css
                        const isMainStylesheet = !sheet.href || sheet.href.includes('styles.css');
                        if (isMainStylesheet && sheetCSS.length > 1000) {
                            methodUsed = 'CSSOM (primary stylesheet)';
                            console.log(`✅ CSS extracted from CSSOM (sheet ${i}): ${sheetCSS.length} chars`);
                        }
                    }
                } catch (e) {
                    // CORS or access error for this sheet, skip it
                    console.warn(`⚠️ Could not access stylesheet ${i} rules:`, e.message);
                }
            }
            
            if (cssText.length > 0) {
                console.log(`✅ Total CSS from CSSOM: ${cssText.length} chars`);
            }
        } catch (e) {
            console.warn('⚠️ CSSOM extraction failed:', e.message);
        }

        // Method 2: Try to fetch if CSSOM didn't work (for HTTP/HTTPS)
        if (!cssText || cssText.length < 1000) {
            try {
                const response = await fetch('./styles.css?v=' + Date.now(), {
                    method: 'GET',
                    cache: 'no-cache'
                });
                if (response.ok) {
                    const fetchedCSS = await response.text();
                    if (fetchedCSS.length > cssText.length) {
                        cssText = fetchedCSS;
                        methodUsed = 'Fetch API';
                        console.log('✅ CSS fetched via API:', cssText.length, 'chars');
                    }
                }
            } catch (e) {
                console.warn('⚠️ CSS fetch failed (expected for file:// protocol):', e.message);
            }
        }

        // Method 3: Collect inline styles as supplement
        document.querySelectorAll('style').forEach(style => {
            const inlineCSS = style.textContent;
            if (inlineCSS && inlineCSS.trim()) {
                cssText += '\n' + inlineCSS;
            }
        });

        // Ensure we have at least basic styles
        if (!cssText || cssText.length < 100) {
            console.warn('⚠️ CSS collection failed, using comprehensive fallback');
            cssText = getMinimalFallbackCSS();
            methodUsed = 'Fallback CSS';
        }

        console.log(`✅ CSS collected (${cssText.length} chars) via ${methodUsed || 'multiple methods'}`);

        // Always add print color enforcement
        cssText += `\n
        /* Force color printing on all elements */
        *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }`;

        return cssText;
    }

    /**
     * Comprehensive fallback CSS if all other methods fail
     */
    function getMinimalFallbackCSS() {
        return `
        /* Base Styles */
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            line-height: 1.6; 
            color: #1f2937;
            margin: 0;
            padding: 0;
        }
        
        /* CV Container */
        .cv { 
            max-width: 100%;
            padding: 30px;
            background: #ffffff;
            margin: 0 auto;
        }
        
        /* Header Styles */
        .cv-header { 
            margin-bottom: 25px;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
            display: flex;
            align-items: flex-start;
            gap: 20px;
        }
        .cv-header.no-photo {
            flex-direction: column;
        }
        .cv-info { flex: 1; }
        .cv-name { 
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 8px 0;
            color: #1f2937;
        }
        .cv-title { 
            font-size: 20px;
            font-weight: 600;
            color: #3b82f6;
            margin: 0 0 12px 0;
        }
        .cv-contact,
        .cv-contact p { 
            font-size: 14px;
            color: #6b7280;
            line-height: 1.8;
            margin: 4px 0;
        }
        .cv-contact a {
            color: #3b82f6;
            text-decoration: none;
        }
        .cv-photo {
            width: 120px;
            height: 120px;
            border-radius: 8px;
            object-fit: cover;
            border: 3px solid #e5e7eb;
            flex-shrink: 0;
        }
        
        /* Section Styles */
        .cv-section { 
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .cv-section h3 { 
            font-size: 20px;
            font-weight: 700;
            color: #1f2937;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 8px;
            margin: 0 0 15px 0;
        }
        .cv-section h4 {
            font-size: 16px;
            font-weight: 600;
            color: #374151;
            margin: 0 0 6px 0;
        }
        .cv-section p {
            font-size: 14px;
            color: #4b5563;
            line-height: 1.6;
            margin: 0 0 10px 0;
        }
        .cv-section ul {
            margin: 0 0 15px 0;
            padding-left: 20px;
        }
        .cv-section li {
            font-size: 14px;
            color: #4b5563;
            line-height: 1.6;
            margin-bottom: 6px;
        }
        
        /* Grid Layout */
        .cv-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 30px;
        }
        
        /* Timeline */
        .timeline-item {
            margin-bottom: 25px;
            padding-left: 20px;
            border-left: 3px solid #3b82f6;
            position: relative;
            page-break-inside: avoid;
        }
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -7px;
            top: 5px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #3b82f6;
            border: 2px solid #ffffff;
        }
        
        /* Cards */
        .cv-card {
            background: #f8fafc;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        
        /* Sidebar */
        .cv-sidebar {
            background: #f1f5f9;
            padding: 20px;
            border-radius: 8px;
        }
        
        /* Highlights */
        .highlights-block {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin-bottom: 25px;
        }
        .highlights-block ul {
            margin: 0;
            padding-left: 20px;
        }
        
        /* Print Specific */
        @media print {
            body { padding: 0; }
            .cv { padding: 15mm; }
            .cv-section { page-break-inside: avoid; }
            .timeline-item { page-break-inside: avoid; }
            .cv-card { page-break-inside: avoid; }
        }
        `;
    }

    /**
     * UNIVERSAL EXPORT PDF - Main function
     * Works with html2pdf.js library
     */
    window.universalExportPDF = async function() {
        if (window.exportingUniversalPDF) {
            console.log('Export already in progress...');
            return;
        }

        window.exportingUniversalPDF = true;
        console.log('📄 Starting Universal PDF Export...');

        const exportBtn = document.getElementById('exportBtn');
        const originalText = exportBtn?.textContent;
        if (exportBtn) {
            exportBtn.textContent = '⏳ Generating PDF...';
            exportBtn.disabled = true;
        }

        try {
            // Update preview first
            if (window.updatePreview) {
                window.updatePreview();
            }
            await new Promise(resolve => setTimeout(resolve, 300));

            const source = document.getElementById('cvPreview');
            if (!source || !source.innerHTML.trim()) {
                throw new Error('CV preview is empty. Please fill in your details.');
            }

            const fullName = document.getElementById('fullName')?.value?.trim() || 'CV';
            const fileName = fullName.replace(/[^a-z0-9_\-]/gi, '_') || 'CV';

            // Check if html2pdf is available
            if (!window.html2pdf) {
                throw new Error('PDF library not loaded. Please refresh the page.');
            }

            // Get critical CSS
            const criticalCSS = await getCriticalCSS();

            // Create a wrapper to isolate the export
            const exportWrapper = document.createElement('div');
            exportWrapper.id = 'pdf-export-wrapper';
            exportWrapper.style.cssText = `
                position: fixed;
                left: -9999px;
                top: 0;
                width: 794px;
                min-height: 1123px;
                background: #ffffff;
                padding: 0;
                margin: 0;
                box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            `;

            // Add CSS to wrapper
            const styleElement = document.createElement('style');
            styleElement.textContent = criticalCSS;
            exportWrapper.appendChild(styleElement);

            // Create export container
            const exportContainer = document.createElement('div');
            exportContainer.className = source.className;
            exportContainer.style.cssText = `
                width: 100%;
                padding: 40px;
                box-sizing: border-box;
                background: #ffffff;
            `;
            exportContainer.innerHTML = source.innerHTML;
            
            exportWrapper.appendChild(exportContainer);
            document.body.appendChild(exportWrapper);

            // Wait for styles to apply
            await new Promise(resolve => setTimeout(resolve, 200));

            // Wait for images to load
            const images = exportWrapper.querySelectorAll('img');
            await Promise.all(Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                    setTimeout(resolve, 2000);
                });
            }));

            // Configure html2pdf options for best quality
            const opt = {
                margin: [10, 10, 10, 10],
                filename: `${fileName}.pdf`,
                image: { 
                    type: 'jpeg', 
                    quality: 0.98 
                },
                html2canvas: {
                    scale: 2.5,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: 794,
                    windowHeight: exportWrapper.scrollHeight,
                    onclone: (clonedDoc) => {
                        // Ensure all elements have color printing enabled
                        const allElements = clonedDoc.querySelectorAll('*');
                        allElements.forEach(el => {
                            el.style.webkitPrintColorAdjust = 'exact';
                            el.style.printColorAdjust = 'exact';
                            el.style.colorAdjust = 'exact';
                        });
                    }
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait',
                    compress: true,
                    precision: 16
                },
                pagebreak: {
                    mode: ['css', 'legacy'],
                    avoid: ['img', '.cv-header', '.cv-section', '.timeline-item', '.cv-card', '.cv-job', '.education-item']
                }
            };

            console.log('🎨 Generating PDF...');
            await window.html2pdf().set(opt).from(exportWrapper).save();

            // Cleanup
            document.body.removeChild(exportWrapper);

            console.log('✅ PDF exported successfully!');
            alert('✅ PDF downloaded successfully!');

        } catch (error) {
            console.error('❌ PDF export failed:', error);
            alert(`PDF export failed: ${error.message}\n\nTrying alternative print method...`);
            
            // Fallback to print
            if (window.universalPrintCV) {
                window.universalPrintCV();
            }
        } finally {
            window.exportingUniversalPDF = false;
            if (exportBtn) {
                exportBtn.textContent = originalText || '📥 Export PDF';
                exportBtn.disabled = false;
            }
        }
    };

    /**
     * UNIVERSAL PRINT CV - Fallback method
     * Opens print dialog with properly styled content
     */
    window.universalPrintCV = async function() {
        console.log('🖨️ Starting Universal Print...');

        try {
            // Update preview
            if (window.updatePreview) {
                window.updatePreview();
            }
            await new Promise(resolve => setTimeout(resolve, 200));

            const source = document.getElementById('cvPreview');
            if (!source || !source.innerHTML.trim()) {
                throw new Error('CV preview is empty.');
            }

            const fullName = document.getElementById('fullName')?.value?.trim() || 'CV';
            const scaleValue = parseInt(document.getElementById('printScale')?.value || '100', 10);

            // Get CSS
            const criticalCSS = await getCriticalCSS();

            // Open print window
            const printWindow = window.open('', '_blank', 'width=900,height=1200');
            if (!printWindow) {
                throw new Error('Popup blocked. Please allow popups and try again.');
            }

            const printHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fullName} - CV</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 12mm;
        }

        *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box;
        }

        html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        body {
            padding: 15mm;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
        }

        ${criticalCSS}

        .cv {
            transform: scale(${scaleValue / 100});
            transform-origin: top left;
            ${scaleValue !== 100 ? `width: ${10000 / scaleValue}%;` : ''}
        }

        @media print {
            body { padding: 0; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
    </style>
</head>
<body>
    <div class="${source.className}">
        ${source.innerHTML}
    </div>
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.focus();
                window.print();
            }, 1000);
        };
        window.onafterprint = function() {
            setTimeout(function() { window.close(); }, 500);
        };
    </script>
</body>
</html>`;

            printWindow.document.write(printHTML);
            printWindow.document.close();

            console.log('✅ Print window opened');

        } catch (error) {
            console.error('❌ Print failed:', error);
            alert(`Print failed: ${error.message}`);
        }
    };

    // Override existing functions
    window.exportPDF = window.universalExportPDF;
    window.printCV = window.universalPrintCV;
    window.downloadPDF = window.universalExportPDF;

    console.log('✅ Universal PDF Export loaded successfully!');
})();
