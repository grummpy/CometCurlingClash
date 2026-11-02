import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relative) {
  return readFileSync(path.join(root, relative), "utf8");
}

test("arcade.json matches the manifest and points at real files", () => {
  const manifest = JSON.parse(read("arcade.json"));
  assert.equal(manifest.name, "Comet Curling Clash");
  assert.equal(manifest.id, "cometcurlingclash");
  assert.equal(manifest.icon, "assets/icon.jpg");
  assert.equal(manifest.cover, "assets/cover.jpg");
  assert.equal(manifest.players, 4);
  assert.equal(manifest.minPlayers, 1);
  assert.equal(manifest.port, 8813);
  assert.equal(manifest.version, "1.0.0");
  assert.deepEqual(manifest.input, ["keyboard", "gamepad"]);
  assert.deepEqual(manifest.launch, {
    mac: "./launch-mac.command",
    windows: "launch-windows.bat",
    linux: "./launch-linux.sh",
    web: "index.html",
  });
  for (const relative of [manifest.icon, manifest.cover, manifest.launch.web, "server.py", "LICENSE"]) {
    assert.equal(existsSync(path.join(root, relative)), true, relative);
  }
  for (const launch of ["launch-mac.command", "launch-linux.sh", "launch-windows.bat"]) {
    const file = path.join(root, launch);
    assert.equal(existsSync(file), true, launch);
    assert.ok(statSync(file).size > 0);
  }
  const linux = statSync(path.join(root, "launch-linux.sh"));
  const mac = statSync(path.join(root, "launch-mac.command"));
  assert.ok(linux.mode & 0o111, "launch-linux.sh should be executable");
  assert.ok(mac.mode & 0o111, "launch-mac.command should be executable");
});

test("the page is a self-contained canvas module with no CDN", () => {
  const html = read("index.html");
  assert.match(html, /<canvas id="game"/);
  assert.match(html, /src="src\/main\.js"/);
  assert.match(html, /assets\/icon\.jpg/);
  const files = ["index.html", "src/main.js", "src/core/match.js", "src/ui/render.js", "src/ui/audio.js"];
  for (const relative of files) {
    const source = read(relative);
    assert.equal(/https?:\/\//.test(source), false, relative);
    assert.equal(source.includes("cdn."), false, relative);
  }
});
