"""Assistente local para configurar o Supabase sem expor a chave no chat."""

from __future__ import annotations

import argparse
import sys
import getpass
import json
from pathlib import Path
import tempfile
from urllib.parse import urlparse

from supabase_connector import SupabaseConfig, SupabaseClient, SupabaseError


DEFAULT_URL = "https://ggwwttitfklozyiwbsfe.supabase.co"
APP_DIR = Path(__file__).resolve().parent.parent
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))
DATA_DIR = APP_DIR / "data"
CONFIG_PATH = DATA_DIR / "supabase_config.json"


def ask_url(saved: dict) -> str:
    current = str(saved.get("url") or DEFAULT_URL).strip().rstrip("/")
    while True:
        value = input(f"URL do projeto Supabase [{current}]: ").strip() or current
        parsed = urlparse(value)
        if parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password:
            return value.rstrip("/")
        print("Informe uma URL HTTPS válida, por exemplo https://seu-projeto.supabase.co")


def load_saved() -> dict:
    try:
        value = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return {}


def save_config(url: str, key: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "url": url,
        "serviceRoleKey": key,
        "enabled": True,
        "updatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(timespec="seconds"),
    }
    fd, temporary = tempfile.mkstemp(prefix="supabase-", suffix=".json", dir=DATA_DIR)
    try:
        with open(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(payload, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        Path(temporary).replace(CONFIG_PATH)
    finally:
        Path(temporary).unlink(missing_ok=True)


def configure() -> int:
    saved = load_saved()
    print("SEG Vendas — configuração segura do Supabase")
    print("A chave será digitada de forma oculta e não será exibida.")
    url = ask_url(saved)
    key = getpass.getpass("Cole a chave secreta/service_role (não será exibida): ").strip()
    if not key:
        print("Nenhuma chave foi informada; nada foi alterado.")
        return 2
    config = SupabaseConfig(url=url, service_role_key=key, enabled=True, config_path=CONFIG_PATH)
    try:
        config.validate(require_enabled=True)
    except SupabaseError as exc:
        print(f"Chave ou URL inválida: {exc}")
        return 2
    save_config(url, key)
    print(f"Configuração salva em {CONFIG_PATH}")
    print("A chave não foi impressa. Execute novamente com --test após criar o schema.")
    return 0


def test_connection() -> int:
    config = SupabaseConfig.from_env_or_file(DATA_DIR)
    try:
        result = SupabaseClient(config).health_check()
    except SupabaseError as exc:
        print(f"Teste não concluído: {exc}")
        return 1
    print(f"Conexão com Supabase OK ({result.get('latencyMs', '?')} ms).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test", action="store_true", help="testa a configuração já salva")
    args = parser.parse_args()
    return test_connection() if args.test else configure()


if __name__ == "__main__":
    raise SystemExit(main())
