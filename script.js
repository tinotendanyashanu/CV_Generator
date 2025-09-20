// Global variables
let photoDataUrl = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updatePreview();
    
    // Auto-update on input changes
    const inputs = ['fullName', 'jobTitle', 'contactInfo', 'cvContent'];
    inputs.forEach(id => {
        const element = document.getElementById(id);
        element.addEventListener('input', debounce(updatePreview, 500));
    });
    
    // Photo upload handler
    const photoUpload = document.getElementById('photoUpload');
    photoUpload.addEventListener('change', handlePhotoUpload);
    
    // iOS-specific functionality
    detectiOSAndSetup();
    
    // Check for PWA install prompt
    setupPWAInstall();
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
    const cvContent = document.getElementById('cvContent').value || '<div class="cv-section"><h3>CV Content</h3><p>Enter your CV content in the editor...</p></div>';
    
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
    
    // Photo HTML
    const photoHTML = photoDataUrl 
        ? `<img src="${photoDataUrl}" alt="Profile photo">` 
        : '📸 Photo';
    
    const cvHTML = `
        <div class="cv-header">
            <div class="cv-info">
                <div class="cv-name">${fullName}</div>
                <div class="cv-title">${jobTitle}</div>
                <div class="cv-contact">${contactHTML}</div>
            </div>
            <div class="cv-photo">
                ${photoHTML}
            </div>
        </div>
        
        ${cvContent}
    `;
    
    document.getElementById('cvPreview').innerHTML = cvHTML;
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
                    margin: 0.5in;
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
                
                /* Print optimizations */
                @media print {
                    body { 
                        margin: 0; 
                        padding: 0;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    
                    .cv {
                        margin: 0;
                        padding: 0;
                    }
                    
                    .cv-header { 
                        flex-direction: row-reverse; 
                        page-break-after: avoid;
                    }
                    
                    .cv-section {
                        page-break-inside: avoid;
                    }
                    
                    .cv h3 {
                        page-break-after: avoid;
                    }
                    
                    /* Ensure colors print */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="cv">${cvContent}</div>
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
        photo: photoDataUrl
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
