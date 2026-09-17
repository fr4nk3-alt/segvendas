#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
import_preview.py

Módulo reutilizável para importação controlada de dados do Dataplace.

Fluxo de prévia:
arquivo recebido -> validação -> comparação -> relatório

Não grava nos arquivos de produção. Gera apenas um relatório JSON/JSONL
com a análise de diferenças, validações e recomendações.

Uso básico:
    python import_preview.py --arquivo "relatorio.csv" --tipo produtos
"""

import argparse
import csv
import hashlib
import json
import re
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


@dataclass
class ValidationIssue:
    """Representa um problema de validação encontrado."""
    linha: int
    tipo: str  # "erro", "aviso"
    codigo: Optional[str]
    campo: str
    mensagem: str
    valor: Any = None


@dataclass
class ProductRecord:
    """Registro de produto do Dataplace."""
    codigo: str
    descricao: str
    preco: Optional[float]
    ean: Optional[str]
    linha: int
    valido: bool
    erros: List[str]


@dataclass
class ComparisonResult:
    """Resultado da comparação entre arquivo recebido e base atual."""
    codigo: str
    estado: str  # "novo", "igual", "alterado", "ausente"
    atual: Optional[Dict[str, Any]]
    recebido: Optional[Dict[str, Any]]
    campos_alterados: List[str]


@dataclass
class PreviewReport:
    """Relatório completo da prévia de importação."""
    tipo: str  # "produtos", "ean", "clientes", "funcionarios"
    arquivo_origem: str
    hash_sha256: str
    data_hora: str
    total_linhas: int
    linhas_validas: int
    linhas_invalidas: int
    linhas_ignoradas: int
    total_produtos: int
    codigos_duplicados: List[str]
    problemas: List[ValidationIssue]
    comparacao: List[ComparisonResult]
    resumo: Dict[str, int]


def calcular_hash(arquivo: Path) -> str:
    """Calcula SHA-256 do arquivo."""
    sha256 = hashlib.sha256()
    with arquivo.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def parse_price(value: Any) -> Optional[float]:
    """Converte texto de preço para float, aceitando formatos brasileiros."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    text = text.replace("R$", "").replace("$", "").replace(" ", "")
    if not text:
        return None
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        price = float(text)
    except ValueError:
        return None
    if price < 0:
        return None
    return price


def validate_code(value: Any) -> Tuple[Optional[str], Optional[str]]:
    """Valida código do produto. Retorna (codigo, erro)."""
    if value is None:
        return None, "código vazio"
    code = str(value).strip()
    if not code:
        return None, "código vazio"
    if len(code) > 80:
        return None, "código muito longo (máximo 80 caracteres)"
    if not re.fullmatch(r"[A-Za-z0-9._\-]+", code):
        return None, f"código inválido: '{code}' (use apenas letras, números, ponto, hífen e underscore)"
    return code, None


def validate_ean(value: Any) -> Tuple[Optional[str], Optional[str]]:
    """Valida código de barras EAN/GTIN. Retorna (ean, erro)."""
    if value is None:
        return None, None
    text = str(value).strip().upper()
    if not text or text in ("", "SEM GTIN", "N/A"):
        return None, None
    ean = re.sub(r"\D", "", text)
    if not ean:
        return None, None
    if not (4 <= len(ean) <= 14):
        return None, f"EAN com comprimento inválido: {len(ean)} dígitos (esperado 4-14)"
    return ean, None


def ler_relatorio_dataplace(arquivo: Path) -> Tuple[List[Dict[str, str]], str]:
    """Lê relatório CSV do Dataplace e retorna (linhas, delimitador)."""
    if not arquivo.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {arquivo}")

    if arquivo.suffix.lower() != ".csv":
        raise ValueError("Atualmente suportamos apenas arquivos CSV do Dataplace")

    linhas = []
    delimitador = ";"

    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            with arquivo.open("r", encoding=encoding, newline="") as f:
                sniffer = csv.Sniffer()
                sample = f.read(1024)
                f.seek(0)
                delimitador = sniffer.sniff(sample).delimiter
                reader = csv.DictReader(f, delimiter=delimitador)
                linhas = [row for row in reader]
            break
        except (UnicodeDecodeError, csv.Error):
            continue
    else:
        raise ValueError("Não foi possível decodificar o arquivo (tentamos utf-8-sig, cp1252, latin-1)")

    return linhas, delimitador


def mapear_colunas_dataplace(cabecalhos: List[str]) -> Dict[str, str]:
    """Mapeia colunas do Dataplace para nomes padrão."""
    mapping = {
        "codigo": ["Código", "codigo", "code", "Cd."],
        "descricao": ["Descrição", "descricao", "desc", "Nome", "nome"],
        "ean": ["Código de Barras", "ean", "gtin", "Cd. Barras"],
        "preco": ["Valor", "Preço", "preco", "price", "Valor de Mercado"],
    }

    mapa = {}
    cabecalhos_normalizados = [h.strip().lower() for h in cabecalhos]

    for padrao, variantes in mapping.items():
        for v in variantes:
            if v.lower() in cabecalhos_normalizados:
                idx = cabecalhos_normalizados.index(v.lower())
                mapa[padrao] = cabecalhos[idx]
                break

    return mapa


def processar_produtos_dataplace(linhas: List[Dict[str, str]], mapa_colunas: Dict[str, str]) -> Tuple[List[ProductRecord], List[ValidationIssue]]:
    """Processa linhas do Dataplace e retorna (produtos, problemas)."""
    produtos = []
    problemas = []
    codigos_vistos: Set[str] = set()
    duplicados: Set[str] = set()

    for idx, linha in enumerate(linhas, start=2):
        raw_codigo = linha.get(mapa_colunas.get("codigo", ""), "")
        raw_descricao = linha.get(mapa_colunas.get("descricao", ""), "")
        raw_preco = linha.get(mapa_colunas.get("preco", ""), "")
        raw_ean = linha.get(mapa_colunas.get("ean", ""), "")

        codigo, erro_codigo = validate_code(raw_codigo)
        if erro_codigo:
            problemas.append(ValidationIssue(
                linha=idx, tipo="erro", codigo=raw_codigo, campo="codigo",
                mensagem=erro_codigo, valor=raw_codigo
            ))
            continue

        if codigo in codigos_vistos:
            duplicados.add(codigo)
            problemas.append(ValidationIssue(
                linha=idx, tipo="erro", codigo=codigo, campo="codigo",
                mensagem=f"código duplicado: '{codigo}'", valor=codigo
            ))
            continue

        codigos_vistos.add(codigo)

        descricao = str(raw_descricao).strip()
        if not descricao:
            problemas.append(ValidationIssue(
                linha=idx, tipo="erro", codigo=codigo, campo="descricao",
                mensagem="descrição vazia", valor=raw_descricao
            ))
            continue

        if len(descricao) > 500:
            problemas.append(ValidationIssue(
                linha=idx, tipo="aviso", codigo=codigo, campo="descricao",
                mensagem=f"descrição truncada para 500 caracteres (original: {len(descricao)})", valor=len(descricao)
            ))
            descricao = descricao[:500]

        preco = parse_price(raw_preco)
        if preco is None:
            problemas.append(ValidationIssue(
                linha=idx, tipo="erro", codigo=codigo, campo="preco",
                mensagem=f"preço inválido: '{raw_preco}'", valor=raw_preco
            ))
            continue

        ean, erro_ean = validate_ean(raw_ean)
        if erro_ean:
            problemas.append(ValidationIssue(
                linha=idx, tipo="aviso", codigo=codigo, campo="ean",
                mensagem=erro_ean, valor=raw_ean
            ))

        produtos.append(ProductRecord(
            codigo=codigo,
            descricao=descricao,
            preco=preco,
            ean=ean,
            linha=idx,
            valido=True,
            erros=[]
        ))

    produtos_validos = [p for p in produtos if p.valido]
    return produtos_validos, problemas


def ler_products_js(caminho: Path) -> Dict[str, Dict[str, Any]]:
    """Lê o arquivo products.js atual e retorna dicionário {codigo: {desc, price}}."""
    if not caminho.exists():
        return {}

    conteudo = caminho.read_text(encoding="utf-8")
    if not conteudo.startswith("const PRODUCTS = ["):
        raise ValueError("Formato inválido de products.js")

    try:
        inicio = conteudo.find("[")
        fim = conteudo.rfind("]") + 1
        if inicio == -1 or fim == 0:
            raise ValueError("Não foi possível encontrar o array PRODUCTS")
        array_str = conteudo[inicio:fim]
        import ast
        produtos = ast.literal_eval(array_str)
        return {p[0]: {"desc": p[1], "price": p[2]} for p in produtos}
    except Exception as e:
        raise ValueError(f"Erro ao interpretar products.js: {e}")


def ler_ean_map_js(caminho: Path) -> Dict[str, str]:
    """Lê o arquivo ean_map.js atual e retorna dicionário {ean: codigo}."""
    if not caminho.exists():
        return {}

    conteudo = caminho.read_text(encoding="utf-8")
    if not conteudo.startswith("const EAN_MAP = {"):
        raise ValueError("Formato inválido de ean_map.js")

    try:
        inicio = conteudo.find("{")
        fim = conteudo.rfind("}") + 1
        if inicio == -1 or fim == 0:
            raise ValueError("Não foi possível encontrar o objeto EAN_MAP")
        objeto_str = conteudo[inicio:fim]
        import ast
        return ast.literal_eval(objeto_str)
    except Exception as e:
        raise ValueError(f"Erro ao interpretar ean_map.js: {e}")


def comparar_produtos(recebidos: List[ProductRecord], atual_produto: Dict[str, Dict[str, Any]], atual_ean: Dict[str, str]) -> List[ComparisonResult]:
    """Compara produtos recebidos com a base atual."""
    resultados = []
    recebidos_por_codigo = {p.codigo: p for p in recebidos}

    for codigo, produto in recebidos_por_codigo.items():
        atual = atual_produto.get(codigo)
        recebido = {"desc": produto.descricao, "price": produto.preco, "ean": produto.ean}

        if atual is None:
            resultados.append(ComparisonResult(
                codigo=codigo,
                estado="novo",
                atual=None,
                recebido=recebido,
                campos_alterados=[]
            ))
        else:
            campos_alterados = []
            if atual.get("desc") != produto.descricao:
                campos_alterados.append("descricao")
            if atual.get("price") != produto.preco:
                campos_alterados.append("preco")

            estado = "alterado" if campos_alterados else "igual"
            resultados.append(ComparisonResult(
                codigo=codigo,
                estado=estado,
                atual=atual,
                recebido=recebido,
                campos_alterados=campos_alterados
            ))

    for codigo in atual_produto:
        if codigo not in recebidos_por_codigo:
            resultados.append(ComparisonResult(
                codigo=codigo,
                estado="ausente",
                atual=atual_produto[codigo],
                recebido=None,
                campos_alterados=[]
            ))

    return resultados


def gerar_relatorio_preview(tipo: str, arquivo_origem: str, hash_sha256: str,
                           linhas: List[ProductRecord], problemas: List[ValidationIssue],
                           comparacao: List[ComparisonResult]) -> PreviewReport:
    """Gera o relatório completo da prévia."""
    total_linhas = len(linhas) + len([p for p in problemas if p.tipo == "erro"])
    linhas_validas = len(linhas)
    linhas_invalidas = len([p for p in problemas if p.tipo == "erro"])
    linhas_ignoradas = len([p for p in problemas if p.tipo == "aviso"])

    codigos_duplicados = []
    for p in problemas:
        if "duplicado" in p.mensagem.lower() and p.codigo:
            if p.codigo not in codigos_duplicados:
                codigos_duplicados.append(p.codigo)

    resumo = {
        "novo": len([c for c in comparacao if c.estado == "novo"]),
        "igual": len([c for c in comparacao if c.estado == "igual"]),
        "alterado": len([c for c in comparacao if c.estado == "alterado"]),
        "ausente": len([c for c in comparacao if c.estado == "ausente"]),
    }

    return PreviewReport(
        tipo=tipo,
        arquivo_origem=arquivo_origem,
        hash_sha256=hash_sha256,
        data_hora=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        total_linhas=total_linhas,
        linhas_validas=linhas_validas,
        linhas_invalidas=linhas_invalidas,
        linhas_ignoradas=linhas_ignoradas,
        total_produtos=linhas_validas,
        codigos_duplicados=codigos_duplicados,
        problemas=problemas,
        comparacao=comparacao,
        resumo=resumo
    )


def salvar_relatorio(relatorio: PreviewReport, arquivo_saida: Path) -> None:
    """Salva o relatório em formato JSON."""
    with arquivo_saida.open("w", encoding="utf-8") as f:
        json.dump(asdict(relatorio), f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="Prévia de importação de dados do Dataplace (não grava na base)"
    )
    parser.add_argument("--arquivo", "-a", required=True, help="Arquivo CSV do Dataplace")
    parser.add_argument("--tipo", "-t", default="produtos", choices=["produtos", "ean"], help="Tipo de importação")
    parser.add_argument("--saida", "-s", help="Arquivo JSON para salvar o relatório (padrão: preview.json)")
    parser.add_argument("--comparar", "-c", action="store_true", help="Comparar com arquivos atuais (products.js, ean_map.js)")
    args = parser.parse_args()

    arquivo_entrada = Path(args.arquivo).resolve()
    if not arquivo_entrada.exists():
        print(f"Erro: arquivo não encontrado: {arquivo_entrada}")
        sys.exit(1)

    hash_arquivo = calcular_hash(arquivo_entrada)
    print(f"Lendo arquivo: {arquivo_entrada}")
    print(f"SHA-256: {hash_arquivo}")

    try:
        linhas, delimitador = ler_relatorio_dataplace(arquivo_entrada)
        print(f"Linhas lidas: {len(linhas)}")
        print(f"Delimitador detectado: '{delimitador}'")

        if not linhas:
            print("Erro: arquivo vazio")
            sys.exit(1)

        cabecalhos = list(linhas[0].keys()) if linhas else []
        print(f"Cabeçalhos: {cabecalhos}")

        mapa_colunas = mapear_colunas_dataplace(cabecalhos)
        print(f"Colunas mapeadas: {mapa_colunas}")

        produtos, problemas = processar_produtos_dataplace(linhas, mapa_colunas)
        print(f"Produtos válidos: {len(produtos)}")
        print(f"Problemas encontrados: {len(problemas)}")

        comparacao = []
        if args.comparar:
            projeto = arquivo_entrada.parent.parent
            products_js = projeto / "products.js"
            ean_map_js = projeto / "ean_map.js"

            atual_produto = ler_products_js(products_js)
            atual_ean = ler_ean_map_js(ean_map_js)

            print(f"Produtos atuais: {len(atual_produto)}")
            print(f"EANs atuais: {len(atual_ean)}")

            comparacao = comparar_produtos(produtos, atual_produto, atual_ean)
            print(f"Comparações: {len(comparacao)}")

        relatorio = gerar_relatorio_preview(
            tipo=args.tipo,
            arquivo_origem=str(arquivo_entrada),
            hash_sha256=hash_arquivo,
            linhas=produtos,
            problemas=problemas,
            comparacao=comparacao
        )

        arquivo_saida = Path(args.saida) if args.saida else arquivo_entrada.parent / "preview.json"
        salvar_relatorio(relatorio, arquivo_saida)
        print(f"\nRelatório salvo: {arquivo_saida}")

        print("\nResumo:")
        for k, v in relatorio.resumo.items():
            print(f"  {k}: {v}")

        if relatorio.linhas_invalidas > 0:
            print(f"\nATENÇÃO: {relatorio.linhas_invalidas} linhas inválidas encontradas")
            for p in relatorio.problemas[:10]:
                if p.tipo == "erro":
                    print(f"  Linha {p.linha} ({p.codigo}): {p.mensagem}")

    except Exception as e:
        print(f"Erro: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
