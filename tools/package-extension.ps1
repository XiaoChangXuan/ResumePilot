param(
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ManifestPath = Join-Path $ProjectRoot "manifest.json"
$Manifest = Get-Content $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$Version = $Manifest.version

$DistRoot = Join-Path $ProjectRoot $OutputDir
$WorkRoot = Join-Path $DistRoot "_work"

function Assert-InProject([string]$Path) {
  $resolved = [System.IO.Path]::GetFullPath($Path)
  $root = [System.IO.Path]::GetFullPath($ProjectRoot)
  if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside project: $resolved"
  }
}

Assert-InProject $DistRoot
Assert-InProject $WorkRoot

if (Test-Path $WorkRoot) {
  Remove-Item -LiteralPath $WorkRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $WorkRoot | Out-Null
New-Item -ItemType Directory -Force -Path $DistRoot | Out-Null

$IncludeFiles = @(
  "manifest.json",
  "background.js",
  "content.js",
  "content.css",
  "complex-controls.js",
  "autofill.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "profile.html",
  "profile.css",
  "profile.js",
  "profile-schema.js",
  "resume-parser.mjs",
  "LICENSE",
  "README.md"
)

$IncludeDirs = @(
  "icons",
  "libs"
)

function Copy-ReleaseFile([string]$RelativePath, [string]$TargetRoot) {
  $source = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $source)) {
    throw "Missing release file: $RelativePath"
  }
  $target = Join-Path $TargetRoot $RelativePath
  $parent = Split-Path $target -Parent
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
}

function Copy-ReleaseDir([string]$RelativePath, [string]$TargetRoot) {
  $source = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $source)) {
    throw "Missing release directory: $RelativePath"
  }
  $target = Join-Path $TargetRoot $RelativePath
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  Copy-Item -Path (Join-Path $source "*") -Destination $target -Recurse -Force
}

function New-ReleasePackage([string]$Browser) {
  $packageName = "resumepilot-$Browser-v$Version"
  $packageRoot = Join-Path $WorkRoot $packageName
  $zipPath = Join-Path $DistRoot "$packageName.zip"

  New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

  foreach ($file in $IncludeFiles) {
    Copy-ReleaseFile $file $packageRoot
  }
  foreach ($dir in $IncludeDirs) {
    Copy-ReleaseDir $dir $packageRoot
  }

  if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }
  Compress-Archive -Path (Join-Path $packageRoot "*") -DestinationPath $zipPath -Force

  $zipItem = Get-Item $zipPath
  [PSCustomObject]@{
    Browser = $Browser
    Version = $Version
    Zip = $zipItem.FullName
    SizeKB = [Math]::Round($zipItem.Length / 1KB, 1)
  }
}

$packages = @(
  New-ReleasePackage "chrome"
  New-ReleasePackage "edge"
)

Remove-Item -LiteralPath $WorkRoot -Recurse -Force

foreach ($package in $packages) {
  Write-Output ("{0} v{1}: {2} KB - {3}" -f $package.Browser, $package.Version, $package.SizeKB, $package.Zip)
}
