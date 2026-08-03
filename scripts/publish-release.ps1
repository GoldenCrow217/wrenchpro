param(
  [string]$Tag = $env:GITHUB_REF_NAME,
  [string]$Repo = $env:GITHUB_REPOSITORY
)

$ErrorActionPreference = 'Stop'

if (-not $Tag) {
  $package = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
  $Tag = "v$($package.version)"
}

if (-not $Repo) {
  $remoteUrl = git config --get remote.origin.url
  if ($remoteUrl -match 'github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)(\.git)?$') {
    $Repo = "$($Matches.owner)/$($Matches.repo)"
  }
}

if (-not $Repo) {
  throw 'Unable to determine GitHub repository. Set GITHUB_REPOSITORY or configure origin.'
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'GitHub CLI (gh) is required to publish release artifacts.'
}

if (-not (Test-Path -LiteralPath 'dist/latest.yml')) {
  throw 'dist/latest.yml was not generated'
}

$manifest = Get-Content -LiteralPath 'dist/latest.yml' -Raw
$installerName = [regex]::Match($manifest, '(?m)^path:\s*(.+\.exe)\s*$').Groups[1].Value.Trim()
if (-not $installerName) {
  throw 'dist/latest.yml does not include an installer path'
}

$installerPath = Join-Path 'dist' $installerName
$blockmapPath = Join-Path 'dist' "$installerName.blockmap"

if (-not (Test-Path -LiteralPath $installerPath)) {
  throw "Installer not found: $installerPath"
}

if (-not (Test-Path -LiteralPath $blockmapPath)) {
  throw "Blockmap not found: $blockmapPath"
}

gh release view $Tag --repo $Repo *> $null
if ($LASTEXITCODE -ne 0) {
  gh release create $Tag --repo $Repo --title "WrenchPro $Tag" --notes "Automated release for $Tag"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create GitHub release $Tag"
  }
}

gh release upload $Tag `
  (Join-Path 'dist' 'latest.yml') `
  $installerPath `
  $blockmapPath `
  --repo $Repo `
  --clobber

if ($LASTEXITCODE -ne 0) {
  throw "Failed to upload release artifacts for $Tag"
}
