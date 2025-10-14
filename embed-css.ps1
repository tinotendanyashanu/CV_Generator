# CSS Embedding Script for CV Website
# This script embeds styles.css directly into index.html to bypass CORS restrictions

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   CSS Embedding Tool for CV Site   " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if files exist
if (!(Test-Path "styles.css")) {
    Write-Host "❌ ERROR: styles.css not found in current directory" -ForegroundColor Red
    Write-Host "Please run this script from: C:\Users\tinot\Desktop\md cvs\cv-website" -ForegroundColor Yellow
    exit 1
}

if (!(Test-Path "index.html")) {
    Write-Host "❌ ERROR: index.html not found in current directory" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found styles.css and index.html" -ForegroundColor Green
Write-Host ""

# Create backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "index.html.backup_$timestamp"
Copy-Item "index.html" $backupFile
Write-Host "✅ Created backup: $backupFile" -ForegroundColor Green

# Read CSS content
Write-Host "📖 Reading styles.css..." -ForegroundColor Cyan
$cssContent = Get-Content "styles.css" -Raw
$cssSize = $cssContent.Length
Write-Host "✅ Loaded CSS: $cssSize characters" -ForegroundColor Green
Write-Host ""

# Read HTML content
$htmlContent = Get-Content "index.html" -Raw

# Check if already embedded
if ($htmlContent -match '<style id="embedded-styles">') {
    Write-Host "⚠️  WARNING: CSS appears to be already embedded" -ForegroundColor Yellow
    $response = Read-Host "Do you want to update it? (y/n)"
    if ($response -ne 'y') {
        Write-Host "Operation cancelled" -ForegroundColor Yellow
        exit 0
    }
    
    # Replace existing embedded CSS
    $pattern = '<style id="embedded-styles">.*?</style>'
    $replacement = "<style id=`"embedded-styles`">`n$cssContent`n</style>"
    $htmlContent = $htmlContent -replace $pattern, $replacement
    Write-Host "✅ Updated embedded CSS" -ForegroundColor Green
}
else {
    # Find and replace the link tag (with or without version parameter)
    if ($htmlContent -match '<link[^>]*href="styles\.css[^"]*"[^>]*>') {
        Write-Host "✅ Found external stylesheet link" -ForegroundColor Green
        $replacement = "<style id=`"embedded-styles`">`n$cssContent`n</style>"
        $htmlContent = $htmlContent -replace '<link[^>]*href="styles\.css[^"]*"[^>]*>', $replacement
        Write-Host "✅ Replaced with embedded styles" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Could not find stylesheet link tag" -ForegroundColor Yellow
        Write-Host "Looking for link tag with href=styles.css" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Adding embedded styles to head section..." -ForegroundColor Cyan
        $replacement = "</head>"
        $newContent = "<style id=`"embedded-styles`">`n$cssContent`n</style>`n</head>"
        $htmlContent = $htmlContent -replace '</head>', $newContent
        Write-Host "✅ Added embedded styles before closing head tag" -ForegroundColor Green
    }
}

# Write updated HTML
Set-Content "index.html" $htmlContent -NoNewline
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "✅ SUCCESS! CSS embedded into HTML" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Statistics:" -ForegroundColor Cyan
Write-Host "   CSS Size: $cssSize characters" -ForegroundColor White
Write-Host "   Backup: $backupFile" -ForegroundColor White
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Refresh your browser (Ctrl+F5)" -ForegroundColor White
Write-Host "   2. Fill in CV data and click Export PDF or Print CV" -ForegroundColor White
Write-Host "   3. Verify that styles are preserved in the output" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: You can now use the CV on file:// protocol!" -ForegroundColor Yellow
Write-Host "   (No need for web server or deployment)" -ForegroundColor Yellow
Write-Host ""
Write-Host "To restore backup: Copy-Item $backupFile index.html" -ForegroundColor Gray
Write-Host ""
