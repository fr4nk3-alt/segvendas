# Preparação do Supabase

1. No projeto `ggwwttitfklozyiwbsfe`, abra **SQL Editor**.
2. Cole e execute o arquivo `schema.sql` uma única vez.
3. No computador que roda o SEG Vendas, execute `CONFIGURAR_SUPABASE.bat`.
4. Informe a chave secreta quando o script pedir. Ela será salva somente em
   `data/supabase_config.json`, que não faz parte do Git nem do pacote público.
5. Reinicie o servidor e verifique a situação em **Ajustes → Replicação**.

O Supabase é o banco central. Cada filial continua usando a fila SQLite e os
backups locais quando a internet cai. O navegador nunca recebe a chave secreta.

## Chaves

Use a chave `secret`/`service_role` somente no computador que executa
`servidor.py`. Nunca coloque essa chave em `app.js`, em um arquivo público ou
em uma mensagem. A chave `anon` não substitui a chave do servidor para esta
integração.
