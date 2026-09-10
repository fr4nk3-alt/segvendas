# SEG Vendas — projeto principal

Esta pasta é a fonte de código do projeto principal. Não existe uma linha de
produto separada chamada “Beta”: cada melhoria será incorporada aqui, com
versionamento, testes e uma cópia de segurança antes da atualização das lojas.

## Regra de dados

Os dados reais de clientes, funcionários, senhas, fotos e históricos ficam
fora do repositório de código. Antes de qualquer migração, faça um backup da
pasta `data` da instalação em uso e mantenha uma cópia recuperável. O pacote
distribuível deve conter somente modelos e instruções demonstrativos.

## Fonte de verdade do código

- Backend: `servidor.py`.
- Interface: `index.html`, `app.js`, `styles.css` e arquivos `v*.js/css`.
- Operação offline: `store_replication.py` e `data/store_replica.sqlite3`.
- Conector da nuvem: `supabase_connector.py`.
- Schema central: `supabase/schema.sql`.
- Instalação e configuração: `INSTALAR_SEG_VENDAS.bat`, `iniciar_app.bat` e
  `scripts/CONFIGURAR_SUPABASE.bat`.

## Critério para cada melhoria

1. Reproduzir o problema ou definir o comportamento esperado.
2. Alterar o código principal sem copiar uma versão paralela.
3. Testar login, orçamento, histórico, permissões, offline e sincronização.
4. Fazer backup da instalação e só então atualizar as lojas.
5. Registrar a mudança no histórico da versão.

O Supabase centraliza os eventos compartilháveis, mas não substitui a cópia
local de cada loja. A sincronização de clientes, produtos e preços deverá usar
regras de conflito explícitas antes de ser liberada para edição simultânea.
