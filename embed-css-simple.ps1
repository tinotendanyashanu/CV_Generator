# Simple CSS Embedding Script
# Embeds styles.css directly into index.html

$ErrorActionPreference = "Stop"

Write-Host "`n====================================="  -ForegroundColor Cyan
Write-Host "   CSS Embedding Tool" -ForegroundColor Cyan
Write-Host "=====================================`n" -ForegroundColor Cyan

# Read CSS
$cssContent = Get-Content "styles.css" -Raw
Write-Host "Loaded CSS: $($cssContent.Length) characters" -ForegroundColor Green

# Create backup
$backup = "index.html.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item "index.html" $backup
Write-Host "Created backup: $backup" -ForegroundColor Green

# Read and modify HTML
$htmlContent = Get-Content "index.html" -Raw

# Replace external link with embedded style
$pattern = '<link[^>]*href="styles\.css[^"]*"[^>]*>'
$replacement = "<style id=`"embedded-styles`">`n$cssContent`n    </style>"

if ($htmlContent -match $pattern) {
    $htmlContent = $htmlContent -replace $pattern, $replacement
    Set-Content "index.html" $htmlContent -NoNewline
    Write-Host "`n✅ SUCCESS! CSS embedded into HTML" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Refresh browser (Ctrl+F5)" -ForegroundColor White
    Write-Host "  2. Test Export PDF and Print CV" -ForegroundColor White
    Write-Host "`n" -ForegroundColor White
} else {
    Write-Host "`n❌ ERROR: Could not find stylesheet link in index.html" -ForegroundColor Red
    Write-Host "Backup preserved: $backup" -ForegroundColor Yellow
}
