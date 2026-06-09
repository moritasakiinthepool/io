// input.js
// 押しっぱなし(down) と 押した瞬間(consume) を分ける入力ユーティリティ

export function createInput() {
  const downSet = new Set(); // 押されているキー
  const hitSet = new Set(); // 押された瞬間（1回だけ）
  let gamepadDownSet = new Set();
  let rawGamepadDownSet = new Set();
  let captureIgnoreGamepadSet = new Set();
  const rawGamepadHitSet = new Set();
  const gamepadIgnoreSet = new Set();
  let _locked = false;

  const GAMEPAD_BINDINGS_KEY = "ftld_gamepad_bindings_v2";
  const DEFAULT_GAMEPAD_BINDINGS = {
    z: [1],
    x: [0],
    c: [2, 7],
    s: [4],
    l: [5],
    v: [3],
    Enter: [9],
  };
  const GAMEPAD_BUTTON_LABELS = {
    0: "B",
    1: "A",
    2: "X",
    3: "Y",
    4: "L1",
    5: "R1",
    6: "L2",
    7: "R2",
    8: "SELECT",
    9: "START",
    10: "L3",
    11: "R3",
    12: "UP",
    13: "DOWN",
    14: "LEFT",
    15: "RIGHT",
  };

  function cloneDefaultBindings() {
    return Object.fromEntries(Object.entries(DEFAULT_GAMEPAD_BINDINGS).map(([key, value]) => [key, [...value]]));
  }

  function loadGamepadBindings() {
    try {
      const raw = localStorage.getItem(GAMEPAD_BINDINGS_KEY);
      if (!raw) return cloneDefaultBindings();
      const parsed = JSON.parse(raw);
      const bindings = cloneDefaultBindings();
      for (const key of Object.keys(bindings)) {
        if (Array.isArray(parsed?.[key])) {
          bindings[key] = parsed[key].map((n) => n | 0).filter((n) => n >= 0 && n <= 31);
        }
      }
      return bindings;
    } catch (_) {
      return cloneDefaultBindings();
    }
  }

  let gamepadBindings = loadGamepadBindings();

  function saveGamepadBindings() {
    try { localStorage.setItem(GAMEPAD_BINDINGS_KEY, JSON.stringify(gamepadBindings)); } catch (_) {}
  }

  function normKey(k) {
    if (k === "Z") return "z";
    if (k === "X") return "x";
    if (k === "C") return "c";
    if (k === "D") return "d";
    if (k === "S") return "s";
    if (k === "L") return "l";
    if (k === "V") return "v";
    return k;
  }

  function isArrowKey(k) {
    return k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight";
  }

  function isOurKey(k) {
    return isArrowKey(k) || k === "z" || k === "x" || k === "c" || k === "s" || k === "l" || k === "v";
  }

  function onKeyDown(e) {
    const k = normKey(e.key);
    if (!isOurKey(k)) return;
    e.preventDefault();
    if (!downSet.has(k)) hitSet.add(k);
    downSet.add(k);
  }

  function onKeyUp(e) {
    const k = normKey(e.key);
    if (!isOurKey(k)) return;
    downSet.delete(k);
  }

  function onBlur() {
    downSet.clear();
    hitSet.clear();
    gamepadDownSet.clear();
    rawGamepadDownSet.clear();
    captureIgnoreGamepadSet.clear();
    rawGamepadHitSet.clear();
    gamepadIgnoreSet.clear();
  }

  function addPadButton(keys, buttons, idx, key) {
    const b = buttons && buttons[idx];
    if (b && (b.pressed || b.value > 0.5)) keys.add(key);
  }

  function pollGamepads() {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;

    const keys = new Set();
    const rawButtons = new Set();
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      const buttons = pad.buttons || [];
      const axes = pad.axes || [];
      const ax0 = axes[0] || 0;
      const ax1 = axes[1] || 0;
      const DEAD = 0.45;

      for (let i = 0; i < buttons.length; i += 1) {
        const b = buttons[i];
        if (b && (b.pressed || b.value > 0.5)) rawButtons.add(i);
      }

      for (const [key, indexes] of Object.entries(gamepadBindings)) {
        for (const idx of indexes) addPadButton(keys, buttons, idx, key);
      }
      addPadButton(keys, buttons, 12, "ArrowUp");
      addPadButton(keys, buttons, 13, "ArrowDown");
      addPadButton(keys, buttons, 14, "ArrowLeft");
      addPadButton(keys, buttons, 15, "ArrowRight");

      if (ax0 <= -DEAD) keys.add("ArrowLeft");
      if (ax0 >= DEAD) keys.add("ArrowRight");
      if (ax1 <= -DEAD) keys.add("ArrowUp");
      if (ax1 >= DEAD) keys.add("ArrowDown");
    }

    for (const idx of rawButtons) {
      if (captureIgnoreGamepadSet.has(idx)) continue;
      if (!rawGamepadDownSet.has(idx)) rawGamepadHitSet.add(idx);
    }
    for (const idx of captureIgnoreGamepadSet) {
      if (!rawButtons.has(idx)) captureIgnoreGamepadSet.delete(idx);
    }
    rawGamepadDownSet = rawButtons;

    const nextDown = new Set();
    for (const key of keys) {
      if (gamepadIgnoreSet.has(key)) continue;
      nextDown.add(key);
      if (!gamepadDownSet.has(key)) hitSet.add(key);
    }
    for (const key of gamepadIgnoreSet) {
      if (!keys.has(key)) gamepadIgnoreSet.delete(key);
    }
    gamepadDownSet = nextDown;
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp, { passive: false });
  window.addEventListener("blur", onBlur);

  return {
    lock()   {
      pollGamepads();
      for (const key of gamepadDownSet) gamepadIgnoreSet.add(key);
      _locked = true;
      downSet.clear();
      hitSet.clear();
      gamepadDownSet.clear();
      rawGamepadHitSet.clear();
    },
    unlock() { _locked = false; },
    isLocked() { return _locked; },
    down(key) {
      if (_locked) return false;
      pollGamepads();
      const k = normKey(key);
      return downSet.has(k) || gamepadDownSet.has(k);
    },
    consume(key) {
      if (_locked) return false;
      pollGamepads();
      const k = normKey(key);
      if (hitSet.has(k)) {
        hitSet.delete(k);
        return true;
      }
      return false;
    },
    consumeGamepadButton() {
      if (_locked) return null;
      pollGamepads();
      const idx = rawGamepadHitSet.values().next().value;
      if (idx == null) return null;
      rawGamepadHitSet.delete(idx);
      return idx | 0;
    },
    beginGamepadCapture() {
      pollGamepads();
      captureIgnoreGamepadSet = new Set(rawGamepadDownSet);
      rawGamepadHitSet.clear();
    },
    getGamepadBindings() {
      return Object.fromEntries(Object.entries(gamepadBindings).map(([key, value]) => [key, [...value]]));
    },
    setGamepadBinding(key, buttonIndex) {
      const k = normKey(key);
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_GAMEPAD_BINDINGS, k)) return;
      const btn = buttonIndex | 0;
      const prev = gamepadBindings[k] || [];
      for (const bindKey of Object.keys(gamepadBindings)) {
        gamepadBindings[bindKey] = (gamepadBindings[bindKey] || []).filter((idx) => idx !== btn);
      }
      gamepadBindings[k] = [btn];
      const fallbackKey = Object.keys(gamepadBindings).find((bindKey) => bindKey !== k && !(gamepadBindings[bindKey] || []).length);
      if (fallbackKey && prev.length) gamepadBindings[fallbackKey] = [...prev];
      saveGamepadBindings();
      rawGamepadHitSet.clear();
    },
    resetGamepadBindings() {
      gamepadBindings = cloneDefaultBindings();
      saveGamepadBindings();
      rawGamepadHitSet.clear();
    },
    gamepadButtonLabel(idx) {
      return GAMEPAD_BUTTON_LABELS[idx | 0] || `B${idx | 0}`;
    },
    // タッチ用：押し始め
    press(key) {
      if (_locked) return;
      const k = normKey(key);
      if (!downSet.has(k)) hitSet.add(k);
      downSet.add(k);
    },
    // タッチ用：離した
    release(key) {
      downSet.delete(normKey(key));
    },
    clear() {
      pollGamepads();
      for (const key of gamepadDownSet) gamepadIgnoreSet.add(key);
      downSet.clear();
      hitSet.clear();
      gamepadDownSet.clear();
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      downSet.clear();
      hitSet.clear();
      gamepadDownSet.clear();
      rawGamepadDownSet.clear();
      captureIgnoreGamepadSet.clear();
      rawGamepadHitSet.clear();
      gamepadIgnoreSet.clear();
    },
  };
}
