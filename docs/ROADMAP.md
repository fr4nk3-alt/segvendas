# Roadmap técnico — SEG Vendas

A versão 5.9.14 (esta pasta, com Git) é a referência para o laboratório.
Preservar também a versão anterior, 5.9.13. Se aprovado nos testes e na revisão
técnica, o sistema será implantado em um Windows Server.

## Fases já concluídas

### Fase 1 — Organização (5.9.14)
- Raiz reduzida de 92 para ~30 itens; frontend legado em `static/legacy/`,
  scripts em `scripts/`, ferramentas em `tools/`, nuvem em `deploy/`,
  histórico em `docs/historico/`, código sem uso em `_descartados/`.
- Novas pastas internas bloqueadas para acesso HTTP (`servidor.py`, `protected_roots`).

### Fase 2 — Confiança (5.9.14)
- Repositório Git iniciado; `.gitignore` exclui dados reais, binários e descartados.
- `README.md` unificado, `requirements.txt` (sem dependências externas), `verificar.bat`.
- Protocolo Gertec reescrito conforme SDK oficial e coberto por `tests/test_gertec_protocol.py`.

## Fase 3 — Refatoração (a conduzir pelo programador)

O objetivo é preservar o uso pelo vendedor: `iniciar_app.bat`, porta HTTP 8080,
Gertec TCP 6500 e a interface. Isso deve ser confirmado por testes após cada etapa,
não presumido. A Fase 3 não é requisito para continuar testando neste PC.

Manter a 5.9.14 estável e refatorar em uma cópia separada, por exemplo 5.9.15,
com controle de versão. Separar os dados de cada ambiente: um caminho externo
compartilhado não isola dados automaticamente. `SEG_DATA_DIR` é uma proposta
a implementar e validar, não uma configuração garantida nesta versão.
Instâncias simultâneas precisam de portas diferentes tanto para HTTP quanto
para Gertec; cada terminal deve apontar para a instância escolhida.

| # | Item | Motivação | Observações |
|---|------|-----------|-------------|
| 3.1 | Mover `data/` para fora da pasta do programa (`SEG_DATA_DIR`, padrão `%PROGRAMDATA%\SEG_Vendas\data`) | Atualizar o sistema vira "trocar a pasta do programa"; elimina o passo manual de copiar `data\` por cima | `DATA_DIR` já é uma constante única em `servidor.py`; `scripts/configurar_*.py` também apontam para `data/` |
| 3.2 | Consolidar `static/legacy/v55…v599` em módulos por funcionalidade | 17 camadas incrementais (~290 KB) carregadas em sequência dificultam manutenção | Mapa do que cada camada faz em `docs/ESTRUTURA_E_FUNCOES.md`; manter ordem de carga até a consolidação terminar |
| 3.3 | Dividir `servidor.py` (~3.600 linhas) em módulos: `auth`, `quotes`, `clients`, `gertec`, `network`, `http_handler` | Revisão e testes por área | A classe `GertecTerminalHandler` e `start_gertec_server()` já são isoláveis |
| 3.4 | Ampliar testes: autenticação, rate limit, permissões, APIs de orçamento | Hoje só conectores, replicação e Gertec têm testes | `tests/` usa `unittest`; `verificar.bat` roda tudo |
| 3.5 | Revisar `_descartados/` | Limpeza final | Excluir somente após confirmação explícita; ver `_descartados/LEIA-ME.txt` |

## Fase 4 — Preparação para Windows Server

| # | Item | Motivação |
|---|------|-----------|
| 4.1 | Avaliar serviço do Windows com wrapper compatível ou, como alternativa, Agendador de Tarefas ao iniciar | Agendamento não é serviço; `sc create` sozinho não adapta um script Python ao protocolo de serviços. Testar reinício e recuperação após falha |
| 4.2 | Implementar o diretório externo de dados e validar backup completo, retenção e restauração | Não presumir que a replicação cubra todos os CSV, JSON, SQLite, imagens e configurações; testar recuperação consistente |
| 4.3 | Firewall: restringir TCP 8080 (HTTP) e 6500 (Gertec) aos equipamentos/redes autorizados | Confirmar portas e IP fixo ou reserva DHCP; redirecionar os terminais somente na migração |
| 4.4 | Revisar `SEG_BIND_ADDRESS`, `SEG_ALLOWED_HOSTS` e `SEG_PUBLIC_URL` conforme o IP/nome do servidor | Validar configuração, Host e Origin no ambiente de destino |
| 4.5 | Planejar HTTPS para acesso autenticado, inclusive na rede interna, e revisar a implantação do servidor HTTP | Proteger senhas e sessões em trânsito; não expor diretamente o servidor HTTP embutido à internet |
| 4.6 | Conta técnica dedicada, sem privilégios de administrador; permissões mínimas e logs com rotação | Separar acesso ao código, dados, configuração e backups |
| 4.7 | Validar monitoramento de saúde, inicialização e compatibilidade do runtime com a versão escolhida do Windows Server | Testar no servidor de destino antes de liberar para uso |

## Fase 5 — Integração com o ERP Dataplace Symphony (em andamento)

Objetivo: sincronizar produtos, preços, estoque, clientes, pedidos de faturamento
e ordens de serviço. `dataplace_connector.py` e `offline_sync.py` já existem como
base. Decisões pendentes: método de acesso (HUB / Data Exchange / API), formato
dos arquivos, frequência e conta técnica.

Progresso em 14/09/2026:
- Implementado `tools/import_preview.py`: módulo de prévia de importação.
- Valida formato, conteúdo e compara com arquivos atuais (products.js, ean_map.js).
- Gera relatório JSON com erros, avisos e diferenças (novo, igual, alterado, ausente).
- Não grava nos arquivos de produção.
- Testado com arquivos válidos e inválidos.
- Documentado em `tools/README_IMPORT_PREVIEW.md`.

Enquanto isso, `tools/gerar_products.py` e `tools/gerar_ean_map.py` atualizam preços
a partir de CSV exportado do ERP.

## Fluxo de trabalho recomendado

1. Preservar uma cópia executável da 5.9.14 e um backup separado dos dados.
   Git não guarda os dados ignorados e não substitui backup.
2. Refatorar uma responsabilidade por vez em cópia separada com Git.
3. Rodar `verificar.bat` e validar navegador, persistência e terminais Gertec
   após cada etapa. Usar dados de laboratório separados dos dados de produção.
4. Gerar pacote de entrega sem dados reais, credenciais, `.git`, `__pycache__`
   ou `_descartados`. Revisar o conteúdo do ZIP; `.gitignore` não filtra ZIPs.
5. Antes da implantação, testar instalação, reinício, backup e restauração no
   Windows Server. Definir uma janela de migração e impedir gravações durante
   a transferência final dos dados.
6. Migrar os dados apenas por procedimento explícito de backup/restauração,
   ajustar os terminais Gertec para o servidor e validar os fluxos principais.
7. Manter pacote anterior e backup compatível para retorno. Reverter código
   não reverte alterações de dados; documentar e testar ambos os procedimentos.
