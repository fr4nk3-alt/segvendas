# Preparação para nuvem — SEG Vendas 5.9.13

## Opção indicada para o projeto principal

Para uma implantação online, a opção mais simples é um Web Service Docker no Render com plano pago inicial e disco persistente montado em `/app/data`. O `render.yaml` deste repositório já descreve essa estrutura.

O disco é necessário porque o aplicativo grava usuários, clientes importados, históricos, fotos e auditorias em arquivos locais. Sem um disco persistente, esses arquivos seriam perdidos quando o serviço reiniciasse ou fosse publicado novamente.

## Passos no Render

1. Mantenha o repositório do GitHub como **privado**.
2. No Render, crie um Blueprint a partir do repositório `seginter/seg-vendas`.
3. Confira se o serviço `seg-vendas-principal` foi criado com o `Dockerfile` e o disco de 10 GB.
4. Depois de o endereço `*.onrender.com` ser criado, configure:
   - `SEG_PUBLIC_URL`: endereço HTTPS completo do serviço;
   - `SEG_ALLOWED_HOSTS`: somente o hostname, sem `https://` e sem caminho.
5. Faça o primeiro deploy e confirme que `https://SEU_HOST/healthz` retorna `{"ok": true}`.
6. Troque as credenciais de fábrica antes de convidar vendedores.

O Render termina o HTTPS antes de encaminhar a requisição ao container. O servidor foi preparado para usar a variável `PORT`, escutar em `0.0.0.0` e não abrir janela de navegador no ambiente cloud.

## Operação entre lojas e modo offline

Cada loja pode continuar atendendo no servidor local mesmo sem internet. A versão 5.9.13 cria `data/store_replica.sqlite3`, mantém snapshots e gera ZIPs periódicos em `data/backups`. Quando um servidor central for configurado, a fila de eventos de vendas será enviada por HTTPS com token por loja e assinatura HMAC; após o retorno da conexão, eventos recebidos serão aplicados sem duplicidade.

Para o Supabase, execute `supabase/schema.sql` no SQL Editor e use
`CONFIGURAR_SUPABASE.bat` em cada instalação. A configuração fica em
`data/supabase_config.json` (fora do Git); a chave secreta nunca chega ao
navegador. O transporte Supabase é opcional e não impede a operação local.

Todos os orçamentos recebem um prefixo por filial (`MA`, `OE`, `SC` ou `LA`) e cinco dígitos. A sequência fica no servidor local de cada loja em `data/quote_sequences.json`, portanto continua disponível mesmo sem internet; o servidor central não deve substituir essa reserva local. Registros antigos apenas numéricos são convertidos automaticamente, com o valor anterior preservado internamente em `legacyNumber`.

Para um teste controlado, configure em cada loja:

- `SEG_STORE_ID`: identificador único, por exemplo `matriz`, `oeste`, `sao-cristovao` ou `vitoria`;
- `SEG_STORE_NAME`: nome exibido da loja;
- `SEG_REPLICATION_HUB_URL`: URL HTTPS do servidor central;
- `SEG_REPLICATION_TOKEN`: segredo exclusivo da loja;
- `SEG_REPLICATION_ENABLED=1` e `SEG_REPLICATION_WORKER=1`;
- `SEG_BACKUP_ENABLED=1` (padrão) e, opcionalmente, `SEG_BACKUP_INTERVAL`/`SEG_BACKUP_RETENTION`.

No servidor central, habilite `SEG_REPLICATION_HUB=1` e cadastre os tokens em `SEG_REPLICATION_STORE_TOKENS` como um JSON secreto, por exemplo `{"matriz":"...","oeste":"..."}`. Nunca coloque tokens no código, no navegador ou no GitHub.

Esta primeira etapa replica eventos de vendas e backups locais; não sincroniza senhas, credenciais, configurações de rede ou segredos. Clientes, produtos e dados mestres devem ter uma política de autoridade definida antes de permitir edição em mais de uma loja. Para a versão definitiva, o próximo passo é migrar o banco principal para PostgreSQL e formalizar resolução de conflitos.

## Dataplace e modo offline

O conector Dataplace usa somente segredos do ambiente do servidor. Depois de receber da Dataplace o endpoint e o mapeamento oficial, preencha no Render:

- `DATAPLACE_BASE_URL`
- `DATAPLACE_API_KEY`
- `DATAPLACE_AUTH_TYPE` (`api-key` ou `bearer`)
- `DATAPLACE_API_KEY_HEADER` (normalmente `X-API-Key`)
- `DATAPLACE_HEALTH_PATH`
- `DATAPLACE_CUSTOMERS_PATH`
- `DATAPLACE_PRODUCTS_PATH`
- `DATAPLACE_QUOTE_PATH`

Mantenha `SEG_SYNC_ENABLED=0` até homologar o mapeamento. Quando a API estiver validada, altere para `1` e, se desejar o envio automático da fila, altere `SEG_SYNC_WORKER` para `1`. Orçamentos salvos enquanto a API estiver indisponível ficam em `data/sync_queue.json` e são reenviados com uma chave de idempotência.

O conector não inventa campos do ERP: sem o contrato oficial do Dataplace, ele não envia pedidos nem interpreta clientes/produtos. Isso evita gravar informações no módulo errado ou duplicar vendas.

Não coloque planilhas reais, backups ou `network_config.json` no GitHub. Importe os dados no serviço pela área de Ajustes ou copie-os diretamente para o volume persistente após o primeiro deploy.
