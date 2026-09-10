# Fluxo recomendado para novas alterações

## 1. Localizar a área

- Tela e textos: `index.html`.
- Estilo: `styles.css` ou uma nova camada `vXXX.css`.
- Regra de negócio do navegador: `app.js` ou uma nova camada `vXXX.js`.
- API, segurança ou gravação: `servidor.py`.
- Dados persistentes: somente os arquivos necessários dentro de `data/`.

## 2. Criar uma camada versionada

Para uma melhoria de interface independente, crie `v600.js` e `v600.css`, carregue ambos depois de `v599` e registre a alteração em `ALTERACOES_V5_9_10.txt`. Isso reduz o risco de quebrar recursos que já estão sendo usados.

## 3. Alterar o servidor somente quando necessário

Qualquer dado recebido do navegador deve ser validado no servidor. A interface pode esconder um botão, mas a permissão real precisa existir em `servidor.py`.

## 4. Testar antes de distribuir

```text
node --check *.js
python -c "import ast, pathlib; ast.parse(pathlib.Path('servidor.py').read_text(encoding='utf-8'))"
validar manifest.webmanifest
verificar ícones, PDFs e ausência de __pycache__/ .pyc
testar instalação e atualização preservando data/
```

## 5. Empacotar

1. Remova resíduos de teste e caches.
2. Preserve `data/` da instalação existente por meio do instalador.
3. Gere o ZIP com uma pasta nova de versão.
4. Teste login, orçamento, cesta, histórico, fotos, manuais, avatar e instalação PWA.

## O que fica onde

```text
Código de produto       → products.js / app.js
Interface               → index.html / styles.css / v*.css
Comportamento do avatar → v57–v599
Regra e API             → servidor.py
Dados                   → data/
Documentos técnicos     → manuais/
Bibliotecas externas    → vendor/
Python portátil         → runtime/
Documentação            → docs/
```
