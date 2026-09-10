"""Cliente mínimo e seguro para a API do Dataplace.

O módulo não conhece o esquema comercial do ERP. Os caminhos e o formato
final do pedido ficam configuráveis até a SEG receber a documentação oficial
do ambiente contratado. A credencial é lida somente do ambiente do servidor.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin, urlparse
from urllib.request import Request, urlopen


class DataplaceError(RuntimeError):
    """Erro de comunicação ou configuração sem expor a credencial."""


def _text(value: object, limit: int = 500) -> str:
    return str(value or "").strip()[:limit]


def _truthy(value: object) -> bool:
    return _text(value, 20).casefold() in {"1", "true", "sim", "yes", "on"}


@dataclass(frozen=True)
class DataplaceConfig:
    base_url: str
    api_key: str
    auth_type: str = "api-key"
    api_key_header: str = "X-API-Key"
    health_path: str = ""
    customers_path: str = ""
    products_path: str = ""
    quote_path: str = ""
    timeout_seconds: float = 15.0
    allow_http: bool = False

    @classmethod
    def from_env(cls) -> "DataplaceConfig":
        try:
            timeout_seconds = max(2.0, min(60.0, float(os.environ.get("DATAPLACE_TIMEOUT", "15"))))
        except (TypeError, ValueError):
            timeout_seconds = 15.0
        return cls(
            base_url=_text(os.environ.get("DATAPLACE_BASE_URL")),
            api_key=_text(os.environ.get("DATAPLACE_API_KEY"), 10_000),
            auth_type=_text(os.environ.get("DATAPLACE_AUTH_TYPE"), 20).casefold() or "api-key",
            api_key_header=_text(os.environ.get("DATAPLACE_API_KEY_HEADER"), 80) or "X-API-Key",
            health_path=_text(os.environ.get("DATAPLACE_HEALTH_PATH"), 300),
            customers_path=_text(os.environ.get("DATAPLACE_CUSTOMERS_PATH"), 300),
            products_path=_text(os.environ.get("DATAPLACE_PRODUCTS_PATH"), 300),
            quote_path=_text(os.environ.get("DATAPLACE_QUOTE_PATH"), 300),
            timeout_seconds=timeout_seconds,
            allow_http=_truthy(os.environ.get("DATAPLACE_ALLOW_HTTP")),
        )

    @property
    def configured(self) -> bool:
        return bool(self.base_url)

    @property
    def enabled(self) -> bool:
        return self.configured and _truthy(os.environ.get("SEG_SYNC_ENABLED"))

    def validate(self) -> None:
        if not self.base_url:
            raise DataplaceError("DATAPLACE_BASE_URL não foi configurada no servidor.")
        parsed = urlparse(self.base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise DataplaceError("DATAPLACE_BASE_URL precisa ser uma URL HTTP/HTTPS válida.")
        if parsed.scheme != "https" and not self.allow_http:
            raise DataplaceError("A API do Dataplace precisa usar HTTPS fora do ambiente local.")
        if self.auth_type not in {"none", "bearer", "api-key"}:
            raise DataplaceError("DATAPLACE_AUTH_TYPE inválido.")
        if self.auth_type != "none" and not self.api_key:
            raise DataplaceError("DATAPLACE_API_KEY não foi configurada no servidor.")
        if self.auth_type == "api-key":
            valid_header = bool(self.api_key_header) and all(char.isalnum() or char == "-" for char in self.api_key_header)
            if not valid_header:
                raise DataplaceError("DATAPLACE_API_KEY_HEADER inválido.")


class DataplaceClient:
    def __init__(self, config: DataplaceConfig | None = None):
        self.config = config or DataplaceConfig.from_env()
        self.config.validate()

    def _target(self, path: str) -> str:
        relative = _text(path, 300).lstrip("/")
        return urljoin(self.config.base_url.rstrip("/") + "/", quote(relative, safe="/%:@?=&-_.~")) if relative else self.config.base_url

    def _headers(self, operation_id: str = "") -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "SEG-Vendas-Dataplace/1.0",
        }
        if operation_id:
            headers["Idempotency-Key"] = operation_id
        if self.config.auth_type == "bearer":
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        elif self.config.auth_type == "api-key":
            headers[self.config.api_key_header] = self.config.api_key
        return headers

    def request(self, method: str, path: str, payload: object | None = None, operation_id: str = "") -> object:
        target = self._target(path)
        body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = Request(target, data=body, headers=self._headers(operation_id), method=method.upper())
        try:
            with urlopen(request, timeout=self.config.timeout_seconds) as response:
                raw = response.read()
                if not raw:
                    return {"status": int(getattr(response, "status", 200))}
                try:
                    return json.loads(raw.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    return {"status": int(getattr(response, "status", 200)), "raw": raw[:2000].decode("utf-8", "replace")}
        except HTTPError as exc:
            # O corpo da resposta nunca é retornado, pois pode conter dados do ERP.
            raise DataplaceError(f"Dataplace respondeu HTTP {exc.code}.") from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise DataplaceError("Não foi possível conectar ao Dataplace.") from exc

    def health(self) -> object:
        return self.request("GET", self.config.health_path)

    def customers(self) -> object:
        if not self.config.customers_path:
            raise DataplaceError("DATAPLACE_CUSTOMERS_PATH ainda não foi configurado.")
        return self.request("GET", self.config.customers_path)

    def products(self) -> object:
        if not self.config.products_path:
            raise DataplaceError("DATAPLACE_PRODUCTS_PATH ainda não foi configurado.")
        return self.request("GET", self.config.products_path)

    def send_quote(self, quote_payload: dict, operation_id: str) -> object:
        if not self.config.quote_path:
            raise DataplaceError("DATAPLACE_QUOTE_PATH ainda não foi configurado.")
        return self.request("POST", self.config.quote_path, quote_payload, operation_id)
