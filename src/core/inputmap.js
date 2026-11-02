// Keyboard split for four local players, plus a standard gamepad mapping.
// A connected pad overrides that player's keyboard bindings.

export const ACTIONS = ["left", "right", "up", "down", "action", "secondary"];

export function blankAction() {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    leftPressed: false,
    rightPressed: false,
    upPressed: false,
    downPressed: false,
    action: false,
    actionPressed: false,
    actionReleased: false,
    secondary: false,
    secondaryPressed: false,
    pause: false,
  };
}

export function defaultBindings() {
  return [
    { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", action: "KeyF", secondary: "KeyG" },
    { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", action: "Slash", secondary: "Period" },
    { left: "KeyJ", right: "KeyL", up: "KeyI", down: "KeyK", action: "Semicolon", secondary: "Quote" },
    { left: "Numpad4", right: "Numpad6", up: "Numpad8", down: "Numpad5", action: "Numpad0", secondary: "NumpadEnter" },
  ];
}

export function cloneBindings(bindings) {
  return bindings.map((row) => ({ ...row }));
}

function edge(list, code) {
  return !!(code && list && list.includes(code));
}

export function actionsFromKeyboard(held, pressed, released, bindings) {
  const rows = bindings || defaultBindings();
  const actions = [0, 1, 2, 3].map(() => blankAction());
  for (let i = 0; i < 4; i++) {
    const bind = rows[i];
    const action = actions[i];
    if (!bind) continue;
    for (const name of ["left", "right", "up", "down", "action", "secondary"]) {
      const code = bind[name];
      if (held && held.has(code)) action[name] = true;
      if (name === "left" || name === "right" || name === "up" || name === "down") {
        if (edge(pressed, code)) action[`${name}Pressed`] = true;
      }
    }
    if (edge(pressed, bind.action)) action.actionPressed = true;
    if (edge(released, bind.action)) action.actionReleased = true;
    if (edge(pressed, bind.secondary)) action.secondaryPressed = true;
  }
  return actions;
}

function buttonDown(pad, index) {
  const button = pad.buttons?.[index];
  if (!button) return false;
  if (typeof button === "boolean") return button;
  return !!button.pressed;
}

export function gamepadToAction(pad, previous) {
  const action = blankAction();
  if (!pad) return action;
  const prevButtons = previous?.buttons || [];
  const prevX = previous?.x ?? 0;
  const prevY = previous?.y ?? 0;
  const axisX = pad.axes?.[0] ?? 0;
  const axisY = pad.axes?.[1] ?? 0;
  const dead = 0.45;
  const left = axisX < -dead || buttonDown(pad, 14);
  const right = axisX > dead || buttonDown(pad, 15);
  const up = axisY < -dead || buttonDown(pad, 12);
  const down = axisY > dead || buttonDown(pad, 13);
  action.left = left;
  action.right = right;
  action.up = up;
  action.down = down;
  const wasLeft = prevX < -dead || !!prevButtons[14];
  const wasRight = prevX > dead || !!prevButtons[15];
  const wasUp = prevY < -dead || !!prevButtons[12];
  const wasDown = prevY > dead || !!prevButtons[13];
  action.leftPressed = left && !wasLeft;
  action.rightPressed = right && !wasRight;
  action.upPressed = up && !wasUp;
  action.downPressed = down && !wasDown;

  const a = buttonDown(pad, 0);
  const b = buttonDown(pad, 1);
  const start = buttonDown(pad, 9);
  action.action = a;
  action.actionPressed = a && !prevButtons[0];
  action.actionReleased = !a && !!prevButtons[0];
  action.secondary = b;
  action.secondaryPressed = b && !prevButtons[1];
  action.pause = start && !prevButtons[9];
  return action;
}

export function gamepadSnapshot(pad) {
  const buttons = [];
  const count = pad?.buttons?.length || 16;
  for (let i = 0; i < count; i++) buttons[i] = buttonDown(pad, i);
  return {
    buttons,
    x: pad?.axes?.[0] ?? 0,
    y: pad?.axes?.[1] ?? 0,
  };
}

// connected[i] replaces that player's keyboard actions with the pad actions.
export function combinePlayerActions(keyboardActions, gamepadActions, connected) {
  const combined = [];
  for (let i = 0; i < 4; i++) {
    combined[i] = connected && connected[i]
      ? (gamepadActions[i] || blankAction())
      : (keyboardActions[i] || blankAction());
  }
  return combined;
}

export function clearBindingConflicts(bindings, owner, actionName, code) {
  for (let p = 0; p < bindings.length; p++) {
    for (const name of ACTIONS) {
      if (p === owner && name === actionName) continue;
      if (bindings[p][name] === code) bindings[p][name] = "";
    }
  }
  bindings[owner][actionName] = code;
}

export const KEY_LABELS = {
  KeyA: "A", KeyB: "B", KeyC: "C", KeyD: "D", KeyE: "E", KeyF: "F", KeyG: "G",
  KeyH: "H", KeyI: "I", KeyJ: "J", KeyK: "K", KeyL: "L", KeyM: "M", KeyN: "N",
  KeyO: "O", KeyP: "P", KeyQ: "Q", KeyR: "R", KeyS: "S", KeyT: "T", KeyU: "U",
  KeyV: "V", KeyW: "W", KeyX: "X", KeyY: "Y", KeyZ: "Z",
  ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down",
  Slash: "/", Period: ".", Semicolon: ";", Quote: "'",
  Numpad0: "Num 0", Numpad1: "Num 1", Numpad2: "Num 2", Numpad3: "Num 3",
  Numpad4: "Num 4", Numpad5: "Num 5", Numpad6: "Num 6", Numpad7: "Num 7",
  Numpad8: "Num 8", Numpad9: "Num 9", NumpadEnter: "Num Enter",
  Space: "Space", Enter: "Enter", Escape: "Esc",
  ShiftLeft: "L Shift", ShiftRight: "R Shift",
};

export function labelForCode(code) {
  if (!code) return "—";
  return KEY_LABELS[code] || code.replace(/^Key/, "").replace(/^Digit/, "");
}
