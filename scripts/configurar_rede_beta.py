from __future__ import annotations

from pathlib import Path
import sys
from urllib.parse import urlparse

APP_DIR = Path(__file__).resolve().parent.parent
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import servidor


def ask(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{prompt}{suffix}: ").strip()
    return value or default


def ask_port(default: int) -> int:
    while True:
        value = ask("Porta interna do aplicativo", str(default))
        try:
            port = int(value)
        except ValueError:
            print("  Digite somente números.")
            continue
        if 1024 <= port <= 65535:
            return port
        print("  Use uma porta entre 1024 e 65535. Exemplo: 8080.")


def ask_scheme(default: str = "https") -> str:
    while True:
        scheme = ask("Protocolo público (https ou http)", default).casefold()
        if scheme in {"http", "https"}:
            return scheme
        print("  Digite https ou http.")


def format_public_url(scheme: str, host: str, port: int | None = None) -> str:
    host = host.strip().rstrip("/")
    if "://" in host:
        parsed = urlparse(host)
        host = parsed.hostname or ""
        if parsed.port is not None:
            port = parsed.port
    default_port = 443 if scheme == "https" else 80
    port_text = f":{port}" if port and port != default_port else ""
    return f"{scheme}://{host}{port_text}"


def show_config(config: dict) -> None:
    mode_labels = {
        "secure_tunnel": "Túnel seguro / HTTPS",
        "direct_ddns": "DDNS com porta aberta",
        "local_network": "Somente rede local",
        "custom": "Personalizado",
    }
    print("\nCONFIGURAÇÃO ATUAL")
    print("-" * 56)
    print(f"Modo:             {mode_labels.get(config.get('mode'), config.get('mode'))}")
    print(f"IP de escuta:     {config.get('bindAddress')}")
    print(f"Porta interna:    {config.get('port')}")
    print(f"Porta fixa:       {'sim' if config.get('strictPort') else 'não; procura a próxima livre'}")
    print(f"Endereço público: {config.get('publicUrl') or 'não configurado'}")
    print(f"IP local detectado: {servidor.local_ip()}")
    print("-" * 56)


def secure_tunnel_config(current: dict) -> dict:
    print("\nMODO RECOMENDADO PARA O PROJETO PRINCIPAL")
    print("O aplicativo ficará acessível somente neste computador e o túnel fará a publicação HTTPS.")
    port = ask_port(int(current.get("port", 8080)))
    while True:
        public_url = ask("Endereço HTTPS criado no túnel (ex.: https://vendas.empresa.com)", current.get("publicUrl", ""))
        if public_url and not public_url.casefold().startswith("https://"):
            public_url = "https://" + public_url.lstrip("/")
        try:
            config = servidor.normalize_network_config({
                "bindAddress": "127.0.0.1",
                "port": port,
                "strictPort": True,
                "publicUrl": public_url,
                "mode": "secure_tunnel",
            })
            if not config["publicUrl"]:
                print("  Informe o endereço público que será usado pelo túnel.")
                continue
            return config
        except ValueError as exc:
            print(f"  {exc}")


def direct_ddns_config(current: dict) -> dict:
    print("\nATENÇÃO: DDNS não fornece HTTPS nem protege a porta aberta no roteador.")
    print("Esta opção apenas prepara o aplicativo; ela não altera roteador ou Firewall do Windows.")
    port = ask_port(int(current.get("port", 8080)))
    while True:
        host = ask("Nome DDNS, sem caminho (ex.: minhaempresa.ddns.net)")
        scheme = ask_scheme("https" if str(current.get("publicUrl", "")).startswith("https://") else "http")
        suggested_public_port = 443 if scheme == "https" else port
        try:
            public_port = int(ask("Porta pública/DDNS", str(suggested_public_port)))
            public_url = format_public_url(scheme, host, public_port)
            return servidor.normalize_network_config({
                "bindAddress": "0.0.0.0",
                "port": port,
                "strictPort": True,
                "publicUrl": public_url,
                "mode": "direct_ddns",
            })
        except (ValueError, TypeError) as exc:
            print(f"  Configuração inválida: {exc}")


def local_network_config(current: dict) -> dict:
    port = ask_port(int(current.get("port", 8080)))
    return servidor.normalize_network_config({
        "bindAddress": "0.0.0.0",
        "port": port,
        "strictPort": True,
        "publicUrl": "",
        "mode": "local_network",
    })


def custom_config(current: dict) -> dict:
    while True:
        bind_address = ask("IP de escuta (127.0.0.1, 0.0.0.0 ou IP local)", str(current.get("bindAddress", "0.0.0.0")))
        port = ask_port(int(current.get("port", 8080)))
        public_url = ask("URL pública completa; deixe vazio se não houver", str(current.get("publicUrl", "")))
        try:
            return servidor.normalize_network_config({
                "bindAddress": bind_address,
                "port": port,
                "strictPort": True,
                "publicUrl": public_url,
                "mode": "custom",
            })
        except ValueError as exc:
            print(f"  {exc}")


def save_config(config: dict) -> None:
    servidor.write_json_file(servidor.NETWORK_CONFIG_DB, config)
    print(f"\nConfiguração salva em: {servidor.NETWORK_CONFIG_DB}")
    try:
        servidor.find_available_port(int(config["port"]), 1, str(config["bindAddress"]))
        print("A porta escolhida está livre neste momento.")
    except OSError:
        print("AVISO: a porta está ocupada. Feche o aplicativo atual ou escolha outra porta.")
    print("Feche e abra o SEG Vendas para aplicar a nova configuração.")
    if config.get("mode") == "direct_ddns":
        print("AVISO DE SEGURANÇA: não publique dados reais sem HTTPS e uma camada externa de acesso.")


def main() -> int:
    print("\nSEG VENDAS 5.9.13 - CONFIGURAR IP, PORTA E ENDEREÇO PÚBLICO")
    print("Feche o SEG Vendas antes de salvar uma nova porta.\n")
    try:
        current = servidor.normalize_network_config(servidor.read_network_config_file())
    except ValueError as exc:
        print(f"A configuração anterior era inválida e será substituída: {exc}")
        current = dict(servidor.DEFAULT_NETWORK_CONFIG)
    show_config(current)
    print("\nEscolha o modo:")
    print("  1 - Túnel seguro com HTTPS (RECOMENDADO para vendedores)")
    print("  2 - DDNS + porta aberta no roteador (não recomendado)")
    print("  3 - Somente rede local / Wi-Fi da loja")
    print("  4 - Configuração avançada de IP e porta")
    print("  5 - Restaurar padrão automático (0.0.0.0, porta inicial 8080)")
    print("  0 - Sair sem alterar")
    choice = ask("Opção", "1")
    if choice == "0":
        print("Nenhuma alteração realizada.")
        return 0
    if choice == "1":
        config = secure_tunnel_config(current)
    elif choice == "2":
        config = direct_ddns_config(current)
    elif choice == "3":
        config = local_network_config(current)
    elif choice == "4":
        config = custom_config(current)
    elif choice == "5":
        config = servidor.normalize_network_config(servidor.DEFAULT_NETWORK_CONFIG)
    else:
        print("Opção inválida. Nenhuma alteração realizada.")
        return 1
    show_config(config)
    if ask("Salvar esta configuração? (S/N)", "S").casefold() not in {"s", "sim", "y", "yes"}:
        print("Nenhuma alteração realizada.")
        return 0
    save_config(config)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (KeyboardInterrupt, EOFError):
        print("\nConfiguração cancelada.")
        raise SystemExit(1)
