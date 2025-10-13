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

        // Method 1: Try to fetch the external stylesheet
        try {
            const response = await fetch('./styles.css?v=' + Date.now(), {
                method: 'GET',
                cache: 'no-cache',
                mode: 'cors'
            });
            if (response.ok) {
                cssText = await response.text();
                console.log('✅ External CSS loaded:', cssText.length, 'chars');
            }
        } catch (e) {
            console.warn('⚠️ External CSS fetch failed:', e.message);
        }

        // Method 2: Extract from linked stylesheets in DOM
        if (!cssText || cssText.length < 100) {
            const styleSheets = Array.from(document.styleSheets);
            for (const sheet of styleSheets) {
                try {
                    if (sheet.href && sheet.href.includes('styles.css')) {
                        const rules = Array.from(sheet.cssRules || sheet.rules || []);
                        cssText += rules.map(rule => rule.cssText).join('\n');
                        console.log('✅ CSS extracted from stylesheet:', cssText.length, 'chars');
                    }
                } catch (e) {
                    console.warn('⚠️ Could not access stylesheet:', e.message);
                }
            }
        }

        // Method 3: Collect inline styles as fallback
        document.querySelectorAll('style').forEach(style => {
            cssText += '\n' + style.textContent;
        });

        // Ensure we have at least basic styles
        if (!cssText || cssText.length < 100) {
            console.warn('⚠️ CSS collection failed, using minimal fallback');
            cssText = getMinimalFallbackCSS();
        }

        // Always add print color enforcement
        cssText += `\n
        *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }`;

        return cssText;
    }

    /**
     * Minimal fallback CSS if all other methods fail
     */
    function getMinimalFallbackCSS() {
        return `
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; }
        .cv { max-width: 100%; padding: 20px; background: #fff; }
        .cv-header { margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; }
        .cv-name { font-size: 28px; font-weight: 700; margin-bottom: 5px; }
        .cv-title { font-size: 18px; color: #2563eb; margin-bottom: 10px; }
        .cv-section { margin-bottom: 20px; }
        .cv-section h3 { font-size: 18px; font-weight: 700; border-bottom: 2px solid #e5e7eb; margin-bottom: 10px; }
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
