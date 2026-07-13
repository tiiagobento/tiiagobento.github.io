from __future__ import annotations

import os
import random
import string
import subprocess
import sys
import time
from pathlib import Path

import qrcode
from zeroconf import ServiceBrowser, Zeroconf


ROOT = Path(__file__).resolve().parent
QR_PATH = ROOT / "qr-pareamento-adb.png"
ADB = Path(os.environ.get("LOCALAPPDATA", "")) / "Android" / "Sdk" / "platform-tools" / "adb.exe"


def random_token(length: int = 6) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(random.choice(alphabet) for _ in range(length))


def run_adb(*args: str) -> bool:
    if not ADB.exists():
        print(f"ERRO: ADB nao encontrado em {ADB}")
        return False
    cmd = [str(ADB), *args]
    print(f"> {' '.join(cmd)}")
    result = subprocess.run(cmd, text=True, capture_output=True)
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip())
    return result.returncode == 0


class PairingListener:
    def __init__(self, target_service_name: str = "", target_ip: str | None = None) -> None:
        self.target_service_name = target_service_name
        self.target_ip = target_ip
        self.ip_address: str | None = None
        self.port: int | None = None

    def remove_service(self, zeroconf: Zeroconf, service_type: str, name: str) -> None:
        return None

    def update_service(self, zeroconf: Zeroconf, service_type: str, name: str) -> None:
        return None

    def add_service(self, zeroconf: Zeroconf, service_type: str, name: str) -> None:
        info = zeroconf.get_service_info(service_type, name)
        if not info:
            return
        addresses = info.parsed_addresses()
        if not addresses:
            return
        ip = addresses[0]
        if self.target_service_name and self.target_service_name not in name:
            return
        if self.target_ip and ip != self.target_ip:
            return
        self.ip_address = ip
        self.port = info.port


def discover(service_type: str, target_service_name: str = "", target_ip: str | None = None, timeout: int = 300) -> tuple[str | None, int | None]:
    zeroconf = Zeroconf()
    listener = PairingListener(target_service_name, target_ip)
    ServiceBrowser(zeroconf, service_type, listener)
    started = time.time()
    while listener.ip_address is None and time.time() - started < timeout:
        time.sleep(0.5)
    zeroconf.close()
    return listener.ip_address, listener.port


def main() -> int:
    service_name = f"adb-cli-{random_token()}"
    password = random_token()
    payload = f"WIFI:T:ADB;S:{service_name};P:{password};;"

    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=4)
    qr.add_data(payload)
    qr.make(fit=True)
    image = qr.make_image(fill_color="#0b2530", back_color="white")
    image.save(QR_PATH)

    print("============================================")
    print("Nova Forma CRM - Pareamento ADB por QR")
    print("============================================")
    print()
    print(f"QR gerado em: {QR_PATH}")
    print(f"Service Name: {service_name}")
    print(f"Password: {password}")
    print()
    print("No celular:")
    print("1. Abra Depuracao sem fio.")
    print("2. Toque em Parear o dispositivo com um codigo QR.")
    print("3. Escaneie o arquivo qr-pareamento-adb.png.")
    print()
    print("Aguardando o celular escanear o QR por ate 5 minutos...")
    print()

    try:
        os.startfile(QR_PATH)  # type: ignore[attr-defined]
    except Exception:
        pass

    ip, pairing_port = discover("_adb-tls-pairing._tcp.local.", target_service_name=service_name, timeout=300)
    if not ip or not pairing_port:
        print("Tempo esgotado. Gere um novo QR e tente novamente.")
        return 1

    print(f"Celular encontrado para pareamento: {ip}:{pairing_port}")
    if not run_adb("pair", f"{ip}:{pairing_port}", password):
        print("Pareamento falhou.")
        return 1

    print("Pareamento concluido. Procurando porta de conexao...")
    connect_ip, connect_port = discover("_adb-tls-connect._tcp.local.", target_ip=ip, timeout=45)
    if not connect_ip or not connect_port:
        print("Nao encontrei a porta de conexao automaticamente.")
        print("Abra a tela Depuracao sem fio no celular e rode CONECTAR-WIFI.bat com o IP:PORTA exibido.")
        return 1

    if not run_adb("connect", f"{connect_ip}:{connect_port}"):
        print("Conexao falhou.")
        return 1

    print()
    print("Pareado e conectado com sucesso.")
    run_adb("devices", "-l")
    print()
    print("Agora voce pode rodar INSTALAR-VIA-WIFI.bat.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
