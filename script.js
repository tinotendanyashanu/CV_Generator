// Global variables
let photoDataUrl = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updatePreview();
    
    // Auto-update on input changes
    const inputs = ['fullName', 'jobTitle', 'contactInfo', 'summary', 'skills', 'experience', 'education'];
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
    const summary = document.getElementById('summary').value || 'Your professional summary';
    const skills = document.getElementById('skills').value || '';
    const experience = document.getElementById('experience').value || '';
    const education = document.getElementById('education').value || '';
    
    // Create skills HTML
    const skillsArray = skills.split(',').map(skill => skill.trim()).filter(skill => skill);
    const skillsHTML = skillsArray.map(skill => `<span class="cv-skill">${skill}</span>`).join('');
    
    // Format contact info (make links clickable)
    const contactHTML = contactInfo
        .replace(/\n/g, '<br>')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>')
        .replace(/linkedin\.com\/in\/([^\s]+)/g, '<a href="https://linkedin.com/in/$1" target="_blank">linkedin.com/in/$1</a>')
        .replace(/github\.com\/([^\s]+)/g, '<a href="https://github.com/$1" target="_blank">github.com/$1</a>')
        .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1">$1</a>');
    
    // Format education (convert markdown-style to HTML)
    const educationHTML = education
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/•/g, '&bull;')
        .replace(/\n/g, '<br>');
    
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
        
        <div class="cv-section">
            <h3>Professional Summary</h3>
            <div class="cv-summary">${summary}</div>
        </div>
        
        ${skillsArray.length > 0 ? `
        <div class="cv-section">
            <h3>Core Skills</h3>
            <div class="cv-skills">${skillsHTML}</div>
        </div>
        ` : ''}
        
        ${experience ? `
        <div class="cv-section">
            <h3>Professional Experience</h3>
            ${experience}
        </div>
        ` : ''}
        
        ${education ? `
        <div class="cv-section">
            <h3>Education & Certifications</h3>
            <div style="line-height: 1.6;">${educationHTML}</div>
        </div>
        ` : ''}
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
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; 
                    margin: 20px; 
                    line-height: 1.6; 
                    color: #1f2937; 
                }
                .cv { 
                    max-width: 800px; 
                    margin: 0 auto; 
                }
                .cv-header { 
                    display: flex; 
                    align-items: center; 
                    gap: 20px; 
                    padding-bottom: 15px; 
                    margin-bottom: 20px; 
                    border-bottom: 2px solid #e5e7eb; 
                    flex-direction: row-reverse; 
                }
                .cv-info { 
                    flex: 1; 
                }
                .cv-name { 
                    font-size: 28px; 
                    font-weight: 700; 
                    margin-bottom: 5px; 
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
                    border-bottom: 2px solid #2563eb; 
                    padding-bottom: 5px; 
                    display: inline-block; 
                }
                .cv-summary { 
                    background: #f8fafc; 
                    padding: 20px; 
                    border-radius: 8px; 
                    border-left: 4px solid #2563eb; 
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
                .cv-job { 
                    margin-bottom: 20px; 
                    padding: 15px; 
                    border-left: 3px solid #10b981; 
                    background: #f9fafb; 
                }
                .cv-job-title { 
                    font-weight: 700; 
                    font-size: 16px; 
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
                @media print { 
                    body { margin: 10px; } 
                    .cv-header { flex-direction: row-reverse; } 
                }
            </style>
        </head>
        <body>
            <div class="cv">${cvContent}</div>
        </body>
        </html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
    printWindow.onload = function() {
        printWindow.print();
    };
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
        document.getElementById('summary').value = '';
        document.getElementById('skills').value = '';
        document.getElementById('experience').value = '';
        document.getElementById('education').value = '';
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
        summary: document.getElementById('summary').value,
        skills: document.getElementById('skills').value,
        experience: document.getElementById('experience').value,
        education: document.getElementById('education').value,
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
        document.getElementById('summary').value = data.summary || '';
        document.getElementById('skills').value = data.skills || '';
        document.getElementById('experience').value = data.experience || '';
        document.getElementById('education').value = data.education || '';
        photoDataUrl = data.photo || null;
        updatePreview();
    }
}

// Save every 10 seconds
setInterval(saveToLocalStorage, 10000);

// Load on page load
document.addEventListener('DOMContentLoaded', loadFromLocalStorage);
