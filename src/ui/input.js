import {
  actionsFromKeyboard,
  gamepadToAction,
  gamepadSnapshot,
  combinePlayerActions,
} from "../core/inputmap.js";

export function createInput(getBindings) {
  const held = new Set();
  let pressed = [];
  let released = [];
  const previousPads = [null, null, null, null];

  function onKeyDown(event) {
    if (event.repeat) return;
    const block = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Slash", "Quote", "Semicolon"];
    if (block.includes(event.code)) event.preventDefault();
    held.add(event.code);
    pressed.push(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
    released.push(event.code);
  }

  function onBlur() {
    held.clear();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  function pollPads() {
    let source = [];
    try {
      source = navigator.getGamepads ? navigator.getGamepads() : [];
    } catch {
      source = [];
    }
    const connected = [false, false, false, false];
    const actions = [];
    for (let i = 0; i < 4; i++) {
      const pad = source && source[i];
      if (!pad || !pad.connected) {
        previousPads[i] = null;
        connected[i] = false;
        actions[i] = gamepadToAction(null, null);
        continue;
      }
      connected[i] = true;
      actions[i] = gamepadToAction(pad, previousPads[i]);
      previousPads[i] = gamepadSnapshot(pad);
    }
    return { connected, actions };
  }

  return {
    consume() {
      const keyboard = actionsFromKeyboard(held, pressed, released, getBindings());
      const pads = pollPads();
      const actions = combinePlayerActions(keyboard, pads.actions, pads.connected);
      const codes = pressed.slice();
      const system = {
        enter: codes.includes("Enter") || codes.includes("Space"),
        escape: codes.includes("Escape"),
        mute: codes.includes("KeyM"),
        padStart: actions.some((action) => action.pause),
        pressed: codes,
      };
      pressed = [];
      released = [];
      return { actions, connected: pads.connected, system };
    },
  };
}
