#!/usr/bin/env python3
"""Serve Comet Curling Clash from this folder on 127.0.0.1."""

import argparse
import json
import os
import socket
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


def preferred_port():
    path = os.path.join(ROOT, "arcade.json")
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
        port = int(data.get("port", 8813))
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        port = 8813
    return port


def first_free_port(start, host):
    if start == 0:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind((host, 0))
            return sock.getsockname()[1]
    port = start
    for _ in range(30):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((host, port))
            except OSError:
                port += 1
                continue
            return port
    raise SystemExit(f"No free port from {start} through {port}.")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


def main():
    parser = argparse.ArgumentParser(description="Comet Curling Clash local server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=None, help="Port to bind. 0 picks a free port.")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser window.")
    args = parser.parse_args()

    os.chdir(ROOT)
    requested = preferred_port() if args.port is None else args.port
    port = first_free_port(requested, args.host)
    if port != requested and requested != 0:
        print(f"Port {requested} is busy. Using {port} instead.")

    server = ThreadingHTTPServer((args.host, port), Handler)
    url = f"http://{args.host}:{port}/"
    print(f"READY {url}")
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception as exc:
            print(f"Could not open a browser ({exc}). Open {url} yourself.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
