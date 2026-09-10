#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gerar_ean_map.py

Gera o arquivo ean_map.js a partir do relatorio de produtos exportado do Dataplace.

O ean_map.js associa codigos de barras (EAN/GTIN) aos codigos internos do SEG Vendas,
sem alterar precos, descricoes ou outras informacoes do catalogo existente.

Uso:
    python gerar_ean_map.py -e "C:/Users/RENATO/Desktop/relatorio de produto.csv" -s "../01_versoes/SEG_Vendas_5.9.13_Premium_Principal/eans_map.js"
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
        description="Gera ean_map.js com mapeamento EAN -> codigo interno do SEG Vendas."
    )
    parser.add_argument(
        "--entrada", "-e",
        required=True,
        help="Caminho do relatorio CSV exportado do Dataplace (separador ;)."
    )
    parser.add_argument(
        "--saida", "-s",
        default="..\\01_versoes\\SEG_Vendas_5.9.13_Premium_Principal\\ean_map.js",
        help="Caminho do ean_map.js a ser gerado."
    )
    return parser.parse_args()


def is_valid_barcode(value: str) -> bool:
    """Valida se o texto e um codigo de barras legivel (numerico, 4 a 14 digitos).

    Aceita EAN-8, EAN-12, EAN-13, EAN-14 e tambem codigos internos menores que
    as vezes sao usados como codigo de barras no proprio produto.
    """
    text = re.sub(r"\D", "", str(value).strip())
    return text != "" and 4 <= len(text) <= 14


def normalize_code(value: str) -> str:
    """Remove espacos e valida o codigo interno."""
    code = str(value).strip()
    if not code:
        return ""
    if len(code) > 80:
        return ""
    if not re.fullmatch(r"[A-Za-z0-9._\-]+", code):
        return ""
    return code


def backup_file(path: Path) -> Path | None:
    if not path.exists():
        return None
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = path.parent / "backups_ferramentas"
    backup_dir.mkdir(exist_ok=True)
    backup_path = backup_dir / f"ean_map.js.{timestamp}.bkp"
    shutil.copy2(path, backup_path)
    return backup_path


def main():
    args = parse_args()
    entrada = Path(args.entrada).resolve()
    saida = Path(args.saida).resolve()

    if not entrada.exists():
        print(f"Erro: arquivo de entrada nao encontrado: {entrada}")
        sys.exit(1)

    ean_map = {}
    skipped = 0
    invalid = 0

    with entrada.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f, delimiter=";")
        try:
            next(reader)  # cabecalho
        except StopIteration:
            print("Erro: arquivo CSV vazio.")
            sys.exit(1)

        for row in reader:
            if not row or len(row) < 4:
                skipped += 1
                continue

            code = normalize_code(row[1])
            ean_text = str(row[3]).strip().upper()

            if not code:
                invalid += 1
                continue

            if ean_text in ("", "SEM GTIN"):
                skipped += 1
                continue

            ean = re.sub(r"\D", "", ean_text)
            if not is_valid_barcode(ean):
                invalid += 1
                continue

            if ean in ean_map and ean_map[ean] != code:
                print(f"Aviso: EAN {ean} associado a mais de um codigo ({ean_map[ean]} e {code}). Mantido o primeiro.")
                continue

            ean_map[ean] = code

    if not ean_map:
        print("Erro: nenhum EAN valido foi encontrado no relatorio.")
        sys.exit(1)

    if saida.exists():
        backup = backup_file(saida)
        if backup:
            print(f"Backup criado: {backup}")

    lines = ["const EAN_MAP = {"]
    for ean in sorted(ean_map.keys(), key=lambda x: (len(x), x)):
        lines.append(f'  "{ean}": "{ean_map[ean]}",')
    lines.append("};")
    content = "\n".join(lines)

    saida.write_text(content, encoding="utf-8")
    print(f"\nean_map.js gerado: {saida}")
    print(f"Total de associacoes EAN -> codigo: {len(ean_map)}")
    print(f"Linhas ignoradas: {skipped}")
    print(f"Codigos/EANs invalidos: {invalid}")


if __name__ == "__main__":
    main()
