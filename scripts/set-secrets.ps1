# Sets the nivo-lite secrets in %USERPROFILE%\.nivo-lite\secrets.env (outside the repo).
# Values are typed hidden and never printed. Press Enter on a prompt to keep the current value.
#   powershell -ExecutionPolicy Bypass -File scripts\set-secrets.ps1
$ErrorActionPreference = "Stop"
$file = Join-Path $env:USERPROFILE ".nivo-lite\secrets.env"
New-Item -ItemType Directory -Force -Path (Split-Path $file) | Out-Null
if (-not (Test-Path $file)) { New-Item -ItemType File -Path $file | Out-Null }

$lines = [System.Collections.Generic.List[string]](Get-Content $file -Encoding UTF8)

function Set-Secret([string]$name, [string]$prompt, [bool]$hidden = $true) {
  if ($hidden) {
    $secure = Read-Host -Prompt "$prompt (Enter = keep)" -AsSecureString
    $value = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  } else {
    $value = Read-Host -Prompt "$prompt (Enter = keep)"
  }
  if ([string]::IsNullOrWhiteSpace($value)) { Write-Host "  $name kept" -ForegroundColor DarkGray; return }
  $index = -1
  for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "^\s*$name\s*=") { $index = $i; break } }
  $entry = "$name=$($value.Trim())"
  if ($index -ge 0) { $lines[$index] = $entry } else { $lines.Add($entry) }
  Write-Host "  $name set" -ForegroundColor Green
}

Write-Host "nivo-lite secrets -> $file" -ForegroundColor Cyan
Set-Secret "DEEPSEEK_API_KEY" "DeepSeek API key"
Set-Secret "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID" "Google OAuth client ID" $false
Set-Secret "SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET" "Google OAuth client secret"

[System.IO.File]::WriteAllLines($file, $lines, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Saved. Restart Supabase (npm run db:stop; npm run db:start) and the dev server so the new values load." -ForegroundColor Cyan
