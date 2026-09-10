# Ferramenta de geracao do products.js

Este script gera o arquivo `products.js` do SEG Vendas a partir de uma planilha CSV ou Excel.

## Colunas esperadas

| Coluna | Obrigatoria | Exemplo | Descricao |
|---|---|---|---|
| `codigo` | Sim | `10001` | Codigo unico do produto. Use apenas letras, numeros, ponto, hifen e underscore. |
| `descricao` | Sim | `CAPACITOR 15UF X 250V` | Nome/descricao do produto. |
| `preco` | Sim | `12.00` | Preco de venda. Aceita `12.00`, `12,00`, `1.234,56`. |
| `foto` | Nao | `C:\\fotos\\10001.jpg` | Caminho da foto do produto. Usado somente com `--fotos`. |
| `ativo` | Nao | `sim` | Use `sim`/`nao` para ignorar produtos inativos (com `--ativos`). |

## Modelo

O arquivo `modelo_produtos.csv` ja esta pronto para ser preenchido.

## Como usar

### 1. Preencher a planilha

Abra `modelo_produtos.csv` no Excel ou editores de texto e adicione seus produtos.

### 2. Gerar o products.js

Execute no prompt de comando:

```cmd
cd "C:\\Users\\RENATO\\Desktop\\SEG\\ferramentas"
python gerar_products.py -e modelo_produtos.csv -s "..\\products.js"
```

### 3. Copiar fotos (opcional)

Se a planilha tiver a coluna `foto`, adicione `--fotos`:

```cmd
python gerar_products.py -e modelo_produtos.csv -s "..\\products.js" --fotos
```

## Regras importantes

- O script faz backup automatico do `products.js` anterior.
- Codigos duplicados ou invalidos impedem a geracao.
- O preco zero e permitido, mas nao pode ser negativo.
- Descricoes vazias ou muito longas sao rejeitadas.

# Mapeamento de codigo de barras (EAN)

O arquivo `ean_map.js` associa codigos de barras lidos por camera ou leitor Gertec aos codigos internos do SEG Vendas, sem alterar precos ou descricoes do catalogo existente.

## Gerar o ean_map.js a partir do relatorio do Dataplace

Exporte o relatorio de produtos do Dataplace (separador `;`) e execute:

```cmd
cd "C:\Users\RENATO\Desktop\SEG\ferramentas"
python gerar_ean_map.py -e "C:\Users\RENATO\Desktop\relatorio de produto.csv" -s "..\ean_map.js"
```

O script le a coluna `Código de Barras` do relatorio e cria o mapeamento automaticamente. Produtos sem GTIN sao ignorados.

## Como funciona no SEG Vendas

1. Ao ler um codigo de barras com a camera, o `v572.js` consulta o `ean_map.js` e traduz o EAN para o codigo interno.
2. A busca de produtos (`app.js`) tambem aceita EAN digitado manualmente no campo de pesquisa.
3. O produto e exibido com o preco e descricao que ja existem no `products.js`.

## Integracao com leitor Gertec TCServer

O SEG Vendas possui um servidor TCP embutido (porta 6500) que atende terminais de consulta de precos Gertec (modelos TC501, SC501 e compativeis) usando o protocolo Gertec TCServer.

### Como funciona

```text
Leitor Gertec  --TCP porta 6500-->  SEG Vendas (servidor.py)
                                        |
                                        v
                                   products.js + ean_map.js
                                        |
                                        v
                                   Resposta ao display do leitor
```

1. O leitor Gertec e configurado para apontar ao IP do computador onde o SEG Vendas esta rodando.
2. Ao ler um codigo de barras, o leitor envia o codigo via TCP.
3. O SEG Vendas consulta o `ean_map.js` (EAN -> codigo interno) e o `products.js` (descricao + preco).
4. O preco e a descricao sao enviados de volta ao display do leitor.
5. Se o produto nao for encontrado, o leitor exibe "produto nao encontrado".

### Configuracao do leitor Gertec

No leitor Gertec, configure:

- **IP do servidor**: IP do computador onde o SEG Vendas esta rodando (ex.: `10.1.5.187`)
- **Porta**: `6500`
- **Mascara de rede**: mesma da rede local
- **IP do terminal**: um IP unico para cada leitor

Isso pode ser feito pelo display do leitor ou pelo software Gertec TCServer.

### Teste de comunicacao

Com o SEG Vendas rodando, voce pode testar a comunicacao com um cliente TCP simulado:

```python
import socket
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(("IP_DO_SERVIDOR", 6500))
print(sock.recv(255).decode())  # deve receber #ok
sock.sendall(b"#TC501|1.0")
print(sock.recv(255).decode())  # deve receber #alwayslive
sock.sendall(b"#alwayslive_ok")
sock.sendall(b"#7898962020067")  # envia EAN
print(sock.recv(255).decode())  # recebe descricao|preco
sock.close()
```

### Notas

- O servidor Gertec inicia automaticamente junto com o SEG Vendas.
- A porta 6500 e o padrao Gertec. Se precisar alterar, mude a constante `GERTEC_PORT` no `servidor.py`.
- O catalogo e o mapeamento EAN sao recarregados a cada consulta, entao atualizar o `ean_map.js` ou `products.js` nao exige reiniciar o servidor.
- Se a porta 6500 estiver em uso por outro programa, o servidor Gertec nao iniciara e mostrara um aviso no console.

## Integracao futura com Dataplace

Depois que a API do Dataplace HUB for homologada, este processo pode ser automatizado:

```text
Dataplace HUB  -->  script de sincronizacao  -->  products.js + ean_map.js + fotos  -->  SEG Vendas
```

Em vez de editar o CSV manualmente, o script consultara a API e atualizara produtos, precos, estoque e codigos de barras automaticamente.
