from __future__ import annotations

from getpass import getpass
from pathlib import Path
import hashlib
import json
import os
import re
import secrets
import time


ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "data" / "master_recovery.json"
ITERATIONS = 180_000


def digest(password: str) -> tuple[str, str]:
    salt = secrets.token_bytes(16)
    value = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return salt.hex(), value.hex()


def main() -> int:
    print("\nCONFIGURAR SENHA MESTRE - SEG VENDAS\n")
    print("A senha não será exibida e somente o resumo criptográfico será salvo.")
    print("Use pelo menos 12 caracteres, com letras e números.\n")
    first = getpass("Digite a nova senha mestre: ")
    second = getpass("Confirme a senha mestre: ")
    if first != second:
        print("\nERRO: as senhas não são iguais.")
        return 1
    if len(first) < 12 or not re.search(r"[A-Za-zÀ-ÿ]", first) or not re.search(r"\d", first):
        print("\nERRO: use pelo menos 12 caracteres, com letras e números.")
        return 1
    salt, value = digest(first)
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    temporary = TARGET.with_suffix(".json.tmp")
    temporary.write_text(json.dumps({
        "passwordSalt": salt,
        "passwordHash": value,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "iterations": ITERATIONS,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(TARGET)
    try:
        os.chmod(TARGET, 0o600)
    except OSError:
        pass
    print("\nSenha mestre configurada com sucesso.")
    print("Guarde-a em local seguro. Ela não pode ser visualizada pelo sistema.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
