import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dataplace_connector import DataplaceClient, DataplaceConfig
from offline_sync import OfflineSyncQueue


class _FakeDataplaceHandler(BaseHTTPRequestHandler):
    requests = []

    def log_message(self, *_args):
        return

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        self.__class__.requests.append({
            "path": self.path,
            "body": json.loads(body.decode("utf-8")),
            "api_key": self.headers.get("X-API-Key"),
            "idempotency": self.headers.get("Idempotency-Key"),
        })
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"accepted":true}')


class DataplaceSyncTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _FakeDataplaceHandler.requests = []
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), _FakeDataplaceHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def test_connector_and_offline_queue(self):
        base_url = f"http://127.0.0.1:{self.server.server_port}"
        config = DataplaceConfig(
            base_url=base_url,
            api_key="teste-seg",
            api_key_header="X-API-Key",
            quote_path="/quotes",
            allow_http=True,
        )
        client = DataplaceClient(config)
        self.assertEqual(client.health(), {"ok": True})
        with tempfile.TemporaryDirectory() as directory:
            queue = OfflineSyncQueue(Path(directory))
            queued = queue.enqueue("quote", {"source": "teste", "quote": {"id": "Q-1"}}, "quote:Q-1")
            duplicate = queue.enqueue("quote", {"ignored": True}, "quote:Q-1")
            self.assertFalse(queued["duplicate"])
            self.assertTrue(duplicate["duplicate"])
            self.assertEqual(queue.process(client), {"processed": 1, "sent": 1, "failed": 0})
            self.assertEqual(queue.snapshot()["counts"]["sent"], 1)
        self.assertEqual(len(_FakeDataplaceHandler.requests), 1)
        request = _FakeDataplaceHandler.requests[0]
        self.assertEqual(request["path"], "/quotes")
        self.assertEqual(request["api_key"], "teste-seg")
        self.assertEqual(request["idempotency"], "quote:Q-1")
        self.assertEqual(request["body"]["quote"]["id"], "Q-1")

    def test_invalid_timeout_falls_back_to_safe_default(self):
        old = os.environ.get("DATAPLACE_TIMEOUT")
        try:
            os.environ["DATAPLACE_TIMEOUT"] = "nao-e-numero"
            self.assertEqual(DataplaceConfig.from_env().timeout_seconds, 15.0)
        finally:
            if old is None:
                os.environ.pop("DATAPLACE_TIMEOUT", None)
            else:
                os.environ["DATAPLACE_TIMEOUT"] = old


if __name__ == "__main__":
    unittest.main()
