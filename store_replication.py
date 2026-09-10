"""Replicação segura entre lojas e cópias locais de recuperação.

Este módulo é independente do Dataplace. Cada instalação mantém um pequeno
ledger SQLite local com snapshots e eventos. O aplicativo continua usando os
arquivos JSON atuais; a migração da base principal para SQLite pode ser feita
em uma etapa posterior, sem perder a operação offline.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from contextlib import contextmanager
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sqlite3
import time
import tempfile
import uuid
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen
import zipfile


class StoreReplicationError(RuntimeError):
    """Erro sanitizado de configuração ou comunicação entre lojas."""


def _text(value: object, limit: int = 500) -> str:
    return str(value or "").strip()[:limit]


def _truthy(value: object) -> bool:
    return _text(value, 20).casefold() in {"1", "true", "sim", "yes", "on"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


@dataclass(frozen=True)
class StoreReplicationConfig:
    store_id: str
    store_name: str
    hub_url: str
    token: str
    enabled: bool = False
    worker_enabled: bool = False
    interval_seconds: int = 60
    backup_interval_seconds: int = 900
    backup_retention: int = 30
    batch_size: int = 50
    allow_http: bool = False

    @classmethod
    def from_env(cls) -> "StoreReplicationConfig":
        try:
            interval = max(30, min(3600, int(os.environ.get("SEG_REPLICATION_INTERVAL", "60"))))
        except (TypeError, ValueError):
            interval = 60
        try:
            backup_interval = max(300, min(86_400, int(os.environ.get("SEG_BACKUP_INTERVAL", "900"))))
        except (TypeError, ValueError):
            backup_interval = 900
        try:
            retention = max(3, min(365, int(os.environ.get("SEG_BACKUP_RETENTION", "30"))))
        except (TypeError, ValueError):
            retention = 30
        try:
            batch = max(1, min(200, int(os.environ.get("SEG_REPLICATION_BATCH", "50"))))
        except (TypeError, ValueError):
            batch = 50
        hub_url = _text(os.environ.get("SEG_REPLICATION_HUB_URL"), 500)
        return cls(
            store_id=_text(os.environ.get("SEG_STORE_ID"), 80) or "local",
            store_name=_text(os.environ.get("SEG_STORE_NAME"), 160) or "Loja local",
            hub_url=hub_url,
            token=_text(os.environ.get("SEG_REPLICATION_TOKEN"), 10_000),
            enabled=_truthy(os.environ.get("SEG_REPLICATION_ENABLED")) and bool(hub_url),
            worker_enabled=_truthy(os.environ.get("SEG_REPLICATION_WORKER")),
            interval_seconds=interval,
            backup_interval_seconds=backup_interval,
            backup_retention=retention,
            batch_size=batch,
            allow_http=_truthy(os.environ.get("SEG_REPLICATION_ALLOW_HTTP")),
        )

    def validate(self, require_hub: bool = False) -> None:
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", self.store_id):
            raise StoreReplicationError("SEG_STORE_ID inválido.")
        if require_hub or self.enabled:
            parsed = urlparse(self.hub_url)
            if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
                raise StoreReplicationError("SEG_REPLICATION_HUB_URL precisa ser uma URL HTTP/HTTPS válida.")
            if parsed.scheme != "https" and not (self.allow_http and parsed.hostname in {"127.0.0.1", "localhost"}):
                raise StoreReplicationError("A sincronização entre lojas precisa usar HTTPS.")
            if not self.token:
                raise StoreReplicationError("SEG_REPLICATION_TOKEN não foi configurado.")


class ReplicaDatabase:
    """Ledger local com snapshots, outbox e inbox deduplicados."""

    def __init__(self, db_path: Path, store_id: str):
        self.db_path = Path(db_path)
        self.store_id = store_id
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    @contextmanager
    def _db(self):
        connection = self._connect()
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _initialize(self) -> None:
        with self._db() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS snapshots (
                    name TEXT PRIMARY KEY,
                    saved_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    sha256 TEXT NOT NULL,
                    payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS outbox (
                    event_id TEXT PRIMARY KEY,
                    store_id TEXT NOT NULL,
                    entity TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    next_attempt_at REAL NOT NULL DEFAULT 0,
                    last_error TEXT NOT NULL DEFAULT ''
                );
                CREATE INDEX IF NOT EXISTS outbox_ready ON outbox(status, next_attempt_at);
                CREATE TABLE IF NOT EXISTS inbox (
                    event_id TEXT PRIMARY KEY,
                    origin_store_id TEXT NOT NULL,
                    entity TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    received_at TEXT NOT NULL,
                    applied_at TEXT NOT NULL DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS hub_events (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT NOT NULL UNIQUE,
                    origin_store_id TEXT NOT NULL,
                    entity TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    received_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS hub_events_sequence ON hub_events(sequence);
            """)
            columns = {row[1] for row in db.execute("PRAGMA table_info(inbox)").fetchall()}
            if "applied_at" not in columns:
                db.execute("ALTER TABLE inbox ADD COLUMN applied_at TEXT NOT NULL DEFAULT ''")
            db.execute("INSERT OR IGNORE INTO metadata(key,value) VALUES('storeId',?)", (self.store_id,))

    def get_meta(self, key: str, default: str = "") -> str:
        with self._db() as db:
            row = db.execute("SELECT value FROM metadata WHERE key=?", (key,)).fetchone()
        return str(row[0]) if row else default

    def set_meta(self, key: str, value: object) -> None:
        with self._db() as db:
            db.execute("INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))

    def save_snapshot(self, name: str, payload: object) -> dict:
        serialized = _json(payload)
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        with self._db() as db:
            old = db.execute("SELECT version,sha256 FROM snapshots WHERE name=?", (name,)).fetchone()
            if old and old[1] == digest:
                return {"name": name, "changed": False, "version": int(old[0]), "sha256": digest}
            version = int(old[0]) + 1 if old else 1
            db.execute("INSERT INTO snapshots(name,saved_at,version,sha256,payload) VALUES(?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET saved_at=excluded.saved_at,version=excluded.version,sha256=excluded.sha256,payload=excluded.payload", (name, _now(), version, digest, serialized))
        return {"name": name, "changed": True, "version": version, "sha256": digest}

    def enqueue(self, entity: str, operation: str, payload: object, event_id: str = "") -> dict:
        event_id = _text(event_id, 160) or f"{self.store_id}:{uuid.uuid4().hex}"
        with self._db() as db:
            before = db.execute("SELECT status FROM outbox WHERE event_id=?", (event_id,)).fetchone()
            if before:
                return {"eventId": event_id, "duplicate": True, "status": before[0]}
            db.execute("INSERT INTO outbox(event_id,store_id,entity,operation,payload,created_at) VALUES(?,?,?,?,?,?)", (event_id, self.store_id, _text(entity, 80), _text(operation, 80), _json(payload), _now()))
        return {"eventId": event_id, "duplicate": False, "status": "pending"}

    def pending(self, limit: int) -> list[dict]:
        with self._db() as db:
            rows = db.execute("SELECT * FROM outbox WHERE status IN ('pending','retry') AND next_attempt_at<=? ORDER BY created_at LIMIT ?", (time.time(), max(1, min(int(limit), 200)))).fetchall()
        return [{
            "eventId": row["event_id"],
            "storeId": row["store_id"],
            "entity": row["entity"],
            "operation": row["operation"],
            "payload": json.loads(row["payload"]),
            "createdAt": row["created_at"],
            "status": row["status"],
            "attempts": row["attempts"],
        } for row in rows]

    def mark_sent(self, event_ids: list[str]) -> None:
        if not event_ids:
            return
        with self._db() as db:
            db.executemany("UPDATE outbox SET status='sent',attempts=attempts+1,last_error='',next_attempt_at=0 WHERE event_id=?", [(event_id,) for event_id in event_ids])

    def mark_retry(self, event_ids: list[str], error: str) -> None:
        if not event_ids:
            return
        with self._db() as db:
            for event_id in event_ids:
                row = db.execute("SELECT attempts FROM outbox WHERE event_id=?", (event_id,)).fetchone()
                attempts = int(row[0] if row else 0) + 1
                status = "failed" if attempts >= 8 else "retry"
                delay = min(3600, 30 * (2 ** min(attempts, 6)))
                db.execute("UPDATE outbox SET status=?,attempts=?,last_error=?,next_attempt_at=? WHERE event_id=?", (status, attempts, _text(error, 240), time.time() + delay, event_id))

    def receive_events(self, events: list[dict]) -> int:
        inserted = 0
        with self._db() as db:
            for event in events:
                try:
                    event_id = _text(event.get("eventId"), 160)
                    origin = _text(event.get("storeId"), 80)
                    if not event_id or not origin:
                        continue
                    cursor = db.execute("INSERT OR IGNORE INTO inbox(event_id,origin_store_id,entity,operation,payload,created_at,received_at,applied_at) VALUES(?,?,?,?,?,?,?,?)", (event_id, origin, _text(event.get("entity"), 80), _text(event.get("operation"), 80), _json(event.get("payload")), _text(event.get("createdAt"), 60) or _now(), _now(), ""))
                    inserted += cursor.rowcount
                except (TypeError, ValueError):
                    continue
        return inserted

    def unapplied_events(self, limit: int = 200) -> list[dict]:
        with self._db() as db:
            rows = db.execute("SELECT * FROM inbox WHERE applied_at='' ORDER BY received_at LIMIT ?", (max(1, min(int(limit), 500)),)).fetchall()
        return [{"eventId": row["event_id"], "storeId": row["origin_store_id"], "entity": row["entity"], "operation": row["operation"], "payload": json.loads(row["payload"]), "createdAt": row["created_at"]} for row in rows]

    def mark_events_applied(self, event_ids: list[str]) -> None:
        if not event_ids:
            return
        with self._db() as db:
            db.executemany("UPDATE inbox SET applied_at=? WHERE event_id=?", [(_now(), event_id) for event_id in event_ids])

    def hub_receive_events(self, events: list[dict], origin_store_id: str) -> int:
        inserted = 0
        with self._db() as db:
            for event in events:
                event_id = _text(event.get("eventId"), 160)
                if not event_id:
                    continue
                cursor = db.execute("INSERT OR IGNORE INTO hub_events(event_id,origin_store_id,entity,operation,payload,created_at,received_at) VALUES(?,?,?,?,?,?,?)", (event_id, origin_store_id, _text(event.get("entity"), 80), _text(event.get("operation"), 80), _json(event.get("payload")), _text(event.get("createdAt"), 60) or _now(), _now()))
                inserted += cursor.rowcount
        return inserted

    def hub_pull(self, cursor: int, limit: int) -> tuple[list[dict], int]:
        with self._db() as db:
            rows = db.execute("SELECT * FROM hub_events WHERE sequence>? ORDER BY sequence LIMIT ?", (max(0, int(cursor)), max(1, min(int(limit), 200)))).fetchall()
        events = [{"sequence": row["sequence"], "eventId": row["event_id"], "storeId": row["origin_store_id"], "entity": row["entity"], "operation": row["operation"], "payload": json.loads(row["payload"]), "createdAt": row["created_at"]} for row in rows]
        return events, (int(rows[-1]["sequence"]) if rows else max(0, int(cursor)))

    def status(self) -> dict:
        with self._db() as db:
            rows = db.execute("SELECT status,COUNT(*) FROM outbox GROUP BY status").fetchall()
            snapshots = db.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]
            inbox = db.execute("SELECT COUNT(*) FROM inbox").fetchone()[0]
            hub_events = db.execute("SELECT COUNT(*) FROM hub_events").fetchone()[0]
        counts = {"pending": 0, "retry": 0, "sending": 0, "sent": 0, "failed": 0}
        counts.update({str(row[0]): int(row[1]) for row in rows})
        return {"storeId": self.store_id, "outbox": counts, "snapshots": int(snapshots), "inbox": int(inbox), "hubEvents": int(hub_events), "cursor": int(self.get_meta("hubCursor", "0") or 0)}


class StoreReplicationClient:
    def __init__(self, config: StoreReplicationConfig):
        self.config = config
        self.config.validate(require_hub=True)

    def _request(self, method: str, path: str, payload: object | None = None, query: dict | None = None) -> object:
        base = self.config.hub_url.rstrip("/") + "/"
        target = urljoin(base, _text(path, 160).lstrip("/"))
        if query:
            target += "?" + urlencode(query)
        body = b"" if payload is None else _json(payload).encode("utf-8")
        timestamp = str(int(time.time()))
        signature = hmac.new(self.config.token.encode("utf-8"), timestamp.encode("ascii") + b"." + body, hashlib.sha256).hexdigest()
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "SEG-Vendas-StoreSync/1.0",
            "Authorization": f"Bearer {self.config.token}",
            "X-SEG-Store-ID": self.config.store_id,
            "X-SEG-Timestamp": timestamp,
            "X-SEG-Signature": signature,
        }
        request = Request(target, data=None if method.upper() == "GET" else body, headers=headers, method=method.upper())
        try:
            with urlopen(request, timeout=20) as response:
                raw = response.read()
                return json.loads(raw.decode("utf-8")) if raw else {"ok": True}
        except HTTPError as exc:
            raise StoreReplicationError(f"Servidor central respondeu HTTP {exc.code}.") from exc
        except (URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise StoreReplicationError("Não foi possível comunicar com o servidor central.") from exc

    def sync_once(self, replica: ReplicaDatabase) -> dict:
        pending = replica.pending(self.config.batch_size)
        sent = 0
        if pending:
            response = self._request("POST", "/api/store-sync/push", {"events": pending})
            if not isinstance(response, dict) or not response.get("ok"):
                raise StoreReplicationError("O servidor central recusou os eventos da loja.")
            accepted = response.get("acceptedEventIds") if isinstance(response.get("acceptedEventIds"), list) else [item["eventId"] for item in pending]
            replica.mark_sent([_text(event_id, 160) for event_id in accepted if event_id])
            sent = len(accepted)
        cursor = int(replica.get_meta("hubCursor", "0") or 0)
        response = self._request("GET", "/api/store-sync/pull", query={"cursor": cursor, "limit": self.config.batch_size})
        if not isinstance(response, dict) or not response.get("ok"):
            raise StoreReplicationError("O servidor central não respondeu à leitura da fila.")
        events = response.get("events") if isinstance(response.get("events"), list) else []
        received = replica.receive_events(events)
        next_cursor = int(response.get("nextCursor", cursor) or cursor)
        replica.set_meta("hubCursor", next_cursor)
        return {"sent": sent, "received": received, "cursor": next_cursor}


def verify_hub_request(headers: object, body: bytes = b"") -> str:
    """Valida assinatura HMAC de uma loja e retorna o ID autenticado."""
    store_id = _text(getattr(headers, "get", lambda *_: "")("X-SEG-Store-ID"), 80)
    timestamp = _text(getattr(headers, "get", lambda *_: "")("X-SEG-Timestamp"), 30)
    signature = _text(getattr(headers, "get", lambda *_: "")("X-SEG-Signature"), 128)
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", store_id) or not timestamp or not signature:
        raise StoreReplicationError("Autenticação da loja ausente.")
    try:
        if abs(time.time() - int(timestamp)) > 300:
            raise StoreReplicationError("Assinatura da loja expirada.")
        token_map = json.loads(os.environ.get("SEG_REPLICATION_STORE_TOKENS", "{}"))
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise StoreReplicationError("Configuração de lojas inválida no servidor central.") from exc
    token = token_map.get(store_id) if isinstance(token_map, dict) else None
    if not token:
        fallback = _text(os.environ.get("SEG_REPLICATION_TOKEN"), 10_000)
        token = fallback if store_id == _text(os.environ.get("SEG_STORE_ID"), 80) else ""
    if not token:
        raise StoreReplicationError("Loja não autorizada no servidor central.")
    expected = hmac.new(str(token).encode("utf-8"), timestamp.encode("ascii") + b"." + body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise StoreReplicationError("Assinatura da loja inválida.")
    return store_id


def create_local_backup(data_dir: Path, backup_dir: Path, store_id: str, retention: int = 30, replica_db_path: Path | None = None) -> dict:
    """Cria um backup ZIP local sem incluir backups anteriores ou o próprio ZIP."""
    data_dir = Path(data_dir)
    backup_dir = Path(backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    archive_path = backup_dir / f"seg-store-{_text(store_id, 50) or 'local'}-{stamp}.zip"
    files = []
    temporary_replica = None
    try:
        if replica_db_path and Path(replica_db_path).exists():
            fd, temporary_replica = tempfile.mkstemp(prefix="seg-replica-", suffix=".sqlite3")
            os.close(fd)
            source = sqlite3.connect(Path(replica_db_path))
            target = sqlite3.connect(temporary_replica)
            try:
                source.backup(target)
            finally:
                target.close()
                source.close()
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(data_dir.rglob("*")):
                if not path.is_file() or backup_dir in path.parents or path.name.endswith(".tmp") or path.name == "store_replica.sqlite3":
                    continue
                relative = path.relative_to(data_dir).as_posix()
                archive.write(path, f"data/{relative}")
                files.append(relative)
            if temporary_replica:
                archive.write(temporary_replica, "data/store_replica.sqlite3")
                files.append("store_replica.sqlite3")
            manifest = {"storeId": store_id, "createdAt": _now(), "files": files}
            archive.writestr("manifest.json", _json(manifest))
    finally:
        if temporary_replica:
            try:
                Path(temporary_replica).unlink(missing_ok=True)
            except OSError:
                pass
    digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    archives = sorted(backup_dir.glob("seg-store-*.zip"), key=lambda item: item.stat().st_mtime, reverse=True)
    for old in archives[max(1, int(retention)):]:
        try:
            old.unlink()
        except OSError:
            pass
    return {"path": str(archive_path), "files": len(files), "sha256": digest, "createdAt": _now()}
