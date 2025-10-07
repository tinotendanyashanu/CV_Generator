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
            line-height: 1.4; 
            color: #1f2937; 
            background: white;
            padding: 20px;
        }
        @page {
            size: A4;
            margin: 0.5in;
        }
        @media print {
            body { padding: 0; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .cv { max-width: 100%; margin: 0 auto; }
        .cv h1, .cv h2, .cv h3 { color: #1f2937 !important; margin-bottom: 10px; }
        .cv p, .cv li { margin-bottom: 5px; }
        .cv-section { margin-bottom: 20px; }
        .cv-photo { max-width: 150px; height: auto; border-radius: 8px; }
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