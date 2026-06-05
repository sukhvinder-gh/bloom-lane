# ============================================================
# Bloom Lane — Azure App Service Deployment Script
# Prerequisites: az CLI installed and logged in
#
# Usage:
#   .\deploy-azure.ps1
# ============================================================

# --- Config (edit these) ------------------------------------
$SUBSCRIPTION_ID = "973e3134-218e-4198-8835-c364a555bdcc"
$RESOURCE_GROUP  = "bloom-lane-rg"
$PLAN_NAME       = "bloom-lane-plan"
$WEBAPP_NAME     = "bloom-lane-app"   # must be globally unique on Azure
$LOCATION        = "australiaeast"
$NODE_VERSION    = "NODE|20-lts"
# ------------------------------------------------------------

Write-Host "==> Setting subscription..." -ForegroundColor Cyan
az account set --subscription $SUBSCRIPTION_ID
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to set subscription. Run 'az login' first."; exit 1 }

Write-Host "==> Checking resource group '$RESOURCE_GROUP'..." -ForegroundColor Cyan
$rgExists = az group exists --name $RESOURCE_GROUP
if ($rgExists -eq "false") {
    Write-Host "    Creating resource group..." -ForegroundColor Yellow
    az group create --name $RESOURCE_GROUP --location $LOCATION
}

Write-Host "==> Checking App Service Plan '$PLAN_NAME'..." -ForegroundColor Cyan
$planId = az appservice plan show --name $PLAN_NAME --resource-group $RESOURCE_GROUP --query id -o tsv 2>$null
if (-not $planId) {
    Write-Host "    Creating App Service Plan (B1, Linux)..." -ForegroundColor Yellow
    az appservice plan create `
        --name $PLAN_NAME `
        --resource-group $RESOURCE_GROUP `
        --sku B1 `
        --is-linux `
        --location $LOCATION
}

Write-Host "==> Checking Web App '$WEBAPP_NAME'..." -ForegroundColor Cyan
$appId = az webapp show --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP --query id -o tsv 2>$null
if (-not $appId) {
    Write-Host "    Creating Web App..." -ForegroundColor Yellow
    az webapp create `
        --name $WEBAPP_NAME `
        --resource-group $RESOURCE_GROUP `
        --plan $PLAN_NAME `
        --runtime $NODE_VERSION
}

Write-Host "==> Configuring startup command..." -ForegroundColor Cyan
az webapp config set `
    --name $WEBAPP_NAME `
    --resource-group $RESOURCE_GROUP `
    --startup-file "node server.js"

Write-Host "==> Setting environment variables..." -ForegroundColor Cyan
# Load from .env.local
$envFile = Get-Content ".env.local" | Where-Object { $_ -match "^[A-Z_]" -and $_ -notmatch "^#" }
$settings = @()
foreach ($line in $envFile) {
    $parts = $line -split "=", 2
    if ($parts.Count -eq 2) {
        $key = $parts[0].Trim()
        # Strip inline comments (e.g. "value   # comment")
        $val = ($parts[1] -split "#")[0].Trim()
        if ($key -and $val) {
            $settings += "$key=$val"
        }
    }
}
# Override APP_URL with the real Azure hostname
$settings += "NEXT_PUBLIC_APP_URL=https://$WEBAPP_NAME.azurewebsites.net"
$settings += "NODE_ENV=production"

az webapp config appsettings set `
    --name $WEBAPP_NAME `
    --resource-group $RESOURCE_GROUP `
    --settings @settings

Write-Host "==> Building Next.js app (standalone output)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed."; exit 1 }

Write-Host "==> Assembling deployment package..." -ForegroundColor Cyan
# Standalone output needs static assets copied into it
Copy-Item -Recurse -Force ".next\static" ".next\standalone\.next\static"
if (Test-Path "public") {
    Copy-Item -Recurse -Force "public" ".next\standalone\public"
}

# Zip the standalone folder
$zipPath = "bloom-lane-deploy.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path ".next\standalone\*" -DestinationPath $zipPath
Write-Host "    Package: $zipPath ($([math]::Round((Get-Item $zipPath).Length/1MB, 1)) MB)" -ForegroundColor Gray

Write-Host "==> Deploying to Azure..." -ForegroundColor Cyan
az webapp deploy `
    --name $WEBAPP_NAME `
    --resource-group $RESOURCE_GROUP `
    --src-path $zipPath `
    --type zip `
    --async false

Write-Host ""
Write-Host "==> Done! Your app is live at:" -ForegroundColor Green
Write-Host "    https://$WEBAPP_NAME.azurewebsites.net" -ForegroundColor Green
Write-Host ""
Write-Host "    Logs: az webapp log tail --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP" -ForegroundColor Gray
