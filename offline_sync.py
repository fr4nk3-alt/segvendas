"""Fila local, idempotente e tolerante a quedas para integrações externas.

Os registros ficam em JSON dentro de ``data/`` para que a operação local
continue funcionando sem internet.  O módulo não conhece o formato do ERP;
recebe um cliente com ``send_quote(payload, operation_id)`` e controla apenas
tentativas, estados e auditoria.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import threading
import time
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class OfflineSyncQueue:
    """Fila persistida em disco, segura para o worker e para ações manuais."""

    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.queue_path = self.data_dir / "sync_queue.json"
        self.audit_path = self.data_dir / "sync_audit.json"
        self._lock = threading.RLock()

    def _read(self, path: Path) -> list[dict]:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (FileNotFoundError, OSError, json.JSONDecodeError):
            return []
        return value if isinstance(value, list) else []

    def _write(self, path: Path, entries: list[dict]) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    def _audit(self, event: dict) -> None:
        entries = self._read(self.audit_path)
        entries.insert(0, {"at": _now(), **event})
        self._write(self.audit_path, entries[:5000])

    def enqueue(self, kind: str, payload: object, operation_id: str = "") -> dict:
        operation_id = operation_id or f"{kind}:{uuid.uuid4().hex}"
        with self._lock:
            entries = self._read(self.queue_path)
            for item in entries:
                if item.get("operationId") == operation_id and item.get("status") in {"pending", "retry", "processing"}:
                    return {"id": item.get("id"), "operationId": operation_id, "duplicate": True, "status": item.get("status")}
            item = {
                "id": uuid.uuid4().hex,
                "operationId": operation_id,
                "kind": str(kind or "unknown")[:40],
                "payload": payload,
                "status": "pending",
                "attempts": 0,
                "createdAt": _now(),
                "updatedAt": _now(),
                "nextAttemptAt": 0,
                "lastError": "",
            }
            entries.insert(0, item)
            self._write(self.queue_path, entries[:5000])
            self._audit({"action": "enqueued", "id": item["id"], "operationId": operation_id, "kind": item["kind"]})
            return {"id": item["id"], "operationId": operation_id, "duplicate": False, "status": "pending"}

    def snapshot(self) -> dict:
        with self._lock:
            entries = self._read(self.queue_path)
        counts = {status: 0 for status in ("pending", "processing", "retry", "sent", "failed")}
        for item in entries:
            status = item.get("status")
            if status in counts:
                counts[status] += 1
        return {"total": len(entries), "counts": counts, "items": [
            {key: item.get(key) for key in ("id", "operationId", "kind", "status", "attempts", "createdAt", "updatedAt", "nextAttemptAt", "lastError")}
            for item in entries[:100]
        ]}

    def process(self, client: object, limit: int = 20) -> dict:
        processed = sent = failed = 0
        now = time.time()
        with self._lock:
            entries = self._read(self.queue_path)
            candidates = [item for item in entries if item.get("status") in {"pending", "retry"} and float(item.get("nextAttemptAt") or 0) <= now][:max(1, min(int(limit), 100))]
            for item in candidates:
                item["status"] = "processing"
                item["updatedAt"] = _now()
            self._write(self.queue_path, entries[:5000])

        for selected in candidates:
            processed += 1
            try:
                if selected.get("kind") != "quote":
                    raise RuntimeError("Tipo de sincronização não suportado.")
                client.send_quote(selected.get("payload") or {}, str(selected.get("operationId") or selected.get("id")))
            except Exception as exc:  # connector sanitiza os detalhes externos
                with self._lock:
                    current = self._read(self.queue_path)
                    item = next((entry for entry in current if entry.get("id") == selected.get("id")), None)
                    if item is not None:
                        item["attempts"] = int(item.get("attempts") or 0) + 1
                        item["status"] = "failed" if item["attempts"] >= 8 else "retry"
                        item["lastError"] = str(exc)[:240]
                        item["nextAttemptAt"] = time.time() + min(3600, 30 * (2 ** min(item["attempts"], 6)))
                        item["updatedAt"] = _now()
                    self._write(self.queue_path, current[:5000])
                    self._audit({"action": "send_failed", "id": selected.get("id"), "operationId": selected.get("operationId"), "detail": str(exc)[:240]})
                failed += 1
            else:
                with self._lock:
                    current = self._read(self.queue_path)
                    item = next((entry for entry in current if entry.get("id") == selected.get("id")), None)
                    if item is not None:
                        item["attempts"] = int(item.get("attempts") or 0) + 1
                        item["status"] = "sent"
                        item["lastError"] = ""
                        item["updatedAt"] = _now()
                    self._write(self.queue_path, current[:5000])
                    self._audit({"action": "sent", "id": selected.get("id"), "operationId": selected.get("operationId")})
                sent += 1
        return {"processed": processed, "sent": sent, "failed": failed}
