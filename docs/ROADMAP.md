# Roadmap técnico — SEG Vendas

Situação em setembro/2026: a versão 5.9.13 roda em produção na loja; a 5.9.14
(esta pasta, com Git) é o laboratório. Se aprovado, o sistema será realocado em
um Windows Server.

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

Nenhum item altera o uso pelo vendedor: `iniciar_app.bat`, porta 8080, Gertec 6500
e a interface permanecem iguais. Todos podem ser feitos e testados no laboratório
sem afetar a loja.

| # | Item | Motivação | Observações |
|---|------|-----------|-------------|
| 3.1 | Mover `data/` para fora da pasta do programa (`SEG_DATA_DIR`, padrão `%PROGRAMDATA%\SEG_Vendas\data`) | Atualizar o sistema vira "trocar a pasta do programa"; elimina o passo manual de copiar `data\` por cima | `DATA_DIR` já é uma constante única em `servidor.py`; `scripts/configurar_*.py` também apontam para `data/` |
| 3.2 | Consolidar `static/legacy/v55…v599` em módulos por funcionalidade | 17 camadas incrementais (~290 KB) carregadas em sequência dificultam manutenção | Mapa do que cada camada faz em `docs/ESTRUTURA_E_FUNCOES.md`; manter ordem de carga até a consolidação terminar |
| 3.3 | Dividir `servidor.py` (~3.600 linhas) em módulos: `auth`, `quotes`, `clients`, `gertec`, `network`, `http_handler` | Revisão e testes por área | A classe `GertecTerminalHandler` e `start_gertec_server()` já são isoláveis |
| 3.4 | Ampliar testes: autenticação, rate limit, permissões, APIs de orçamento | Hoje só conectores, replicação e Gertec têm testes | `tests/` usa `unittest`; `verificar.bat` roda tudo |
| 3.5 | Revisar `_descartados/` e apagar | Limpeza final | Ver `_descartados/LEIA-ME.txt` |

## Fase 4 — Preparação para Windows Server

| # | Item | Motivação |
|---|------|-----------|
| 4.1 | Executar como serviço do Windows (NSSM, `sc create` ou Agendador de Tarefas "ao iniciar") | Hoje o servidor vive numa janela CMD; fechar a janela derruba o sistema |
| 4.2 | Definir `SEG_DATA_DIR` (depende de 3.1) e política de backup para disco/pasta de rede | O backup periódico já existe em `store_replication.py`; falta o destino |
| 4.3 | Firewall: liberar TCP 8080 (HTTP) e 6500 (Gertec) somente na rede interna | Mesmo cenário da loja |
| 4.4 | `SEG_BIND_ADDRESS`, `SEG_ALLOWED_HOSTS` e `SEG_PUBLIC_URL` conforme o IP/nome do servidor | Validação de `Host`/`Origin` já existe e depende dessas variáveis |
| 4.5 | HTTPS (proxy reverso ou certificado interno) se houver acesso fora da rede local | Cookies/sessão e senhas em trânsito |
| 4.6 | Conta técnica dedicada para o serviço, sem privilégios de administrador | Princípio do menor privilégio |
| 4.7 | Monitoramento simples: `GET /healthz` já responde `{"ok": true, "version": ...}` | Pode ser usado por qualquer ferramenta de monitoramento |

## Fase 5 — Integração com o ERP Dataplace Symphony (pausada)

Objetivo: sincronizar produtos, preços, estoque, clientes, pedidos de faturamento
e ordens de serviço. `dataplace_connector.py` e `offline_sync.py` já existem como
base. Decisões pendentes: método de acesso (HUB / Data Exchange / API), formato
dos arquivos, frequência e conta técnica. Enquanto isso, `tools/gerar_products.py`
e `tools/gerar_ean_map.py` atualizam preços a partir de CSV exportado do ERP.

## Fluxo de trabalho recomendado

1. Toda alteração é feita na pasta com Git e registrada com commit.
2. `verificar.bat` antes de qualquer entrega.
3. Entrega = ZIP em `02_Distribuicao` (excluir `.git`, `__pycache__`, `_descartados`).
4. A versão em produção nunca é editada diretamente; se algo falhar, volta-se à
   versão anterior pelo Git ou pelo ZIP anterior.
