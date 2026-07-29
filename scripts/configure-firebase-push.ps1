param(
  [string]$GoogleServicesJson = "$PSScriptRoot\..\android\app\google-services.json",
  [switch]$BuildRelease
)

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidApp = Join-Path $projectRoot "android\app"
$googleServicesTarget = Join-Path $androidApp "google-services.json"

function Fail($message) {
  Write-Error $message
  exit 1
}

if (!(Test-Path $GoogleServicesJson)) {
  Fail "google-services.json nao encontrado. Baixe no Firebase Console para o app Android br.com.novaforma.crm e salve em android/app/google-services.json."
}

$json = Get-Content $GoogleServicesJson -Raw | ConvertFrom-Json
$packageName = $json.client.client_info.android_client_info.package_name | Select-Object -First 1
if ($packageName -ne "br.com.novaforma.crm") {
  Fail "google-services.json pertence ao pacote '$packageName'. O pacote esperado e 'br.com.novaforma.crm'."
}

$sourcePath = (Resolve-Path $GoogleServicesJson).Path
$targetPath = if (Test-Path $googleServicesTarget) { (Resolve-Path $googleServicesTarget).Path } else { $null }
if ($sourcePath -ne $targetPath) {
  Copy-Item $GoogleServicesJson $googleServicesTarget -Force
}

$requiredServerVars = @("SUPABASE_SERVICE_ROLE_KEY", "PUSH_WEBHOOK_SECRET", "FIREBASE_SERVICE_ACCOUNT_JSON")
$missing = $requiredServerVars | Where-Object { [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_, "Process")) }
if ($missing.Count -gt 0) {
  Write-Warning "Variaveis server-side ausentes nesta sessao: $($missing -join ', '). Configure-as na Vercel antes de esperar entrega real de push."
}

Write-Output "Firebase Android validado para br.com.novaforma.crm."
Write-Output "Para ativar registro nativo, configure na Vercel:"
Write-Output "NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=true"
Write-Output "NEXT_PUBLIC_ANDROID_FIREBASE_CONFIGURED=true"

if ($BuildRelease) {
  Push-Location $projectRoot
  try {
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npx.cmd cap sync android
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Push-Location (Join-Path $projectRoot "android")
    try {
      .\gradlew.bat assembleRelease bundleRelease --no-daemon --console=plain --max-workers=2
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } finally {
      Pop-Location
    }
  } finally {
    Pop-Location
  }
}
