import { createMatch, stepMatch } from "./core/match.js";
import { defaultBindings, cloneBindings, clearBindingConflicts, ACTIONS } from "./core/inputmap.js";
import { createAudio } from "./ui/audio.js";
import { createInput } from "./ui/input.js";
import { loadSettings, saveSettings, loadBindings, saveBindings } from "./ui/storage.js";
import { createBackdrop, render, VIEW } from "./ui/render.js";

const STEP = 1000 / 60;

const canvas = document.getElementById("game");
const live = document.getElementById("live");
const ctx = canvas.getContext("2d");
const params = new URLSearchParams(location.search);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mixSeed(n) {
  let x = (n >>> 0) || 1;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) || 1;
}

const audio = createAudio();
const backdrop = createBackdrop();
const settings = loadSettings();
if (params.get("ends")) {
  const ends = parseInt(params.get("ends"), 10);
  if (Number.isFinite(ends)) settings.ends = clamp(ends, 1, 9);
}
const bindings = loadBindings();
const fast = clamp(parseInt(params.get("fast") || "1", 10) || 1, 1, 30);

const app = {
  screen: "title",
  menuIndex: 0,
  settings,
  bindings,
  kinds: ["bot", "bot", "bot", "bot"],
  match: null,
  connected: [false, false, false, false],
  notice: "",
  returnTo: "title",
  controlPlayer: 0,
  listen: null,
  cover: null,
  backdrop,
  audio,
  time: 0,
  nextSeed: params.get("seed") ? (parseInt(params.get("seed"), 10) >>> 0) || 1 : mixSeed(Date.now()),
  celebrated: false,
};

const input = createInput(() => app.bindings);

function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = VIEW.W * dpr;
  canvas.height = VIEW.H * dpr;
  canvas.style.width = `${VIEW.W}px`;
  canvas.style.height = `${VIEW.H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scale = Math.min(window.innerWidth / VIEW.W, window.innerHeight / VIEW.H);
  canvas.style.width = `${VIEW.W * scale}px`;
  canvas.style.height = `${VIEW.H * scale}px`;
}

window.addEventListener("resize", fit);
fit();

const cover = new Image();
cover.onload = () => {
  app.cover = cover;
};
cover.src = "assets/cover.jpg";

audio.setVolume(settings.volume);
audio.setMute(settings.mute);

function syncLive() {
  const match = app.match;
  let text = `Comet Curling Clash screen ${app.screen}`;
  if (match) {
    const scores = match.players.map((player) => player.score).join("-");
    const kinds = match.players.map((player) => player.kind).join(",");
    text += ` phase ${match.phase} end ${match.endIndex + 1}/${match.endsTotal} scores ${scores} players ${kinds}`;
    if (match.phase === "matchOver") {
      const names = (match.winners || []).map((player) => player.name).join("&") || "none";
      text += ` winner ${names} final ${scores}`;
    }
  }
  live.textContent = text;
}

function startMatch() {
  const seed = app.nextSeed || 1;
  app.nextSeed = (seed + 997) >>> 0;
  app.match = createMatch({
    seed,
    ends: app.settings.ends,
    kinds: app.kinds.slice(),
  });
  app.screen = "play";
  app.menuIndex = 0;
  app.celebrated = false;
  app.notice = "";
  audio.startMusic();
}

function go(screen, returnTo) {
  app.screen = screen;
  app.menuIndex = 0;
  app.listen = null;
  if (returnTo) app.returnTo = returnTo;
  audio.ui();
}

function edge(actions, name) {
  return actions.some((action) => action[name]);
}

function applySettingsChange(dir) {
  const row = app.menuIndex;
  if (row === 0) app.settings.volume = clamp(Math.round((app.settings.volume + dir * 0.1) * 10) / 10, 0, 1);
  if (row === 1) app.settings.ends = clamp(app.settings.ends + dir, 1, 9);
  audio.setVolume(app.settings.volume);
  saveSettings(app.settings);
}

function playEvents(events) {
  if (!events) return;
  if (events.launched) audio.launch();
  if (events.hits > 0) audio.hit();
  if (events.spun) audio.spin();
  if (events.beep) audio.countdown();
  if (events.pickups && events.pickups.length) audio.pickup();
  if (events.kos && events.kos.length) audio.ko();
  if (events.ended && !events.matchOver) audio.roundWin();
  if (events.matchOver && !app.celebrated) {
    app.celebrated = true;
    audio.roundWin();
    app.screen = "match";
    app.menuIndex = 0;
  }
}

function simStep(actions) {
  if (!app.match || app.screen !== "play") return;
  const events = stepMatch(app.match, actions);
  playEvents(events);
}

function update(frame, applyInput) {
  const { actions, connected, system } = frame;
  app.connected = connected;
  app.time += STEP;

  if (app.listen) {
    if (system.escape) {
      app.listen = null;
      return;
    }
    const code = system.pressed.find((entry) => entry !== "Escape");
    if (code && applyInput) {
      clearBindingConflicts(app.bindings, app.listen.player, app.listen.action, code);
      saveBindings(app.bindings);
      app.listen = null;
      audio.ui();
    }
    syncLive();
    return;
  }

  if (system.mute && applyInput) {
    app.settings.mute = !app.settings.mute;
    audio.setMute(app.settings.mute);
    saveSettings(app.settings);
  }

  if (app.screen === "title") {
    if (applyInput && edge(actions, "upPressed")) app.menuIndex = (app.menuIndex + 2) % 3;
    if (applyInput && edge(actions, "downPressed")) app.menuIndex = (app.menuIndex + 1) % 3;
    if (applyInput && (system.enter || system.padStart || edge(actions, "actionPressed"))) {
      const choice = ["join", "settings", "controls"][app.menuIndex];
      if (choice === "join") go("join");
      else go(choice, "title");
    }
  } else if (app.screen === "join") {
    if (applyInput) {
      for (let i = 0; i < 4; i++) {
        if (actions[i].actionPressed) app.kinds[i] = "human";
        else if (actions[i].secondaryPressed) {
          if (app.kinds[i] === "human") app.kinds[i] = "bot";
          else app.kinds[i] = app.kinds[i] === "bot" ? "off" : "bot";
        }
      }
      if (system.escape) go("title");
      else if (system.enter || system.padStart) {
        if (app.kinds.some((kind) => kind !== "off")) startMatch();
        else app.notice = "Need at least one player";
      }
    }
  } else if (app.screen === "settings") {
    const count = 4;
    if (applyInput && edge(actions, "upPressed")) app.menuIndex = (app.menuIndex + count - 1) % count;
    if (applyInput && edge(actions, "downPressed")) app.menuIndex = (app.menuIndex + 1) % count;
    if (applyInput && edge(actions, "leftPressed")) applySettingsChange(-1);
    if (applyInput && edge(actions, "rightPressed")) applySettingsChange(1);
    if (applyInput && (system.enter || edge(actions, "actionPressed"))) {
      if (app.menuIndex === 2) {
        app.settings.mute = !app.settings.mute;
        audio.setMute(app.settings.mute);
        saveSettings(app.settings);
      } else if (app.menuIndex === 3 || system.escape) {
        go(app.returnTo);
      }
    } else if (applyInput && system.escape) go(app.returnTo);
  } else if (app.screen === "controls") {
    const count = 8;
    if (applyInput && edge(actions, "upPressed")) app.menuIndex = (app.menuIndex + count - 1) % count;
    if (applyInput && edge(actions, "downPressed")) app.menuIndex = (app.menuIndex + 1) % count;
    if (applyInput && edge(actions, "leftPressed")) app.controlPlayer = (app.controlPlayer + 3) % 4;
    if (applyInput && edge(actions, "rightPressed")) app.controlPlayer = (app.controlPlayer + 1) % 4;
    if (applyInput && system.escape) go(app.returnTo);
    else if (applyInput && (system.enter || edge(actions, "actionPressed"))) {
      if (app.menuIndex < 6) {
        app.listen = { player: app.controlPlayer, action: ACTIONS[app.menuIndex] };
      } else if (app.menuIndex === 6) {
        app.bindings.splice(0, 4, ...cloneBindings(defaultBindings()));
        saveBindings(app.bindings);
        audio.ui();
      } else go(app.returnTo);
    }
  } else if (app.screen === "pause") {
    const count = 4;
    if (applyInput && edge(actions, "upPressed")) app.menuIndex = (app.menuIndex + count - 1) % count;
    if (applyInput && edge(actions, "downPressed")) app.menuIndex = (app.menuIndex + 1) % count;
    if (applyInput && (system.escape || system.padStart)) {
      app.screen = "play";
      audio.ui();
    } else if (applyInput && (system.enter || edge(actions, "actionPressed"))) {
      const choice = app.menuIndex;
      if (choice === 0) app.screen = "play";
      else if (choice === 1) go("settings", "pause");
      else if (choice === 2) go("controls", "pause");
      else {
        app.match = null;
        audio.stopMusic();
        go("title");
      }
    }
  } else if (app.screen === "match") {
    if (applyInput && edge(actions, "upPressed")) app.menuIndex = (app.menuIndex + 1) % 2;
    if (applyInput && edge(actions, "downPressed")) app.menuIndex = (app.menuIndex + 1) % 2;
    if (applyInput && (system.enter || system.padStart || edge(actions, "actionPressed"))) {
      if (app.menuIndex === 0) startMatch();
      else {
        app.match = null;
        audio.stopMusic();
        go("title");
      }
    }
  } else if (app.screen === "play") {
    if (applyInput && (system.escape || system.padStart)) {
      app.screen = "pause";
      app.menuIndex = 0;
      app.returnTo = "pause";
      audio.ui();
    } else {
      const playing = actions.map((action) => ({ ...action }));
      if (applyInput && system.enter && app.match && app.match.phase === "endReview") {
        playing[0].actionPressed = true;
      }
      simStep(playing);
      if (fast > 1 && app.screen === "play" && app.match && app.match.phase !== "matchOver") {
        for (let extra = 1; extra < fast; extra++) simStep(actions.map(() => ({
          left: false, right: false, up: false, down: false,
          leftPressed: false, rightPressed: false, upPressed: false, downPressed: false,
          action: false, actionPressed: false, actionReleased: false,
          secondary: false, secondaryPressed: false, pause: false,
        })));
      }
    }
  }
  syncLive();
}

let last = performance.now();
let acc = 0;

function frame(now) {
  acc += Math.min(250, now - last);
  last = now;
  let steps = 0;
  while (acc >= STEP && steps < 8) {
    const sample = input.consume();
    update(sample, true);
    acc -= STEP;
    steps += 1;
  }
  audio.setVolume(app.settings.volume);
  render(ctx, app);
  syncLive();
  requestAnimationFrame(frame);
}

window.__COMET = app;
syncLive();
render(ctx, app);

if (params.get("auto") === "1") {
  if (params.get("kinds")) {
    const kinds = params.get("kinds").split(",").map((kind) => (kind === "human" || kind === "off" ? kind : "bot"));
    while (kinds.length < 4) kinds.push("bot");
    app.kinds = kinds.slice(0, 4);
  }
  startMatch();
  syncLive();
}

requestAnimationFrame(frame);
