"""Persistência do diretório data/ em armazenamento de objetos S3-compatível.

Uso previsto: Railway Bucket, Cloudflare R2, MinIO ou outro endpoint S3.
Somente biblioteca padrão; assinatura AWS Signature Version 4 implementada aqui.

Variáveis de ambiente:
    SEG_S3_ENABLED      "1" ativa
    SEG_S3_ENDPOINT     ex.: https://bucket-production-xxxx.up.railway.app
    SEG_S3_BUCKET       nome do bucket
    SEG_S3_ACCESS_KEY
    SEG_S3_SECRET_KEY
    SEG_S3_REGION       opcional (padrão "auto")
    SEG_S3_PREFIX       opcional (padrão "seg-vendas")
    SEG_S3_INTERVAL     opcional, segundos entre uploads (padrão 300)
"""

from __future__ import annotations

import hashlib
import hmac
import os
import threading
import time
import urllib.request
import urllib.error
import zipfile
from datetime import datetime, timezone
from pathlib import Path


def _text(value, limit: int = 500) -> str:
    return str(value).strip()[:limit] if value is not None else ""


class S3PersistConfig:
    def __init__(self) -> None:
        self.enabled = _text(os.environ.get("SEG_S3_ENABLED"), 10).casefold() in {"1", "true", "yes", "sim"}
        self.endpoint = _text(os.environ.get("SEG_S3_ENDPOINT")).rstrip("/")
        self.bucket = _text(os.environ.get("SEG_S3_BUCKET"), 120)
        self.access_key = _text(os.environ.get("SEG_S3_ACCESS_KEY"), 200)
        self.secret_key = _text(os.environ.get("SEG_S3_SECRET_KEY"), 500)
        self.region = _text(os.environ.get("SEG_S3_REGION"), 60) or "auto"
        self.prefix = _text(os.environ.get("SEG_S3_PREFIX"), 120).strip("/") or "seg-vendas"
        try:
            self.interval = max(60, int(os.environ.get("SEG_S3_INTERVAL", "300")))
        except ValueError:
            self.interval = 300

    def ready(self) -> bool:
        return self.enabled and bool(self.endpoint and self.bucket and self.access_key and self.secret_key)


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _hmac_sha256(key: bytes, data: str) -> bytes:
    return hmac.new(key, data.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(secret: str, date_stamp: str, region: str) -> bytes:
    key = _hmac_sha256(("AWS4" + secret).encode("utf-8"), date_stamp)
    key = _hmac_sha256(key, region)
    key = _hmac_sha256(key, "s3")
    return _hmac_sha256(key, "aws4_request")


def _quote_key(key: str) -> str:
    from urllib.parse import quote
    return "/".join(quote(part, safe="") for part in key.split("/"))


def _request(cfg: S3PersistConfig, method: str, key: str, body: bytes = b"") -> bytes | None:
    host = cfg.endpoint.split("://", 1)[-1].split("/", 1)[0]
    canonical_uri = f"/{cfg.bucket}/{_quote_key(key)}"
    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    payload_hash = _sha256_hex(body)

    canonical_headers = f"host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n"
    signed_headers = "host;x-amz-content-sha256;x-amz-date"
    canonical_request = "\n".join([method, canonical_uri, "", canonical_headers, signed_headers, payload_hash])

    scope = f"{date_stamp}/{cfg.region}/s3/aws4_request"
    string_to_sign = "\n".join(["AWS4-HMAC-SHA256", amz_date, scope, _sha256_hex(canonical_request.encode("utf-8"))])
    signature = hmac.new(_signing_key(cfg.secret_key, date_stamp, cfg.region), string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    authorization = (
        f"AWS4-HMAC-SHA256 Credential={cfg.access_key}/{scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    url = cfg.endpoint + canonical_uri
    request = urllib.request.Request(
        url,
        data=body if method in {"PUT", "POST"} else None,
        method=method,
        headers={
            "Host": host,
            "x-amz-date": amz_date,
            "x-amz-content-sha256": payload_hash,
            "Authorization": authorization,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise


def restore_data(cfg: S3PersistConfig, data_dir: Path) -> dict:
    """Baixa o snapshot mais recente e extrai em data_dir. Retorna resumo."""
    data = _request(cfg, "GET", f"{cfg.prefix}/latest.zip")
    if data is None:
        return {"restored": False, "reason": "no_snapshot"}
    data_dir.mkdir(parents=True, exist_ok=True)
    import io
    restored = 0
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for member in archive.namelist():
            if not member.startswith("data/") or member.endswith("/"):
                continue
            relative = member[len("data/"):]
            target = (data_dir / relative).resolve()
            if not str(target).startswith(str(data_dir.resolve())):
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(member))
            restored += 1
    return {"restored": True, "files": restored, "bytes": len(data)}


def upload_snapshot(cfg: S3PersistConfig, archive_path: Path) -> dict:
    """Envia um ZIP de backup para o bucket como arquivo datado e como latest.zip."""
    body = Path(archive_path).read_bytes()
    name = Path(archive_path).name
    _request(cfg, "PUT", f"{cfg.prefix}/backups/{name}", body)
    _request(cfg, "PUT", f"{cfg.prefix}/latest.zip", body)
    return {"uploaded": name, "bytes": len(body)}


def start_persistence(data_dir: Path, backup_dir: Path, store_id: str) -> threading.Thread | None:
    """Restaura o snapshot (se existir) e inicia upload periódico. Retorna a thread ou None."""
    cfg = S3PersistConfig()
    if not cfg.ready():
        return None

    try:
        result = restore_data(cfg, data_dir)
        print(f"[S3] Restauração inicial: {result}")
    except Exception as exc:  # noqa: BLE001 - falha de nuvem não pode impedir a loja de subir
        print(f"[S3] Falha ao restaurar snapshot: {exc}")

    def worker() -> None:
        from store_replication import create_local_backup
        while True:
            try:
                backup = create_local_backup(data_dir, backup_dir, store_id, retention=5)
                uploaded = upload_snapshot(cfg, Path(backup["path"]))
                print(f"[S3] Snapshot enviado: {uploaded['uploaded']} ({uploaded['bytes']} bytes)")
            except Exception as exc:  # noqa: BLE001
                print(f"[S3] Falha no envio do snapshot: {exc}")
            time.sleep(cfg.interval)

    thread = threading.Thread(target=worker, name="seg-s3-persist", daemon=True)
    thread.start()
    return thread
