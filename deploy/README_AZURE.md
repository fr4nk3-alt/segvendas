# Deploy do SEG Vendas no Azure Container Apps

Este guia descreve como implantar o SEG Vendas no Azure Container Apps para demonstrar que o sistema é seguro e rápido para outras lojas.

## Pré-requisitos

1. **Conta Azure** com permissões para criar recursos
2. **Azure CLI** instalado (`az --version`)
3. **Docker** instalado (para construir a imagem)
4. **Container Registry** (ACR) para hospedar a imagem Docker
5. **Repositório Git privado** com o código do SEG Vendas

## Arquitetura

```
Dataplace Cloud (API futura)
        ↓
Azure Container Apps (SEG Vendas)
        ↓
    Lojas locais
        ↓
   Vendedores + Gertec
```

Cada loja mantém:
- Cópia local dos dados (produtos, preços, estoque, clientes)
- Operação offline quando não houver internet
- Sincronização automática quando a conexão retornar

## Passo 1: Criar Resource Group

```bash
az group create \
  --name seg-vendas-rg \
  --location eastus
```

## Passo 2: Criar Container Registry (ACR)

```bash
az acr create \
  --resource-group seg-vendas-rg \
  --name segvendasregistry \
  --sku Basic \
  --admin-enabled true
```

Obter credenciais do ACR:
```bash
az acr credential show \
  --name segvendasregistry \
  --resource-group seg-vendas-rg
```

## Passo 3: Login no ACR

```bash
az acr login --name segvendasregistry
```

## Passo 4: Construir e push da imagem Docker

A partir do diretório do projeto:

```bash
cd C:\Users\RENATO\Desktop\SEG\01_versoes\SEG_Vendas_5.9.14_Reorganizado

docker build -f deploy/Dockerfile -t segvendasregistry.azurecr.io/seg-vendas:latest .

docker push segvendasregistry.azurecr.io/seg-vendas:latest
```

## Passo 5: Criar Environment do Container Apps

```bash
az containerapp env create \
  --name seg-vendas-env \
  --resource-group seg-vendas-rg \
  --location eastus
```

## Passo 6: Criar conta de armazenamento (Azure Files)

```bash
az storage account create \
  --name segvendasstorage \
  --resource-group seg-vendas-rg \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2
```

Obter connection string:
```bash
az storage account show-connection-string \
  --name segvendasstorage \
  --resource-group seg-vendas-rg
```

## Passo 7: Criar File Share

```bash
az storage share create \
  --name seg-data \
  --account-name segvendasstorage \
  --quota 10
```

## Passo 8: Ativar volume no Container Apps Environment

```bash
az containerapp env storage set \
  --name seg-vendas-env \
  --resource-group seg-vendas-rg \
  --storage-name seg-data \
  --storage-type AzureFile \
  --account-name segvendasstorage \
  --share-name seg-data \
  --access-key "SUA_ACCESS_KEY"
```

## Passo 9: Definir variáveis de ambiente

No portal Azure ou via CLI, configure:

**Variáveis obrigatórias:**
- `SEG_PUBLIC_URL`: URL completa do app (ex: `https://seg-vendas.azurecontainerapps.io`)
- `SEG_ALLOWED_HOSTS`: Hostname permitido (ex: `seg-vendas.azurecontainerapps.io`)

**Variáveis opcionais (configurar após testes):**
- `SEG_REPLICATION_ENABLED`: `1` para habilitar replicação entre lojas
- `SEG_SYNC_ENABLED`: `1` para habilitar sincronização Dataplace
- `DATAPLACE_BASE_URL`: URL da API Dataplace (quando disponível)
- `DATAPLACE_API_KEY`: Chave da API Dataplace (quando disponível)

## Passo 10: Criar Container App

```bash
az containerapp create \
  --name seg-vendas-principal \
  --resource-group seg-vendas-rg \
  --environment seg-vendas-env \
  --image segvendasregistry.azurecr.io/seg-vendas:latest \
  --target-port 8080 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1Gi \
  --env-vars SEG_CLOUD=1 PORT=8080 SEG_BIND_ADDRESS=0.0.0.0 \
  --secrets seg-public-url="https://SEU-URL.azurecontainerapps.io" \
  --secrets seg-allowed-hosts="SEU-URL.azurecontainerapps.io" \
  --scale-rule-name cpu-scale \
  --scale-rule-type cpu \
  --scale-rule-custom-rule "concurrentRequests=10" \
  --storage-name seg-data \
  --storage-mount-path /app/data
```

## Passo 11: Verificar deployment

1. Obter a URL do app:
```bash
az containerapp show \
  --name seg-vendas-principal \
  --resource-group seg-vendas-rg \
  --query properties.configuration.ingress.fqdn \
  --output tsv
```

2. Testar health endpoint:
```bash
curl https://SEU-URL.azurecontainerapps.io/healthz
```

Deve retornar: `{"ok": true, "version": "5.9.14"}`

## Testes de validação

### 1. Teste de saúde
```bash
curl https://SEU-URL.azurecontainerapps.io/healthz
```

### 2. Teste de performance
```bash
# Medir tempo de resposta
time curl https://SEU-URL.azurecontainerapps.io/healthz
```

### 3. Teste de segurança
- Verificar se usa HTTPS automaticamente
- Tentar acessar /data/ (deve ser bloqueado)
- Tentar acessar arquivos internos (deve ser bloqueado)

### 4. Teste de persistência
- Reiniciar o container
- Verificar se dados persistiram
- Verificar se backups em /app/data/backups foram preservados

## Monitoramento

Azure Container Apps fornece:
- Logs em tempo real
- Métricas de CPU, memória, requisições
- Alertas
- Integração com Azure Monitor

## Custos estimados

- Container Apps: ~$0.000018 por vCPU/segundo, ~$0.000002 por GB/segundo
- Azure Files: ~$0.06 por GB/mês
- Egress: ~$0.087 por GB (saída da rede Azure)

Para um ambiente piloto com 1 réplica e 10 GB de armazenamento:
- ~$15-30/mês (dependendo do uso)

## Próximos passos após piloto

1. **Habilitar replicação entre lojas**
   - Configurar `SEG_REPLICATION_ENABLED=1`
   - Definir tokens por loja
   - Testar sincronização

2. **Integrar com Dataplace**
   - Obter documentação oficial da API
   - Configurar `DATAPLACE_BASE_URL` e `DATAPLACE_API_KEY`
   - Habilitar `SEG_SYNC_ENABLED=1`
   - Testar importação de produtos, preços, estoque, clientes

3. **Expandir para múltiplas lojas**
   - Aumentar réplicas conforme necessidade
   - Configurar autoscaling
   - Monitorar performance

## Rollback

Se necessário, rollback para versão anterior:

```bash
az containerapp update \
  --name seg-vendas-principal \
  --resource-group seg-vendas-rg \
  --image segvendasregistry.azurecr.io/seg-vendas:TAG_ANTERIOR
```

## Limpeza

Para remover todos os recursos (cuidado - isso apaga tudo):

```bash
az group delete --name seg-vendas-rg --yes
```
