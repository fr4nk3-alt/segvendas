# SEG Vendas 5.9.14 Premium

Aplicativo offline-first de vendas, orçamentos e consulta de preços para as lojas SEG.
Servidor HTTP local em Python (somente biblioteca padrão), interface web (PWA) e
servidor TCP para terminais de consulta de preço Gertec.

## Requisitos

- Windows 10/11 (o runtime Python 3.13 portátil já está em `runtime/`; não é preciso instalar nada).
- Para desenvolvimento em outro sistema: Python 3.11+ e nenhuma dependência externa (`requirements.txt`).

## Como executar

```bat
iniciar_app.bat
```

O servidor sobe em `http://localhost:8080/index.html` (porta configurável) e o
servidor Gertec na porta TCP `6500`. `CTRL+C` encerra.

| Tarefa                                | Comando                                        |
|---------------------------------------|------------------------------------------------|
| Rodar o aplicativo                    | `iniciar_app.bat`                              |
| Rodar sem abrir o navegador           | `abrir_seg_vendas.bat`                         |
| Instalar/atualizar no PC da loja      | `INSTALAR_SEG_VENDAS.bat`                      |
| Trocar IP, porta ou DDNS              | `scripts\CONFIGURAR_REDE_BETA.bat`             |
| Definir senha mestre de recuperação   | `scripts\CONFIGURAR_SENHA_MESTRE.bat`          |
| Configurar Supabase (opcional)        | `scripts\CONFIGURAR_SUPABASE.bat`              |
| Rodar os testes automatizados         | `verificar.bat`                                |

Variáveis de ambiente úteis: `SEG_PORT`, `SEG_BIND_ADDRESS`, `SEG_PUBLIC_URL`,
`SEG_ALLOWED_HOSTS`, `SEG_BACKUP_ENABLED`, `SEG_SYNC_WORKER`.

## Estrutura de pastas

```
SEG_Vendas/
├── servidor.py               Servidor HTTP + APIs + servidor Gertec (porta 6500)
├── dataplace_connector.py    Cliente do ERP Dataplace Symphony (integração futura)
├── offline_sync.py           Fila offline de eventos para sincronização
├── store_replication.py      Ledger SQLite, backups e replicação entre lojas
├── supabase_connector.py     Cliente Supabase (opcional, nuvem)
├── index.html / app.js / styles.css   Interface principal
├── products.js               Catálogo de produtos: [codigo, descricao, preco]
├── ean_map.js                Mapa EAN (código de barras) -> código interno
├── sw.js / manifest.webmanifest       PWA
├── static/legacy/            Módulos incrementais v55…v599 (js/css) carregados pelo index.html
├── assets/                   Logos, ícones, imagens
├── vendor/                   Bibliotecas de terceiros (ZXing para leitura de código de barras)
├── manuais/                  Manuais em PDF exibidos no aplicativo
├── runtime/                  Python 3.13 embutido para Windows
├── data/                     Dados locais da loja (NUNCA versionar; ver .gitignore)
├── scripts/                  Configuração de rede, senha mestre, Supabase e instalador
├── tools/                    Geração de products.js e ean_map.js a partir de CSV do ERP
├── tests/                    Testes automatizados (unittest)
├── deploy/                   Docker, Render e schema Supabase (uso opcional em nuvem)
├── docs/                     Documentação técnica; docs/historico/ guarda relatórios antigos
└── _descartados/             Scripts sem uso, mantidos para conferência antes de apagar
```

## Dados e segurança

- Senhas de usuários: PBKDF2-HMAC-SHA256, 180.000 iterações, salt individual (`servidor.py`).
- Limite de tentativas (rate limit) em login, cadastro e recuperação de senha.
- Cabeçalhos `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`.
- Validação de `Host`/`Origin` em todas as requisições; bloqueio de acesso HTTP a
  `data/`, `runtime/`, `scripts/`, `tools/`, `tests/`, `deploy/`, `docs/` e a extensões internas.
- Tudo em `data/` (clientes, funcionários, usuários, históricos, backups, configurações)
  fica fora do controle de versão. Os únicos arquivos versionados ali são os modelos `modelo_*.csv`.
- Acesso de fábrica: código do funcionário + `SEG@CODIGO`. A troca de senha pode ser
  tornada obrigatória em `FORCE_PASSWORD_CHANGE` (`servidor.py`).

## Terminais Gertec (TC300 / TC502)

Protocolo implementado conforme o SDK oficial Gertec TCServer:
`#ok` -> `#TIPO|VERSAO` -> `#alwayslive` -> `#alwayslive_ok`; cada `recv()` é uma
mensagem completa prefixada com `#`, sem newline; consulta `#EAN` responde
`#DESCRICAO|R$ 0,00` ou `#nfound`; keepalive `#live?`/`#live` a cada 5 s de
inatividade. Testes em `tests/test_gertec_protocol.py`.

## Atualizar preços e produtos

```bat
runtime\python.exe tools\gerar_products.py -e "relatorio.csv" -s products.js
runtime\python.exe tools\gerar_ean_map.py  -e "relatorio.csv" -s ean_map.js
```

Veja `tools/README.md`. Reinicie o aplicativo após alterar `products.js`.

## Testes

```bat
verificar.bat
```

Executa `unittest` em `tests/` (conectores, replicação, protocolo Gertec).

## Documentação adicional

- `docs/ROADMAP.md`: fases concluídas, refatoração pendente e preparação para Windows Server
- `docs/ESTRUTURA_E_FUNCOES.md`, `docs/FLUXO_DE_DESENVOLVIMENTO.md`, `docs/PROJETO_PRINCIPAL.md`
- `deploy/README_CLOUD.md` para execução em nuvem (opcional)
- `docs/historico/` relatórios de versões anteriores
