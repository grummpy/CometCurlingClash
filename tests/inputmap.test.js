import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultBindings,
  actionsFromKeyboard,
  gamepadToAction,
  gamepadSnapshot,
  combinePlayerActions,
  clearBindingConflicts,
  blankAction,
} from "../src/core/inputmap.js";

test("default keyboard bindings match the four-player split", () => {
  const [p1, p2, p3, p4] = defaultBindings();
  assert.deepEqual(p1, { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", action: "KeyF", secondary: "KeyG" });
  assert.deepEqual(p2, { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", action: "Slash", secondary: "Period" });
  assert.deepEqual(p3, { left: "KeyJ", right: "KeyL", up: "KeyI", down: "KeyK", action: "Semicolon", secondary: "Quote" });
  assert.deepEqual(p4, { left: "Numpad4", right: "Numpad6", up: "Numpad8", down: "Numpad5", action: "Numpad0", secondary: "NumpadEnter" });
});

test("keyboard edges map to the owning player", () => {
  const bindings = defaultBindings();
  const held = new Set(["KeyD", "ArrowUp", "KeyF"]);
  const pressed = ["KeyF", "Semicolon", "NumpadEnter", "Numpad6"];
  const released = ["KeyG"];
  const actions = actionsFromKeyboard(held, pressed, released, bindings);
  assert.equal(actions[0].right, true);
  assert.equal(actions[0].action, true);
  assert.equal(actions[0].actionPressed, true);
  assert.equal(actions[0].actionReleased, false);
  assert.equal(actions[1].up, true);
  assert.equal(actions[1].upPressed, false);
  assert.equal(actions[2].actionPressed, true);
  assert.equal(actions[3].secondaryPressed, true);
  assert.equal(actions[3].rightPressed, true);
  assert.equal(actions[3].right, false);
});

test("gamepad stick, d-pad, A, B, and Start map to actions", () => {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  buttons[0] = { pressed: true };
  buttons[1] = { pressed: true };
  buttons[9] = { pressed: true };
  buttons[14] = { pressed: true };
  const pad = { axes: [0.8, -0.9], buttons };
  const first = gamepadToAction(pad, null);
  assert.equal(first.right, true);
  assert.equal(first.up, true);
  assert.equal(first.left, true);
  assert.equal(first.actionPressed, true);
  assert.equal(first.secondaryPressed, true);
  assert.equal(first.pause, true);
  const second = gamepadToAction(pad, gamepadSnapshot(pad));
  assert.equal(second.action, true);
  assert.equal(second.actionPressed, false);
  assert.equal(second.actionReleased, false);
  assert.equal(second.pause, false);
  buttons[0] = { pressed: false };
  const released = gamepadToAction(pad, gamepadSnapshot({ axes: pad.axes, buttons: buttons.map((button, index) => ({ pressed: index === 0 ? true : button.pressed })) }));
  assert.equal(released.actionReleased, true);
});

test("a connected gamepad overrides that player's keyboard", () => {
  const keyboard = [blankAction(), blankAction(), blankAction(), blankAction()];
  keyboard[0].right = true;
  keyboard[0].actionPressed = true;
  keyboard[1].left = true;
  const pads = [blankAction(), blankAction(), blankAction(), blankAction()];
  pads[0].left = true;
  pads[0].secondaryPressed = true;
  const combined = combinePlayerActions(keyboard, pads, [true, false, false, false]);
  assert.equal(combined[0].left, true);
  assert.equal(combined[0].right, false);
  assert.equal(combined[0].actionPressed, false);
  assert.equal(combined[0].secondaryPressed, true);
  assert.equal(combined[1].left, true);
});

test("rebinding a key clears it from other actions", () => {
  const bindings = defaultBindings();
  clearBindingConflicts(bindings, 0, "action", "ArrowLeft");
  assert.equal(bindings[0].action, "ArrowLeft");
  assert.equal(bindings[1].left, "");
  assert.equal(bindings[0].left, "KeyA");
});
