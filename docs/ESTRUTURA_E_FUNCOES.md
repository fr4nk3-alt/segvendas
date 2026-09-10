# SEG Vendas 5.9.13 — estrutura de pastas e funções

## Visão rápida

O aplicativo é uma aplicação web local/offline-first executada pelo Python embutido. O navegador apresenta a interface, `servidor.py` fornece o servidor HTTP e as APIs locais, e `data/` guarda as informações persistentes.

```text
SEG_Vendas/
├─ assets/       imagens estáticas da interface, logos e avatares
├─ data/         base local, réplica, fotos, auditorias e backups
├─ manuais/      PDFs da biblioteca técnica
├─ runtime/      Python embutido para executar sem instalação externa
├─ vendor/       bibliotecas de terceiros incluídas no pacote
├─ docs/         documentação da estrutura e manutenção
└─ arquivos de execução na raiz
```

Os arquivos de execução permanecem na raiz de propósito: os BATs, o instalador, o servidor e o navegador usam caminhos relativos a essa pasta. Mover esses arquivos sem atualizar os caminhos quebraria a instalação.

## Pastas

| Pasta | Responsabilidade | Pode editar manualmente? |
|---|---|---|
| `assets/` | Logos SEG, ícones PWA/Windows, imagens do NestorX, SEGuito e Pretinha e imagens estáticas da interface. | Sim, mantendo nomes e formatos usados pelo código. |
| `data/` | Dados persistentes do aplicativo: clientes, funcionários, usuários, histórico, descrições, categorias, auditorias, fotos de produtos e fotos de perfil. | Somente com backup; prefira as telas do sistema. |
| `data/backups/` | Cópias de segurança geradas antes de importações e atualizações. | Não apagar sem confirmar a política de retenção. |
| `data/store_replica.sqlite3` | Ledger local de snapshots, eventos enviados/recebidos e cursor de sincronização entre lojas. | Não editar manualmente; faça cópia antes de manutenção. |
| `data/quote_sequences.json` | Sequências reservadas por prefixo de filial (`MA`, `OE`, `SC`, `LA`). | Não editar durante o uso; a reserva é feita pelo servidor. |
| `data/fotos_produtos/` | Fotos associadas ao código de cada produto. | Sim, usando o código correto no nome do arquivo. |
| `data/fotos_perfil/` | Fotos de perfil dos usuários. | Prefira a tela de perfil. |
| `manuais/` | Arquivos PDF e biblioteca de manuais técnicos. | Use a tela de Manuais para cadastrar, substituir e auditar. |
| `runtime/` | Python portátil e arquivos necessários para executar o servidor no Windows. | Não atualizar ou remover manualmente. |
| `vendor/` | Bibliotecas externas empacotadas, como leitor de código de barras. | Não alterar sem testar compatibilidade/licença. |
| `docs/` | Mapas, instruções de desenvolvimento e documentação de entrega. | Sim; não é lida pelo aplicativo em tempo de execução. |

## Arquivos de execução da raiz

### Interface e catálogo

- `index.html`: estrutura da tela, login, navegação, páginas, modais e pontos de montagem do NestorX/cesta.
- `styles.css`: estilo base, layout, cores, formulários e responsividade.
- `products.js`: catálogo local e dados principais dos produtos.
- `app.js`: regras principais do front-end: login, usuários, orçamentos, clientes, histórico, fotos, manuais, fórum, permissões, numeração por filial e integração com APIs locais.
- `static/legacy/v55.js` / `.css`: camada histórica do avatar e ajustes de interface.
- `static/legacy/v56.js` / `.css`: recursos complementares de navegação e responsividade.
- `static/legacy/v57.js` / `.css`: NestorX/SEGuito, movimento, ajuda, pausa, ocultação e arraste.
- `static/legacy/v572.js` / `.css`: pesquisa por câmera ou álbum do celular.
- `static/legacy/v575.js` / `.css`: situações visíveis, modelos de orçamento e ações do histórico.
- `static/legacy/v576.js` / `.css`: escolha e troca de mascote.
- `static/legacy/v577.js` / `.css`: avatar clicável, lâmpada e ajustes de interação.
- `static/legacy/v578.js` / `.css`: recursos complementares de fotos, login e experiência.
- `static/legacy/v59.js` / `.css`: pesquisa paginada, busca inteligente e categorias.
- `static/legacy/v593.js` / `.css`: cesta flutuante, quantidades, selos e redirecionamento para o orçamento.
- `static/legacy/v596.js` / `.css`: rascunhos, resumo inicial e salvamento automático local.
- `static/legacy/v597.js` / `.css`: posicionamento seguro da cesta em relação ao avatar e painel de ajuda.
- `static/legacy/v598.js` / `.css`: movimento calmo e três tamanhos do avatar.
- `static/legacy/v599.js` / `.css`: instalação PWA no celular e identificação da instalação.

As camadas `static/legacy/v*.js` e `v*.css` são carregadas em ordem no final do `index.html`. Uma novidade nova deve ser acrescentada como uma camada versionada no final, evitando reescrever funcionalidades antigas sem necessidade.

### Servidor, rede e instalação

- `servidor.py`: servidor HTTP local, APIs, autenticação, permissões, arquivos persistentes, validações, fotos, manuais, histórico, numeração atômica por filial e configuração de rede.
- `store_replication.py`: ledger SQLite local, fila por loja, backups, protocolo HTTPS/HMAC e eventos de replicação.
- `sw.js`: Service Worker usado para tornar o sistema instalável como PWA.
- `manifest.webmanifest`: nome, ícones, escopo e comportamento do aplicativo instalado no celular.
- `iniciar_app.bat`: ponto de entrada que inicia o servidor com o Python embutido.
- `abrir_seg_vendas.bat`: atalho de compatibilidade que chama o inicializador.
- `INSTALAR_SEG_VENDAS.bat`: instalador visual do Windows.
- `scripts/instalar_seg_vendas.ps1`: cópia segura, backup, criação dos atalhos e aplicação do ícone `assets/seg-vendas.ico`.
- `scripts/CONFIGURAR_REDE_BETA.bat` / `scripts/configurar_rede_beta.py`: configuração de IP, porta e DDNS/endereço público (o nome antigo foi mantido para compatibilidade).
- `scripts/CONFIGURAR_SENHA_MESTRE.bat` / `scripts/configurar_senha_mestre.py`: configuração da senha mestre de recuperação, quando habilitada.

### Scripts de manutenção

A geração de `products.js` e `ean_map.js` a partir de relatórios do ERP fica em `tools/` (ver `tools/README.md`). Os antigos scripts `processar_*.py`, `analisar_csv.py` e `criar_clientes_exemplo.py` não são mais usados e foram movidos para `_descartados/` até serem apagados. Faça backup de `data/` antes de usar qualquer ferramenta administrativa.

### Documentação histórica

Arquivos `ALTERACOES_*.txt`, `RELATORIO_*.txt`, `CHECKLIST_*.txt`, `LEIA-ME.txt`, `INSTRUCOES.txt` e `GUIA_*.txt` registram versões e procedimentos e ficam em `docs/historico/`. O mapa atual fica nesta pasta `docs/`.

## Fluxo dos dados

```text
navegador (index.html + app.js + v*.js)
              │ fetch('/api/...')
              ▼
servidor.py (HTTP + autenticação + regras)
              │
              ├─ data/*.json e data/*.csv
              ├─ data/fotos_produtos/
              ├─ data/fotos_perfil/
              └─ manuais/*.pdf
```

## Regras de manutenção

1. Faça uma cópia de `data/` antes de importar planilhas, alterar usuários ou atualizar o pacote.
2. Não coloque `network_config.json`, senhas ou backups de produção dentro de um ZIP público.
3. Não mova `servidor.py`, `index.html`, BATs, `runtime/`, `data/` ou `manuais/` sem atualizar o instalador e os caminhos relativos.
4. Para nova funcionalidade visual, prefira criar `v600.js`/`v600.css` e carregar os arquivos por último no `index.html`.
5. Depois de qualquer alteração, valide JavaScript com `node --check`, Python com AST e o instalador PowerShell antes de empacotar.
6. Em acesso externo, use HTTPS/túnel seguro e allowlist; não exponha diretamente uma base real por HTTP/DDNS.
