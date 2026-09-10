"""Testes do protocolo Gertec (terminais de consulta de preco TC300/TC502).

Baseado no SDK oficial Gertec TCServer: cada recv() e uma mensagem completa,
prefixada com '#', sem terminador de linha. Respostas tambem sem newline.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import servidor  # noqa: E402


class FakeSocket:
    """Socket falso: entrega uma mensagem por recv(), como o terminal real."""

    def __init__(self, incoming: list[bytes]) -> None:
        self.incoming = list(incoming)
        self.sent: list[bytes] = []
        self.closed = False

    def settimeout(self, _value) -> None:
        return

    def recv(self, _size: int) -> bytes:
        if not self.incoming:
            return b""
        return self.incoming.pop(0)

    def sendall(self, data: bytes) -> None:
        self.sent.append(data)

    def close(self) -> None:
        self.closed = True

    def fileno(self) -> int:
        return 0


def fake_select(sock_list, _w, _x, _timeout):
    sock = sock_list[0]
    return (sock_list, [], []) if sock.incoming else ([], [], [])


CATALOG = {
    "7891000100103": {"desc": "FECHADURA STAM 803", "price": 89.9},
    "7891000200203": {"desc": "CAIXA PLASTICA 20L", "price": 24.5},
}


def fake_resolve(barcode: str):
    return CATALOG.get(barcode)


class GertecProtocolTests(unittest.TestCase):
    def run_handler(self, incoming: list[bytes]) -> FakeSocket:
        sock = FakeSocket(incoming)
        handler = servidor.GertecTerminalHandler(sock, ("172.16.1.81", 50000))
        with mock.patch.object(servidor, "resolve_gertec_product", fake_resolve), \
             mock.patch("select.select", fake_select), \
             mock.patch("builtins.print"):
            handler.run()
        # Ao esgotar as mensagens o servidor envia '#live?' ate desistir; isso
        # e o comportamento esperado e nao faz parte das respostas de consulta.
        sock.responses = [chunk for chunk in sock.sent if chunk != b"#live?"]
        return sock

    def test_keepalive_is_sent_on_idle_and_connection_drops_after_retries(self):
        sock = self.run_handler([b"#TC300|3.3", b"#alwayslive_ok"])
        self.assertEqual(sock.sent.count(b"#live?"), servidor.GertecTerminalHandler.LIVE_MAX_RETRIES)
        self.assertTrue(sock.closed)

    def test_handshake_follows_official_sdk(self):
        sock = self.run_handler([b"#TC300|3.3", b"#alwayslive_ok"])
        self.assertEqual(sock.sent[0], b"#ok")
        self.assertEqual(sock.sent[1], b"#alwayslive")
        self.assertTrue(sock.closed)

    def test_responses_have_no_newline(self):
        sock = self.run_handler([b"#TC300|3.3", b"#alwayslive_ok", b"#7891000100103"])
        for chunk in sock.sent:
            self.assertFalse(chunk.endswith(b"\n"), f"resposta com newline: {chunk!r}")

    def test_two_consecutive_scans_return_distinct_products(self):
        # Cenario reportado em loja: fechadura seguida de caixa plastica.
        sock = self.run_handler([
            b"#TC300|3.3",
            b"#alwayslive_ok",
            b"#7891000100103",
            b"#7891000200203",
        ])
        responses = sock.responses[2:]
        self.assertEqual(responses[0], b"#FECHADURA STAM 803|R$ 89,90")
        self.assertEqual(responses[1], b"#CAIXA PLASTICA 20L|R$ 24,50")

    def test_unknown_barcode_returns_nfound(self):
        sock = self.run_handler([b"#TC300|3.3", b"#alwayslive_ok", b"#0000000000000"])
        self.assertEqual(sock.responses[-1], b"#nfound")

    def test_live_reply_is_not_treated_as_barcode(self):
        sock = self.run_handler([b"#TC300|3.3", b"#alwayslive_ok", b"#live", b"#7891000200203"])
        self.assertNotIn(b"#nfound", sock.responses)
        self.assertEqual(sock.responses[-1], b"#CAIXA PLASTICA 20L|R$ 24,50")

    def test_terminal_without_alwayslive_ack_still_works(self):
        # TC502 v6.5.1 pode nao confirmar alwayslive; nao deve derrubar a conexao.
        sock = self.run_handler([b"#tc502|6.5.1", b"#7891000100103"])
        self.assertEqual(sock.responses[-1], b"#FECHADURA STAM 803|R$ 89,90")

    def test_description_is_limited_to_display_width(self):
        long_desc = {"desc": "X" * 40, "price": 1.0}
        with mock.patch.dict(CATALOG, {"1": long_desc}):
            sock = self.run_handler([b"#TC300|3.3", b"#alwayslive_ok", b"#1"])
        desc = sock.responses[-1].split(b"|")[0][1:]
        self.assertLessEqual(len(desc), 20)


if __name__ == "__main__":
    unittest.main()
