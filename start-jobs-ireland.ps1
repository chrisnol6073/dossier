# Starts Jobs Ireland with Docker Desktop, checking each step.
# Run it from this folder in PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\start-jobs-ireland.ps1
Set-Location $PSScriptRoot

function Step($number, $text) { Write-Host ""; Write-Host "[$number/6] $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host ""; Write-Host $text -ForegroundColor Red; Write-Host "Copy everything in red above and send it to Claude." -ForegroundColor Red; exit 1 }

Step 1 "Is Docker Desktop running?"
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker Desktop isn't running. Start it from the Start menu, wait until it shows 'Engine running', then run this again." }
Write-Host "Yes." -ForegroundColor Green

Step 2 "Is the settings file (.env) here?"
if (-not (Test-Path ".env")) { Fail "There's no .env file in $PWD." }
$settings = Get-Content ".env" -Raw
$vault = [regex]::Match($settings, "(?m)^JOBS_IRELAND_VAULT_PATH=(.+?)\r?$").Groups[1].Value
if ($vault -and -not (Test-Path $vault)) { Fail "The Obsidian vault folder in .env doesn't exist: $vault" }
Write-Host "Yes. Vault: $vault" -ForegroundColor Green

Step 3 "Building Jobs Ireland (5-10 minutes the first time)..."
docker compose build app
if ($LASTEXITCODE -ne 0) { Fail "The build failed." }
Write-Host "Built." -ForegroundColor Green

Step 4 "Is your sign-in password set?"
if ($settings -notmatch "(?m)^JOBS_IRELAND_PASSWORD=argon2id:") {
  $first = Read-Host "Choose a password for Jobs Ireland" -AsSecureString
  $second = Read-Host "Type it again" -AsSecureString
  $plain1 = [System.Net.NetworkCredential]::new("", $first).Password
  $plain2 = [System.Net.NetworkCredential]::new("", $second).Password
  if ($plain1 -ne $plain2) { Fail "The two passwords didn't match. Run this again." }
  $hash = ($plain1 | docker run --rm -i dossier-europe:local hash-password 2>$null | Select-String "^argon2id:").Line
  if (-not $hash) { Fail "Couldn't make the password hash." }
  $settings = [regex]::Replace($settings, "(?m)^JOBS_IRELAND_PASSWORD=.*$", "JOBS_IRELAND_PASSWORD=$hash")
  Set-Content ".env" $settings -NoNewline -Encoding ascii
  Write-Host "Saved in .env (only the hash, never the password)." -ForegroundColor Green
} else {
  Write-Host "Yes." -ForegroundColor Green
}

Step 5 "Starting Jobs Ireland and its database..."
docker compose up -d
if ($LASTEXITCODE -ne 0) { Fail "It didn't start." }

Step 6 "Waiting for http://localhost:3001 to answer (up to 2 minutes)..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  try { Invoke-WebRequest "http://localhost:3001/login" -UseBasicParsing -TimeoutSec 3 | Out-Null; $ready = $true; break } catch { Start-Sleep -Seconds 2 }
}
if (-not $ready) {
  docker compose logs app --tail 40
  Fail "Jobs Ireland didn't answer. Its last log lines are above."
}
Write-Host "Jobs Ireland is running. Opening it in your browser..." -ForegroundColor Green
Start-Process "http://localhost:3001"
