# Import Preview — Prévia de Importação do Dataplace

Este módulo analisa arquivos exportados do Dataplace antes de qualquer atualização
na base do SEG Vendas. Ele não grava nos arquivos de produção.

## Propósito

- Validar formato e conteúdo do arquivo recebido;
- Comparar com os arquivos atuais (products.js, ean_map.js);
- Gerar um relatório JSON com diferenças, erros e recomendações;
- Evitar aplicação automática de dados inválidos ou incompletos.

## Uso

### Análise básica (sem comparação)

```cmd
cd C:\Users\RENATO\Desktop\SEG\01_versoes\SEG_Vendas_5.9.14_Reorganizado
runtime\python.exe tools\import_preview.py --arquivo "relatorio.csv" --tipo produtos
```

Gera `preview.json` na mesma pasta do arquivo de entrada.

### Análise com comparação contra a base atual

```cmd
runtime\python.exe tools\import_preview.py --arquivo "relatorio.csv" --tipo produtos --comparar
```

Compara com `products.js` e `ean_map.js` na raiz do projeto.

### Especificar arquivo de saída

```cmd
runtime\python.exe tools\import_preview.py --arquivo "relatorio.csv" --tipo produtos --comparar --saida "analise.json"
```

## Formato esperado do CSV

Colunas reconhecidas (maiúsculas/minúsculas/variações aceitas):

- `Código` ou `codigo`: código interno do produto (obrigatório).
- `Descrição` ou `descricao`: nome do produto (obrigatório).
- `Código de Barras` ou `ean`: código de barras EAN/GTIN (opcional).
- `Valor` ou `Preço`: preço de venda (obrigatório).

Separador: `;` (detectado automaticamente).

## Relatório gerado

O arquivo JSON contém:

- `tipo`: tipo de importação (produtos, ean, etc.).
- `arquivo_origem`: caminho do arquivo analisado.
- `hash_sha256`: hash do arquivo para rastreabilidade.
- `data_hora`: data e hora UTC da análise.
- `total_linhas`: total de linhas do arquivo.
- `linhas_validas`: linhas que passaram na validação.
- `linhas_invalidas`: linhas com erro que impedem a importação.
- `linhas_ignoradas`: linhas com aviso (não impedem).
- `total_produtos`: quantidade de produtos válidos.
- `codigos_duplicados`: lista de códigos duplicados encontrados.
- `problemas`: lista detalhada de erros e avisos.
- `comparacao`: diferenças contra a base atual.
- `resumo`: contagem de produtos novos, iguais, alterados e ausentes.

## Estados de comparação

- `novo`: produto existe no arquivo recebido, mas não na base atual.
- `igual`: produto existe nos dois, sem diferenças em descrição e preço.
- `alterado`: produto existe nos dois, com descrição ou preço diferentes.
- `ausente`: produto existe na base atual, mas não foi recebido no arquivo.

## Importante

**Este módulo não grava nenhum dado em products.js, ean_map.js ou em qualquer
outro arquivo de produção.** Ele serve apenas para análise e decisão.

A aplicação real dos dados será implementada em uma etapa posterior, com:
- confirmação explícita;
- backup anterior;
- escrita atômica;
- auditoria;
- retenção da versão anterior.

## Exemplo de saída

```json
{
  "tipo": "produtos",
  "arquivo_origem": "C:\\...\\relatorio.csv",
  "hash_sha256": "...",
  "data_hora": "2026-09-14T14:05:53+00:00",
  "total_linhas": 5,
  "linhas_validas": 5,
  "linhas_invalidas": 0,
  "linhas_ignoradas": 0,
  "total_produtos": 5,
  "codigos_duplicados": [],
  "problemas": [],
  "comparacao": [
    {
      "codigo": "10001",
      "estado": "alterado",
      "atual": {"desc": "...", "price": 12.0},
      "recebido": {"desc": "...", "price": 12.5, "ean": "..."},
      "campos_alterados": ["descricao", "preco"]
    }
  ],
  "resumo": {
    "novo": 3,
    "igual": 0,
    "alterado": 2,
    "ausente": 6603
  }
}
```
