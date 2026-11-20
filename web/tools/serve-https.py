#!/usr/bin/env python3
"""Serve the practice app over https on your local network, so a phone or tablet can use the mic.

Browsers only open the microphone on https or localhost. From the repo root:

    python3 web/tools/serve-https.py            # port 8443
    python3 web/tools/serve-https.py 9443

The first run makes a self-signed certificate (with openssl) in ~/.cache/guitar-teacher/. On the
phone, open the https://<your-computer's-IP>:8443/ address printed below. Safari warns that the
certificate isn't trusted: tap "Show Details" → "visit this website". Same Wi-Fi network required.
"""
import http.server
import os
import socket
import ssl
import subprocess
import sys

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(os.path.expanduser('~'), '.cache', 'guitar-teacher')
CERT = os.path.join(CACHE, 'cert.pem')
KEY = os.path.join(CACHE, 'key.pem')


def lan_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))  # no packet is sent; this only picks the outgoing interface
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    return sorted(ip for ip in ips if not ip.startswith('127.'))


def ensure_cert(ips):
    if os.path.exists(CERT) and os.path.exists(KEY):
        return
    os.makedirs(CACHE, exist_ok=True)
    san = ','.join(['DNS:localhost', 'IP:127.0.0.1'] + [f'IP:{ip}' for ip in ips])
    subprocess.run([
        'openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825',
        '-keyout', KEY, '-out', CERT, '-subj', '/CN=guitar-teacher-dev',
        '-addext', f'subjectAltName={san}',
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')  # phones cache hard; always serve the current files
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8443
    ips = lan_ips()
    ensure_cert(ips)
    httpd = http.server.ThreadingHTTPServer(('0.0.0.0', port), Handler)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT, KEY)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print('Practice app over https. On your phone (same Wi-Fi), open:')
    for ip in ips or ['<this computer’s IP>']:
        print(f'  https://{ip}:{port}/session.html')
    print(f'  (this computer: https://localhost:{port}/)  Ctrl+C to stop.', flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
