from __future__ import annotations

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from html.parser import HTMLParser
from html import unescape
import base64
import binascii
import csv
import ctypes
from ctypes import wintypes
import hashlib
import hmac
import io
import ipaddress
import json
import os
import re
import secrets
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import threading
import time
import unicodedata
import uuid
import webbrowser
import zipfile

from dataplace_connector import DataplaceClient, DataplaceConfig, DataplaceError
from offline_sync import OfflineSyncQueue
from store_replication import (
    ReplicaDatabase,
    StoreReplicationClient,
    StoreReplicationConfig,
    StoreReplicationError,
    create_local_backup,
    verify_hub_request,
)
from supabase_connector import (
    SupabaseConfig,
    SupabaseError,
    SupabaseClient,
    SupabaseStoreReplicationClient,
)

ROOT = Path(__file__).resolve().parent
APP_VERSION = "5.9.14"
DATA_DIR = ROOT / "data"
MANUALS_DIR = ROOT / "manuais"
PHOTOS_DIR = DATA_DIR / "fotos_produtos"
PROFILE_PHOTOS_DIR = DATA_DIR / "fotos_perfil"
MANUALS_DB = DATA_DIR / "manuals.json"
MANUAL_AUDIT_DB = DATA_DIR / "manual_audit.json"
PHOTO_AUDIT_DB = DATA_DIR / "photo_audit.json"
PHOTO_INDEX_DB = DATA_DIR / "photo_index.json"
PRODUCT_DESCRIPTIONS_DB = DATA_DIR / "product_descriptions.json"
PRODUCT_DESCRIPTION_AUDIT_DB = DATA_DIR / "product_description_audit.json"
PRODUCT_STATUSES_DB = DATA_DIR / "product_statuses.json"
PRODUCT_STATUS_AUDIT_DB = DATA_DIR / "product_status_audit.json"
PRODUCT_CATEGORIES_DB = DATA_DIR / "product_categories.json"
PRODUCT_CATEGORY_AUDIT_DB = DATA_DIR / "product_category_audit.json"
QUOTE_TEMPLATES_DB = DATA_DIR / "quote_templates.json"
QUOTE_TEMPLATE_AUDIT_DB = DATA_DIR / "quote_template_audit.json"
QUOTE_HISTORY_DB = DATA_DIR / "quote_history.json"
QUOTE_HISTORY_AUDIT_DB = DATA_DIR / "quote_history_audit.json"
QUOTE_SEQUENCES_DB = DATA_DIR / "quote_sequences.json"
CLIENTS_DB = DATA_DIR / "clients.json"
CLIENTS_CSV = DATA_DIR / "clientes.csv"
CLIENT_IMPORT_AUDIT_DB = DATA_DIR / "client_import_audit.json"
BACKUP_DIR = DATA_DIR / "backups"
USERS_DB = DATA_DIR / "users.json"
USERS_CSV_DB = DATA_DIR / "users_from_csv.json"
USERS_LOG = DATA_DIR / "usuarios_log.txt"
MASTER_RECOVERY_DB = DATA_DIR / "master_recovery.json"
PASSWORD_RECOVERY_AUDIT_DB = DATA_DIR / "password_recovery_audit.json"
PASSWORD_RESET_REQUESTS_DB = DATA_DIR / "password_reset_requests.json"
FACTORY_PASSWORD_RESET_MARKER = DATA_DIR / "factory_password_reset_5_9_1.json"
NETWORK_CONFIG_DB = DATA_DIR / "network_config.json"
ACCESS_REQUESTS_DB = DATA_DIR / "access_requests.json"
ACCESS_REQUEST_AUDIT_DB = DATA_DIR / "access_request_audit.json"
INTEGRATIONS_DB = DATA_DIR / "integrations.json"
INTEGRATION_AUDIT_DB = DATA_DIR / "integration_audit.json"
SYNC_QUEUE_DB = DATA_DIR / "sync_queue.json"
SYNC_AUDIT_DB = DATA_DIR / "sync_audit.json"
STORE_REPLICA_DB = DATA_DIR / "store_replica.sqlite3"
MAX_REQUEST_BYTES = 80 * 1024 * 1024
MAX_PDF_BYTES = 20 * 1024 * 1024
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_CSV_BYTES = 64 * 1024 * 1024
SEG_HELP_SEARCH_URL = "https://suporte.segbr.com.br/api/v2/help_center/articles/search.json"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
PASSWORD_ITERATIONS = 180_000
INTERNAL_ROLES = {"seller", "coordinator", "admin", "finance"}
# A troca obrigatória permanece desligada nesta versão. O botão de troca voluntária continua disponível.
FORCE_PASSWORD_CHANGE = False

DATA_DIR.mkdir(exist_ok=True)
MANUALS_DIR.mkdir(exist_ok=True)
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
PROFILE_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
SYNC_QUEUE = OfflineSyncQueue(DATA_DIR)
STORE_REPLICA = ReplicaDatabase(STORE_REPLICA_DB, StoreReplicationConfig.from_env().store_id)
os.chdir(ROOT)

DB_LOCK = threading.RLock()
SEARCH_CACHE_LOCK = threading.RLock()
SESSION_LOCK = threading.RLock()
RATE_LIMIT_LOCK = threading.RLock()
SEARCH_CACHE: dict[str, tuple[float, dict]] = {}
SESSIONS: dict[str, dict] = {}
RATE_LIMITS: dict[str, list[float]] = {}
try:
    PRODUCT_CODES = set(re.findall(r'\["([A-Za-z0-9_-]+)"\s*,', (ROOT / "products.js").read_text(encoding="utf-8")))
except OSError:
    PRODUCT_CODES: set[str] = set()

STORE_CONFIG = {
    "Loja de JPA / SEG Matriz": [
        ("Dayany", "coordinator"), ("Aline", "coordinator"), ("Arilson", "seller"),
        ("Evelyn", "seller"), ("Filipe Mores", "seller"), ("Ketsa", "seller"),
        ("Ludmila", "seller"), ("Rodrigo", "seller"), ("Rafaela", "seller"),
        ("Guilherme", "seller"),
    ],
    "SEG Oeste (Campo Grande)": [
        ("Marcio", "seller"), ("Junior", "seller"), ("Felipe", "seller"),
        ("Bianca", "seller"), ("Clarice", "coordinator"),
    ],
    "SEG São Cristóvão": [
        ("Davi", "seller"), ("Leonardo", "seller"), ("Eliane", "coordinator"),
    ],
    "SEG Lagos": [
        ("Samantha", "seller"), ("Jorge", "seller"), ("Viviane", "seller"),
        ("Lucas", "seller"),
    ],
}

# Prefixos públicos dos orçamentos. O servidor local mantém uma sequência
# independente por filial, permitindo trabalhar sem internet sem misturar a
# numeração entre lojas.
QUOTE_PREFIXES = {
    "Loja de JPA / SEG Matriz": "MA",
    "SEG Oeste (Campo Grande)": "OE",
    "SEG São Cristóvão": "SC",
    "SEG Lagos": "LA",
    # Reserva para a filial Vitória, caso ela seja incluída na configuração.
    "SEG Vitória": "VI",
}
QUOTE_NUMBER_WIDTH = 5
QUOTE_NUMBER_PATTERN = re.compile(r"^[A-Z]{2}\d{5,}$", re.IGNORECASE)


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style"}:
            self.skip_depth += 1
        elif tag in {"p", "br", "li", "div", "h1", "h2", "h3", "h4"} and not self.skip_depth:
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.skip_depth:
            self.skip_depth -= 1
        elif tag in {"p", "li", "div", "h1", "h2", "h3", "h4"} and not self.skip_depth:
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.parts.append(data)

    def text(self) -> str:
        return re.sub(r"\s+", " ", unescape("".join(self.parts))).strip()


def strip_html(value: str | None, limit: int = 420) -> str:
    if not value:
        return ""
    parser = TextExtractor()
    try:
        parser.feed(str(value))
        text = parser.text()
    except Exception:
        text = re.sub(r"<[^>]+>", " ", str(value))
        text = re.sub(r"\s+", " ", unescape(text)).strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def open_app_window(url: str) -> bool:
    """Abre como janela de aplicativo quando iniciado pelo atalho instalado."""
    if os.environ.get("SEG_APP_MODE") != "1":
        return webbrowser.open(url)

    candidates: list[Path] = []
    for executable in ("msedge.exe", "chrome.exe"):
        located = shutil.which(executable)
        if located:
            candidates.append(Path(located))

    browser_locations = (
        (os.environ.get("PROGRAMFILES(X86)"), "Microsoft/Edge/Application/msedge.exe"),
        (os.environ.get("PROGRAMFILES"), "Microsoft/Edge/Application/msedge.exe"),
        (os.environ.get("LOCALAPPDATA"), "Microsoft/Edge/Application/msedge.exe"),
        (os.environ.get("PROGRAMFILES"), "Google/Chrome/Application/chrome.exe"),
        (os.environ.get("PROGRAMFILES(X86)"), "Google/Chrome/Application/chrome.exe"),
        (os.environ.get("LOCALAPPDATA"), "Google/Chrome/Application/chrome.exe"),
    )
    for root, relative in browser_locations:
        if root:
            candidates.append(Path(root) / relative)

    seen: set[str] = set()
    for executable in candidates:
        key = str(executable).casefold()
        if key in seen or not executable.is_file():
            continue
        seen.add(key)
        try:
            subprocess.Popen(
                [str(executable), f"--app={url}", "--start-maximized", "--no-first-run"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return True
        except OSError:
            continue
    return webbrowser.open(url)


DEFAULT_NETWORK_CONFIG = {
    "bindAddress": "0.0.0.0",
    "port": 8080,
    "strictPort": False,
    "publicUrl": "",
    "mode": "local_network",
}
NETWORK_CONFIG = dict(DEFAULT_NETWORK_CONFIG)
ALLOWED_REQUEST_HOSTS = {"localhost", "127.0.0.1", "::1", local_ip().casefold(), socket.gethostname().casefold(), socket.getfqdn().casefold()}
ALLOWED_REQUEST_AUTHORITIES: set[str] = set()


def find_available_port(start: int = 8080, attempts: int = 30, bind_address: str = "0.0.0.0") -> int:
    for port in range(start, start + attempts):
        if port > 65535:
            break
        probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            probe.bind((bind_address, port))
            return port
        except OSError:
            continue
        finally:
            probe.close()
    end = min(65535, start + max(1, attempts) - 1)
    raise OSError(f"Nenhuma porta disponível foi encontrada entre {start} e {end} no endereço {bind_address}.")


def read_json_file(path: Path, default):
    with DB_LOCK:
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return default


def write_json_file(path: Path, value) -> None:
    with DB_LOCK:
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temp.replace(path)


def read_network_config_file() -> dict:
    with DB_LOCK:
        if not NETWORK_CONFIG_DB.exists():
            return {}
        try:
            value = json.loads(NETWORK_CONFIG_DB.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(
                "O arquivo data\\network_config.json está danificado. "
                "Execute scripts\\CONFIGURAR_REDE_BETA.bat para corrigi-lo."
            ) from exc
    if not isinstance(value, dict):
        raise ValueError(
            "O arquivo data\\network_config.json tem formato inválido. "
            "Execute scripts\\CONFIGURAR_REDE_BETA.bat para corrigi-lo."
        )
    return value


def safe_text(value, max_len: int = 300) -> str:
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(value or ""))
    return cleaned.strip()[:max_len]


def parse_config_bool(value, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    normalized = safe_text(value, 20).casefold()
    if normalized in {"1", "true", "sim", "yes", "on"}:
        return True
    if normalized in {"0", "false", "não", "nao", "no", "off"}:
        return False
    return default


def valid_public_hostname(hostname: str) -> bool:
    candidate = hostname.rstrip(".")
    if not candidate or len(candidate) > 253:
        return False
    try:
        ipaddress.ip_address(candidate)
        return True
    except ValueError:
        pass
    labels = candidate.split(".")
    return all(
        1 <= len(label) <= 63
        and re.fullmatch(r"[A-Za-z0-9-]+", label) is not None
        and label[0].isalnum()
        and label[-1].isalnum()
        for label in labels
    )


def normalize_network_config(raw: dict | None = None) -> dict:
    source = {**DEFAULT_NETWORK_CONFIG, **(raw if isinstance(raw, dict) else {})}
    bind_address = safe_text(source.get("bindAddress"), 80) or "0.0.0.0"
    if bind_address.casefold() == "localhost":
        bind_address = "127.0.0.1"
    try:
        parsed_ip = ipaddress.ip_address(bind_address)
    except ValueError as exc:
        raise ValueError("O IP de escuta precisa ser um IPv4 válido, como 127.0.0.1, 0.0.0.0 ou 192.168.1.20.") from exc
    if parsed_ip.version != 4:
        raise ValueError("Esta versão aceita somente endereço IPv4 na configuração de rede.")
    if parsed_ip.is_multicast:
        raise ValueError("Não é permitido usar um endereço multicast como IP de escuta.")

    try:
        port = int(source.get("port", 8080))
    except (TypeError, ValueError) as exc:
        raise ValueError("A porta interna precisa ser um número entre 1024 e 65535.") from exc
    if port < 1024 or port > 65535:
        raise ValueError("A porta interna precisa ficar entre 1024 e 65535.")

    public_url = safe_text(source.get("publicUrl"), 500).rstrip("/")
    if public_url:
        parsed_url = urlparse(public_url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.hostname:
            raise ValueError("O endereço público precisa começar com http:// ou https:// e conter um domínio válido.")
        if not valid_public_hostname(parsed_url.hostname):
            raise ValueError("O domínio ou IP do endereço público é inválido.")
        if parsed_url.username or parsed_url.password:
            raise ValueError("O endereço público não pode conter usuário ou senha.")
        if parsed_url.path not in {"", "/"} or parsed_url.query or parsed_url.fragment:
            raise ValueError("Informe apenas a raiz do endereço público, sem caminho, consulta ou fragmento.")
        try:
            public_port = parsed_url.port
        except ValueError as exc:
            raise ValueError("A porta informada no endereço público é inválida.") from exc
        if public_port is not None and (public_port < 1 or public_port > 65535):
            raise ValueError("A porta pública precisa ficar entre 1 e 65535.")

    mode = safe_text(source.get("mode"), 40).casefold() or "local_network"
    if mode not in {"local_network", "secure_tunnel", "direct_ddns", "custom"}:
        mode = "custom"
    return {
        "bindAddress": str(parsed_ip),
        "port": port,
        "strictPort": parse_config_bool(source.get("strictPort"), False),
        "publicUrl": public_url,
        "mode": mode,
    }


def load_network_config() -> dict:
    source = read_network_config_file()
    configured_port = os.environ.get("SEG_PORT") or os.environ.get("PORT")
    environment_overrides = {
        "bindAddress": os.environ.get("SEG_BIND_ADDRESS"),
        "port": configured_port,
        "publicUrl": os.environ.get("SEG_PUBLIC_URL"),
        "strictPort": os.environ.get("SEG_STRICT_PORT"),
    }
    merged = dict(source)
    for key, value in environment_overrides.items():
        if value is not None and str(value).strip() != "":
            merged[key] = value
    return normalize_network_config(merged)


def cloud_runtime_enabled() -> bool:
    """Indica execução atrás de uma plataforma cloud/containerizada."""
    return safe_text(os.environ.get("SEG_CLOUD"), 10).casefold() in {"1", "true", "sim", "yes"} or bool(os.environ.get("PORT"))


def allowed_request_hosts(config: dict) -> set[str]:
    hosts = {
        "localhost",
        "127.0.0.1",
        "::1",
        local_ip().casefold(),
        socket.gethostname().casefold(),
        socket.getfqdn().casefold(),
    }
    bind_address = safe_text(config.get("bindAddress"), 80).casefold()
    if bind_address and bind_address != "0.0.0.0":
        hosts.add(bind_address)
    public_url = safe_text(config.get("publicUrl"), 500)
    if public_url:
        public_host = (urlparse(public_url).hostname or "").casefold()
        if public_host:
            hosts.add(public_host)
    extra_hosts = safe_text(os.environ.get("SEG_ALLOWED_HOSTS"), 2000)
    for candidate in re.split(r"[,;\s]+", extra_hosts):
        candidate = candidate.strip().rstrip(".").casefold()
        if candidate and valid_public_hostname(candidate):
            hosts.add(candidate)
    return {host.rstrip(".") for host in hosts if host}


def authority_key(hostname: str, port: int | None = None) -> str:
    host = hostname.casefold().rstrip(".")
    return f"{host}:{port}" if port is not None else host


def parse_request_authority(value: str) -> str:
    parsed = urlparse(f"//{safe_text(value, 500)}")
    if parsed.username or parsed.password or not parsed.hostname or parsed.path or parsed.query or parsed.fragment:
        raise ValueError("Autoridade inválida.")
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Porta inválida.") from exc
    return authority_key(parsed.hostname, port)


def allowed_request_authorities(config: dict, actual_port: int | None = None) -> set[str]:
    port = int(actual_port if actual_port is not None else config.get("port", 8080))
    authorities = {authority_key(host, port) for host in allowed_request_hosts({**config, "publicUrl": ""})}
    public_url = safe_text(config.get("publicUrl"), 500)
    if public_url:
        parsed = urlparse(public_url)
        public_host = parsed.hostname or ""
        public_port = parsed.port
        authorities.add(authority_key(public_host, public_port))
        if public_port in {80, 443}:
            authorities.add(authority_key(public_host))
    return authorities


def configure_request_authorities(config: dict, actual_port: int | None = None) -> None:
    global ALLOWED_REQUEST_HOSTS, ALLOWED_REQUEST_AUTHORITIES
    ALLOWED_REQUEST_HOSTS = allowed_request_hosts(config)
    ALLOWED_REQUEST_AUTHORITIES = allowed_request_authorities(config, actual_port)


def configure_network_runtime() -> dict:
    global NETWORK_CONFIG
    if cloud_runtime_enabled():
        # Plataformas como Render/Railway injetam PORT e descartam o filesystem
        # da aplicação entre deploys. A configuração local não pode sobrescrever
        # a porta pública nem prender o processo em localhost.
        configured_port = os.environ.get("PORT") or os.environ.get("SEG_PORT") or DEFAULT_NETWORK_CONFIG["port"]
        NETWORK_CONFIG = normalize_network_config({
            "bindAddress": "0.0.0.0",
            "port": configured_port,
            "strictPort": True,
            "publicUrl": os.environ.get("SEG_PUBLIC_URL", ""),
            "mode": "cloud",
        })
    else:
        NETWORK_CONFIG = load_network_config()
    configure_request_authorities(NETWORK_CONFIG)
    return dict(NETWORK_CONFIG)


configure_request_authorities(NETWORK_CONFIG)


def valid_new_password(password: str) -> bool:
    return len(password) >= 8 and bool(re.search(r"[A-Za-zÀ-ÿ]", password)) and bool(re.search(r"\d", password))


def rate_limit_ok(key: str, limit: int, window_seconds: int) -> bool:
    now = time.time()
    cutoff = now - window_seconds
    with RATE_LIMIT_LOCK:
        attempts = [stamp for stamp in RATE_LIMITS.get(key, []) if stamp >= cutoff]
        if len(attempts) >= limit:
            RATE_LIMITS[key] = attempts
            return False
        attempts.append(now)
        RATE_LIMITS[key] = attempts
        if len(RATE_LIMITS) > 5000:
            stale = [item for item, stamps in RATE_LIMITS.items() if not stamps or stamps[-1] < now - 3600]
            for item in stale[:1000]:
                RATE_LIMITS.pop(item, None)
        return True


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-zA-Z0-9]+", " ", normalized).strip().lower()


def normalize_username(value: str) -> str:
    return normalize_text(value).replace(" ", "")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")).strip("-").lower()
    return slug[:70] or "arquivo"


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def quote_prefix_for_store(store: str) -> str:
    """Retorna a sigla de dois caracteres usada no número do orçamento."""
    normalized = normalize_text(store)
    for name, prefix in QUOTE_PREFIXES.items():
        if normalized == normalize_text(name):
            return prefix
    # Permite reconhecer variações digitadas no cadastro sem aceitar valores
    # arbitrários como prefixo de um documento.
    if "oeste" in normalized:
        return "OE"
    if "cristovao" in normalized:
        return "SC"
    if "lagos" in normalized:
        return "LA"
    if "vitoria" in normalized:
        return "VI"
    if "matriz" in normalized or "jpa" in normalized:
        return "MA"
    words = [word for word in normalized.split() if word not in {"seg", "loja", "de", "da", "do"}]
    if len(words) >= 2:
        return f"{words[0][0]}{words[1][0]}".upper()
    if words:
        return words[0][:2].upper().ljust(2, "X")
    return "LO"


def allocate_quote_number(store: str, records: list[dict] | None = None) -> str:
    """Reserva, de forma atômica, o próximo número da filial.

    A função deve ser chamada sob ``DB_LOCK``. O histórico existente é
    considerado na primeira reserva para que uma restauração ou atualização
    não volte a emitir um número já utilizado.
    """
    prefix = quote_prefix_for_store(store)
    state = read_json_file(QUOTE_SEQUENCES_DB, {})
    if not isinstance(state, dict):
        state = {}
    try:
        current = max(0, int(state.get(prefix, 0)))
    except (TypeError, ValueError):
        current = 0
    source_records = records if isinstance(records, list) else read_json_file(QUOTE_HISTORY_DB, [])
    highest_existing = 0
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
    for item in source_records if isinstance(source_records, list) else []:
        if not isinstance(item, dict):
            continue
        match = pattern.fullmatch(safe_text(item.get("number"), 40))
        if match:
            try:
                highest_existing = max(highest_existing, int(match.group(1)))
            except ValueError:
                continue
    next_value = max(current, highest_existing) + 1
    state[prefix] = next_value
    write_json_file(QUOTE_SEQUENCES_DB, state)
    return f"{prefix}{next_value:0{QUOTE_NUMBER_WIDTH}d}"


def migrate_legacy_quote_numbers(records: list[dict]) -> int:
    """Converte números antigos para o padrão da filial, preservando o alias.

    O campo ``legacyNumber`` mantém o número que já foi impresso ou enviado
    antes da padronização. Assim a busca passa a encontrar somente o formato
    novo sem perder a rastreabilidade do documento anterior.
    """
    if not isinstance(records, list):
        return 0
    aliases: dict[str, str] = {}
    changed = 0
    for item in records:
        if not isinstance(item, dict):
            continue
        old_number = safe_text(item.get("number"), 40).upper()
        expected_prefix = quote_prefix_for_store(item.get("store", ""))
        is_standard = bool(QUOTE_NUMBER_PATTERN.fullmatch(old_number)) and old_number[:2] == expected_prefix
        if is_standard:
            continue
        if old_number and not item.get("legacyNumber"):
            item["legacyNumber"] = old_number
        new_number = allocate_quote_number(item.get("store", ""), records)
        item["number"] = new_number
        quote_id = safe_text(item.get("id"), 100)
        if quote_id:
            aliases[quote_id] = new_number
        changed += 1
    # Atualiza o vínculo exibido por pedidos reutilizados que apontavam para
    # um orçamento legado convertido nesta mesma passagem.
    for item in records:
        reused = item.get("reusedFrom") if isinstance(item, dict) else None
        if isinstance(reused, dict) and safe_text(reused.get("id"), 100) in aliases:
            reused["number"] = aliases[safe_text(reused.get("id"), 100)]
    return changed


def standardize_quote_history_storage() -> int:
    """Garante que o histórico persistido use o padrão por filial."""
    with DB_LOCK:
        records = read_json_file(QUOTE_HISTORY_DB, [])
        if not isinstance(records, list):
            return 0
        changed = migrate_legacy_quote_numbers(records)
        if changed:
            write_json_file(QUOTE_HISTORY_DB, records)
        return changed


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def _data_blob(value: bytes) -> tuple[_DataBlob, ctypes.Array]:
    buffer = ctypes.create_string_buffer(value)
    blob = _DataBlob(len(value), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte)))
    return blob, buffer


def protect_server_secret(value: str) -> str:
    """Protege credenciais com o DPAPI do Windows; o segredo só abre no mesmo usuário do servidor."""
    if not value:
        return ""
    if os.name != "nt":
        raise ValueError("Neste servidor, configure a credencial por variável de ambiente.")
    source, source_buffer = _data_blob(value.encode("utf-8"))
    entropy, entropy_buffer = _data_blob(b"SEG-Vendas-Integration-v1")
    output = _DataBlob()
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    ok = crypt32.CryptProtectData(
        ctypes.byref(source), "SEG Vendas", ctypes.byref(entropy), None, None,
        0x01, ctypes.byref(output)
    )
    _ = (source_buffer, entropy_buffer)
    if not ok:
        raise ValueError("O Windows não conseguiu proteger a credencial da API.")
    try:
        protected = ctypes.string_at(output.pbData, output.cbData)
        return base64.b64encode(protected).decode("ascii")
    finally:
        kernel32.LocalFree(output.pbData)


def unprotect_server_secret(value: str) -> str:
    if not value:
        return ""
    if os.name != "nt":
        return os.environ.get(value, "") if value.startswith("SEG_") else ""
    try:
        encrypted = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error):
        return ""
    source, source_buffer = _data_blob(encrypted)
    entropy, entropy_buffer = _data_blob(b"SEG-Vendas-Integration-v1")
    output = _DataBlob()
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    ok = crypt32.CryptUnprotectData(
        ctypes.byref(source), None, ctypes.byref(entropy), None, None,
        0x01, ctypes.byref(output)
    )
    _ = (source_buffer, entropy_buffer)
    if not ok:
        return ""
    try:
        return ctypes.string_at(output.pbData, output.cbData).decode("utf-8")
    finally:
        kernel32.LocalFree(output.pbData)


def clean_integration_url(value, field_name: str, required: bool = False) -> str:
    text = safe_text(value, 500)
    if not text and not required:
        return ""
    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError(f"Informe uma URL HTTP ou HTTPS válida em {field_name}.")
    return text.rstrip("/")


def public_integration_config(config: dict) -> dict:
    if not isinstance(config, dict):
        config = {}
    return {
        "provider": safe_text(config.get("provider"), 40) or "dataplace",
        "name": safe_text(config.get("name"), 100),
        "baseUrl": safe_text(config.get("baseUrl"), 500),
        "testPath": safe_text(config.get("testPath"), 300),
        "customersPath": safe_text(config.get("customersPath"), 300),
        "productsPath": safe_text(config.get("productsPath"), 300),
        "authType": safe_text(config.get("authType"), 30) or "bearer",
        "apiKeyHeader": safe_text(config.get("apiKeyHeader"), 80) or "X-API-Key",
        "enabled": bool(config.get("enabled")),
        "hasSecret": bool(config.get("protectedSecret")),
        "updatedAt": safe_text(config.get("updatedAt"), 60),
        "updatedBy": safe_text(config.get("updatedBy"), 120),
    }


def integration_request_url(config: dict) -> str:
    base = clean_integration_url(config.get("baseUrl"), "URL principal", required=True)
    path = safe_text(config.get("testPath"), 300)
    if not path:
        return base
    return f"{base}/{path.lstrip('/')}"


def integration_headers(config: dict) -> dict[str, str]:
    headers = {"Accept": "application/json", "User-Agent": f"SEG-Vendas/{APP_VERSION}"}
    auth_type = safe_text(config.get("authType"), 30)
    if auth_type == "none":
        return headers
    secret = unprotect_server_secret(safe_text(config.get("protectedSecret"), 20_000))
    if not secret:
        raise ValueError("A credencial da integração não está disponível para este servidor.")
    if auth_type == "bearer":
        headers["Authorization"] = f"Bearer {secret}"
    elif auth_type == "api-key":
        header_name = safe_text(config.get("apiKeyHeader"), 80) or "X-API-Key"
        if not re.fullmatch(r"[A-Za-z0-9-]{1,80}", header_name):
            raise ValueError("O nome do cabeçalho da chave de API é inválido.")
        headers[header_name] = secret
    else:
        raise ValueError("O tipo de autenticação da integração é inválido.")
    return headers


def dataplace_sync_config() -> dict:
    config = DataplaceConfig.from_env()
    return {
        "configured": config.configured,
        "enabled": config.enabled,
        "workerEnabled": safe_text(os.environ.get("SEG_SYNC_WORKER"), 10).casefold() in {"1", "true", "sim", "yes"},
        "hasCredential": bool(config.api_key) if config.auth_type != "none" else True,
        "paths": {
            "health": bool(config.health_path),
            "customers": bool(config.customers_path),
            "products": bool(config.products_path),
            "quotes": bool(config.quote_path),
        },
    }


def enqueue_quote_for_dataplace(quote_entry: dict) -> dict:
    config = DataplaceConfig.from_env()
    if not config.enabled:
        return {"enabled": False, "queued": False, "reason": "sync_disabled"}
    operation_id = f"quote:{safe_text(quote_entry.get('id'), 100)}"
    result = SYNC_QUEUE.enqueue("quote", {
        "source": "SEG Vendas",
        "operation": "upsert_quote",
        "quote": quote_entry,
    }, operation_id=operation_id)
    return {"enabled": True, "queued": True, **result}


def start_dataplace_sync_worker() -> threading.Thread | None:
    if safe_text(os.environ.get("SEG_SYNC_WORKER"), 10).casefold() not in {"1", "true", "sim", "yes"}:
        return None

    def worker() -> None:
        while True:
            try:
                config = DataplaceConfig.from_env()
                if config.enabled:
                    SYNC_QUEUE.process(DataplaceClient(config), limit=20)
            except (DataplaceError, ValueError, OSError):
                # A queda da internet é esperada no modo offline; os itens
                # permanecem na fila para a próxima tentativa.
                pass
            time.sleep(30)

    thread = threading.Thread(target=worker, name="seg-dataplace-sync", daemon=True)
    thread.start()
    return thread


def store_replication_status() -> dict:
    config = StoreReplicationConfig.from_env()
    supabase = SupabaseConfig.from_env_or_file(DATA_DIR)
    return {
        "storeId": config.store_id,
        "storeName": config.store_name,
        "enabled": config.enabled,
        "workerEnabled": config.worker_enabled,
        "hubConfigured": bool(config.hub_url),
        "hasCredential": bool(config.token),
        "intervalSeconds": config.interval_seconds,
        "backupIntervalSeconds": config.backup_interval_seconds,
        "lastBackupAt": STORE_REPLICA.get_meta("lastBackupAt", ""),
        "lastSyncAt": STORE_REPLICA.get_meta("lastSyncAt", ""),
        "lastSyncError": STORE_REPLICA.get_meta("lastSyncError", ""),
        "supabase": {
            "enabled": bool(supabase.enabled),
            "configured": bool(supabase.configured),
            "url": supabase.url,
            "hasCredential": bool(supabase.service_role_key),
        },
        "ledger": STORE_REPLICA.status(),
    }


def supabase_status() -> dict:
    """Retorna somente informações não secretas da configuração da nuvem."""
    config = SupabaseConfig.from_env_or_file(DATA_DIR)
    return {
        "enabled": bool(config.enabled),
        "configured": bool(config.configured),
        "url": config.url,
        "hasCredential": bool(config.service_role_key),
    }


def capture_local_replica_snapshots() -> int:
    captured = 0
    for path in sorted(DATA_DIR.rglob("*.json")):
        if BACKUP_DIR in path.parents or path.name.endswith(".tmp"):
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            STORE_REPLICA.save_snapshot(path.relative_to(DATA_DIR).as_posix(), payload)
            captured += 1
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, sqlite3.Error):
            continue
    return captured


def record_quote_replication(quote_entry: dict) -> dict:
    config = StoreReplicationConfig.from_env()
    supabase = SupabaseConfig.from_env_or_file(DATA_DIR)
    if not config.hub_url and not parse_config_bool(os.environ.get("SEG_REPLICATION_ENABLED")) and not supabase.enabled:
        return {"enabled": False, "queued": False, "reason": "replication_not_configured"}
    quote_id = safe_text(quote_entry.get("id"), 100)
    version = safe_text(quote_entry.get("updatedAt") or quote_entry.get("serverSavedAt"), 60)
    event_id = f"{config.store_id}:quote:{quote_id}:{version}"
    result = STORE_REPLICA.enqueue("quote", "upsert", quote_entry, event_id=event_id)
    return {"enabled": bool(config.enabled or supabase.enabled), "queued": True, **result}


def apply_incoming_replication_events() -> dict:
    """Aplica apenas vendas append/update; usuários e segredos nunca entram na réplica."""
    events = STORE_REPLICA.unapplied_events(200)
    applied = 0
    ignored = 0
    local_store_id = StoreReplicationConfig.from_env().store_id
    for event in events:
        if safe_text(event.get("storeId"), 80) == local_store_id:
            ignored += 1
            continue
        if event.get("entity") != "quote" or event.get("operation") != "upsert" or not isinstance(event.get("payload"), dict):
            ignored += 1
            continue
        quote = dict(event["payload"])
        quote["replicaOriginStore"] = safe_text(event.get("storeId"), 80)
        quote_id = safe_text(quote.get("id"), 100)
        if not quote_id:
            ignored += 1
            continue
        with DB_LOCK:
            records = read_json_file(QUOTE_HISTORY_DB, [])
            if not isinstance(records, list):
                records = []
            index = next((i for i, item in enumerate(records) if isinstance(item, dict) and safe_text(item.get("id"), 100) == quote_id and safe_text(item.get("replicaOriginStore"), 80) == quote["replicaOriginStore"]), -1)
            if index >= 0:
                current_stamp = safe_text(records[index].get("updatedAt") or records[index].get("serverSavedAt"), 60)
                incoming_stamp = safe_text(quote.get("updatedAt") or quote.get("serverSavedAt"), 60)
                if incoming_stamp >= current_stamp:
                    records[index] = quote
            else:
                records.insert(0, quote)
            write_json_file(QUOTE_HISTORY_DB, records)
        applied += 1
    STORE_REPLICA.mark_events_applied([event["eventId"] for event in events])
    return {"received": len(events), "applied": applied, "ignored": ignored}


def start_store_replication_worker() -> threading.Thread:
    def worker() -> None:
        while True:
            config = StoreReplicationConfig.from_env()
            supabase = SupabaseConfig.from_env_or_file(DATA_DIR)
            try:
                now = time.time()
                last_backup = float(STORE_REPLICA.get_meta("lastBackupEpoch", "0") or 0)
                if parse_config_bool(os.environ.get("SEG_BACKUP_ENABLED", "1"), True) and now - last_backup >= config.backup_interval_seconds:
                    capture_local_replica_snapshots()
                    backup = create_local_backup(DATA_DIR, BACKUP_DIR, config.store_id, config.backup_retention, STORE_REPLICA_DB)
                    STORE_REPLICA.set_meta("lastBackupAt", backup["createdAt"])
                    STORE_REPLICA.set_meta("lastBackupEpoch", now)
                if supabase.enabled:
                    result = SupabaseStoreReplicationClient(supabase).sync_once(STORE_REPLICA)
                    applied = apply_incoming_replication_events()
                    STORE_REPLICA.set_meta("lastSyncAt", now_iso())
                    STORE_REPLICA.set_meta("lastSyncError", "")
                    STORE_REPLICA.set_meta("lastSyncSummary", json.dumps({**result, **applied, "transport": "supabase"}, ensure_ascii=False))
                elif config.enabled and config.worker_enabled:
                    result = StoreReplicationClient(config).sync_once(STORE_REPLICA)
                    applied = apply_incoming_replication_events()
                    STORE_REPLICA.set_meta("lastSyncAt", now_iso())
                    STORE_REPLICA.set_meta("lastSyncError", "")
                    STORE_REPLICA.set_meta("lastSyncSummary", json.dumps({**result, **applied}, ensure_ascii=False))
            except (StoreReplicationError, SupabaseError, OSError, ValueError, sqlite3.Error) as exc:
                STORE_REPLICA.set_meta("lastSyncError", safe_text(exc, 240))
            time.sleep(config.interval_seconds)

    thread = threading.Thread(target=worker, name="seg-store-replication", daemon=True)
    thread.start()
    return thread


GERTEC_PORT = 6500
GERTEC_BUF_SIZE = 255
GERTEC_HANDSHAKE_TIMEOUT = 30.0
GERTEC_READ_TIMEOUT = None


def load_gertec_catalog() -> dict[str, dict]:
    """Carrega o catalogo local (products.js) e o mapeamento EAN para atender leitores Gertec."""
    catalog: dict[str, dict] = {}
    try:
        products_text = (ROOT / "products.js").read_text(encoding="utf-8")
        match = re.search(r"const\s+PRODUCTS\s*=\s*(\[.*?\]);\s*$", products_text, re.DOTALL)
        if match:
            data = json.loads(match.group(1))
            for item in data:
                if not isinstance(item, (list, tuple)) or len(item) < 3:
                    continue
                code = safe_text(item[0], 80)
                if not code:
                    continue
                catalog[code] = {
                    "code": code,
                    "desc": safe_text(item[1], 500),
                    "price": finite_number(item[2], 0.0, 0.0, 100_000_000.0),
                }
    except (OSError, json.JSONDecodeError, re.error) as exc:
        print(f"[Gertec] Nao foi possivel carregar o catalogo: {exc}")

    ean_map: dict[str, str] = {}
    try:
        ean_text = (ROOT / "ean_map.js").read_text(encoding="utf-8")
        for ean_match in re.finditer(r'"([^"]+)"\s*:\s*"([^"]+)"', ean_text):
            ean = ean_match.group(1).strip()
            code = ean_match.group(2).strip()
            if ean and code:
                ean_map[ean] = code
    except OSError:
        pass

    return catalog, ean_map


def format_gertec_price(value: float) -> str:
    """Formata o preco no padrao brasileiro esperado pelos terminais Gertec."""
    try:
        return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except (TypeError, ValueError):
        return "R$ 0,00"


def resolve_gertec_product(barcode: str) -> dict | None:
    """Traduz um codigo de barras lido em um produto do catalogo local."""
    catalog, ean_map = load_gertec_catalog()
    if not catalog:
        return None

    raw = safe_text(barcode, 80).strip()
    if not raw:
        return None

    # Se o codigo lido for um EAN mapeado, traduz para o codigo interno.
    code = ean_map.get(raw, raw)

    # Busca exata pelo codigo interno.
    product = catalog.get(code)
    if product:
        return product

    # Busca exata pelo EAN, caso o proprio codigo interno tenha sido lido.
    if raw in catalog:
        return catalog[raw]

    return None


class GertecTerminalHandler(threading.Thread):
    """Atende um terminal de consulta de precos Gertec via TCP.

    Implementacao baseada no SDK oficial Gertec TCServer (Java e C#).
    Protocolo: cada recv() retorna uma mensagem completa, prefixada com '#'.
    Envio: bytes ASCII puros, SEM newline no final.
    Keepalive: servidor envia '#live?' apos timeout; terminal responde '#live'.
    """

    LIVE_TIMEOUT = 5.0  # Timeout do Select (segundos) - igual ao C# oficial.
    LIVE_MAX_RETRIES = 2  # Quantos timeouts seguidos antes de desconectar.

    def __init__(self, sock: socket.socket, address: tuple[str, int]) -> None:
        super().__init__(name=f"gertec-terminal-{address[0]}:{address[1]}", daemon=True)
        self.sock = sock
        self.address = address
        self.tipo = ""
        self.versao = ""
        self._pending = ""

    def _recv(self) -> str:
        """Le uma mensagem do terminal.

        Retorno:
            A string recebida (incluindo o '#' inicial), ou "" se desconectou.
        Levanta:
            TimeoutError se o socket atingiu o timeout.
        """
        dados = self.sock.recv(GERTEC_BUF_SIZE)
        if not dados:
            return ""
        # Converte para ASCII, cortando bytes nulos que o terminal pode enviar.
        texto = dados.decode("ascii", errors="replace").rstrip("\x00").strip()
        return texto

    def _send(self, comando: str) -> None:
        """Envia um comando para o terminal, em bytes ASCII puros (sem newline)."""
        self.sock.sendall(comando.encode("ascii", errors="replace"))

    def _recv_with_select(self, timeout_sec: float) -> tuple[int, str]:
        """Aguarda dados com timeout usando select, igual ao C# oficial.

        Retorno:
            (0, mensagem) - leitura OK
            (1, "")       - timeout (nenhum dado)
            (-1, "")      - erro/desconexao
        """
        import select
        try:
            ready, _, _ = select.select([self.sock], [], [], timeout_sec)
            if ready:
                dados = self.sock.recv(GERTEC_BUF_SIZE)
                if not dados:
                    return (-1, "")
                texto = dados.decode("ascii", errors="replace").rstrip("\x00").strip()
                return (0, texto)
            return (1, "")
        except Exception:
            return (-1, "")

    def _handshake(self) -> bool:
        """Executa o handshake inicial com o terminal."""
        self.sock.settimeout(GERTEC_HANDSHAKE_TIMEOUT)
        # Passo 1: Envia #ok
        self._send("#ok")
        # Passo 2: Recebe identificacao (ex: #TC300|3.3)
        try:
            ident = self._recv()
        except Exception as exc:
            print(f"[Gertec] Erro ao receber identificacao de {self.address[0]}: {exc}")
            return False
        if not ident or "|" not in ident:
            print(f"[Gertec] Handshake invalido de {self.address[0]}: {ident!r}")
            return False
        # Extrai tipo e versao (remove o '#' inicial).
        corpo = ident.lstrip("#")
        idx_pipe = corpo.index("|")
        self.tipo = corpo[:idx_pipe]
        self.versao = corpo[idx_pipe + 1:].rstrip("\x00").strip()
        print(f"[Gertec] Terminal conectado: {self.address[0]} tipo={self.tipo} versao={self.versao}")
        # Passo 3: Envia #alwayslive
        self._send("#alwayslive")
        # Passo 4: Recebe #alwayslive_ok. Se o terminal enviar outra coisa
        # (ex.: ja mandou um codigo de barras), a mensagem e devolvida para
        # ser processada normalmente em vez de ser descartada.
        try:
            ack = self._recv()
        except Exception:
            ack = ""
        if ack and "alwayslive_ok" in ack:
            print(f"[Gertec] Alwayslive confirmado por {self.address[0]}")
            self._pending = ""
        else:
            print(f"[Gertec] Terminal {self.address[0]} nao confirmou alwayslive ({ack!r}), continuando")
            self._pending = ack
        return True

    def _handle_query(self, barcode: str) -> None:
        """Consulta um produto pelo codigo de barras e responde ao terminal."""
        product = resolve_gertec_product(barcode)
        if product:
            desc = product["desc"].replace("|", " ")[:20]
            price = format_gertec_price(product["price"])
            response = f"#{desc}|{price}"
        else:
            response = "#nfound"
        print(f"[Gertec] Consulta {barcode} -> {response}")
        self._send(response)

    def _dispatch(self, comando: str) -> None:
        """Trata uma mensagem recebida do terminal."""
        if comando.startswith("#live"):
            return  # Resposta ao '#live?'.
        if comando.startswith("#restartsoft_ok"):
            print(f"[Gertec] Terminal {self.address[0]} reiniciado")
        elif comando.startswith("#alwayslive"):
            return
        elif comando.startswith(("#config02", "#paramconfig", "#updconfig")):
            print(f"[Gertec] Configuracao recebida de {self.address[0]}: {comando[:16]}")
        elif comando.startswith("#"):
            barcode = comando[1:].strip()
            if barcode:
                self._handle_query(barcode)
        else:
            print(f"[Gertec] Mensagem inesperada de {self.address[0]}: {comando!r}")

    def run(self) -> None:
        try:
            if not self._handshake():
                return
            # Remove qualquer timeout fixo; usamos select com timeout para keepalive.
            self.sock.settimeout(None)
            if self._pending:
                self._dispatch(self._pending)
                self._pending = ""
            cont_live = 0
            while True:
                status, comando = self._recv_with_select(self.LIVE_TIMEOUT)
                if status == 1:
                    # Timeout - nenhum dado recebido. Envia keepalive.
                    if cont_live < self.LIVE_MAX_RETRIES:
                        self._send("#live?")
                        cont_live += 1
                    else:
                        print(f"[Gertec] Terminal {self.address[0]} nao respondeu keepalive, desconectando")
                        break
                elif status == -1 or not comando:
                    break
                else:
                    cont_live = 0
                    self._dispatch(comando)
        except (OSError, ConnectionResetError) as exc:
            print(f"[Gertec] Terminal {self.address[0]} desconectado: {exc}")
        finally:
            try:
                self.sock.close()
            except OSError:
                pass
            print(f"[Gertec] Conexao encerrada: {self.address[0]}")


def start_gertec_server() -> threading.Thread | None:
    """Inicia o servidor TCP para terminais de consulta Gertec na porta 6500."""
    try:
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_sock.bind(("0.0.0.0", GERTEC_PORT))
        server_sock.listen(5)
    except OSError as exc:
        print(f"[Gertec] Nao foi possivel iniciar o servidor na porta {GERTEC_PORT}: {exc}")
        return None

    def listener() -> None:
        print(f"[Gertec] Servidor de terminais de consulta ativo na porta {GERTEC_PORT}")
        while True:
            try:
                client_sock, address = server_sock.accept()
                handler = GertecTerminalHandler(client_sock, address)
                handler.start()
            except OSError:
                break

    thread = threading.Thread(target=listener, name="seg-gertec-server", daemon=True)
    thread.start()
    return thread



def password_digest(password: str, salt_hex: str | None = None) -> tuple[str, str]:
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    password_bytes = password.encode("utf-8")
    if hasattr(hashlib, "pbkdf2_hmac"):
        digest = hashlib.pbkdf2_hmac("sha256", password_bytes, salt, PASSWORD_ITERATIONS)
    else:
        # Compatibilidade com distribuições do Python sem OpenSSL/PBKDF2.
        block = hmac.new(password_bytes, salt + b"\x00\x00\x00\x01", hashlib.sha256).digest()
        digest_bytes = bytearray(block)
        previous = block
        for _ in range(1, PASSWORD_ITERATIONS):
            previous = hmac.new(password_bytes, previous, hashlib.sha256).digest()
            for index, value in enumerate(previous):
                digest_bytes[index] ^= value
        digest = bytes(digest_bytes)
    return salt.hex(), digest.hex()


def verify_password(user: dict, password: str) -> bool:
    salt_hex = safe_text(user.get("passwordSalt"), 100)
    expected = safe_text(user.get("passwordHash"), 200)
    if not salt_hex or not expected:
        return False
    try:
        _, actual = password_digest(password, salt_hex)
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def master_recovery_configured() -> bool:
    config = read_json_file(MASTER_RECOVERY_DB, {})
    return isinstance(config, dict) and bool(config.get("passwordSalt") and config.get("passwordHash"))


def verify_master_recovery_password(password: str) -> bool:
    if not password or len(password) > 300:
        return False
    config = read_json_file(MASTER_RECOVERY_DB, {})
    return isinstance(config, dict) and verify_password(config, password)


def revoke_user_sessions(username: str) -> None:
    normalized = normalize_username(username)
    with SESSION_LOCK:
        tokens_to_revoke = [
            token for token, session in SESSIONS.items()
            if normalize_username(session.get("user", {}).get("username", "")) == normalized
        ]
        for token in tokens_to_revoke:
            SESSIONS.pop(token, None)


def clear_login_rate_limits(*identifiers: str) -> None:
    keys = {f"login-user:{normalize_username(value)}" for value in identifiers if normalize_username(value)}
    with RATE_LIMIT_LOCK:
        for key in keys:
            RATE_LIMITS.pop(key, None)


def employee_code_map() -> dict[str, str]:
    source = DATA_DIR / "funcionarios.csv"
    result: dict[str, str] = {}
    if not source.exists():
        return result
    try:
        with source.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle, delimiter=";")
            required_columns = {"User ID", "User Name", "Nome Completo", "Grupo", "Status"}
            if not reader.fieldnames or not required_columns.issubset(set(reader.fieldnames)):
                raise csv.Error("Cabeçalho de funcionários inválido")
            for raw in reader:
                row = {str(k or "").strip(): safe_text(v, 300) for k, v in raw.items()}
                code = row.get("User ID", "").strip()
                full_name = row.get("Nome Completo", "").strip()
                source_user = row.get("User Name", "").strip()
                if not code:
                    continue
                if full_name:
                    result[normalize_username(full_name)] = code
                if source_user:
                    result[normalize_username(source_user.removeprefix("sym_"))] = code
    except (OSError, csv.Error):
        return {}
    return result


def default_password_for(user: dict) -> str:
    username = normalize_username(user.get("username", ""))
    role = user.get("role")
    if username == "cliente" or role == "client":
        return "cliente123"
    if username == "admin":
        return "segadmin"
    code = safe_text(user.get("code"), 40) or username or "123"
    return f"SEG@{code}"


def factory_password_for_employee(user: dict) -> str:
    """Retorna o padrão de fábrica somente para contas internas vinculadas a um código."""
    code = safe_text(user.get("code"), 40)
    if user.get("role") not in INTERNAL_ROLES or not code:
        return ""
    return f"SEG@{code}"


def factory_password_for_user(user: dict) -> str:
    """Inclui funcionários com código e a conta técnica interna admin/segadmin."""
    employee_password = factory_password_for_employee(user)
    if employee_password:
        return employee_password
    if user.get("role") in INTERNAL_ROLES and normalize_username(user.get("username", "")) == "admin":
        return "segadmin"
    return ""


def apply_factory_password(user: dict, stamp: str | None = None) -> None:
    factory_password = factory_password_for_user(user)
    if not factory_password:
        raise ValueError("A conta não possui um código de funcionário para restaurar a senha de fábrica.")
    stamp = stamp or now_iso()
    salt, digest = password_digest(factory_password)
    user["passwordSalt"] = salt
    user["passwordHash"] = digest
    user["passwordUpdatedAt"] = stamp
    user["factoryPasswordResetAt"] = stamp
    user["mustChangePassword"] = FORCE_PASSWORD_CHANGE
    user["passwordChangedByUser"] = False


def reset_changed_factory_passwords_once() -> dict:
    """Restaura uma única vez apenas contas internas cuja senha saiu do padrão SEG@CÓDIGO."""
    if FACTORY_PASSWORD_RESET_MARKER.exists():
        marker = read_json_file(FACTORY_PASSWORD_RESET_MARKER, {})
        return marker if isinstance(marker, dict) else {"skipped": True}
    users = read_json_file(USERS_DB, [])
    if not isinstance(users, list):
        return {"skipped": True, "reason": "invalid_users_database"}
    changed_count = 0
    already_factory_count = 0
    eligible_count = 0
    stamp = now_iso()
    for user in users:
        factory_password = factory_password_for_user(user)
        if not factory_password:
            continue
        eligible_count += 1
        if verify_password(user, factory_password):
            already_factory_count += 1
        else:
            apply_factory_password(user, stamp)
            changed_count += 1
        user["passwordChangedByUser"] = False
        if user.get("mustChangePassword"):
            user["mustChangePassword"] = False
    if changed_count:
        backup_file(USERS_DB)
    # Grava também a desativação da troca obrigatória, mesmo quando a senha já estava correta.
    write_json_file(USERS_DB, users)
    marker = {
        "version": "5.9.1",
        "completedAt": stamp,
        "eligibleUsers": eligible_count,
        "resetPasswords": changed_count,
        "alreadyFactory": already_factory_count,
    }
    write_json_file(FACTORY_PASSWORD_RESET_MARKER, marker)
    append_audit(PASSWORD_RECOVERY_AUDIT_DB, {
        "action": "factory_passwords_reset_once",
        "eligibleUsers": eligible_count,
        "resetPasswords": changed_count,
        "alreadyFactory": already_factory_count,
    })
    return marker


def ensure_user_credentials() -> None:
    users = read_json_file(USERS_DB, [])
    if not isinstance(users, list):
        users = []
    codes = employee_code_map()
    changed = False
    for user in users:
        username = normalize_username(user.get("username", ""))
        code = safe_text(user.get("code"), 40)
        if not code:
            code = codes.get(normalize_username(user.get("name", ""))) or codes.get(username) or ""
            if code:
                user["code"] = code
                changed = True
        if not user.get("passwordSalt") or not user.get("passwordHash"):
            salt, digest = password_digest(default_password_for(user))
            user["passwordSalt"] = salt
            user["passwordHash"] = digest
            user["passwordUpdatedAt"] = now_iso()
            user["mustChangePassword"] = FORCE_PASSWORD_CHANGE
            changed = True
    if changed:
        write_json_file(USERS_DB, users)


def ensure_password_security_flags() -> None:
    """Exige uma troca controlada para contas internas ainda sem registro de senha pessoal."""
    users = read_json_file(USERS_DB, [])
    if not isinstance(users, list):
        return
    changed = False
    for user in users:
        desired = FORCE_PASSWORD_CHANGE if user.get("role") in INTERNAL_ROLES else False
        if user.get("mustChangePassword") is not desired:
            user["mustChangePassword"] = desired
            changed = True
    if changed:
        backup_file(USERS_DB)
        write_json_file(USERS_DB, users)


def ensure_default_users() -> None:
    if USERS_DB.exists():
        return
    
    users = []
    
    # Tentar carregar do CSV processado primeiro
    if USERS_CSV_DB.exists():
        try:
            csv_users = read_json_file(USERS_CSV_DB, [])
            if csv_users:
                users = csv_users
                print(f"Carregados {len(users)} usuários do CSV processado")
        except Exception as e:
            print(f"Erro ao carregar CSV: {e}")
    
    # Se não tiver CSV ou falhar, usar configuração padrão
    if not users:
        for store, people in STORE_CONFIG.items():
            for name, role in people:
                users.append({
                    "username": normalize_username(name), "name": name, "role": role, "store": store,
                    "active": True,
                })
        users.extend([
            {"username": "cliente", "name": "Cliente de teste", "role": "client", "store": "", "active": True},
            {"username": "admin", "name": "Administrador SEG", "role": "admin", "store": "Loja de JPA / SEG Matriz", "active": True},
        ])
    
    write_json_file(USERS_DB, users)


def role_from_employee_group(group: str) -> str:
    normalized = safe_text(group, 40).upper()
    if normalized == "ADM":
        return "admin"
    if normalized == "COODLOJA":
        return "coordinator"
    if normalized in {"VDACAIXA", "VDALOJA"}:
        return "seller"
    if normalized == "FINANCEIRO":
        return "finance"
    return "client"


def sync_users_from_employee_csv() -> None:
    """Mescla todos os funcionários ativos do CSV sem apagar senhas já alteradas."""
    source = DATA_DIR / "funcionarios.csv"
    if not source.exists():
        return
    users = read_json_file(USERS_DB, [])
    if not isinstance(users, list):
        users = []
    by_code = {safe_text(item.get("code"), 40): item for item in users if safe_text(item.get("code"), 40)}
    by_username = {normalize_username(item.get("username", "")): item for item in users if normalize_username(item.get("username", ""))}
    seen_codes: set[str] = set()
    changed = False
    try:
        with source.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle, delimiter=";")
            for raw in reader:
                row = {safe_text(k, 80): safe_text(v, 300) for k, v in raw.items()}
                code = row.get("User ID", "").strip()
                name = row.get("Nome Completo", "").strip()
                source_username = row.get("User Name", "").strip()
                username = normalize_username(source_username.removeprefix("sym_").removeprefix("SYM_"))
                if not username:
                    username = normalize_username(name)
                if not code or not username or not name:
                    continue
                seen_codes.add(code)
                user = by_code.get(code) or by_username.get(username)
                if row.get("Status", "").casefold() != "ativo":
                    if user and user.get("active", True):
                        user["active"] = False
                        user["deactivatedAt"] = now_iso()
                        changed = True
                    continue
                if user is None:
                    user = {
                        "username": username, "name": name, "role": role_from_employee_group(row.get("Grupo", "")),
                        "store": "Loja de JPA / SEG Matriz", "active": True, "original_group": row.get("Grupo", ""),
                        "code": code, "createdAt": now_iso(), "registrationSource": "funcionarios.csv",
                    }
                    salt, digest = password_digest(f"SEG@{code}")
                    user["passwordSalt"] = salt
                    user["passwordHash"] = digest
                    user["passwordUpdatedAt"] = now_iso()
                    user["mustChangePassword"] = FORCE_PASSWORD_CHANGE
                    users.append(user)
                    by_code[code] = user
                    by_username[username] = user
                    changed = True
                else:
                    updates = {
                        "username": username, "name": name, "role": role_from_employee_group(row.get("Grupo", "")),
                        "active": True, "original_group": row.get("Grupo", ""), "code": code,
                        "registrationSource": "funcionarios.csv",
                    }
                    for key, value in updates.items():
                        if user.get(key) != value:
                            user[key] = value
                            changed = True
    except (OSError, csv.Error) as exc:
        print(f"Não foi possível sincronizar funcionários: {exc}")
        return

    for user in users:
        code = safe_text(user.get("code"), 40)
        if user.get("registrationSource") == "funcionarios.csv" and code and code not in seen_codes and user.get("active", True):
            user["active"] = False
            user["deactivatedAt"] = now_iso()
            changed = True

    # Mantém uma conta de cliente para teste e demonstração.
    if not any(normalize_username(item.get("username", "")) == "cliente" for item in users):
        salt, digest = password_digest("cliente123")
        users.append({
            "username": "cliente", "name": "Cliente de teste", "role": "client", "store": "", "active": True,
            "passwordSalt": salt, "passwordHash": digest, "passwordUpdatedAt": now_iso(),
            "createdAt": now_iso(), "registrationSource": "sistema",
        })
        changed = True
    if changed:
        write_json_file(USERS_DB, users)


def public_user(user: dict) -> dict:
    public = {k: user.get(k) for k in ("username", "name", "role", "store", "code", "mustChangePassword", "avatarUrl")}
    public["mustChangePassword"] = bool(FORCE_PASSWORD_CHANGE and user.get("mustChangePassword"))
    return public


def log_user_access(user: dict, action: str = "LOGIN") -> None:
    timestamp = time.strftime("%d/%m/%Y %H:%M:%S")
    log_entry = f"[{timestamp}] {action} - Usuário: {user.get('name')} ({user.get('username')}) - Perfil: {user.get('role')} - Loja: {user.get('store', 'N/A')}\n"
    with open(USERS_LOG, "a", encoding="utf-8") as f:
        f.write(log_entry)


def cleanup_sessions() -> None:
    cutoff = time.time() - 30 * 60
    with SESSION_LOCK:
        expired = [token for token, item in SESSIONS.items() if item.get("lastSeen", 0) < cutoff]
        for token in expired:
            SESSIONS.pop(token, None)


def create_session(user: dict) -> str:
    cleanup_sessions()
    token = secrets.token_urlsafe(32)
    with SESSION_LOCK:
        SESSIONS[token] = {"user": public_user(user), "created": time.time(), "lastSeen": time.time()}
    return token


def request_user(handler: SimpleHTTPRequestHandler) -> dict | None:
    auth = handler.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    with SESSION_LOCK:
        session = SESSIONS.get(token)
        if not session:
            return None
        now = time.time()
        if session.get("lastSeen", 0) < now - 30 * 60 or session.get("created", 0) < now - 8 * 3600:
            SESSIONS.pop(token, None)
            return None
        session_user = session.get("user", {})
        users = read_json_file(USERS_DB, [])
        current = next((item for item in users if normalize_username(item.get("username", "")) == normalize_username(session_user.get("username", ""))), None)
        if not current or not current.get("active", True):
            SESSIONS.pop(token, None)
            return None
        if current.get("role") == "client":
            document = re.sub(r"\D", "", safe_text(current.get("document"), 40))
            if document:
                clients = read_json_file(CLIENTS_DB, [])
                if any(item.get("blocked") and re.sub(r"\D", "", safe_text(item.get("document"), 40)) == document for item in clients):
                    SESSIONS.pop(token, None)
                    return None
        session["user"] = public_user(current)
        session["lastSeen"] = time.time()
        return dict(session["user"])


def require_user(handler: "AppHandler", roles: set[str] | None = None) -> dict | None:
    user = request_user(handler)
    if not user:
        handler.send_json(401, {"ok": False, "message": "Sua sessão expirou. Entre novamente."})
        return None
    if roles and user.get("role") not in roles:
        handler.send_json(403, {"ok": False, "message": "Você não tem permissão para realizar esta ação."})
        return None
    if FORCE_PASSWORD_CHANGE and user.get("mustChangePassword") and urlparse(handler.path).path not in {"/api/session", "/api/change-password", "/api/logout"}:
        handler.send_json(403, {"ok": False, "code": "PASSWORD_CHANGE_REQUIRED", "message": "Troque a senha temporária antes de continuar."})
        return None
    return user


def append_audit(path: Path, entry: dict, limit: int = 1500) -> None:
    entries = read_json_file(path, [])
    if not isinstance(entries, list):
        entries = []
    entries.insert(0, {"id": uuid.uuid4().hex, "at": now_iso(), **entry})
    write_json_file(path, entries[:limit])


def decode_data_url(content, max_bytes: int, label: str) -> bytes:
    if not content:
        raise ValueError(f"Selecione {label}.")
    text = str(content)
    if "," in text and text.lstrip().startswith("data:"):
        text = text.split(",", 1)[1]
    try:
        raw = base64.b64decode(text, validate=True)
    except Exception as exc:
        raise ValueError(f"Não foi possível ler {label}.") from exc
    if len(raw) > max_bytes:
        raise ValueError(f"{label.capitalize()} ultrapassa o limite permitido.")
    return raw


def decode_pdf(data: dict) -> bytes:
    file_name = safe_text(data.get("fileName"), 180).lower()
    if not file_name.endswith(".pdf"):
        raise ValueError("O arquivo precisa estar no formato PDF.")
    raw = decode_data_url(data.get("fileDataBase64"), MAX_PDF_BYTES, "o arquivo PDF")
    if not raw.startswith(b"%PDF"):
        raise ValueError("O arquivo selecionado não parece ser um PDF válido.")
    return raw


def image_extension(raw: bytes, file_name: str = "") -> str:
    if raw.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if len(raw) > 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return ".webp"
    ext = Path(file_name).suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        return ext
    raise ValueError("A imagem precisa estar em JPG, PNG ou WEBP.")


def clean_product_code(value: str) -> str:
    code = re.sub(r"[^A-Za-z0-9.-]", "", safe_text(value, 80))
    if not code:
        raise ValueError("Código do produto inválido.")
    return code


def photo_files_for_code(code: str) -> list[Path]:
    key = code.casefold()
    matches = []
    for path in PHOTOS_DIR.iterdir():
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        stem = path.stem.casefold()
        if stem == key or stem.startswith(key + "_"):
            matches.append(path)
    return sorted(matches, key=lambda p: (p.stem.casefold() != key, p.name.casefold()))


def scan_photos() -> dict[str, dict]:
    result: dict[str, dict] = {}
    grouped: dict[str, list[Path]] = {}
    for path in PHOTOS_DIR.iterdir():
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        code = path.stem.split("_", 1)[0].strip()
        if not code:
            continue
        grouped.setdefault(code, []).append(path)
    for code, paths in grouped.items():
        paths.sort(key=lambda p: (p.stem != code, p.name.casefold()))
        primary = paths[0]
        stat = primary.stat()
        result[code] = {
            "code": code,
            "url": f"data/fotos_produtos/{quote(primary.name)}?v={int(stat.st_mtime)}",
            "fileName": primary.name,
            "count": len(paths),
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(stat.st_mtime)),
        }
    return result


def refresh_photo_index(actor: dict | None = None) -> tuple[dict, dict]:
    previous = read_json_file(PHOTO_INDEX_DB, {})
    if not isinstance(previous, dict):
        previous = {}
    current = scan_photos()
    added = sorted(set(current) - set(previous))
    removed = sorted(set(previous) - set(current))
    changed = sorted(code for code in set(current) & set(previous) if current[code].get("fileName") != previous[code].get("fileName") or current[code].get("updatedAt") != previous[code].get("updatedAt"))
    write_json_file(PHOTO_INDEX_DB, current)
    diff = {"added": added, "changed": changed, "removed": removed, "total": len(current)}
    if actor and (added or changed or removed):
        append_audit(PHOTO_AUDIT_DB, {
            "action": "Atualização do diretório", "code": "—", "description": "Varredura da pasta de fotos",
            "actor": actor.get("name"), "store": actor.get("store"),
            "details": f"Incluídas: {len(added)}; alteradas: {len(changed)}; removidas: {len(removed)}.",
        })
    return current, diff


def seed_photo_directory() -> None:
    bundled = ROOT / "assets" / "products"
    if bundled.exists():
        for path in bundled.iterdir():
            target = PHOTOS_DIR / path.name
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS and not target.exists():
                target.write_bytes(path.read_bytes())
    refresh_photo_index()


def clean_manual_payload(data: dict, existing: dict | None = None) -> dict:
    visibility = safe_text(data.get("visibility"), 20).lower()
    if visibility not in {"public", "internal"}:
        visibility = "public"
    title = safe_text(data.get("title"), 180)
    if not title:
        raise ValueError("Informe o título do manual.")
    return {
        **(existing or {}), "title": title, "code": safe_text(data.get("code"), 60),
        "models": safe_text(data.get("models"), 220), "brand": safe_text(data.get("brand"), 80) or "SEG",
        "category": safe_text(data.get("category"), 80) or "Outros",
        "description": safe_text(data.get("description"), 900), "visibility": visibility,
        "approved": bool(data.get("approved", True)),
    }


def append_manual_audit(action: str, manual: dict, user: dict, details: str = "") -> None:
    append_audit(MANUAL_AUDIT_DB, {
        "action": action, "manualId": manual.get("id", ""), "title": manual.get("title", ""),
        "code": manual.get("code", ""), "actor": user.get("name", ""), "store": user.get("store", ""),
        "details": details,
    })


def normalize_header(value: str) -> str:
    return normalize_text(value).replace(" ", "_")


CLIENT_FIELD_ALIASES = {
    "code": {"codigo", "cod", "cliente", "codigo_cliente", "cod_cliente", "cliente_codigo", "id", "cd_cliente"},
    "name": {"nome", "razao_social", "razao", "nome_razao_social"},
    "fantasyName": {"nome_fantasia", "fantasia", "apelido"},
    "document": {"cpf_cnpj", "cnpj_cpf", "cpf", "cnpj", "documento", "inscricao_federal_cnpj_cpf"},
    "ie": {"inscricao_estadual", "ie", "insc_estadual", "inscricao_estadual_rg"},
    "phone": {"telefone", "fone", "telefone_1", "fone_1", "tel"},
    "whatsapp": {"whatsapp", "celular", "telefone_celular", "fone_celular", "fone_2"},
    "email": {"email", "e_mail", "correio_eletronico"},
    "address": {"endereco", "logradouro", "rua"},
    "number": {"numero", "numero_endereco", "num"},
    "complement": {"complemento", "compl"},
    "neighborhood": {"bairro"},
    "city": {"cidade", "municipio"},
    "state": {"uf", "estado"},
    "cep": {"cep", "codigo_postal"},
    "store": {"loja", "filial", "loja_origem"},
    "seller": {"vendedor", "representante"},
}


def decode_csv_payload(data: dict) -> tuple[bytes, str]:
    name = safe_text(data.get("fileName"), 180)
    if Path(name).suffix.lower() not in {".csv", ".xls", ".xlsx"}:
        raise ValueError("Selecione uma planilha CSV, XLS ou XLSX.")
    raw = decode_data_url(data.get("fileDataBase64"), MAX_CSV_BYTES, "a planilha")
    if Path(name).suffix.lower() == ".csv":
        return raw, name
    try:
        with tempfile.TemporaryDirectory(prefix="seg_planilha_") as folder:
            source = Path(folder) / Path(name).name
            target = Path(folder) / "convertido.csv"
            source.write_bytes(raw)
            script = (
                "$excel=New-Object -ComObject Excel.Application; $excel.Visible=$false; "
                "$excel.DisplayAlerts=$false; $excel.EnableEvents=$false; $excel.AutomationSecurity=3; "
                f"$book=$excel.Workbooks.Open('{str(source).replace("'", "''")}',0,$true); "
                f"$book.SaveAs('{str(target).replace("'", "''")}',6); $book.Close($false); $excel.Quit()"
            )
            result = subprocess.run(["powershell", "-NoProfile", "-Command", script], capture_output=True, timeout=90)
            if result.returncode or not target.exists():
                raise ValueError("Para importar XLS/XLSX, instale o Microsoft Excel ou salve a planilha como CSV.")
            return target.read_bytes(), name
    except (OSError, subprocess.SubprocessError):
        raise ValueError("Não foi possível converter a planilha. Salve-a como CSV separado por ponto e vírgula.")


def backup_file(path: Path) -> None:
    if path.exists():
        stamp = time.strftime("%Y%m%d-%H%M%S")
        shutil.copy2(path, BACKUP_DIR / f"{path.stem}-{stamp}{path.suffix}")


def ensure_full_client_base() -> None:
    current = read_json_file(CLIENTS_DB, [])
    if isinstance(current, list) and len(current) > 100:
        return
    candidates = sorted(DATA_DIR.glob("*cliente*.CSV")) + sorted(DATA_DIR.glob("*cliente*.csv"))
    for source in candidates:
        try:
            clients, _ = parse_clients_csv(source.read_bytes())
            write_json_file(CLIENTS_DB, clients)
            print(f"Base inicial carregada: {len(clients)} clientes")
            return
        except (OSError, ValueError):
            continue


def parse_clients_csv(raw: bytes) -> tuple[list[dict], dict]:
    decoded = None
    used_encoding = "utf-8"
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            decoded = raw.decode(encoding)
            used_encoding = encoding
            break
        except UnicodeDecodeError:
            continue
    if decoded is None:
        raise ValueError("Não foi possível reconhecer a codificação do CSV.")
    sample = decoded[:6000]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=";,\t|")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ";" if sample.count(";") >= sample.count(",") else ","
    reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
    if not reader.fieldnames:
        raise ValueError("O CSV não possui cabeçalho.")
    normalized_fields = {field: normalize_header(field) for field in reader.fieldnames if field is not None}
    field_map: dict[str, str] = {}
    for target, aliases in CLIENT_FIELD_ALIASES.items():
        for original, normalized in normalized_fields.items():
            if normalized in aliases:
                field_map[target] = original
                break
    if "name" not in field_map:
        raise ValueError("Não encontrei uma coluna de nome ou razão social no CSV.")
    clients = []
    for row_number, row in enumerate(reader, start=2):
        def value(target: str, limit: int = 250) -> str:
            source = field_map.get(target)
            return safe_text(row.get(source, "") if source else "", limit)
        name = value("name", 220)
        if not name or normalize_text(name) == "total geral":
            continue
        address_parts = [value("address", 220), value("number", 30), value("complement", 100)]
        address = ", ".join(part for part in address_parts if part)
        client = {
            "id": value("code", 80) or f"linha-{row_number}", "code": value("code", 80), "name": name,
            "fantasyName": value("fantasyName", 180), "document": value("document", 40), "ie": value("ie", 40),
            "phone": value("phone", 50), "whatsapp": value("whatsapp", 50), "email": value("email", 160),
            "address": address, "neighborhood": value("neighborhood", 100), "city": value("city", 100),
            "state": value("state", 4).upper(), "cep": value("cep", 20), "store": value("store", 120),
            "seller": value("seller", 100),
        }
        client["search"] = normalize_text(" ".join(str(v) for k, v in client.items() if k != "search"))
        clients.append(client)
    if not clients:
        raise ValueError("Nenhum cliente válido foi encontrado no CSV.")
    return clients, {"encoding": used_encoding, "delimiter": delimiter, "columns": field_map}


def search_clients(query: str, limit: int = 60) -> list[dict]:
    clients = read_json_file(CLIENTS_DB, [])
    if not isinstance(clients, list):
        return []
    q = normalize_text(query)
    if query == "__all__":
        return clients[:500]
    if len(q) < 2:
        return []
    tokens = q.split()
    scored = []
    digits = re.sub(r"\D", "", query)
    for client in clients:
        hay = client.get("search") or normalize_text(json.dumps(client, ensure_ascii=False))
        score = 0
        if normalize_text(client.get("code", "")) == q:
            score += 1000
        if digits and digits in re.sub(r"\D", "", f"{client.get('document','')} {client.get('phone','')} {client.get('whatsapp','')}"):
            score += 700
        if q in hay:
            score += 450
        if all(token in hay for token in tokens):
            score += len(tokens) * 80
        if score:
            scored.append((score, client))
    scored.sort(key=lambda item: (-item[0], item[1].get("name", "")))
    return [item[1] for item in scored[:limit]]


def public_product_descriptions(include_actor: bool = True) -> dict[str, dict]:
    records = read_json_file(PRODUCT_DESCRIPTIONS_DB, {})
    if not isinstance(records, dict):
        return {}
    result = {
        safe_text(code, 80): {
            "description": safe_text(item.get("description"), 1600),
            "updatedAt": safe_text(item.get("updatedAt"), 60),
            "revision": int(item.get("revision", 1) or 1),
        }
        for code, item in records.items() if isinstance(item, dict) and safe_text(item.get("description"), 1600)
    }
    if include_actor:
        for code, item in result.items():
            item["updatedBy"] = safe_text(records.get(code, {}).get("updatedBy"), 120)
    return result


def public_product_statuses(include_actor: bool = True) -> dict[str, dict]:
    records = read_json_file(PRODUCT_STATUSES_DB, {})
    if not isinstance(records, dict):
        return {}
    result = {}
    for code, item in records.items():
        if not isinstance(item, dict):
            continue
        clean_code = safe_text(code, 80)
        if not clean_code:
            continue
        public = {
            "active": item.get("active") is not False,
            "updatedAt": safe_text(item.get("updatedAt"), 60),
            "revision": int(item.get("revision", 1) or 1),
        }
        if include_actor:
            public["updatedBy"] = safe_text(item.get("updatedBy"), 120)
        result[clean_code] = public
    return result


DEFAULT_PRODUCT_CATEGORIES = [
    "Automatizadores",
    "CFTV",
    "Controle de acesso",
    "Alarmes e sensores",
    "Fontes e energia",
    "Redes e conectividade",
    "Cabos e conectores",
    "Interfonia e fechaduras",
    "Ferramentas e acessórios",
    "Outros",
]


def public_product_categories() -> dict:
    records = read_json_file(PRODUCT_CATEGORIES_DB, {})
    if not isinstance(records, dict):
        records = {}
    saved_categories = records.get("categories") if isinstance(records.get("categories"), list) else []
    categories = []
    for value in [*DEFAULT_PRODUCT_CATEGORIES, *saved_categories]:
        category = safe_text(value, 80).strip()
        if category and category.casefold() not in {item.casefold() for item in categories}:
            categories.append(category)
    overrides = records.get("overrides") if isinstance(records.get("overrides"), dict) else {}
    clean_overrides = {}
    for code, item in overrides.items():
        category = safe_text(item.get("category"), 80) if isinstance(item, dict) else safe_text(item, 80)
        if category:
            clean_overrides[safe_text(code, 80)] = {"category": category}
            if isinstance(item, dict):
                clean_overrides[safe_text(code, 80)].update({
                    "updatedAt": safe_text(item.get("updatedAt"), 60),
                    "updatedBy": safe_text(item.get("updatedBy"), 120),
                })
    return {"categories": categories, "overrides": clean_overrides}


def public_quote_templates(user: dict) -> list[dict]:
    templates = read_json_file(QUOTE_TEMPLATES_DB, [])
    if not isinstance(templates, list):
        return []
    can_delete = user.get("role") == "admin"
    result = []
    for item in templates:
        if not isinstance(item, dict):
            continue
        public = {
            "id": safe_text(item.get("id"), 40),
            "name": safe_text(item.get("name"), 80),
            "summary": safe_text(item.get("summary"), 240),
            "items": item.get("items", []),
            "payment": safe_text(item.get("payment"), 80),
            "validity": int(item.get("validity", 7) or 7),
            "discount": float(item.get("discount", 0) or 0),
            "freight": float(item.get("freight", 0) or 0),
            "notes": safe_text(item.get("notes"), 1200),
            "createdAt": safe_text(item.get("createdAt"), 60),
            "createdBy": safe_text(item.get("createdBy"), 120),
            "canDelete": can_delete,
        }
        if public["id"] and public["name"] and isinstance(public["items"], list):
            result.append(public)
    return result


def finite_number(value, default: float = 0.0, minimum: float = 0.0, maximum: float = 10_000_000.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number != number or number in {float("inf"), float("-inf")}:
        return default
    return max(minimum, min(maximum, number))


def clean_quote_history_payload(data: dict, user: dict) -> dict:
    if not isinstance(data, dict):
        raise ValueError("O pedido enviado é inválido.")
    raw_items = data.get("items")
    if not isinstance(raw_items, list) or not raw_items or len(raw_items) > 300:
        raise ValueError("O pedido precisa ter entre 1 e 300 produtos.")
    items = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            raise ValueError("Há um produto inválido no pedido.")
        code = safe_text(raw.get("code"), 80)
        description = safe_text(raw.get("description"), 500)
        if not code:
            raise ValueError("Há um produto sem código no pedido.")
        qty = finite_number(raw.get("qty"), 1, 0.001, 1_000_000)
        raw_seals = raw.get("warrantySeals") if isinstance(raw.get("warrantySeals"), list) else []
        seal_slots = min(300, max(0, int(qty)))
        warranty_seals = [safe_text(value, 120) for value in raw_seals[:seal_slots]]
        items.append({
            "code": code,
            "description": description,
            "qty": qty,
            "unitPrice": finite_number(raw.get("unitPrice"), 0, 0, 100_000_000),
            "warrantySeals": warranty_seals,
        })
    raw_client = data.get("client") if isinstance(data.get("client"), dict) else {}
    client = {
        "name": safe_text(raw_client.get("name"), 180),
        "code": safe_text(raw_client.get("code"), 80),
        "document": safe_text(raw_client.get("document"), 40),
        "phone": safe_text(raw_client.get("phone"), 50),
        "ie": safe_text(raw_client.get("ie"), 50),
        "address": safe_text(raw_client.get("address"), 260),
        "city": safe_text(raw_client.get("city"), 120),
        "state": safe_text(raw_client.get("state"), 10).upper(),
    }
    quote_id = safe_text(data.get("id"), 100) or uuid.uuid4().hex
    created_at = safe_text(data.get("createdAt"), 60) or now_iso()
    reused = data.get("reusedFrom") if isinstance(data.get("reusedFrom"), dict) else {}
    raw_delivery = data.get("delivery") if isinstance(data.get("delivery"), dict) else {}
    delivery = {
        "address": safe_text(raw_delivery.get("address"), 260),
        "date": safe_text(raw_delivery.get("date"), 20),
        "period": safe_text(raw_delivery.get("period"), 40),
        "receiver": safe_text(raw_delivery.get("receiver"), 160),
        "phone": safe_text(raw_delivery.get("phone"), 50),
        "notes": safe_text(raw_delivery.get("notes"), 2000),
        "savedAt": safe_text(raw_delivery.get("savedAt"), 60),
    } if raw_delivery else {}
    requested_store = safe_text(data.get("store"), 160)
    assigned_store = safe_text(user.get("store"), 160)
    # Vendedores e coordenadores só podem emitir pela filial atribuída à sua
    # conta. Administradores continuam podendo escolher a filial no orçamento.
    quote_store = assigned_store if user.get("role") in {"seller", "coordinator"} and assigned_store else requested_store or assigned_store
    return {
        "id": quote_id,
        "number": safe_text(data.get("number"), 40),
        "createdAt": created_at,
        "updatedAt": safe_text(data.get("updatedAt"), 60) or created_at,
        "seller": safe_text(data.get("seller"), 140),
        "sellerRole": safe_text(data.get("sellerRole"), 30),
        "store": quote_store,
        "payment": safe_text(data.get("payment"), 100),
        "validity": int(finite_number(data.get("validity"), 7, 1, 365)),
        "client": client,
        "items": items,
        "discount": finite_number(data.get("discount"), 0, 0, 100),
        "freight": finite_number(data.get("freight"), 0, 0, 100_000_000),
        "notes": safe_text(data.get("notes"), 4000),
        "status": safe_text(data.get("status"), 30) if safe_text(data.get("status"), 30) in {"quote", "delivery", "sale"} else "quote",
        "soldAt": safe_text(data.get("soldAt"), 60),
        "delivery": delivery,
        "reusedFrom": {
            "id": safe_text(reused.get("id"), 100),
            "number": safe_text(reused.get("number"), 40),
        } if reused else {},
        "ownerUsername": normalize_username(user.get("username", "")),
        "ownerName": safe_text(user.get("name"), 140),
        "ownerRole": safe_text(user.get("role"), 30),
        "serverSavedAt": now_iso(),
    }


def public_quote_history(user: dict) -> list[dict]:
    standardize_quote_history_storage()
    records = read_json_file(QUOTE_HISTORY_DB, [])
    if not isinstance(records, list):
        return []
    username = normalize_username(user.get("username", ""))
    role = user.get("role")
    can_see_all = role == "admin"
    user_store = normalize_text(user.get("store", ""))
    visible = [
        item for item in records
        if isinstance(item, dict) and (
            can_see_all
            or (role == "coordinator" and user_store and normalize_text(item.get("store", "")) == user_store)
            or normalize_username(item.get("ownerUsername", "")) == username
        )
    ]
    return sorted(visible, key=lambda item: safe_text(item.get("serverSavedAt") or item.get("updatedAt"), 60), reverse=True)


def public_team_history(user: dict) -> list[dict]:
    if user.get("role") not in {"coordinator", "admin"}:
        return []
    standardize_quote_history_storage()
    records = read_json_file(QUOTE_HISTORY_DB, [])
    if not isinstance(records, list):
        return []
    user_store = normalize_text(user.get("store", ""))
    visible = [
        item for item in records
        if isinstance(item, dict) and (
            user.get("role") == "admin"
            or (user_store and normalize_text(item.get("store", "")) == user_store)
        )
    ]
    return sorted(visible, key=lambda item: safe_text(item.get("soldAt") or item.get("updatedAt") or item.get("createdAt"), 60), reverse=True)


def search_seg_help(query: str) -> dict:
    key = query.casefold().strip()
    now = time.time()
    with SEARCH_CACHE_LOCK:
        cached = SEARCH_CACHE.get(key)
        if cached and cached[0] > now:
            return {**cached[1], "cached": True}
    params = urlencode({"query": query, "locale": "pt-br", "per_page": 20})
    request = Request(f"{SEG_HELP_SEARCH_URL}?{params}", headers={"Accept": "application/json", "User-Agent": f"SEG-Vendas/{APP_VERSION}"})
    try:
        with urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        message = "Muitas pesquisas em sequência. Aguarde um pouco e tente novamente." if exc.code == 429 else "A Central de Ajuda recusou temporariamente a pesquisa."
        raise RuntimeError(json.dumps({"status": exc.code, "message": message})) from exc
    except URLError as exc:
        raise RuntimeError(json.dumps({"status": 502, "message": "Não foi possível conectar à Central de Ajuda SEG. Verifique a internet."})) from exc
    except (TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(json.dumps({"status": 502, "message": "A Central de Ajuda SEG não respondeu corretamente."})) from exc
    raw_results = payload.get("results") or payload.get("articles") or []
    results = []
    for item in raw_results[:20]:
        html_url = item.get("html_url") or item.get("url") or ""
        if "/api/v2/" in html_url and item.get("id"):
            html_url = f"https://suporte.segbr.com.br/hc/pt-br/articles/{item['id']}-{slugify(item.get('title') or 'artigo')}"
        parsed_url = urlparse(html_url)
        if parsed_url.scheme != "https" or parsed_url.hostname != "suporte.segbr.com.br":
            if item.get("id"):
                html_url = f"https://suporte.segbr.com.br/hc/pt-br/articles/{item['id']}-{slugify(item.get('title') or 'artigo')}"
            else:
                continue
        results.append({
            "id": item.get("id"), "title": strip_html(item.get("title") or "Artigo SEG", 180), "url": html_url,
            "summary": strip_html(item.get("snippet") or item.get("body") or item.get("description"), 420),
            "updatedAt": item.get("updated_at") or item.get("edited_at") or "", "labels": item.get("label_names") or [],
        })
    result = {"ok": True, "source": "Central de Ajuda SEG", "query": query, "searchedAt": now_iso(), "count": len(results), "results": results, "cached": False}
    with SEARCH_CACHE_LOCK:
        SEARCH_CACHE[key] = (now + 600, result)
    return result


class AppHandler(SimpleHTTPRequestHandler):
    server_version = f"SEGVendas/{APP_VERSION}"
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".webp": "image/webp",
        ".webmanifest": "application/manifest+json",
    }

    def log_message(self, fmt: str, *args) -> None:
        return

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=(), usb=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://suporte.segbr.com.br")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_json(self, status: int, payload: dict | list) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def read_raw_body(self) -> bytes:
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise ValueError("A requisição precisa usar o formato JSON.")
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ValueError("Tamanho da requisição inválido.") from exc
        if length <= 0 or length > MAX_REQUEST_BYTES:
            raise ValueError("A requisição está vazia ou ultrapassa o limite permitido.")
        return self.rfile.read(length)

    def read_json_body(self) -> dict:
        try:
            value = json.loads(self.read_raw_body().decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Dados inválidos.") from exc
        if not isinstance(value, dict):
            raise ValueError("Formato de dados inválido.")
        return value

    def validate_request_source(self, mutation: bool = False) -> bool:
        host_header = self.headers.get("Host", "")
        try:
            request_authority = parse_request_authority(host_header)
        except ValueError:
            request_authority = ""
        if not request_authority or request_authority not in ALLOWED_REQUEST_AUTHORITIES:
            self.send_json(403, {"ok": False, "message": "Host não autorizado para este aplicativo."})
            return False
        if mutation:
            fetch_site = self.headers.get("Sec-Fetch-Site", "").casefold()
            if fetch_site == "cross-site":
                self.send_json(403, {"ok": False, "message": "Requisição externa bloqueada."})
                return False
            origin = self.headers.get("Origin", "")
            if origin:
                try:
                    origin_url = urlparse(origin)
                    origin_authority = parse_request_authority(origin_url.netloc)
                except ValueError:
                    origin_url = None
                    origin_authority = ""
                if (
                    not origin_url
                    or origin_url.scheme not in {"http", "https"}
                    or origin_url.path not in {"", "/"}
                    or origin_url.query
                    or origin_url.fragment
                    or origin_authority != request_authority
                ):
                    self.send_json(403, {"ok": False, "message": "Origem não autorizada."})
                    return False
        return True

    def do_HEAD(self) -> None:
        if not self.validate_request_source():
            return
        self.send_response(405)
        self.send_header("Allow", "GET, POST, PUT, DELETE")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if unquote(parsed.path) == "/healthz":
            self.send_json(200, {"ok": True, "version": APP_VERSION})
            return
        if not self.validate_request_source():
            return
        path = unquote(parsed.path)
        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/index.html")
            self.end_headers()
            return
        try:
            resolved_static = (ROOT / path.lstrip("/")).resolve()
            resolved_static.relative_to(ROOT.resolve())
        except (OSError, ValueError):
            self.send_json(403, {"ok": False, "message": "Caminho não permitido."})
            return
        if resolved_static.is_dir():
            self.send_json(403, {"ok": False, "message": "Listagem de diretório não permitida."})
            return
        blocked_extensions = {
            ".py", ".pyc", ".bat", ".ps1", ".csv", ".xls", ".xlsx", ".json", ".log", ".txt", ".tmp", ".zip", ".db",
            ".exe", ".dll", ".pyd", ".so", ".pem", ".key", ".crt", ".ini", ".cfg",
        }
        path_folded = path.casefold()
        protected_roots = (
            ROOT / "runtime",
            ROOT / "__pycache__",
            ROOT / "backups_instalador",
            ROOT / ".git",
            ROOT / "scripts",
            ROOT / "tools",
            ROOT / "tests",
            ROOT / "deploy",
            ROOT / "docs",
            ROOT / "_descartados",
        )
        if any(resolved_static.is_relative_to(item.resolve()) for item in protected_roots):
            self.send_json(403, {"ok": False, "message": "Arquivo interno protegido."})
            return
        in_data = resolved_static.is_relative_to(DATA_DIR.resolve())
        in_photos = resolved_static.is_relative_to(PHOTOS_DIR.resolve())
        in_profile_photos = resolved_static.is_relative_to(PROFILE_PHOTOS_DIR.resolve())
        in_manuals = resolved_static.is_relative_to(MANUALS_DIR.resolve())
        if in_data and not (in_photos or in_profile_photos):
            self.send_json(403, {"ok": False, "message": "Arquivo interno protegido."})
            return
        if in_photos or in_profile_photos:
            if resolved_static.suffix.lower() not in IMAGE_EXTENSIONS:
                self.send_json(403, {"ok": False, "message": "Formato de foto não permitido."})
                return
        if resolved_static.suffix.lower() in blocked_extensions:
            self.send_json(403, {"ok": False, "message": "Arquivo interno protegido."})
            return
        if in_manuals:
            user = require_user(self)
            if not user:
                return
            if user.get("role") == "client":
                requested_name = Path(path).name
                manuals = read_json_file(MANUALS_DB, [])
                allowed = any(item.get("fileName") == requested_name and item.get("visibility", "public") == "public" for item in manuals)
                if not allowed:
                    self.send_json(403, {"ok": False, "message": "Manual interno não disponível para clientes."})
                    return
        if path == "/api/recovery-status":
            self.send_json(200, {"ok": True, "configured": True, "mode": "admin_request"})
            return
        if path == "/api/session":
            user = request_user(self)
            self.send_json(200 if user else 401, {"ok": bool(user), "user": user} if user else {"ok": False, "message": "Sessão inválida."})
            return
        if path == "/api/manuals":
            user = require_user(self)
            if not user:
                return
            manuals = read_json_file(MANUALS_DB, [])
            if not isinstance(manuals, list):
                manuals = []
            if user.get("role") == "client":
                manuals = [item for item in manuals if item.get("visibility", "public") == "public"]
            self.send_json(200, {"ok": True, "manuals": manuals})
            return
        if path == "/api/manual-audit":
            if not require_user(self, {"coordinator", "admin"}):
                return
            self.send_json(200, {"ok": True, "entries": read_json_file(MANUAL_AUDIT_DB, [])})
            return
        if path == "/api/photos":
            if not require_user(self):
                return
            photos, _ = refresh_photo_index()
            self.send_json(200, {"ok": True, "photos": photos})
            return
        if path == "/api/photo-audit":
            if not require_user(self, {"coordinator", "admin"}):
                return
            self.send_json(200, {"ok": True, "entries": read_json_file(PHOTO_AUDIT_DB, [])})
            return
        if path == "/api/clients":
            if not require_user(self, {"seller", "coordinator", "admin"}):
                return
            query = safe_text(parse_qs(parsed.query).get("q", [""])[0], 180)
            self.send_json(200, {"ok": True, "clients": search_clients(query), "query": query})
            return
        if path == "/api/client-import-audit":
            if not require_user(self, {"coordinator", "admin"}):
                return
            self.send_json(200, {"ok": True, "entries": read_json_file(CLIENT_IMPORT_AUDIT_DB, [])})
            return
        if path == "/api/product-descriptions":
            user = require_user(self)
            if not user:
                return
            self.send_json(200, {"ok": True, "descriptions": public_product_descriptions(user.get("role") != "client")})
            return
        if path == "/api/product-statuses":
            user = require_user(self)
            if not user:
                return
            self.send_json(200, {"ok": True, "statuses": public_product_statuses(user.get("role") != "client")})
            return
        if path == "/api/product-categories":
            if not require_user(self):
                return
            self.send_json(200, {"ok": True, **public_product_categories()})
            return
        if path == "/api/quote-history":
            user = require_user(self, {"seller", "coordinator", "admin"})
            if not user:
                return
            self.send_json(200, {"ok": True, "history": public_quote_history(user)})
            return
        if path == "/api/team-history":
            user = require_user(self, {"coordinator", "admin"})
            if not user:
                return
            self.send_json(200, {"ok": True, "history": public_team_history(user), "scope": "all" if user.get("role") == "admin" else user.get("store", "")})
            return
        if path == "/api/quote-templates":
            user = require_user(self, {"seller", "coordinator", "admin"})
            if not user:
                return
            self.send_json(200, {"ok": True, "templates": public_quote_templates(user)})
            return
        if path == "/api/access-requests":
            if not require_user(self, {"admin"}):
                return
            requests = read_json_file(ACCESS_REQUESTS_DB, [])
            if not isinstance(requests, list):
                requests = []
            public_requests = [{k: item.get(k) for k in (
                "id", "name", "email", "phone", "document", "username", "status", "createdAt"
            )} for item in requests if item.get("status") == "pending"]
            self.send_json(200, {"ok": True, "requests": public_requests})
            return
        if path == "/api/password-reset-requests":
            if not require_user(self, {"admin"}):
                return
            requests = read_json_file(PASSWORD_RESET_REQUESTS_DB, [])
            if not isinstance(requests, list):
                requests = []
            public_requests = [{k: item.get(k) for k in (
                "id", "name", "username", "code", "role", "store", "status", "createdAt"
            )} for item in requests if item.get("status") == "pending"]
            self.send_json(200, {"ok": True, "requests": public_requests})
            return
        if path == "/api/integrations":
            if not require_user(self, {"admin"}):
                return
            config = read_json_file(INTEGRATIONS_DB, {})
            self.send_json(200, {"ok": True, "integration": public_integration_config(config)})
            return
        if path == "/api/sync-status":
            if not require_user(self, {"coordinator", "admin"}):
                return
            self.send_json(200, {"ok": True, "dataplace": dataplace_sync_config(), "queue": SYNC_QUEUE.snapshot()})
            return
        if path == "/api/replication-status":
            if not require_user(self, {"coordinator", "admin"}):
                return
            self.send_json(200, {"ok": True, "replication": store_replication_status()})
            return
        if path == "/api/supabase-status":
            if not require_user(self, {"admin"}):
                return
            self.send_json(200, {"ok": True, "supabase": supabase_status()})
            return
        if path == "/api/store-sync/pull":
            if not parse_config_bool(os.environ.get("SEG_REPLICATION_HUB")):
                self.send_json(404, {"ok": False, "message": "Sincronização central não está habilitada."})
                return
            try:
                store_id = verify_hub_request(self.headers)
                query = parse_qs(parsed.query)
                cursor = max(0, int((query.get("cursor") or ["0"])[0]))
                limit = max(1, min(200, int((query.get("limit") or ["50"])[0])))
                events, next_cursor = STORE_REPLICA.hub_pull(cursor, limit)
                self.send_json(200, {"ok": True, "storeId": store_id, "events": events, "nextCursor": next_cursor})
            except (StoreReplicationError, ValueError, sqlite3.Error) as exc:
                self.send_json(401, {"ok": False, "message": str(exc)[:240]})
            return
        if path == "/api/seg-help-search":
            if not require_user(self):
                return
            query = safe_text(parse_qs(parsed.query).get("q", [""])[0], 180)
            if len(query.strip()) < 2:
                self.send_json(400, {"ok": False, "message": "Digite ao menos 2 caracteres para pesquisar."})
                return
            try:
                self.send_json(200, search_seg_help(query))
            except RuntimeError as exc:
                try:
                    error = json.loads(str(exc))
                except json.JSONDecodeError:
                    error = {"status": 502, "message": "Não foi possível realizar a pesquisa."}
                self.send_json(int(error.pop("status", 502)), {"ok": False, **error})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if not self.validate_request_source(mutation=True):
            return
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/register":
            try:
                data = self.read_json_body()
                name = safe_text(data.get("name"), 120)
                email = safe_text(data.get("email"), 140).lower()
                phone = safe_text(data.get("phone"), 40)
                document = re.sub(r"\D", "", safe_text(data.get("document"), 30))
                raw_username = safe_text(data.get("username"), 80) or email or document
                username = normalize_username(raw_username)
                password = str(data.get("password") or "")[:200]
                client_ip = self.client_address[0] if self.client_address else "unknown"
                if not rate_limit_ok(f"register:{client_ip}", 8, 3600):
                    self.send_json(429, {"ok": False, "message": "Muitas tentativas de cadastro. Aguarde e tente novamente."})
                    return
                if len(name) < 3:
                    raise ValueError("Informe seu nome ou razão social.")
                if len(document) not in {11, 14}:
                    raise ValueError("Informe um CPF ou CNPJ válido para vincular o acesso à base de clientes.")
                clients = read_json_file(CLIENTS_DB, [])
                matched_client = next((item for item in clients if re.sub(r"\D", "", safe_text(item.get("document"), 40)) == document), None)
                if matched_client and matched_client.get("blocked"):
                    self.send_json(403, {"ok": False, "message": "Este cliente está bloqueado. Procure a SEG para regularizar o cadastro."})
                    return
                if len(username) < 4:
                    raise ValueError("Crie um usuário com pelo menos 4 caracteres ou informe seu e-mail.")
                if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
                    raise ValueError("Informe um e-mail válido.")
                if not valid_new_password(password):
                    raise ValueError("A senha precisa ter pelo menos 8 caracteres, com letras e números.")
                users = read_json_file(USERS_DB, [])
                if not isinstance(users, list):
                    users = []
                if any(normalize_username(item.get("username", "")) == username for item in users):
                    self.send_json(409, {"ok": False, "message": "Esse usuário ou e-mail já está cadastrado."})
                    return
                if document and any(re.sub(r"\D", "", safe_text(item.get("document"), 30)) == document for item in users):
                    self.send_json(409, {"ok": False, "message": "Já existe um cadastro com esse CPF ou CNPJ."})
                    return
                salt, digest = password_digest(password)
                if not matched_client:
                    requests = read_json_file(ACCESS_REQUESTS_DB, [])
                    if not isinstance(requests, list):
                        requests = []
                    duplicate = next((item for item in requests if item.get("status") == "pending" and (
                        normalize_username(item.get("username", "")) == username
                        or re.sub(r"\D", "", safe_text(item.get("document"), 30)) == document
                    )), None)
                    if duplicate:
                        self.send_json(202, {"ok": True, "pending": True, "message": "Sua solicitação já está aguardando aprovação da SEG."})
                        return
                    request_item = {
                        "id": uuid.uuid4().hex, "name": name, "email": email, "phone": phone,
                        "document": document, "username": username, "status": "pending",
                        "passwordSalt": salt, "passwordHash": digest, "createdAt": now_iso(),
                        "clientIp": client_ip,
                    }
                    requests.insert(0, request_item)
                    write_json_file(ACCESS_REQUESTS_DB, requests)
                    append_audit(ACCESS_REQUEST_AUDIT_DB, {
                        "action": "requested", "requestId": request_item["id"], "name": name,
                        "document": document, "username": username,
                    })
                    self.send_json(202, {"ok": True, "pending": True, "message": "Solicitação enviada. Um administrador da SEG precisa liberar seu acesso."})
                    return
                user = {
                    "username": username, "name": name, "role": "client", "store": "", "active": True,
                    "email": email, "phone": phone, "document": document,
                    "passwordSalt": salt, "passwordHash": digest, "passwordUpdatedAt": now_iso(),
                    "createdAt": now_iso(), "registrationSource": "auto_cadastro_cliente",
                    "mustChangePassword": False,
                }
                users.append(user)
                write_json_file(USERS_DB, users)
                log_user_access(user, "CADASTRO DE CLIENTE")
                token = create_session(user)
                self.send_json(201, {"ok": True, "token": token, "user": public_user(user), "message": "Cadastro criado com sucesso."})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            return
        match = re.fullmatch(r"/api/password-reset-requests/([a-f0-9]+)/approve", path)
        if match:
            admin = require_user(self, {"admin"})
            if not admin:
                return
            with DB_LOCK:
                requests = read_json_file(PASSWORD_RESET_REQUESTS_DB, [])
                if not isinstance(requests, list):
                    requests = []
                request_index = next((i for i, item in enumerate(requests) if item.get("id") == match.group(1) and item.get("status") == "pending"), -1)
                if request_index < 0:
                    self.send_json(404, {"ok": False, "message": "Solicitação não encontrada ou já analisada."})
                    return
                request_item = requests[request_index]
                users = read_json_file(USERS_DB, [])
                if not isinstance(users, list):
                    users = []
                username = normalize_username(request_item.get("username", ""))
                code = safe_text(request_item.get("code"), 40)
                user_index = next((i for i, item in enumerate(users) if item.get("role") in INTERNAL_ROLES and (
                    normalize_username(item.get("username", "")) == username
                    or (code and safe_text(item.get("code"), 40).casefold() == code.casefold())
                )), -1)
                if user_index < 0 or not factory_password_for_employee(users[user_index]):
                    self.send_json(404, {"ok": False, "message": "A conta do funcionário não foi localizada para restauração."})
                    return
                user = users[user_index]
                factory_password = factory_password_for_employee(user)
                password_changed = not verify_password(user, factory_password)
                stamp = now_iso()
                if password_changed:
                    backup_file(USERS_DB)
                    apply_factory_password(user, stamp)
                user["mustChangePassword"] = False
                user["passwordChangedByUser"] = False
                user["passwordRecoveredAt"] = stamp
                user["passwordRecoveredBy"] = admin.get("username")
                write_json_file(USERS_DB, users)
                requests[request_index]["status"] = "approved"
                requests[request_index]["approvedAt"] = stamp
                requests[request_index]["approvedBy"] = admin.get("username")
                write_json_file(PASSWORD_RESET_REQUESTS_DB, requests)
            revoke_user_sessions(user.get("username", ""))
            clear_login_rate_limits(user.get("username", ""), user.get("code", ""))
            append_audit(PASSWORD_RECOVERY_AUDIT_DB, {
                "action": "factory_password_restored_by_admin",
                "requestId": request_item.get("id"),
                "username": user.get("username"),
                "code": user.get("code"),
                "name": user.get("name"),
                "passwordChanged": password_changed,
                "approvedBy": admin.get("username"),
            })
            log_user_access(user, "RESTAURAÇÃO DE SENHA DE FÁBRICA AUTORIZADA PELO ADMINISTRADOR")
            self.send_json(200, {
                "ok": True,
                "code": user.get("code"),
                "message": "Acesso restaurado para a senha de fábrica SEG@CÓDIGO.",
            })
            return
        match = re.fullmatch(r"/api/access-requests/([a-f0-9]+)/approve", path)
        if match:
            admin = require_user(self, {"admin"})
            if not admin:
                return
            requests = read_json_file(ACCESS_REQUESTS_DB, [])
            if not isinstance(requests, list):
                requests = []
            index = next((i for i, item in enumerate(requests) if item.get("id") == match.group(1) and item.get("status") == "pending"), -1)
            if index < 0:
                self.send_json(404, {"ok": False, "message": "Solicitação não encontrada ou já analisada."})
                return
            request_item = requests[index]
            users = read_json_file(USERS_DB, [])
            if not isinstance(users, list):
                users = []
            username = normalize_username(request_item.get("username", ""))
            document = re.sub(r"\D", "", safe_text(request_item.get("document"), 30))
            if any(normalize_username(item.get("username", "")) == username for item in users):
                self.send_json(409, {"ok": False, "message": "O usuário informado já existe."})
                return
            user = {
                "username": username, "name": request_item.get("name"), "role": "client", "store": "", "active": True,
                "email": request_item.get("email", ""), "phone": request_item.get("phone", ""), "document": document,
                "passwordSalt": request_item.get("passwordSalt"), "passwordHash": request_item.get("passwordHash"),
                "passwordUpdatedAt": now_iso(), "createdAt": now_iso(), "registrationSource": "aprovacao_admin",
                "mustChangePassword": False, "approvedAt": now_iso(), "approvedBy": admin.get("username"),
            }
            users.append(user)
            write_json_file(USERS_DB, users)
            requests[index]["status"] = "approved"
            requests[index]["approvedAt"] = now_iso()
            requests[index]["approvedBy"] = admin.get("username")
            write_json_file(ACCESS_REQUESTS_DB, requests)
            append_audit(ACCESS_REQUEST_AUDIT_DB, {
                "action": "approved", "requestId": request_item.get("id"), "name": request_item.get("name"),
                "document": document, "username": username, "approvedBy": admin.get("username"),
            })
            log_user_access(user, "CADASTRO DE CLIENTE APROVADO")
            self.send_json(200, {"ok": True, "message": "Acesso de cliente liberado com sucesso."})
            return
        if path == "/api/integrations":
            admin = require_user(self, {"admin"})
            if not admin:
                return
            try:
                data = self.read_json_body()
                existing = read_json_file(INTEGRATIONS_DB, {})
                if not isinstance(existing, dict):
                    existing = {}
                provider = safe_text(data.get("provider"), 40).lower() or "dataplace"
                if provider not in {"dataplace", "generic"}:
                    raise ValueError("Escolha Dataplace ou API genérica.")
                auth_type = safe_text(data.get("authType"), 30).lower() or "bearer"
                if auth_type not in {"none", "bearer", "api-key"}:
                    raise ValueError("O tipo de autenticação informado é inválido.")
                base_url = clean_integration_url(data.get("baseUrl"), "URL principal", required=True)
                api_key_header = safe_text(data.get("apiKeyHeader"), 80) or "X-API-Key"
                if auth_type == "api-key" and not re.fullmatch(r"[A-Za-z0-9-]{1,80}", api_key_header):
                    raise ValueError("O nome do cabeçalho da chave de API é inválido.")
                def endpoint(name: str) -> str:
                    value = safe_text(data.get(name), 300)
                    if "://" in value:
                        raise ValueError("Nos endpoints, informe somente o caminho relativo à URL principal.")
                    return value
                secret = str(data.get("secret") or "").strip()[:10_000]
                client_ip = self.client_address[0] if self.client_address else ""
                if secret and client_ip not in {"127.0.0.1", "::1"}:
                    raise ValueError("Por segurança, cadastre a credencial diretamente no computador servidor. A configuração remota será liberada somente após HTTPS.")
                protected_secret = protect_server_secret(secret) if secret else safe_text(existing.get("protectedSecret"), 20_000)
                enabled = bool(data.get("enabled"))
                if enabled and auth_type != "none" and not protected_secret:
                    raise ValueError("Informe a credencial antes de habilitar o conector.")
                config = {
                    "provider": provider,
                    "name": safe_text(data.get("name"), 100) or ("Dataplace" if provider == "dataplace" else "API externa"),
                    "baseUrl": base_url,
                    "testPath": endpoint("testPath"),
                    "customersPath": endpoint("customersPath"),
                    "productsPath": endpoint("productsPath"),
                    "authType": auth_type,
                    "apiKeyHeader": api_key_header,
                    "enabled": enabled,
                    "protectedSecret": protected_secret,
                    "updatedAt": now_iso(),
                    "updatedBy": admin.get("name", ""),
                }
                if INTEGRATIONS_DB.exists():
                    backup_file(INTEGRATIONS_DB)
                write_json_file(INTEGRATIONS_DB, config)
                append_audit(INTEGRATION_AUDIT_DB, {
                    "action": "configuration_saved", "provider": provider, "name": config["name"],
                    "baseUrl": base_url, "enabled": enabled, "actor": admin.get("name", ""),
                })
                self.send_json(200, {"ok": True, "integration": public_integration_config(config), "message": "Configuração da integração salva no servidor."})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            return
        if path == "/api/integrations/test":
            admin = require_user(self, {"admin"})
            if not admin:
                return
            config = read_json_file(INTEGRATIONS_DB, {})
            if not isinstance(config, dict) or not config.get("baseUrl"):
                self.send_json(400, {"ok": False, "message": "Salve a configuração da integração antes de testar."})
                return
            try:
                target = integration_request_url(config)
                started = time.time()
                request = Request(target, headers=integration_headers(config), method="GET")
                with urlopen(request, timeout=15) as response:
                    status = int(getattr(response, "status", 200))
                    response.read(1024)
                elapsed_ms = int((time.time() - started) * 1000)
                append_audit(INTEGRATION_AUDIT_DB, {
                    "action": "connection_test_ok", "provider": config.get("provider"),
                    "status": status, "elapsedMs": elapsed_ms, "actor": admin.get("name", ""),
                })
                self.send_json(200, {"ok": True, "status": status, "elapsedMs": elapsed_ms, "message": "A API respondeu e a credencial foi aceita."})
            except HTTPError as exc:
                append_audit(INTEGRATION_AUDIT_DB, {
                    "action": "connection_test_failed", "provider": config.get("provider"),
                    "status": exc.code, "actor": admin.get("name", ""),
                })
                self.send_json(400, {"ok": False, "status": exc.code, "message": f"A API respondeu com HTTP {exc.code}. Confira URL, endpoint e credencial."})
            except (URLError, TimeoutError, OSError, ValueError) as exc:
                append_audit(INTEGRATION_AUDIT_DB, {
                    "action": "connection_test_failed", "provider": config.get("provider"),
                    "detail": safe_text(exc, 240), "actor": admin.get("name", ""),
                })
                self.send_json(400, {"ok": False, "message": "Não foi possível conectar. Confira o endereço, a rede e a credencial da API."})
            return
        if path == "/api/sync-run":
            admin = require_user(self, {"admin"})
            if not admin:
                return
            try:
                config = DataplaceConfig.from_env()
                if not config.enabled:
                    self.send_json(400, {"ok": False, "message": "A sincronização Dataplace está desativada ou incompleta no ambiente do servidor."})
                    return
                result = SYNC_QUEUE.process(DataplaceClient(config), limit=50)
                append_audit(SYNC_AUDIT_DB, {"action": "manual_run", "actor": admin.get("name", ""), **result})
                self.send_json(200, {"ok": True, "result": result})
            except DataplaceError as exc:
                append_audit(SYNC_AUDIT_DB, {"action": "manual_run_failed", "actor": admin.get("name", ""), "detail": str(exc)[:240]})
                self.send_json(400, {"ok": False, "message": str(exc)})
            return
        if path == "/api/replication-run":
            admin = require_user(self, {"admin"})
            if not admin:
                return
            try:
                config = StoreReplicationConfig.from_env()
                supabase = SupabaseConfig.from_env_or_file(DATA_DIR)
                if not config.enabled and not supabase.enabled:
                    self.send_json(400, {"ok": False, "message": "A réplica entre lojas está desativada ou incompleta no ambiente desta loja."})
                    return
                if supabase.enabled:
                    result = SupabaseStoreReplicationClient(supabase).sync_once(STORE_REPLICA)
                    result["transport"] = "supabase"
                else:
                    result = StoreReplicationClient(config).sync_once(STORE_REPLICA)
                    result["transport"] = "hub"
                result["apply"] = apply_incoming_replication_events()
                STORE_REPLICA.set_meta("lastSyncAt", now_iso())
                STORE_REPLICA.set_meta("lastSyncError", "")
                self.send_json(200, {"ok": True, "result": result})
            except (StoreReplicationError, SupabaseError, OSError, ValueError, sqlite3.Error) as exc:
                STORE_REPLICA.set_meta("lastSyncError", safe_text(exc, 240))
                self.send_json(400, {"ok": False, "message": str(exc)[:240]})
            return
        if path == "/api/replication-backup":
            admin = require_user(self, {"admin"})
            if not admin:
                return
            try:
                config = StoreReplicationConfig.from_env()
                capture_local_replica_snapshots()
                result = create_local_backup(DATA_DIR, BACKUP_DIR, config.store_id, config.backup_retention, STORE_REPLICA_DB)
                STORE_REPLICA.set_meta("lastBackupAt", result["createdAt"])
                STORE_REPLICA.set_meta("lastBackupEpoch", time.time())
                self.send_json(200, {"ok": True, "backup": result})
            except (OSError, ValueError, sqlite3.Error, zipfile.BadZipFile) as exc:
                self.send_json(400, {"ok": False, "message": "Não foi possível criar o backup local."})
            return
        if path == "/api/store-sync/push":
            if not parse_config_bool(os.environ.get("SEG_REPLICATION_HUB")):
                self.send_json(404, {"ok": False, "message": "Sincronização central não está habilitada."})
                return
            try:
                raw_body = self.read_raw_body()
                store_id = verify_hub_request(self.headers, raw_body)
                data = json.loads(raw_body.decode("utf-8"))
                events = data.get("events") if isinstance(data, dict) else None
                if not isinstance(events, list) or len(events) > 200:
                    raise ValueError("Lote de eventos inválido.")
                clean_events = []
                for event in events:
                    if not isinstance(event, dict) or not safe_text(event.get("eventId"), 160):
                        continue
                    if safe_text(event.get("entity"), 80) not in {"quote"}:
                        continue
                    clean_events.append({
                        "eventId": safe_text(event.get("eventId"), 160),
                        "storeId": store_id,
                        "entity": safe_text(event.get("entity"), 80),
                        "operation": safe_text(event.get("operation"), 80),
                        "payload": event.get("payload") if isinstance(event.get("payload"), dict) else {},
                        "createdAt": safe_text(event.get("createdAt"), 60) or now_iso(),
                    })
                STORE_REPLICA.hub_receive_events(clean_events, store_id)
                self.send_json(200, {"ok": True, "storeId": store_id, "acceptedEventIds": [event["eventId"] for event in clean_events]})
            except (StoreReplicationError, ValueError, UnicodeDecodeError, json.JSONDecodeError, sqlite3.Error) as exc:
                self.send_json(401, {"ok": False, "message": str(exc)[:240]})
            return
        if path == "/api/login":
            try:
                data = self.read_json_body()
                raw_login = safe_text(data.get("username"), 80)
                username = normalize_username(raw_login)
                password = str(data.get("password") or "")[:200]
                client_ip = self.client_address[0] if self.client_address else "unknown"
                if not rate_limit_ok(f"login-ip:{client_ip}", 30, 600) or not rate_limit_ok(f"login-user:{username}", 10, 600):
                    self.send_json(429, {"ok": False, "message": "Muitas tentativas de acesso. Aguarde alguns minutos."})
                    return
                users = read_json_file(USERS_DB, [])
                user = next((item for item in users if item.get("active", True) and (
                    normalize_username(item.get("username", "")) == username
                    or safe_text(item.get("code"), 40).casefold() == raw_login.strip().casefold()
                )), None)
                if not user or not password or not verify_password(user, password):
                    time.sleep(0.35)
                    self.send_json(401, {"ok": False, "message": "Código, usuário ou senha incorretos."})
                    return
                if user.get("role") == "client":
                    document = re.sub(r"\D", "", safe_text(user.get("document"), 40))
                    if document:
                        clients = read_json_file(CLIENTS_DB, [])
                        blocked = any(item.get("blocked") and re.sub(r"\D", "", safe_text(item.get("document"), 40)) == document for item in clients)
                        if blocked:
                            self.send_json(403, {"ok": False, "message": "Este cliente está bloqueado. Procure a SEG para regularizar o acesso."})
                            return
                log_user_access(user, "LOGIN")
                token = create_session(user)
                self.send_json(200, {"ok": True, "token": token, "user": public_user(user)})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            return
        if path == "/api/profile-photo":
            user = require_user(self)
            if not user:
                return
            try:
                data = self.read_json_body()
                raw = decode_data_url(data.get("fileDataBase64"), 3 * 1024 * 1024, "a foto de perfil")
                ext = image_extension(raw, safe_text(data.get("fileName"), 180))
                username = normalize_username(user.get("username", ""))
                users = read_json_file(USERS_DB, [])
                if not isinstance(users, list):
                    users = []
                index = next((i for i, item in enumerate(users) if normalize_username(item.get("username", "")) == username), -1)
                if index < 0:
                    self.send_json(404, {"ok": False, "message": "Usuário não encontrado."})
                    return
                old_url = safe_text(users[index].get("avatarUrl"), 300)
                file_name = f"{slugify(username)}-{uuid.uuid4().hex[:12]}{ext}"
                destination = PROFILE_PHOTOS_DIR / file_name
                destination.write_bytes(raw)
                users[index]["avatarUrl"] = f"/data/fotos_perfil/{quote(file_name)}"
                users[index]["avatarUpdatedAt"] = now_iso()
                write_json_file(USERS_DB, users)
                if old_url:
                    old_name = Path(unquote(urlparse(old_url).path)).name
                    old_path = (PROFILE_PHOTOS_DIR / old_name).resolve()
                    if old_path.is_relative_to(PROFILE_PHOTOS_DIR.resolve()) and old_path != destination.resolve():
                        old_path.unlink(missing_ok=True)
                self.send_json(200, {"ok": True, "user": public_user(users[index])})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            except OSError:
                self.send_json(500, {"ok": False, "message": "Não foi possível salvar a foto de perfil."})
            return
        if path == "/api/password-reset-requests":
            try:
                data = self.read_json_body()
                raw_login = safe_text(data.get("username"), 80)
                normalized_login = normalize_username(raw_login)
                client_ip = self.client_address[0] if self.client_address else "unknown"
                if not raw_login:
                    self.send_json(400, {"ok": False, "message": "Informe seu código ou usuário."})
                    return
                if not rate_limit_ok(f"password-reset-request-ip:{client_ip}", 8, 3600) or not rate_limit_ok(f"password-reset-request-user:{normalized_login}", 4, 3600):
                    self.send_json(429, {"ok": False, "message": "Muitas solicitações em sequência. Aguarde antes de tentar novamente."})
                    return
                users = read_json_file(USERS_DB, [])
                if not isinstance(users, list):
                    users = []
                user = next((item for item in users if item.get("active", True) and factory_password_for_employee(item) and (
                    normalize_username(item.get("username", "")) == normalized_login
                    or safe_text(item.get("code"), 40).casefold() == raw_login.strip().casefold()
                )), None)
                if user:
                    with DB_LOCK:
                        requests = read_json_file(PASSWORD_RESET_REQUESTS_DB, [])
                        if not isinstance(requests, list):
                            requests = []
                        duplicate = next((item for item in requests if item.get("status") == "pending" and (
                            normalize_username(item.get("username", "")) == normalize_username(user.get("username", ""))
                            or safe_text(item.get("code"), 40) == safe_text(user.get("code"), 40)
                        )), None)
                        if not duplicate:
                            request_item = {
                                "id": uuid.uuid4().hex,
                                "name": user.get("name", ""),
                                "username": user.get("username", ""),
                                "code": user.get("code", ""),
                                "role": user.get("role", ""),
                                "store": user.get("store", ""),
                                "status": "pending",
                                "createdAt": now_iso(),
                                "clientIp": client_ip,
                            }
                            requests.insert(0, request_item)
                            write_json_file(PASSWORD_RESET_REQUESTS_DB, requests[:1500])
                            append_audit(PASSWORD_RECOVERY_AUDIT_DB, {
                                "action": "password_reset_requested",
                                "requestId": request_item["id"],
                                "username": user.get("username"),
                                "code": user.get("code"),
                                "name": user.get("name"),
                                "clientIp": client_ip,
                            })
                else:
                    # Resposta genérica evita confirmar publicamente quais funcionários existem na base.
                    time.sleep(0.35)
                self.send_json(202, {
                    "ok": True,
                    "pending": True,
                    "message": "Solicitação enviada ao servidor. Um administrador precisa autorizar a restauração para a senha de fábrica.",
                })
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            return
        if path == "/api/forgot-password":
            self.send_json(410, {"ok": False, "message": "Use o novo pedido de recuperação para autorização do administrador."})
            return
        if path == "/api/change-password":
            session_user = require_user(self)
            if not session_user:
                return
            try:
                data = self.read_json_body()
                current_password = str(data.get("currentPassword") or "")[:200]
                new_password = str(data.get("newPassword") or "")[:200]
                if not valid_new_password(new_password):
                    self.send_json(400, {"ok": False, "message": "A nova senha precisa ter pelo menos 8 caracteres, com letras e números."})
                    return
                users = read_json_file(USERS_DB, [])
                index = next((i for i, item in enumerate(users) if normalize_username(item.get("username", "")) == normalize_username(session_user.get("username", ""))), -1)
                if index < 0 or not verify_password(users[index], current_password):
                    self.send_json(401, {"ok": False, "message": "A senha atual está incorreta."})
                    return
                if hmac.compare_digest(new_password, current_password) or hmac.compare_digest(new_password, default_password_for(users[index])):
                    self.send_json(400, {"ok": False, "message": "Escolha uma senha nova, diferente da senha temporária ou atual."})
                    return
                salt, digest = password_digest(new_password)
                users[index]["passwordSalt"] = salt
                users[index]["passwordHash"] = digest
                users[index]["passwordUpdatedAt"] = now_iso()
                users[index]["mustChangePassword"] = False
                users[index]["passwordChangedByUser"] = True
                write_json_file(USERS_DB, users)
                revoke_user_sessions(users[index].get("username", ""))
                log_user_access(users[index], "TROCA DE SENHA")
                new_token = create_session(users[index])
                self.send_json(200, {"ok": True, "token": new_token, "user": public_user(users[index])})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            return
        if path == "/api/logout":
            auth = self.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                with SESSION_LOCK:
                    session = SESSIONS.pop(auth[7:].strip(), None)
                    if session and session.get("user"):
                        log_user_access(session["user"], "LOGOUT")
            self.send_json(200, {"ok": True})
            return
        if path == "/api/manuals":
            user = require_user(self, {"coordinator", "admin"})
            if not user:
                return
            try:
                data = self.read_json_body()
                manual = clean_manual_payload(data)
                pdf = decode_pdf(data)
                manual_id = uuid.uuid4().hex
                file_name = f"{slugify(f'{manual.get('code', '')}-{manual['title']}')}-{manual_id[:8]}.pdf"
                (MANUALS_DIR / file_name).write_bytes(pdf)
                manual.update({"id": manual_id, "fileName": file_name, "url": f"manuais/{quote(file_name)}", "createdAt": now_iso(), "updatedAt": now_iso(), "updatedBy": user["name"], "store": user.get("store", ""), "source": "local"})
                manuals = read_json_file(MANUALS_DB, [])
                if not isinstance(manuals, list):
                    manuals = []
                manuals.insert(0, manual)
                write_json_file(MANUALS_DB, manuals)
                append_manual_audit("Cadastro", manual, user, "PDF incluído na biblioteca local.")
                self.send_json(201, {"ok": True, "manual": manual})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            except OSError:
                self.send_json(500, {"ok": False, "message": "Não foi possível salvar o manual neste computador."})
            return
        match = re.fullmatch(r"/api/photos/([^/]+)", path)
        if match:
            user = require_user(self, {"coordinator", "admin"})
            if not user:
                return
            try:
                data = self.read_json_body()
                code = clean_product_code(match.group(1))
                raw = decode_data_url(data.get("fileDataBase64"), MAX_IMAGE_BYTES, "a imagem")
                ext = image_extension(raw, safe_text(data.get("fileName"), 180))
                for old in photo_files_for_code(code):
                    if old.stem.casefold() == code.casefold():
                        old.unlink(missing_ok=True)
                target = PHOTOS_DIR / f"{code}{ext}"
                target.write_bytes(raw)
                description = safe_text(data.get("description"), 300)
                append_audit(PHOTO_AUDIT_DB, {"action": "Adição/Substituição", "code": code, "description": description, "actor": user["name"], "store": user.get("store", ""), "details": f"Arquivo: {target.name}"})
                photos, _ = refresh_photo_index()
                self.send_json(200, {"ok": True, "photo": photos.get(code)})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            except OSError:
                self.send_json(500, {"ok": False, "message": "Não foi possível salvar a foto no diretório."})
            return
        if path == "/api/photos/refresh":
            user = require_user(self, {"coordinator", "admin"})
            if not user:
                return
            photos, diff = refresh_photo_index(user)
            self.send_json(200, {"ok": True, "photos": photos, "diff": diff})
            return
        if path == "/api/clients/import":
            user = require_user(self, {"coordinator", "admin"})
            if not user:
                return
            try:
                data = self.read_json_body()
                raw, file_name = decode_csv_payload(data)
                clients, metadata = parse_clients_csv(raw)
                existing_clients = read_json_file(CLIENTS_DB, [])
                by_code = {safe_text(item.get("code"), 80): item for item in existing_clients if safe_text(item.get("code"), 80)}
                by_document = {re.sub(r"\D", "", safe_text(item.get("document"), 40)): item for item in existing_clients if re.sub(r"\D", "", safe_text(item.get("document"), 40))}
                preserved_blocks = 0
                for client in clients:
                    previous = by_code.get(safe_text(client.get("code"), 80)) or by_document.get(re.sub(r"\D", "", safe_text(client.get("document"), 40)))
                    if previous and previous.get("blocked"):
                        for field in ("blocked", "blockedAt", "blockedBy"):
                            client[field] = previous.get(field)
                        preserved_blocks += 1
                backup_file(CLIENTS_CSV)
                backup_file(CLIENTS_DB)
                CLIENTS_CSV.write_bytes(raw)
                write_json_file(CLIENTS_DB, clients)
                append_audit(CLIENT_IMPORT_AUDIT_DB, {"action": "Importação de clientes", "actor": user["name"], "store": user.get("store", ""), "fileName": file_name, "count": len(clients), "details": metadata})
                self.send_json(200, {"ok": True, "count": len(clients), "preservedBlocks": preserved_blocks, "metadata": metadata})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            except OSError:
                self.send_json(500, {"ok": False, "message": "Não foi possível salvar a base de clientes."})
            return
        if path == "/api/employees/import":
            user = require_user(self, {"admin"})
            if not user:
                return
            try:
                data = self.read_json_body()
                raw, file_name = decode_csv_payload(data)
                employee_file = DATA_DIR / "funcionarios.csv"
                backup_file(employee_file)
                backup_file(USERS_DB)
                employee_file.write_bytes(raw)
                before = len(read_json_file(USERS_DB, []))
                sync_users_from_employee_csv()
                ensure_user_credentials()
                after = len(read_json_file(USERS_DB, []))
                self.send_json(200, {"ok": True, "count": after, "added": max(0, after - before), "fileName": file_name})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            except OSError:
                self.send_json(500, {"ok": False, "message": "Não foi possível salvar a base de funcionários."})
            return
        if path == "/api/clients/block":
            user = require_user(self, {"coordinator", "admin"})
            if not user:
                return
            data = self.read_json_body()
            client_id = safe_text(data.get("id"), 100)
            clients = read_json_file(CLIENTS_DB, [])
            client = next((item for item in clients if safe_text(item.get("id"), 100) == client_id), None)
            if not client:
                self.send_json(404, {"ok": False, "message": "Cliente não encontrado."})
                return
            backup_file(CLIENTS_DB)
            client["blocked"] = bool(data.get("blocked"))
            client["blockedAt"] = now_iso() if client["blocked"] else ""
            client["blockedBy"] = user.get("name", "") if client["blocked"] else ""
            write_json_file(CLIENTS_DB, clients)
            self.send_json(200, {"ok": True, "client": client})
            return
        if path == "/api/product-descriptions":
            user = require_user(self, {"seller", "coordinator", "admin"})
            if not user:
                return
            if not rate_limit_ok(f"description:{normalize_username(user.get('username', ''))}", 120, 3600):
                self.send_json(429, {"ok": False, "message": "Muitas edições em sequência. Aguarde antes de continuar."})
                return
            try:
                data = self.read_json_body()
                code = clean_product_code(data.get("code"))
                if PRODUCT_CODES and code not in PRODUCT_CODES:
                    raise ValueError("Código de produto não localizado no catálogo.")
                raw_description = str(data.get("description") or "")
                if len(raw_description) > 1200:
                    raise ValueError("A descrição pode ter no máximo 1.200 caracteres.")
                description = safe_text(raw_description, 1200)
                if len(description) < 10:
                    raise ValueError("A descrição precisa ter pelo menos 10 caracteres.")
                with DB_LOCK:
                    records = read_json_file(PRODUCT_DESCRIPTIONS_DB, {})
                    if not isinstance(records, dict):
                        records = {}
                    previous = records.get(code, {}) if isinstance(records.get(code), dict) else {}
                    previous_revision = int(previous.get("revision", 0) or 0)
                    base_revision = int(data.get("baseRevision", 0) or 0)
                    if previous and base_revision != previous_revision:
                        self.send_json(409, {"ok": False, "code": "DESCRIPTION_CONFLICT", "message": "A descrição foi alterada por outra pessoa. Reabra o produto e tente novamente."})
                        return
                    stamp = now_iso()
                    entry = {
                        "description": description,
                        "revision": previous_revision + 1,
                        "createdAt": previous.get("createdAt") or stamp,
                        "createdBy": previous.get("createdBy") or user.get("name", ""),
                        "updatedAt": stamp,
                        "updatedBy": user.get("name", ""),
                        "updatedByRole": user.get("role", ""),
                        "store": user.get("store", ""),
                    }
                    records[code] = entry
                    write_json_file(PRODUCT_DESCRIPTIONS_DB, records)
                append_audit(PRODUCT_DESCRIPTION_AUDIT_DB, {
                    "action": "Edição" if previous else "Cadastro",
                    "code": code,
                    "actor": user.get("name", ""),
                    "role": user.get("role", ""),
                    "store": user.get("store", ""),
                    "previousDescription": safe_text(previous.get("description"), 1600),
                    "description": description,
                })
                self.send_json(200, {"ok": True, "product": {"code": code, **public_product_descriptions().get(code, {})}})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            return
        if path == "/api/product-statuses":
            user = require_user(self, {"coordinator", "admin"})
            if not user:
                return
            if not rate_limit_ok(f"product-status:{normalize_username(user.get('username', ''))}", 120, 3600):
                self.send_json(429, {"ok": False, "message": "Muitas alterações em sequência. Aguarde antes de continuar."})
                return
            try:
                data = self.read_json_body()
                code = clean_product_code(data.get("code"))
                if PRODUCT_CODES and code not in PRODUCT_CODES:
                    raise ValueError("Código de produto não localizado no catálogo.")
                active = data.get("active") is True
                with DB_LOCK:
                    records = read_json_file(PRODUCT_STATUSES_DB, {})
                    if not isinstance(records, dict):
                        records = {}
                    previous = records.get(code, {}) if isinstance(records.get(code), dict) else {}
                    entry = {
                        "active": active,
                        "revision": int(previous.get("revision", 0) or 0) + 1,
                        "updatedAt": now_iso(),
                        "updatedBy": user.get("name", ""),
                        "updatedByUsername": user.get("username", ""),
                        "updatedByRole": user.get("role", ""),
                        "store": user.get("store", ""),
                    }
                    records[code] = entry
                    write_json_file(PRODUCT_STATUSES_DB, records)
                append_audit(PRODUCT_STATUS_AUDIT_DB, {
                    "action": "Reativação" if active else "Inativação",
                    "code": code,
                    "actor": user.get("name", ""),
                    "role": user.get("role", ""),
                    "store": user.get("store", ""),
                })
                self.send_json(200, {"ok": True, "product": {"code": code, **public_product_statuses().get(code, {})}})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            return
        if path == "/api/product-categories":
            user = require_user(self, {"admin"})
            if not user:
                return
            if not rate_limit_ok(f"product-category:{normalize_username(user.get('username', ''))}", 120, 3600):
                self.send_json(429, {"ok": False, "message": "Muitas alterações de categoria em sequência. Aguarde antes de continuar."})
                return
            try:
                data = self.read_json_body()
                action = safe_text(data.get("action"), 20).casefold()
                with DB_LOCK:
                    records = read_json_file(PRODUCT_CATEGORIES_DB, {})
                    if not isinstance(records, dict):
                        records = {}
                    saved_categories = records.get("categories") if isinstance(records.get("categories"), list) else []
                    overrides = records.get("overrides") if isinstance(records.get("overrides"), dict) else {}
                    records["categories"] = saved_categories
                    records["overrides"] = overrides
                    if action == "create":
                        category = safe_text(data.get("category"), 80).strip()
                        if len(category) < 2:
                            raise ValueError("Informe um nome de categoria com pelo menos 2 caracteres.")
                        existing = [safe_text(item, 80).casefold() for item in [*DEFAULT_PRODUCT_CATEGORIES, *saved_categories]]
                        if category.casefold() not in existing:
                            saved_categories.append(category)
                        result = {"action": "create", "category": category}
                    elif action == "set":
                        code = clean_product_code(data.get("code"))
                        category = safe_text(data.get("category"), 80).strip()
                        if PRODUCT_CODES and code not in PRODUCT_CODES:
                            raise ValueError("Código de produto não localizado no catálogo.")
                        if len(category) < 2:
                            raise ValueError("Escolha uma categoria válida.")
                        all_categories = [safe_text(item, 80).casefold() for item in [*DEFAULT_PRODUCT_CATEGORIES, *saved_categories]]
                        if category.casefold() not in all_categories:
                            raise ValueError("Crie a categoria antes de atribuí-la a um produto.")
                        stamp = now_iso()
                        overrides[code] = {"category": category, "updatedAt": stamp, "updatedBy": user.get("name", "")}
                        result = {"action": "set", "code": code, "category": category}
                    else:
                        raise ValueError("Ação de categoria inválida.")
                    write_json_file(PRODUCT_CATEGORIES_DB, records)
                append_audit(PRODUCT_CATEGORY_AUDIT_DB, {
                    **result,
                    "actor": user.get("name", ""),
                    "role": user.get("role", ""),
                    "store": user.get("store", ""),
                    "at": now_iso(),
                })
                self.send_json(200, {"ok": True, **public_product_categories(), **result})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            return
        if path == "/api/quote-history":
            user = require_user(self, {"seller", "coordinator", "admin"})
            if not user:
                return
            try:
                data = self.read_json_body()
                raw_quotes = data.get("quotes") if isinstance(data, dict) else None
                if raw_quotes is None:
                    raw_quote = data.get("quote", data) if isinstance(data, dict) else data
                    raw_quotes = [raw_quote]
                if not isinstance(raw_quotes, list) or not raw_quotes or len(raw_quotes) > 500:
                    raise ValueError("Envie entre 1 e 500 pedidos por sincronização.")
                clean_quotes = [clean_quote_history_payload(raw, user) for raw in raw_quotes]
                username = normalize_username(user.get("username", ""))
                created_count = 0
                updated_count = 0
                with DB_LOCK:
                    records = read_json_file(QUOTE_HISTORY_DB, [])
                    if not isinstance(records, list):
                        records = []
                    # Converte o legado antes de reservar o próximo número,
                    # para que a sequência reflita todo o histórico existente.
                    migrate_legacy_quote_numbers(records)
                    for quote_entry in clean_quotes:
                        index = next((
                            i for i, item in enumerate(records)
                            if isinstance(item, dict)
                            and safe_text(item.get("id"), 100) == quote_entry["id"]
                            and normalize_username(item.get("ownerUsername", "")) == username
                        ), -1)
                        if index >= 0:
                            quote_entry["serverCreatedAt"] = safe_text(records[index].get("serverCreatedAt"), 60) or quote_entry["serverSavedAt"]
                            # O número atribuído na criação é preservado em
                            # alterações para manter a rastreabilidade.
                            quote_entry["number"] = safe_text(records[index].get("number"), 40) or quote_entry["number"]
                            records[index] = quote_entry
                            updated_count += 1
                        else:
                            # A numeração exibida no navegador é uma prévia. A
                            # reserva definitiva acontece aqui, no servidor
                            # local da filial, evitando colisões entre
                            # terminais e mantendo a operação offline.
                            quote_entry["number"] = allocate_quote_number(quote_entry.get("store") or user.get("store", ""), records)
                            quote_entry["serverCreatedAt"] = quote_entry["serverSavedAt"]
                            records.insert(0, quote_entry)
                            created_count += 1
                    write_json_file(QUOTE_HISTORY_DB, records)
                sync = {"enabled": False, "queued": 0}
                replication = {"enabled": False, "queued": 0}
                for quote_entry in clean_quotes:
                    try:
                        result = enqueue_quote_for_dataplace(quote_entry)
                        sync["enabled"] = bool(result.get("enabled"))
                        sync["queued"] += int(bool(result.get("queued")))
                    except (OSError, ValueError):
                        # O histórico local continua salvo mesmo se a fila
                        # estiver indisponível; o status administrativo exibirá
                        # a necessidade de revisar a sincronização.
                        sync["queueError"] = True
                    try:
                        result = record_quote_replication(quote_entry)
                        replication["enabled"] = bool(result.get("enabled"))
                        replication["queued"] += int(bool(result.get("queued")))
                    except (OSError, ValueError, sqlite3.Error):
                        replication["queueError"] = True
                append_audit(QUOTE_HISTORY_AUDIT_DB, {
                    "action": "Sincronização",
                    "created": created_count,
                    "updated": updated_count,
                    "actor": user.get("name", ""),
                    "role": user.get("role", ""),
                    "store": user.get("store", ""),
                })
                self.send_json(200, {"ok": True, "history": public_quote_history(user), "created": created_count, "updated": updated_count, "sync": sync, "replication": replication})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            return
        if path == "/api/quote-templates":
            user = require_user(self, {"seller", "coordinator", "admin"})
            if not user:
                return
            if not rate_limit_ok(f"quote-template:{normalize_username(user.get('username', ''))}", 60, 3600):
                self.send_json(429, {"ok": False, "message": "Muitos modelos salvos em sequência. Aguarde antes de continuar."})
                return
            try:
                data = self.read_json_body()
                name = safe_text(data.get("name"), 80)
                if len(name) < 3:
                    raise ValueError("Informe um nome com pelo menos 3 caracteres.")
                raw_items = data.get("items")
                if not isinstance(raw_items, list) or not raw_items or len(raw_items) > 100:
                    raise ValueError("O modelo precisa ter entre 1 e 100 produtos.")
                statuses = read_json_file(PRODUCT_STATUSES_DB, {})
                clean_items = []
                seen_codes = set()
                for raw_item in raw_items:
                    if not isinstance(raw_item, dict):
                        raise ValueError("Há um produto inválido no modelo.")
                    code = clean_product_code(raw_item.get("code"))
                    if PRODUCT_CODES and code not in PRODUCT_CODES:
                        raise ValueError(f"O produto {code} não foi localizado no catálogo.")
                    if isinstance(statuses, dict) and isinstance(statuses.get(code), dict) and statuses[code].get("active") is False:
                        raise ValueError(f"O produto {code} está inativo e não pode entrar no modelo.")
                    try:
                        qty = int(raw_item.get("qty", 1))
                    except (TypeError, ValueError) as exc:
                        raise ValueError(f"Quantidade inválida para o produto {code}.") from exc
                    if qty < 1 or qty > 999:
                        raise ValueError(f"A quantidade do produto {code} deve ficar entre 1 e 999.")
                    if code in seen_codes:
                        raise ValueError(f"O produto {code} está repetido no modelo.")
                    seen_codes.add(code)
                    clean_items.append({"code": code, "qty": qty})
                try:
                    validity = max(1, min(90, int(data.get("validity", 7) or 7)))
                    discount = max(0.0, min(100.0, float(data.get("discount", 0) or 0)))
                    freight = max(0.0, min(10_000_000.0, float(data.get("freight", 0) or 0)))
                except (TypeError, ValueError) as exc:
                    raise ValueError("As condições comerciais do modelo são inválidas.") from exc
                stamp = now_iso()
                entry = {
                    "id": uuid.uuid4().hex,
                    "name": name,
                    "summary": safe_text(data.get("summary"), 240),
                    "items": clean_items,
                    "payment": safe_text(data.get("payment"), 80),
                    "validity": validity,
                    "discount": discount,
                    "freight": freight,
                    "notes": safe_text(data.get("notes"), 1200),
                    "createdAt": stamp,
                    "createdBy": user.get("name", ""),
                    "createdByUsername": user.get("username", ""),
                    "createdByRole": user.get("role", ""),
                    "store": user.get("store", ""),
                }
                with DB_LOCK:
                    templates = read_json_file(QUOTE_TEMPLATES_DB, [])
                    if not isinstance(templates, list):
                        templates = []
                    templates.insert(0, entry)
                    write_json_file(QUOTE_TEMPLATES_DB, templates)
                append_audit(QUOTE_TEMPLATE_AUDIT_DB, {"action": "Criação", "templateId": entry["id"], "name": name, "actor": user.get("name", ""), "role": user.get("role", ""), "store": user.get("store", "")})
                public = next(item for item in public_quote_templates(user) if item["id"] == entry["id"])
                self.send_json(201, {"ok": True, "template": public})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            return
        self.send_json(404, {"ok": False, "message": "Rota não encontrada."})

    def do_PUT(self) -> None:
        if not self.validate_request_source(mutation=True):
            return
        parsed = urlparse(self.path)
        match = re.fullmatch(r"/api/manuals/([a-fA-F0-9]+)", parsed.path)
        if not match:
            self.send_json(404, {"ok": False, "message": "Rota não encontrada."})
            return
        user = require_user(self, {"coordinator", "admin"})
        if not user:
            return
        try:
            data = self.read_json_body()
            manuals = read_json_file(MANUALS_DB, [])
            if not isinstance(manuals, list):
                manuals = []
            index = next((i for i, item in enumerate(manuals) if item.get("id") == match.group(1)), -1)
            if index < 0:
                self.send_json(404, {"ok": False, "message": "Manual não encontrado."})
                return
            existing = manuals[index]
            manual = clean_manual_payload(data, existing)
            replaced = False
            if data.get("fileDataBase64"):
                pdf = decode_pdf(data)
                file_name = f"{slugify(f'{manual.get('code', '')}-{manual['title']}')}-{manual['id'][:8]}.pdf"
                (MANUALS_DIR / file_name).write_bytes(pdf)
                old_name = existing.get("fileName")
                if old_name and old_name != file_name:
                    (MANUALS_DIR / old_name).unlink(missing_ok=True)
                manual["fileName"] = file_name
                manual["url"] = f"manuais/{quote(file_name)}"
                replaced = True
            manual.update({"updatedAt": now_iso(), "updatedBy": user["name"], "store": user.get("store", "")})
            manuals[index] = manual
            write_json_file(MANUALS_DB, manuals)
            append_manual_audit("Substituição do PDF" if replaced else "Edição", manual, user)
            self.send_json(200, {"ok": True, "manual": manual})
        except ValueError as exc:
            self.send_json(400, {"ok": False, "message": str(exc)})
        except OSError:
            self.send_json(500, {"ok": False, "message": "Não foi possível atualizar o manual."})

    def do_DELETE(self) -> None:
        if not self.validate_request_source(mutation=True):
            return
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/profile-photo":
            user = require_user(self)
            if not user:
                return
            username = normalize_username(user.get("username", ""))
            users = read_json_file(USERS_DB, [])
            if not isinstance(users, list):
                users = []
            index = next((i for i, item in enumerate(users) if normalize_username(item.get("username", "")) == username), -1)
            if index < 0:
                self.send_json(404, {"ok": False, "message": "Usuário não encontrado."})
                return
            old_url = safe_text(users[index].get("avatarUrl"), 300)
            users[index].pop("avatarUrl", None)
            users[index]["avatarUpdatedAt"] = now_iso()
            write_json_file(USERS_DB, users)
            if old_url:
                old_name = Path(unquote(urlparse(old_url).path)).name
                old_path = (PROFILE_PHOTOS_DIR / old_name).resolve()
                if old_path.is_relative_to(PROFILE_PHOTOS_DIR.resolve()):
                    old_path.unlink(missing_ok=True)
            self.send_json(200, {"ok": True, "user": public_user(users[index])})
            return
        match = re.fullmatch(r"/api/quote-templates/([a-fA-F0-9]{32})", path)
        if match:
            user = require_user(self, {"admin"})
            if not user:
                return
            templates = read_json_file(QUOTE_TEMPLATES_DB, [])
            if not isinstance(templates, list):
                templates = []
            index = next((i for i, item in enumerate(templates) if item.get("id") == match.group(1)), -1)
            if index < 0:
                self.send_json(404, {"ok": False, "message": "Modelo não encontrado."})
                return
            template = templates[index]
            templates.pop(index)
            write_json_file(QUOTE_TEMPLATES_DB, templates)
            append_audit(QUOTE_TEMPLATE_AUDIT_DB, {"action": "Exclusão", "templateId": template.get("id", ""), "name": template.get("name", ""), "actor": user.get("name", ""), "role": user.get("role", ""), "store": user.get("store", "")})
            self.send_json(200, {"ok": True})
            return
        match = re.fullmatch(r"/api/manuals/([a-fA-F0-9]+)", path)
        if match:
            user = require_user(self, {"coordinator", "admin"})
            if not user:
                return
            manuals = read_json_file(MANUALS_DB, [])
            if not isinstance(manuals, list):
                manuals = []
            index = next((i for i, item in enumerate(manuals) if item.get("id") == match.group(1)), -1)
            if index < 0:
                self.send_json(404, {"ok": False, "message": "Manual não encontrado."})
                return
            manual = manuals.pop(index)
            try:
                if manual.get("fileName"):
                    (MANUALS_DIR / manual["fileName"]).unlink(missing_ok=True)
                write_json_file(MANUALS_DB, manuals)
                append_manual_audit("Exclusão", manual, user, "PDF removido da biblioteca local.")
                self.send_json(200, {"ok": True})
            except OSError:
                self.send_json(500, {"ok": False, "message": "Não foi possível excluir o manual."})
            return
        match = re.fullmatch(r"/api/photos/([^/]+)", path)
        if match:
            user = require_user(self, {"coordinator", "admin"})
            if not user:
                return
            try:
                code = clean_product_code(match.group(1))
                files = photo_files_for_code(code)
                for photo in files:
                    photo.unlink(missing_ok=True)
                append_audit(PHOTO_AUDIT_DB, {"action": "Remoção", "code": code, "description": "Foto do produto", "actor": user["name"], "store": user.get("store", ""), "details": f"Arquivos removidos: {len(files)}"})
                refresh_photo_index()
                self.send_json(200, {"ok": True, "removed": len(files)})
            except ValueError as exc:
                self.send_json(400, {"ok": False, "message": str(exc)})
            except OSError:
                self.send_json(500, {"ok": False, "message": "Não foi possível remover a foto."})
            return
        self.send_json(404, {"ok": False, "message": "Rota não encontrada."})


def main() -> None:
    ensure_full_client_base()
    ensure_default_users()
    sync_users_from_employee_csv()
    ensure_user_credentials()
    reset_summary = reset_changed_factory_passwords_once()
    ensure_password_security_flags()
    seed_photo_directory()
    try:
        network = configure_network_runtime()
        bind_address = network["bindAddress"]
        configured_port = int(network["port"])
        port_attempts = 1 if network.get("strictPort") else 30
        port = find_available_port(configured_port, port_attempts, bind_address)
        configure_request_authorities(network, port)
        server = ThreadingHTTPServer((bind_address, port), AppHandler)
        start_dataplace_sync_worker()
        start_store_replication_worker()
        start_gertec_server()
    except (OSError, ValueError) as exc:
        print(f"\nNão foi possível iniciar o SEG Vendas: {exc}\n")
        print("Feche o aplicativo e execute scripts\\CONFIGURAR_REDE_BETA.bat para revisar o IP e a porta.")
        if not cloud_runtime_enabled():
            input("Pressione ENTER para fechar...")
        return
    computer_host = "localhost" if bind_address in {"0.0.0.0", "127.0.0.1"} else bind_address
    computer_url = f"http://{computer_host}:{port}/index.html?v={APP_VERSION}&fresh={int(time.time())}"
    mobile_host = local_ip() if bind_address == "0.0.0.0" else bind_address
    mobile_url = f"http://{mobile_host}:{port}/index.html?v={APP_VERSION}"
    print(f"\nSEG VENDAS {APP_VERSION} PREMIUM - PROJETO PRINCIPAL")
    print(f"Escutando em: {bind_address}:{port}")
    print(f"Neste computador: {computer_url}")
    if bind_address == "127.0.0.1":
        print("Rede local direta: DESATIVADA (modo recomendado para túnel seguro).")
    else:
        print(f"No celular (mesma rede Wi-Fi): {mobile_url}")
    if network.get("publicUrl"):
        print(f"Endereço público configurado: {network['publicUrl']}")
    else:
        print("Endereço público: não configurado.")
    print("Fotos: pasta 'data\\fotos_produtos' (use o código como nome do arquivo).")
    print("Manuais: pasta 'manuais'. Clientes importados: 'data\\clientes.csv'.")
    print("Acesso de fábrica: código do funcionário + SEG@CÓDIGO | cliente/cliente123 | admin/segadmin")
    print("Troca obrigatória de senha: DESATIVADA. A troca voluntária continua disponível no perfil.")
    print(f"Restauração inicial 5.9.1: {reset_summary.get('resetPasswords', 0)} senha(s) alterada(s) corrigida(s).")
    print("Esqueci minha senha: pedido enviado ao servidor local e autorizado por um administrador em Ajustes.")
    print("Para trocar IP, porta ou DDNS: feche o aplicativo e execute scripts\\CONFIGURAR_REDE_BETA.bat.")
    print("Pressione CTRL+C para encerrar.\n")
    if not cloud_runtime_enabled():
        threading.Timer(1.0, lambda: open_app_window(computer_url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSEG Vendas encerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
