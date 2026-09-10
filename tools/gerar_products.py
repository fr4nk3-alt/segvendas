#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gerar_products.py

Gera o arquivo products.js do SEG Vendas a partir de uma planilha CSV ou Excel.

Uso basico:
    python gerar_products.py --entrada modelo_produtos.csv --saida "../01_versoes/SEG_Vendas_5.9.13_Premium_Principal/products.js"

O script:
- le uma planilha com colunas padrao (codigo, descricao, preco)
- valida codigos e precos
- faz backup do products.js anterior
- gera o arquivo no formato exato esperado pelo SEG Vendas
- (opcional) copia fotos para assets/products e data/fotos_produtos
"""

import argparse
import csv
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(
        description="Gera products.js do SEG Vendas a partir de CSV/Excel."
    )
    parser.add_argument(
        "--entrada", "-e",
        required=True,
        help="Caminho da planilha CSV ou Excel (.csv, .xlsx, .xls)."
    )
    parser.add_argument(
        "--saida", "-s",
        default="../01_versoes/SEG_Vendas_5.9.13_Premium_Principal/products.js",
        help="Caminho do products.js a ser gerado."
    )
    parser.add_argument(
        "--fotos", "-f",
        action="store_true",
        help="Copia fotos indicadas na coluna 'foto' para as pastas do projeto."
    )
    parser.add_argument(
        "--ativos",
        action="store_true",
        help="Ignora produtos marcados como inativos na coluna 'ativo'."
    )
    return parser.parse_args()


def parse_price(value):
    """Converte texto de preco para float, aceitando formatos brasileiros."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None

    # Remove simbolos comuns
    text = text.replace("R$", "").replace("$", "").replace(" ", "")

    if not text:
        return None

    # Detecta formato brasileiro com separador de milhar e decimal
    if "," in text and "." in text:
        # Ex: 1.234,56 -> 1234.56
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        # Ex: 1234,56 -> 1234.56
        text = text.replace(",", ".")
    # Se so houver ponto, assume decimal padrao: 1234.56

    try:
        price = float(text)
    except ValueError:
        return None

    if price < 0:
        return None
    return price


def normalize_header(header):
    """Mapeia variacoes de cabecalho para nomes padrao."""
    h = str(header).strip().lower().replace("ç", "c").replace("ã", "a").replace("õ", "o").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("â", "a").replace("ê", "e").replace("ô", "o")
    mapping = {
        "codigo": ["codigo", "code", "id", "sku", "referencia"],
        "descricao": ["descricao", "desc", "descricao", "nome", "produto", "titulo"],
        "preco": ["preco", "price", "valor", "venda", "preco_venda"],
        "foto": ["foto", "imagem", "image", "photo", "path_foto"],
        "ativo": ["ativo", "status", "ativo"],
        "categoria": ["categoria", "categoria", "category", "grupo"],
    }
    for standard, variants in mapping.items():
        if h in variants:
            return standard
    return h


def read_planilha(path: Path):
    """Le CSV ou Excel e retorna lista de dicionarios."""
    suffix = path.suffix.lower()

    if suffix == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            return [normalize_row(row) for row in reader]

    if suffix in (".xlsx", ".xls"):
        try:
            import openpyxl
        except ImportError:
            print("Erro: para ler Excel e necessario instalar openpyxl.")
            print("   pip install openpyxl")
            sys.exit(1)

        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb.active
        headers = [str(cell.value) if cell.value is not None else "" for cell in ws[1]]
        normalized_headers = [normalize_header(h) for h in headers]
        rows = []
        for raw in ws.iter_rows(min_row=2, values_only=True):
            if all(v is None or str(v).strip() == "" for v in raw):
                continue
            row = {}
            for key, value in zip(normalized_headers, raw):
                row[key] = value
            rows.append(row)
        return rows

    print(f"Erro: formato de arquivo nao suportado: {suffix}")
    sys.exit(1)


def normalize_row(row: dict):
    """Normaliza chaves do dicionario para padroes do script."""
    return {normalize_header(k): v for k, v in row.items()}


def validate_code(value):
    """Valida codigo do produto."""
    if value is None:
        return None, "codigo vazio"
    code = str(value).strip()
    if not code:
        return None, "codigo vazio"
    if len(code) > 80:
        return None, "codigo muito longo (maximo 80 caracteres)"
    if not re.fullmatch(r"[A-Za-z0-9._\-]+", code):
        return None, f"codigo invalido: '{code}' (use apenas letras, numeros, ponto, hifen e underscore)"
    return code, None


def process_rows(rows, skip_inactive=False):
    """Processa e valida todas as linhas."""
    products = []
    seen_codes = set()
    errors = []
    warnings = []
    skipped = 0

    for idx, row in enumerate(rows, start=2):  # start=2 porque linha 1 e cabecalho
        code_raw = row.get("codigo")
        if not code_raw or str(code_raw).strip() == "":
            # Pula linhas totalmente em branco no inicio
            if not row.get("descricao") and not row.get("preco"):
                skipped += 1
                continue
            errors.append(f"Linha {idx}: codigo nao informado.")
            continue

        code, err = validate_code(code_raw)
        if err:
            errors.append(f"Linha {idx}: {err}")
            continue

        if code in seen_codes:
            errors.append(f"Linha {idx}: codigo '{code}' duplicado.")
            continue
        seen_codes.add(code)

        if skip_inactive:
            ativo = str(row.get("ativo", "sim")).strip().lower()
            if ativo in ("nao", "não", "0", "f", "false", "inativo", "no"):
                skipped += 1
                continue

        descricao = str(row.get("descricao", "")).strip()
        if not descricao:
            errors.append(f"Linha {idx} (codigo {code}): descricao vazia.")
            continue
        if len(descricao) > 500:
            warnings.append(f"Linha {idx} (codigo {code}): descricao truncada para 500 caracteres.")
            descricao = descricao[:500]

        preco = parse_price(row.get("preco"))
        if preco is None:
            errors.append(f"Linha {idx} (codigo {code}): preco invalido '{row.get('preco')}'.")
            continue

        product = {
            "code": code,
            "desc": descricao,
            "price": preco,
            "foto": str(row.get("foto", "")).strip() if row.get("foto") else "",
        }
        products.append(product)

    return products, errors, warnings, skipped


def generate_products_js(products, output_path: Path):
    """Gera o arquivo products.js no formato exato do SEG Vendas."""
    entries = []
    for p in products:
        code = json_escape(p["code"])
        desc = json_escape(p["desc"])
        price = p["price"]
        entries.append(f'["{code}","{desc}",{price}]')

    # Formato final: const PRODUCTS = [["COD","DESC",PRECO],[...]];
    content = "const PRODUCTS = [\n" + ",\n".join(entries) + "\n]];"

    output_path.write_text(content, encoding="utf-8")
    return output_path


def json_escape(value: str) -> str:
    """Escapa aspas e caracteres especiais para string JSON/JavaScript."""
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").replace("\r", " ")


def backup_file(path: Path):
    """Cria backup numerado do arquivo."""
    if not path.exists():
        return None
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = path.parent / "backups_ferramentas"
    backup_dir.mkdir(exist_ok=True)
    backup_path = backup_dir / f"products.js.{timestamp}.bkp"
    shutil.copy2(path, backup_path)
    return backup_path


def copy_photos(products, project_dir: Path):
    """Copia fotos indicadas para assets/products e data/fotos_produtos."""
    assets_dir = project_dir / "assets" / "products"
    data_dir = project_dir / "data" / "fotos_produtos"
    assets_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    copied = 0
    missing = 0
    for p in products:
        foto_path = p.get("foto")
        if not foto_path:
            continue
        source = Path(foto_path)
        if not source.exists():
            print(f"  Aviso: foto nao encontrada: {source}")
            missing += 1
            continue

        ext = source.suffix.lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            print(f"  Aviso: extensao ignorada: {source}")
            continue

        # Converte nome para {codigo}.ext
        target_name = f"{p['code']}{ext}"
        shutil.copy2(source, assets_dir / target_name)
        shutil.copy2(source, data_dir / target_name)
        copied += 1

    return copied, missing


def main():
    args = parse_args()
    entrada = Path(args.entrada).resolve()
    saida = Path(args.saida).resolve()

    if not entrada.exists():
        print(f"Erro: arquivo de entrada nao encontrado: {entrada}")
        sys.exit(1)

    print(f"Lendo planilha: {entrada}")
    rows = read_planilha(entrada)
    print(f"Total de linhas lidas: {len(rows)}")

    products, errors, warnings, skipped = process_rows(rows, skip_inactive=args.ativos)

    if warnings:
        print("\nAvisos:")
        for w in warnings:
            print(f"  - {w}")

    if errors:
        print("\nErros encontrados:")
        for e in errors:
            print(f"  - {e}")
        print(f"\nCorrija os erros acima antes de gerar o products.js.")
        sys.exit(1)

    if not products:
        print("Nenhum produto valido encontrado. Verifique a planilha.")
        sys.exit(1)

    # Faz backup se products.js ja existir
    if saida.exists():
        backup = backup_file(saida)
        if backup:
            print(f"Backup criado: {backup}")

    generate_products_js(products, saida)
    print(f"\nproducts.js gerado: {saida}")
    print(f"Produtos ativos: {len(products)} | Ignorados: {skipped}")

    if args.fotos:
        project_dir = saida.parent
        copied, missing = copy_photos(products, project_dir)
        print(f"Fotos copiadas: {copied} | Nao encontradas: {missing}")

    print("\nPronto. Para testar, abra o SEG Vendas e confira o catalogo.")


if __name__ == "__main__":
    main()
