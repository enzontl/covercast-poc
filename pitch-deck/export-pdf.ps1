$ErrorActionPreference = "Stop"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
  $chromePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}

$htmlPath = Resolve-Path "$PSScriptRoot\slides.html"
$pdfOut = Join-Path (Split-Path $PSScriptRoot -Parent) "CoverCast_Pitch_Deck.pdf"
$fileUrl = "file:///" + ($htmlPath.Path -replace "\\", "/")
$tempProfile = Join-Path $env:TEMP ("chrome_pdf_profile_" + [guid]::NewGuid().ToString("N"))

try {
  $argsList = @(
    "--headless=new",
    "--disable-gpu",
    "--user-data-dir=`"$tempProfile`"",
    "--no-pdf-header-footer",
    "--virtual-time-budget=4000",
    "--print-to-pdf=`"$pdfOut`"",
    "`"$fileUrl`""
  )
  $proc = Start-Process -FilePath $chromePath -ArgumentList $argsList -Wait -PassThru -NoNewWindow
  if (-not (Test-Path $pdfOut)) {
    throw "PDF generation failed (exit code $($proc.ExitCode))"
  }
  Write-Host "Exported PDF successfully to: $pdfOut ($((Get-Item $pdfOut).Length) bytes)"
} finally {
  if (Test-Path $tempProfile) {
    Remove-Item -Recurse -Force $tempProfile -ErrorAction SilentlyContinue
  }
}
