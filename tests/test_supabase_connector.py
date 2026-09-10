import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from supabase_connector import SupabaseConfig, SupabaseClient, SupabaseError


class SupabaseConnectorTests(unittest.TestCase):
    def test_configuration_is_loaded_from_local_file_without_printing_secret(self):
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory)
            (data_dir / "supabase_config.json").write_text(json.dumps({
                "url": "https://ggwwttitfklozyiwbsfe.supabase.co",
                "serviceRoleKey": "x" * 40,
                "enabled": True,
            }), encoding="utf-8")
            with patch.dict("os.environ", {}, clear=True):
                config = SupabaseConfig.from_env_or_file(data_dir)
            self.assertTrue(config.enabled)
            self.assertTrue(config.configured)
            self.assertEqual(config.url, "https://ggwwttitfklozyiwbsfe.supabase.co")

    def test_url_is_required_to_be_https(self):
        config = SupabaseConfig(url="http://localhost", service_role_key="x" * 40, enabled=True)
        with self.assertRaises(SupabaseError):
            config.validate(require_enabled=True)

    def test_health_check_uses_rest_endpoint(self):
        response = MagicMock()
        response.read.return_value = b"{}"
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        config = SupabaseConfig(
            url="https://ggwwttitfklozyiwbsfe.supabase.co",
            service_role_key="x" * 40,
            enabled=True,
        )
        with patch("supabase_connector.urlopen", return_value=response) as opened:
            result = SupabaseClient(config).health_check()
        self.assertTrue(result["ok"])
        request = opened.call_args.args[0]
        self.assertEqual(request.full_url, "https://ggwwttitfklozyiwbsfe.supabase.co/rest/v1/")


if __name__ == "__main__":
    unittest.main()
