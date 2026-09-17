# Guia Simplificado - Deploy pelo Portal Azure

Como você já está logado no portal Azure, vamos fazer o deploy manual pela interface gráfica.

## Passo 1: Criar Resource Group

1. No portal Azure, clique em **"Resource groups"** no menu à esquerda
2. Clique em **"+ Criar"**
3. Preencha:
   - **Nome da assinatura:** sua assinatura ativa
   - **Resource group:** `seg-vendas-rg`
   - **Região:** `East US` (ou a mais próxima do Brasil, como Brazil South)
4. Clique em **"Revisar + criar"** e depois **"Criar"**

## Passo 2: Criar Container Registry (ACR)

1. No portal, pesquise por **"Container registries"**
2. Clique em **"+ Criar"**
3. Preencha:
   - **Resource group:** `seg-vendas-rg`
   - **Nome do registro:** `segvendasregistry` (ou outro único)
   - **Região:** mesma do Resource Group
   - **SKU:** `Basic`
4. Na aba **Rede**, deixar como padrão
5. Clique em **"Revisar + criar"** e depois **"Criar"**
6. Aguarde a criação (pode levar alguns minutos)

## Passo 3: Obter credenciais do ACR

1. Acesse o Container Registry criado
2. No menu à esquerda, clique em **"Chaves de acesso"**
3. Em **Usuário administrador**, clique em **"Habilitar"**
4. Copie o **Nome do servidor de login** (ex: `segvendasregistry.azurecr.io`)
5. Copie o **Nome de usuário** e **Senha** (ou uma das senhas)

## Passo 4: Construir e enviar imagem Docker

No seu computador (terminal PowerShell):

```powershell
cd C:\Users\RENATO\Desktop\SEG\01_versoes\SEG_Vendas_5.9.14_Reorganizado

# Login no ACR
docker login segvendasregistry.azurecr.io
# Cole o nome de usuário e senha quando solicitado

# Construir imagem
docker build -f deploy/Dockerfile -t segvendasregistry.azurecr.io/seg-vendas:latest .

# Enviar imagem
docker push segvendasregistry.azurecr.io/seg-vendas:latest
```

## Passo 5: Criar Container Apps Environment

1. No portal, pesquise por **"Container Apps"**
2. Clique em **"+ Criar"**
3. Preencha:
   - **Resource group:** `seg-vendas-rg`
   - **Nome do Container App:** `seg-vendas-principal`
   - **Região:** mesma do Resource Group
4. Clique em **"Criar novo"** em **Ambiente do Container Apps**
   - **Nome do ambiente:** `seg-vendas-env`
   - **Região:** mesma
   - Clique em **"Criar"**
5. Clique em **"Avançar: Contêineres"**

## Passo 6: Configurar Container

1. Em **Imagem do contêiner**, cole: `segvendasregistry.azurecr.io/seg-vendas:latest`
2. Clique em **"Avançar: Application settings"**

## Passo 7: Configurar variáveis de ambiente

Adicione as seguintes variáveis:

| Nome | Valor |
|------|-------|
| SEG_CLOUD | 1 |
| PORT | 8080 |
| SEG_BIND_ADDRESS | 0.0.0.0 |

Clique em **"Avançar: Escala e réplica"**

## Passo 8: Configurar escala

- **Mínimo de réplicas:** 1
- **Máximo de réplicas:** 3
- **Tipo de escala:** Custom
- **Métrica:** CPU
- **Utilização alvo:** 70%

Clique em **"Avançar: Rede"**

## Passo 9: Configurar ingress

- **Tipo de ingress:** External
- **Permitir tráfego:** de qualquer lugar (ou restringir por IP se preferir)
- **Porta do contêiner:** 8080

Clique em **"Avançar: Monitoramento"**

## Passo 10: Configurar armazenamento (OPCIONAL - Requer Storage Account)

Se você quiser persistência de dados (recomendado):

1. Primeiro, crie uma **Storage Account**:
   - Pesquise por "Storage accounts"
   - Criar com nome `segvendasstorage` (deve ser único globalmente)
   - SKU: Standard LRS
   - Tipo: StorageV2

2. Depois, crie um **File Share**:
   - Acesse a Storage Account
   - Clique em "File shares"
   - Criar com nome `seg-data`
   - Cota: 10 GB

3. No Container App, adicione storage:
   - Volte para a configuração do Container App
   - Em "Armazenamento", adicione:
     - Nome: `seg-data`
     - Tipo: Azure File
     - Nome da conta de armazenamento: `segvendasstorage`
     - Nome do compartilhamento de arquivos: `seg-data`
     - Caminho de montagem: `/app/data`

**Nota:** Se não quiser configurar armazenamento agora, pode pular. O app funcionará mas os dados serão perdidos ao reiniciar.

## Passo 11: Criar o Container App

1. Clique em **"Revisar + criar"**
2. Revise a configuração
3. Clique em **"Criar"**
4. Aguarde o deployment (pode levar 5-10 minutos)

## Passo 12: Obter URL e testar

1. Após a criação, acesse o Container App
2. Copie a **URL do aplicativo** (está na página principal)
3. Teste no navegador:
   - Acesse: `https://SEU-URL.azurecontainerapps.io/healthz`
   - Deve retornar: `{"ok": true, "version": "5.9.14"}`

## Passo 13: Configurar variáveis obrigatórias

No Container App, vá em **"Configuração"** → **"Variáveis de ambiente"** e adicione:

- **SEG_PUBLIC_URL:** URL completa do app (ex: `https://seg-vendas-principal.azurecontainerapps.io`)
- **SEG_ALLOWED_HOSTS:** Hostname (ex: `seg-vendas-principal.azurecontainerapps.io`)

**Importante:** Estas variáveis devem ser definidas como **Secrets** se o valor for sensível.

## Testes de validação

### 1. Teste de saúde
```bash
curl https://SEU-URL.azurecontainerapps.io/healthz
```

### 2. Teste de segurança
- Verifique se usa HTTPS (o Azure fornece automaticamente)
- Tente acessar /data/ (deve ser bloqueado pelo servidor)

### 3. Teste de persistência
- Se configurou armazenamento, reinicie o container e verifique se dados persistiram

## Dicas

- Se tiver erro de "imagem não encontrada", verifique se o `docker push` funcionou
- Se tiver erro de "permissão negada", verifique se o login no ACR funcionou
- Logs podem ser visualizados no portal em "Logs" do Container App
- Métricas de performance estão em "Monitoramento"

## Custos

O piloto custará aproximadamente:
- Container Apps: ~$15-30/mês (dependendo do uso)
- Storage Account: ~$1-2/mês para 10 GB
- Total estimado: ~$20-35/mês

## Próximos passos

Após o piloto funcionar:
1. Configure Dataplace (quando tiver documentação)
2. Habilite replicação entre lojas
3. Ajuste escala conforme necessidade
