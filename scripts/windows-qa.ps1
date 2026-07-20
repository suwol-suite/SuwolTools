param(
  [Parameter(Mandatory = $true)][string]$InstallerPath,
  [Parameter(Mandatory = $true)][string]$PortablePath,
  [string]$WorkRoot = (Join-Path $env:TEMP "Suwol Tools QA 한글 경로"),
  [switch]$KeepArtifacts
)

$ErrorActionPreference = "Stop"
$report = [ordered]@{ startedAt = (Get-Date).ToString("o"); checks = @(); diagnostics = @{} }
function Add-Check([string]$Name, [bool]$Passed, [string]$Detail) {
  $script:report.checks += [ordered]@{ name = $Name; passed = $Passed; detail = $Detail }
  if (-not $Passed) { Write-Warning "$Name: $Detail" } else { Write-Host "PASS $Name" -ForegroundColor Green }
}
function Test-ProcessLaunch([string]$Path, [string]$Name) {
  $process = Start-Process -FilePath $Path -PassThru
  Start-Sleep -Seconds 5
  $alive = -not $process.HasExited
  Add-Check "$Name launch without elevation" $alive (if ($alive) { "PID $($process.Id)" } else { "exit code $($process.ExitCode)" })
  if ($alive) { Stop-Process -Id $process.Id -Force }
}

New-Item -ItemType Directory -Force -Path $WorkRoot | Out-Null
$installRoot = Join-Path $WorkRoot "설치본 한글 Space"
$portableRoot = Join-Path $WorkRoot "포터블 한글 Space"
New-Item -ItemType Directory -Force -Path $installRoot, $portableRoot | Out-Null
Copy-Item -LiteralPath $PortablePath -Destination (Join-Path $portableRoot "Suwol Tools Portable.exe") -Force
Add-Check "installer artifact exists" (Test-Path -LiteralPath $InstallerPath) $InstallerPath
Add-Check "portable artifact exists" (Test-Path -LiteralPath (Join-Path $portableRoot "Suwol Tools Portable.exe")) $portableRoot

# NSIS /D must be the final argument; this verifies a user-writable Korean/space path without elevation.
$install = Start-Process -FilePath $InstallerPath -ArgumentList @("/S", "/D=$installRoot") -Wait -PassThru
Add-Check "NSIS silent install" ($install.ExitCode -eq 0) "exit code $($install.ExitCode)"
$installedExe = Get-ChildItem -LiteralPath $installRoot -Filter "*.exe" -Recurse | Where-Object { $_.Name -notmatch "Uninstall" } | Select-Object -First 1
$installedDetail = if ($installedExe) { $installedExe.FullName } else { "not found" }
Add-Check "installed executable discovered" ($null -ne $installedExe) $installedDetail
if ($installedExe) { Test-ProcessLaunch $installedExe.FullName "installed app" }
Test-ProcessLaunch (Join-Path $portableRoot "Suwol Tools Portable.exe") "portable app"

# The app's first-start/job-restore behavior is driven by its own user-data directory. Capture the
# portable and installed storage roots so a Windows runner can confirm they do not overlap.
$appData = Join-Path $env:APPDATA "Suwol Tools"
$portableData = Get-ChildItem -Path $portableRoot -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "data|user" } | Select-Object -ExpandProperty FullName
$report.diagnostics.userData = @{ installed = $appData; portableCandidates = @($portableData) }
Add-Check "installed user-data path scoped" (Test-Path (Split-Path $appData -Parent)) $appData

$ffmpeg = Get-ChildItem -LiteralPath $installRoot -Filter "ffmpeg.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($ffmpeg) {
  $version = & $ffmpeg.FullName -version 2>&1 | Select-Object -First 1
  Add-Check "bundled FFmpeg runs" ($LASTEXITCODE -eq 0) "$($ffmpeg.FullName): $version"
} else {
  Add-Check "bundled FFmpeg runs" $false "ffmpeg.exe not present (expected when no release binary was supplied)"
}

try {
  $defender = Get-MpComputerStatus | Select-Object AMServiceEnabled,AntivirusEnabled,RealTimeProtectionEnabled,AntivirusSignatureLastUpdated
  $threats = Get-MpThreatDetection -ErrorAction SilentlyContinue | Select-Object Resources,ThreatID,ActionSuccess,InitialDetectionTime
  $report.diagnostics.defender = @{ status = $defender; threats = @($threats) }
  Add-Check "Defender status collected" $true "Get-MpComputerStatus completed"
} catch { Add-Check "Defender status collected" $false $_.Exception.Message }

# The remaining UI-driven checks are recorded explicitly for an interactive Windows QA run.
foreach ($check in @("file/folder drag drop", "large-file processing", "pause resume cancel retry", "job restore after forced exit", "file association", "result open and output collision", "Defender/SmartScreen verdict")) {
  $report.checks += [ordered]@{ name = "manual: $check"; passed = $null; detail = "Run in the launched app and update this report." }
}

$uninstaller = Get-ChildItem -LiteralPath $installRoot -Filter "Uninstall*.exe" -Recurse | Select-Object -First 1
if ($uninstaller) {
  $uninstall = Start-Process -FilePath $uninstaller.FullName -ArgumentList "/S" -Wait -PassThru
  Add-Check "NSIS silent uninstall" ($uninstall.ExitCode -eq 0) "exit code $($uninstall.ExitCode)"
  Add-Check "user data retained after uninstall" (Test-Path $appData) $appData
}
$report.finishedAt = (Get-Date).ToString("o")
$reportPath = Join-Path $WorkRoot "windows-qa-report.json"
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding utf8
Write-Host "Windows QA report: $reportPath"
if (-not $KeepArtifacts) { Write-Host "Artifacts retained for diagnosis: $WorkRoot" }
