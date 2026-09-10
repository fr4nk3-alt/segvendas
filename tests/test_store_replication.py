import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import tempfile
import threading
import unittest
import zipfile
from unittest.mock import patch

from store_replication import (
    ReplicaDatabase,
    StoreReplicationClient,
    StoreReplicationConfig,
    StoreReplicationError,
    create_local_backup,
    verify_hub_request,
)


class _HubHandler(BaseHTTPRequestHandler):
    pushed = []

    def log_message(self, *_args):
        return

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        self.__class__.pushed.extend(payload.get("events", []))
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "acceptedEventIds": [event["eventId"] for event in payload.get("events", [])]}).encode())

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({
            "ok": True,
            "events": [{"sequence": 1, "eventId": "oeste:quote:2:v1", "storeId": "oeste", "entity": "quote", "operation": "upsert", "payload": {"id": "2"}, "createdAt": "2026-08-26T12:00:00+00:00"}],
            "nextCursor": 1,
        }).encode())


class StoreReplicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _HubHandler.pushed = []
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), _HubHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def test_replica_ledger_backup_and_sync(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / "data"
            data.mkdir()
            (data / "clients.json").write_text('[{"id":"C1"}]', encoding="utf-8")
            backups = data / "backups"
            replica = ReplicaDatabase(data / "store_replica.sqlite3", "matriz")
            self.assertFalse(replica.enqueue("quote", "upsert", {"id": "1"}, "matriz:quote:1:v1")["duplicate"])
            self.assertTrue(replica.enqueue("quote", "upsert", {"id": "1"}, "matriz:quote:1:v1")["duplicate"])
            config = StoreReplicationConfig(
                store_id="matriz", store_name="Matriz", hub_url=f"http://127.0.0.1:{self.server.server_port}", token="token", enabled=True, allow_http=True,
            )
            result = StoreReplicationClient(config).sync_once(replica)
            self.assertEqual(result["sent"], 1)
            self.assertEqual(result["received"], 1)
            self.assertEqual(replica.status()["outbox"]["sent"], 1)
            self.assertEqual(len(replica.unapplied_events()), 1)
            archive = create_local_backup(data, backups, "matriz", retention=3)
            self.assertEqual(archive["files"], 1)
            with zipfile.ZipFile(archive["path"]) as opened:
                self.assertIn("data/clients.json", opened.namelist())
                self.assertIn("manifest.json", opened.namelist())
        self.assertEqual(_HubHandler.pushed[0]["eventId"], "matriz:quote:1:v1")

    def test_hmac_authentication_and_rejection(self):
        old = os.environ.get("SEG_REPLICATION_STORE_TOKENS")
        try:
            os.environ["SEG_REPLICATION_STORE_TOKENS"] = json.dumps({"matriz": "segredo"})
            import hashlib, hmac, time
            timestamp = str(int(time.time()))
            signature = hmac.new(b"segredo", timestamp.encode() + b".", hashlib.sha256).hexdigest()
            headers = {"X-SEG-Store-ID": "matriz", "X-SEG-Timestamp": timestamp, "X-SEG-Signature": signature}
            self.assertEqual(verify_hub_request(headers), "matriz")
            headers["X-SEG-Signature"] = "0" * 64
            with self.assertRaises(StoreReplicationError):
                verify_hub_request(headers)
        finally:
            if old is None:
                os.environ.pop("SEG_REPLICATION_STORE_TOKENS", None)
            else:
                os.environ["SEG_REPLICATION_STORE_TOKENS"] = old

    def test_quote_numbers_are_scoped_by_store(self):
        # Usa arquivos temporários para não tocar nas bases da cópia de
        # desenvolvimento ao validar a sequência do servidor.
        import servidor

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            history_path = root / "quote_history.json"
            sequences_path = root / "quote_sequences.json"
            history_path.write_text(json.dumps([{"number": "OE00021"}]), encoding="utf-8")
            with patch.object(servidor, "QUOTE_HISTORY_DB", history_path), patch.object(servidor, "QUOTE_SEQUENCES_DB", sequences_path):
                with servidor.DB_LOCK:
                    oeste_next = servidor.allocate_quote_number("SEG Oeste (Campo Grande)", json.loads(history_path.read_text(encoding="utf-8")))
                    oeste_after = servidor.allocate_quote_number("SEG Oeste (Campo Grande)", json.loads(history_path.read_text(encoding="utf-8")))
                    matriz_next = servidor.allocate_quote_number("Loja de JPA / SEG Matriz", [])
            self.assertEqual(servidor.quote_prefix_for_store("SEG Oeste (Campo Grande)"), "OE")
            self.assertEqual(oeste_next, "OE00022")
            self.assertEqual(oeste_after, "OE00023")
            self.assertEqual(matriz_next, "MA00001")

    def test_seller_numbering_uses_assigned_store(self):
        import servidor

        payload = {
            "id": "Q-STORE",
            "number": "MA99999",
            "store": "Loja de JPA / SEG Matriz",
            "items": [{"code": "100", "description": "Produto", "qty": 1, "unitPrice": 10}],
        }
        clean = servidor.clean_quote_history_payload(payload, {
            "username": "oeste-user", "name": "Vendedor Oeste", "role": "seller",
            "store": "SEG Oeste (Campo Grande)",
        })
        self.assertEqual(clean["store"], "SEG Oeste (Campo Grande)")

    def test_legacy_numeric_quotes_are_standardized_with_alias(self):
        import servidor

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            history_path = root / "quote_history.json"
            sequences_path = root / "quote_sequences.json"
            records = [
                {"id": "legacy-1", "number": "2400", "store": "SEG Oeste (Campo Grande)"},
                {"id": "legacy-2", "number": "2401", "store": "SEG Oeste (Campo Grande)"},
            ]
            history_path.write_text(json.dumps(records), encoding="utf-8")
            with patch.object(servidor, "QUOTE_HISTORY_DB", history_path), patch.object(servidor, "QUOTE_SEQUENCES_DB", sequences_path):
                changed = servidor.standardize_quote_history_storage()
            migrated = json.loads(history_path.read_text(encoding="utf-8"))
            self.assertEqual(changed, 2)
            self.assertEqual([item["number"] for item in migrated], ["OE00001", "OE00002"])
            self.assertEqual([item["legacyNumber"] for item in migrated], ["2400", "2401"])


if __name__ == "__main__":
    unittest.main()
