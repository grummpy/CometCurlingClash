import { defaultBindings, cloneBindings, ACTIONS } from "../core/inputmap.js";

const SETTINGS_KEY = "cometcurlingclash.settings";
const BINDINGS_KEY = "cometcurlingclash.bindings";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function defaultSettings() {
  return { volume: 0.8, mute: false, ends: 6 };
}

export function loadSettings() {
  const defaults = defaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      volume: clamp(Number(parsed.volume ?? defaults.volume), 0, 1),
      mute: !!parsed.mute,
      ends: clamp(parseInt(parsed.ends ?? defaults.ends, 10) || defaults.ends, 1, 9),
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private mode and blocked storage still leave the in-memory settings usable.
  }
}

function bindingsLookValid(value) {
  if (!Array.isArray(value) || value.length !== 4) return false;
  return value.every((row) => row && ACTIONS.every((name) => typeof row[name] === "string"));
}

export function loadBindings() {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (!raw) return cloneBindings(defaultBindings());
    const parsed = JSON.parse(raw);
    if (!bindingsLookValid(parsed)) return cloneBindings(defaultBindings());
    return parsed;
  } catch {
    return cloneBindings(defaultBindings());
  }
}

export function saveBindings(bindings) {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(bindings));
  } catch {
    // Ignore quota and privacy errors.
  }
}
