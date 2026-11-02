#!/usr/bin/env python3
"""Smoke test: server.py serves the game page."""

import os
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main():
    port = free_port()
    process = subprocess.Popen(
        [sys.executable, "server.py", "--no-browser", "--port", str(port)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    url = f"http://127.0.0.1:{port}/index.html"
    try:
        deadline = time.time() + 8
        body = None
        while time.time() < deadline:
            if process.poll() is not None:
                output = process.stdout.read() if process.stdout else ""
                raise SystemExit(f"server exited early:\n{output}")
            try:
                with urllib.request.urlopen(url, timeout=1) as response:
                    status = response.status
                    payload = response.read()
                if status == 200:
                    body = payload
                    break
            except Exception:
                time.sleep(0.1)
        if body is None:
            raise SystemExit("timed out waiting for index.html")
        text = body.decode("utf-8", errors="replace")
        if "Comet Curling Clash" not in text or 'src="src/main.js"' not in text:
            raise SystemExit("index.html did not contain the game shell")
        module_url = f"http://127.0.0.1:{port}/src/main.js"
        with urllib.request.urlopen(module_url, timeout=2) as response:
            module = response.read().decode("utf-8", errors="replace")
            if response.status != 200 or "createMatch" not in module:
                raise SystemExit("src/main.js was not served")
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/arcade.json", timeout=2) as response:
            if response.status != 200:
                raise SystemExit("arcade.json was not served")
        print(f"smoke ok {url}")
    finally:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()


if __name__ == "__main__":
    main()
