/**
 * GitHub Pages Deployment Fixes
 * This file contains specific fixes for GitHub Pages deployment issues
 */

// GitHub Pages Export Fix - Override export functions
(function() {
    'use strict';
    
    console.log('🚀 Loading GitHub Pages fixes...');
    
    // Check if we're on GitHub Pages
    const isGitHubPages = window.location.hostname.includes('github.io') || 
                         window.location.hostname.includes('github.com');
    
    if (!isGitHubPages) {
        console.log('Not GitHub Pages - skipping deployment fixes');
        return;
    }
    
    console.log('✅ GitHub Pages detected - applying fixes');
    
    // Wait for main script to load
    function waitForMainScript() {
        return new Promise((resolve) => {
            if (window.updatePreview && window.printCV) {
                resolve();
                return;
            }
            
            const checkInterval = setInterval(() => {
                if (window.updatePreview && window.printCV) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 10000);
        });
    }
    
    // Override export function for GitHub Pages
    function createGitHubPagesExportFunction() {
        console.log('🔧 Creating GitHub Pages export function');
        
        window.githubPagesExportPDF = function() {
            console.log('🎯 GitHub Pages Export: Starting...');
            
            // Force update preview first
            if (window.updatePreview) {
                window.updatePreview();
            }
            
            // Wait for content then use print method
            setTimeout(() => {
                const cvPreview = document.getElementById('cvPreview');
                if (!cvPreview || !cvPreview.innerHTML.trim()) {
                    alert('❌ Error: CV preview is empty.\n\nPlease:\n1. Fill in your details\n2. Wait for preview to load\n3. Try again');
                    return;
                }
                
                console.log('✅ Content validated, using print method');
                alert('🚀 GitHub Pages Export\n\nUsing print method for reliable PDF generation.\nChoose "Save as PDF" in the print dialog.');
                
                if (window.printCV) {
                    window.printCV();
                } else {
                    // Fallback print method
                    window.print();
                }
            }, 500);
        };
        
        // Override the main export function
        window.exportPDF = window.githubPagesExportPDF;
        window.downloadPDF = window.githubPagesExportPDF;
    }
    
    // Override print function for GitHub Pages
    function createGitHubPagesPrintFunction() {
        console.log('🔧 Creating GitHub Pages print function');
        
        window.githubPagesPrintCV = function() {
            console.log('🖨️ GitHub Pages Print: Starting...');
            
            // Force update preview
            if (window.updatePreview) {
                window.updatePreview();
            }
            
            setTimeout(() => {
                const cvPreview = document.getElementById('cvPreview');
                if (!cvPreview) {
                    alert('❌ Error: CV preview not found. Please refresh and try again.');
                    return;
                }
                
                const cvContent = cvPreview.innerHTML;
                if (!cvContent || cvContent.trim().length < 50) {
                    alert('❌ Error: CV content is empty.\n\nPlease:\n1. Fill in your information\n2. Ensure preview shows your CV\n3. Try again');
                    return;
                }
                
                console.log('✅ CV content validated:', cvContent.length, 'characters');
                
                // Create enhanced print window for GitHub Pages
                const printWindow = window.open('', '_blank', 'width=800,height=600');
                if (!printWindow) {
                    alert('❌ Popup blocked!\n\nPlease:\n1. Allow popups for this site\n2. Try again');
                    return;
                }
                
                const fullName = (document.getElementById('fullName')?.value || 'CV').trim();
                
                const printHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>CV - ${fullName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            line-height: 1.6; 
            color: #1f2937; 
            background: white;
            padding: 15px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        @page { size: A4; margin: 0.4in 0.5in; }
        @media print {
            body { padding: 0; font-size: 11px; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        
        /* Complete CV Template Styles */
        .cv { max-width: 100%; font-family: inherit; line-height: 1.6; color: #1f2937; }
        .cv * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .cv-header { display: flex; align-items: center; gap: 20px; padding-bottom: 15px; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; flex-direction: row-reverse; }
        .cv-header.no-photo { flex-direction: column; align-items: flex-start; gap: 0; }
        .cv-info { flex: 1; }
        .cv-name { font-size: 24px; font-weight: 700; margin-bottom: 5px; color: #1f2937; }
        .cv-title { font-size: 16px; font-weight: 600; color: #2563eb; margin-bottom: 10px; }
        .cv-contact { font-size: 13px; color: #6b7280; line-height: 1.4; }
        .cv-contact a { color: #2563eb; text-decoration: none; }
        .cv-photo { width: 100px; height: 100px; border-radius: 8px; object-fit: cover; border: 3px solid #e5e7eb; }
        .cv-section { margin-bottom: 20px; }
        .cv-section h3 { font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb; }
        .cv-section h4 { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 5px; }
        .cv-section p, .cv-section li { font-size: 13px; color: #4b5563; margin-bottom: 5px; line-height: 1.5; }
        .cv-section ul { padding-left: 20px; margin-bottom: 10px; }
        .cv-section li { margin-bottom: 3px; }
        .cv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .timeline-item { margin-bottom: 15px; padding-left: 20px; border-left: 2px solid #e5e7eb; position: relative; }
        .timeline-item::before { content: ''; position: absolute; left: -6px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: #2563eb; }
        .cv-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
        .cv-sidebar { background: #f1f5f9; padding: 20px; border-radius: 8px; }
        .cv-sidebar h3 { color: #1e40af; border-bottom-color: #3b82f6; }
        .cv-header-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
        .cv-header-card .cv-name { color: white; font-size: 26px; }
        .cv-header-card .cv-title { color: rgba(255,255,255,0.9); }
        .cv-header-card .cv-contact { color: rgba(255,255,255,0.8); }
        .glass-header { background: rgba(255, 255, 255, 0.25); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px; padding: 20px; }
        .cv-header, .cv-header-card, .cv-sidebar, .cv-card, .timeline-item, .glass-header, .cv-section { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .cv h1, .cv h2, .cv h3, .cv h4, .cv h5, .cv h6 { color: inherit !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    </style>
</head>
<body>
    <div class="cv">${cvContent}</div>
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.focus();
                window.print();
            }, 500);
        };
    </script>
</body>
</html>`;
                
                printWindow.document.write(printHTML);
                printWindow.document.close();
                
                console.log('✅ Print window created successfully');
            }, 300);
        };
        
        // Override the main print function
        if (window.printCV) {
            window.originalPrintCV = window.printCV;
        }
        window.printCV = window.githubPagesPrintCV;
    }
    
    // Initialize GitHub Pages fixes
    waitForMainScript().then(() => {
        console.log('🎯 Main script loaded, applying GitHub Pages overrides');
        createGitHubPagesExportFunction();
        createGitHubPagesPrintFunction();
        
        // Override button click handlers
        setTimeout(() => {
            const exportBtn = document.getElementById('exportBtn');
            const printBtn = document.getElementById('printBtn');
            
            if (exportBtn) {
                exportBtn.onclick = window.githubPagesExportPDF;
                exportBtn.title = 'Export PDF (GitHub Pages: Uses print method)';
                console.log('✅ Export button override applied');
            }
            
            if (printBtn) {
                printBtn.onclick = window.githubPagesPrintCV;
                printBtn.title = 'Print CV (GitHub Pages optimized)';
                console.log('✅ Print button override applied');
            }
        }, 1000);
    });
    
})();