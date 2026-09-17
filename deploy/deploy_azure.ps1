# Script de Deploy do SEG Vendas no Azure Container Apps
# Este script automatiza a criação dos recursos e deployment no Azure

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory=$true)]
    [string]$Location = "eastus",

    [Parameter(Mandatory=$true)]
    [string]$AcrName,

    [Parameter(Mandatory=$true)]
    [string]$AppName,

    [Parameter(Mandatory=$false)]
    [string]$ContainerRegistryTag = "latest"
)

$ErrorActionPreference = "Stop"

Write-Host "=== SEG Vendas - Deploy Azure Container Apps ===" -ForegroundColor Cyan
Write-Host ""

# Verificar Azure CLI
Write-Host "Verificando Azure CLI..." -ForegroundColor Yellow
try {
    $azVersion = az --version 2>&1
    Write-Host "Azure CLI instalado" -ForegroundColor Green
} catch {
    Write-Host "Azure CLI não encontrado. Instale em: https://docs.microsoft.com/cli/azure/install-azure-cli" -ForegroundColor Red
    exit 1
}

# Verificar login no Azure
Write-Host "Verificando login no Azure..." -ForegroundColor Yellow
$account = az account show 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Você não está logado no Azure. Execute: az login" -ForegroundColor Red
    exit 1
}
Write-Host "Logado no Azure" -ForegroundColor Green
Write-Host ""

# Criar Resource Group
Write-Host "Criando Resource Group: $ResourceGroupName..." -ForegroundColor Yellow
az group create --name $ResourceGroupName --location $Location | Out-Null
Write-Host "Resource Group criado" -ForegroundColor Green
Write-Host ""

# Criar Container Registry
Write-Host "Criando Container Registry: $AcrName..." -ForegroundColor Yellow
$acr = az acr create --resource-group $ResourceGroupName --name $AcrName --sku Basic --admin-enabled true
Write-Host "Container Registry criado" -ForegroundColor Green
Write-Host ""

# Obter credenciais do ACR
Write-Host "Obtendo credenciais do ACR..." -ForegroundColor Yellow
$acrCredentials = az acr credential show --name $AcrName --resource-group $ResourceGroupName
$acrUsername = ($acrCredentials | ConvertFrom-Json).username
$acrPassword = ($acrCredentials | ConvertFrom-Json).passwords[0].value
Write-Host "Credenciais obtidas" -ForegroundColor Green
Write-Host ""

# Login no ACR
Write-Host "Fazendo login no ACR..." -ForegroundColor Yellow
az acr login --name $AcrName | Out-Null
Write-Host "Login no ACR realizado" -ForegroundColor Green
Write-Host ""

# Construir imagem Docker
Write-Host "Construindo imagem Docker..." -ForegroundColor Yellow
$imageName = "$AcrName.azurecr.io/seg-vendas:$ContainerRegistryTag"
docker build -f deploy/Dockerfile -t $imageName .
Write-Host "Imagem Docker construída" -ForegroundColor Green
Write-Host ""

# Push da imagem
Write-Host "Enviando imagem para o ACR..." -ForegroundColor Yellow
docker push $imageName
Write-Host "Imagem enviada para o ACR" -ForegroundColor Green
Write-Host ""

# Criar Environment do Container Apps
Write-Host "Criando Container Apps Environment..." -ForegroundColor Yellow
$envName = "$AppName-env"
az containerapp env create --name $envName --resource-group $ResourceGroupName --location $Location | Out-Null
Write-Host "Environment criado" -ForegroundColor Green
Write-Host ""

# Criar conta de armazenamento
Write-Host "Criando conta de armazenamento..." -ForegroundColor Yellow
$storageName = "$($AppName.ToLower())storage"
az storage account create --name $storageName --resource-group $ResourceGroupName --location $Location --sku Standard_LRS --kind StorageV2 | Out-Null
Write-Host "Conta de armazenamento criada" -ForegroundColor Green
Write-Host ""

# Obter connection string
Write-Host "Obtendo connection string..." -ForegroundColor Yellow
$connectionString = az storage account show-connection-string --name $storageName --resource-group $ResourceGroupName
$connectionString = ($connectionString | ConvertFrom-Json).connectionString
Write-Host "Connection string obtida" -ForegroundColor Green
Write-Host ""

# Criar File Share
Write-Host "Criando File Share..." -ForegroundColor Yellow
az storage share create --name seg-data --account-name $storageName --quota 10 | Out-Null
Write-Host "File Share criado" -ForegroundColor Green
Write-Host ""

# Obter access key
Write-Host "Obtendo access key..." -ForegroundColor Yellow
$accessKey = az storage account keys list --account-name $storageName --resource-group $ResourceGroupName
$accessKey = ($accessKey | ConvertFrom-Json)[0].value
Write-Host "Access key obtida" -ForegroundColor Green
Write-Host ""

# Ativar volume no Environment
Write-Host "Ativando volume no Environment..." -ForegroundColor Yellow
az containerapp env storage set --name $envName --resource-group $ResourceGroupName --storage-name seg-data --storage-type AzureFile --account-name $storageName --share-name seg-data --access-key $accessKey | Out-Null
Write-Host "Volume ativado" -ForegroundColor Green
Write-Host ""

# Solicitar URL pública
Write-Host "Após o deployment, a URL será gerada automaticamente pelo Azure." -ForegroundColor Yellow
Write-Host "Exemplo: https://$AppName-$ResourceGroupName.region.azurecontainerapps.io" -ForegroundColor Yellow
Write-Host ""

# Criar Container App
Write-Host "Criando Container App..." -ForegroundColor Yellow
az containerapp create `
    --name $AppName `
    --resource-group $ResourceGroupName `
    --environment $envName `
    --image $imageName `
    --target-port 8080 `
    --ingress external `
    --min-replicas 1 `
    --max-replicas 3 `
    --cpu 0.5 `
    --memory 1Gi `
    --env-vars SEG_CLOUD=1 PORT=8080 SEG_BIND_ADDRESS=0.0.0.0 `
    --scale-rule-name cpu-scale `
    --scale-rule-type cpu `
    --scale-rule-custom-rule "concurrentRequests=10" `
    --storage-name seg-data `
    --storage-mount-path /app/data

Write-Host "Container App criado" -ForegroundColor Green
Write-Host ""

# Obter URL do app
Write-Host "Obtendo URL do app..." -ForegroundColor Yellow
$appUrl = az containerapp show --name $AppName --resource-group $ResourceGroupName --query properties.configuration.ingress.fqdn --output tsv
Write-Host "URL do app: https://$appUrl" -ForegroundColor Green
Write-Host ""

# Testar health endpoint
Write-Host "Aguardando inicialização do app (30 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "Testando health endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "https://$appUrl/healthz" -UseBasicParsing
    Write-Host "Health endpoint respondeu: $($healthResponse.Content)" -ForegroundColor Green
} catch {
    Write-Host "Health endpoint ainda não respondeu. Verifique os logs no portal Azure." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Deploy concluído ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Configure SEG_PUBLIC_URL e SEG_ALLOWED_HOSTS no portal Azure"
Write-Host "2. Teste a URL completa no navegador"
Write-Host "3. Configure as variáveis de Dataplace após obter documentação"
Write-Host "4. Habilite replicação entre lojas após testes"
Write-Host ""
Write-Host "Para ver logs: az containerapp logs show --name $AppName --resource-group $ResourceGroupName --follow" -ForegroundColor Cyan
