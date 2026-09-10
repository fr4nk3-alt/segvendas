"""Conector opcional do SEG Vendas ao Supabase.

O aplicativo continua sendo local-first: a fila SQLite permanece a fonte de
operação quando a internet cai. Este módulo apenas transporta os eventos da
fila para uma tabela PostgreSQL do Supabase quando a conexão está disponível.

Nenhuma chave é enviada ao navegador ou registrada em logs. A configuração
local fica em ``data/supabase_config.json`` (ignorado pelo Git) ou em variáveis
de ambiente do servidor.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen


class SupabaseError(RuntimeError):
    """Erro sanitizado de configuração ou comunicação com o Supabase."""


def _text(value: object, limit: int = 1000) -> str:
    return str(value or "").strip()[:limit]


def _truthy(value: object) -> bool:
    return _text(value, 20).casefold() in {"1", "true", "sim", "yes", "on"}


def _json(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


@dataclass(frozen=True)
class SupabaseConfig:
    url: str = ""
    service_role_key: str = ""
    enabled: bool = False
    timeout_seconds: int = 20
    config_path: Path | None = None

    @classmethod
    def from_env_or_file(cls, data_dir: Path | None = None) -> "SupabaseConfig":
        """Carrega configuração sem imprimir nenhum segredo.

        Variáveis de ambiente têm prioridade. O arquivo é útil no Windows,
        onde o servidor pode ser iniciado por um atalho sem herdar o ambiente
        do PowerShell.
        """
        data_dir = Path(data_dir or "data")
        path = data_dir / "supabase_config.json"
        saved: dict = {}
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                saved = raw
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            saved = {}
        url = _text(os.environ.get("SEG_SUPABASE_URL") or os.environ.get("SUPABASE_URL"), 500) or _text(saved.get("url"), 500)
        key = _text(
            os.environ.get("SEG_SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_SECRET_KEY"),
            4096,
        ) or _text(saved.get("serviceRoleKey") or saved.get("service_role_key"), 4096)
        raw_enabled = os.environ.get("SEG_SUPABASE_ENABLED")
        if raw_enabled is not None:
            enabled = _truthy(raw_enabled)
        elif "enabled" in saved:
            enabled = _truthy(saved.get("enabled"))
        else:
            enabled = bool(url and key)
        try:
            timeout = max(5, min(60, int(os.environ.get("SEG_SUPABASE_TIMEOUT", saved.get("timeoutSeconds", 20)))))
        except (TypeError, ValueError):
            timeout = 20
        return cls(url=url, service_role_key=key, enabled=bool(enabled), timeout_seconds=timeout, config_path=path)

    @property
    def configured(self) -> bool:
        return bool(self.url and self.service_role_key)

    def validate(self, require_enabled: bool = False) -> None:
        if require_enabled and not self.enabled:
            raise SupabaseError("Integração Supabase está desativada.")
        if not self.configured:
            raise SupabaseError("URL ou chave privada do Supabase não configurada.")
        parsed = __import__("urllib.parse", fromlist=["urlparse"]).urlparse(self.url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise SupabaseError("SEG_SUPABASE_URL precisa ser uma URL HTTPS válida.")
        if not re.fullmatch(r"[A-Za-z0-9._~+/=-]{20,4096}", self.service_role_key):
            raise SupabaseError("A chave privada do Supabase parece inválida.")


class SupabaseClient:
    """Cliente REST mínimo, sem dependência externa."""

    def __init__(self, config: SupabaseConfig):
        self.config = config
        self.config.validate(require_enabled=True)

    def _request(
        self,
        method: str,
        path: str,
        payload: object | None = None,
        query: dict[str, object] | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> object:
        target = urljoin(self.config.url.rstrip("/") + "/", path.lstrip("/"))
        if query:
            target += "?" + urlencode(query, doseq=True)
        body = None if payload is None else _json(payload)
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "apikey": self.config.service_role_key,
            "Authorization": f"Bearer {self.config.service_role_key}",
            "User-Agent": "SEG-Vendas-Supabase/1.0",
        }
        if extra_headers:
            headers.update({str(key): str(value) for key, value in extra_headers.items()})
        request = Request(target, data=body, headers=headers, method=method.upper())
        try:
            with urlopen(request, timeout=self.config.timeout_seconds) as response:
                raw = response.read()
                if not raw:
                    return {"ok": True, "status": response.status}
                try:
                    return json.loads(raw.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    return {"ok": True, "status": response.status}
        except HTTPError as exc:
            # Nunca devolve o corpo do erro: alguns gateways podem ecoar
            # cabeçalhos ou detalhes que não devem aparecer no aplicativo.
            if exc.code in {401, 403}:
                raise SupabaseError("Supabase recusou a chave privada.") from exc
            if exc.code == 404:
                raise SupabaseError("A tabela do Supabase ainda não foi criada.") from exc
            raise SupabaseError(f"Supabase respondeu HTTP {exc.code}.") from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise SupabaseError("Não foi possível alcançar o Supabase; a fila local será mantida.") from exc

    def health_check(self) -> dict:
        started = time.monotonic()
        self._request("GET", "/rest/v1/")
        return {"ok": True, "latencyMs": round((time.monotonic() - started) * 1000)}

    def upsert_events(self, events: list[dict]) -> int:
        if not events:
            return 0
        response = self._request(
            "POST",
            "/rest/v1/seg_sync_events?on_conflict=event_id",
            events,
            extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
        )
        _ = response
        return len(events)

    def pull_events(self, cursor: int, limit: int = 50) -> list[dict]:
        response = self._request(
            "GET",
            "/rest/v1/seg_sync_events",
            query={
                "select": "sequence,event_id,origin_store_id,entity,operation,payload,created_at",
                "sequence": f"gt.{max(0, int(cursor))}",
                "order": "sequence.asc",
                "limit": max(1, min(int(limit), 200)),
            },
        )
        return response if isinstance(response, list) else []


class SupabaseStoreReplicationClient:
    """Transporta a fila local para o ledger central do Supabase."""

    def __init__(self, config: SupabaseConfig):
        self.client = SupabaseClient(config)

    def sync_once(self, replica) -> dict:
        pending = replica.pending(50)
        sent = 0
        if pending:
            payload = [
                {
                    "event_id": event["eventId"],
                    "origin_store_id": event["storeId"],
                    "entity": event["entity"],
                    "operation": event["operation"],
                    "payload": event["payload"],
                    "created_at": event["createdAt"],
                }
                for event in pending
            ]
            self.client.upsert_events(payload)
            replica.mark_sent([event["eventId"] for event in pending])
            sent = len(pending)
        cursor = int(replica.get_meta("supabaseCursor", "0") or 0)
        remote = self.client.pull_events(cursor, 50)
        events = []
        next_cursor = cursor
        for item in remote:
            try:
                sequence = int(item.get("sequence", next_cursor))
            except (TypeError, ValueError):
                sequence = next_cursor
            next_cursor = max(next_cursor, sequence)
            events.append(
                {
                    "sequence": sequence,
                    "eventId": _text(item.get("event_id"), 160),
                    "storeId": _text(item.get("origin_store_id"), 80),
                    "entity": _text(item.get("entity"), 80),
                    "operation": _text(item.get("operation"), 80),
                    "payload": item.get("payload") if isinstance(item.get("payload"), dict) else {},
                    "createdAt": _text(item.get("created_at"), 60),
                }
            )
        received = replica.receive_events(events)
        replica.set_meta("supabaseCursor", next_cursor)
        return {"sent": sent, "received": received, "cursor": next_cursor}
