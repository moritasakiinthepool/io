// mobile_controller.js
export function setupMobileController(input, {
  onUserGesture = null,
  onCapture = null,
} = {}) {
  const style = document.createElement("style");
  style.textContent = `
    body {
      background: #1a1a1a;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    #screen-wrap {
      width: 100%;
      max-width: 480px;
      background: #000;
      padding: 20px 0;
    }

    #c {
      display: block;
      width: 100% !important;
      height: auto !important;
      max-width: 480px;
    }

    #mobile-ctrl {
      position: relative;
      width: 100%;
      max-width: 480px;
      background: #2e2e2e;
      box-sizing: border-box;
      padding: 36px 24px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      border-radius: 0;
      box-shadow: inset 0 4px 12px rgba(0,0,0,0.4);
    }

    #mobile-ctrl .row-main {
      display: flex;
      width: 100%;
      justify-content: space-between;
      align-items: center;
      padding: 0 8px;
    }

    /* ---- スティック ---- */
    .stick-wrap {
      position: relative;
      width: 130px;
      height: 130px;
      flex-shrink: 0;
    }
    .stick-base {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: #1a1a1a;
      box-shadow: 0 4px 0 #0a0a0a, inset 0 2px 6px rgba(0,0,0,0.6);
    }
    .stick-knob {
      position: absolute;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: radial-gradient(circle at 38% 35%, #555, #222);
      box-shadow: 0 4px 0 #0a0a0a;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      transition: transform 0.05s;
    }

    /* ---- A/B/C ---- */
    .ab-group {
      display: grid;
      grid-template-columns: repeat(2, 58px);
      grid-template-rows: repeat(2, 58px);
      gap: 10px;
      align-items: center;
      justify-items: center;
      flex-shrink: 0;
    }
    .btn-ab {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      border: none;
      background: #1a1a1a;
      color: #aaa;
      font-size: 15px;
      font-weight: bold;
      font-family: sans-serif;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 5px 0 #0a0a0a;
      -webkit-tap-highlight-color: transparent;
      touch-action: none;
    }
    .btn-ab:active, .btn-ab.pressed {
      box-shadow: 0 1px 0 #0a0a0a;
      transform: translateY(4px);
      background: #333;
    }
    .btn-ab.btn-c {
      grid-column: 2;
      grid-row: 2;
    }
    .btn-ab.btn-b {
      grid-column: 1;
      grid-row: 2;
    }
    .btn-ab.btn-a {
      grid-column: 1 / 3;
      grid-row: 1;
    }

    /* ---- 下段 ---- */
    .row-bottom {
      display: flex;
      gap: 20px;
      margin-top: 28px;
      transform: translateY(14px);
      align-items: center;
    }
    .btn-debug {
      width: 36px;
      height: 20px;
      border-radius: 6px;
      border: none;
      background: #111;
      color: #666;
      font-size: 10px;
      font-family: sans-serif;
      cursor: pointer;
      box-shadow: 0 2px 0 #0a0a0a;
      -webkit-tap-highlight-color: transparent;
      touch-action: none;
    }
    .btn-debug:active, .btn-debug.pressed {
      box-shadow: 0 1px 0 #0a0a0a;
      transform: translateY(1px);
      background: #222;
    }
    .btn-small {
      width: 72px;
      height: 26px;
      border-radius: 13px;
      border: none;
      background: #1a1a1a;
      color: #aaa;
      font-size: 11px;
      font-family: sans-serif;
      letter-spacing: 0.5px;
      cursor: pointer;
      box-shadow: 0 3px 0 #0a0a0a;
      -webkit-tap-highlight-color: transparent;
      touch-action: none;
    }
    .btn-small:active, .btn-small.pressed {
      box-shadow: 0 1px 0 #0a0a0a;
      transform: translateY(2px);
      background: #333;
    }
    .btn-icon {
      width: 36px;
      height: 20px;
      border-radius: 6px;
      border: none;
      background: #111;
      color: #666;
      cursor: pointer;
      box-shadow: 0 2px 0 #0a0a0a;
      -webkit-tap-highlight-color: transparent;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 0;
    }
    .btn-icon:active, .btn-icon.pressed {
      box-shadow: 0 1px 0 #0a0a0a;
      transform: translateY(1px);
      background: #222;
    }
    .btn-icon .play {
      width: 0;
      height: 0;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      border-left: 7px solid #777;
      margin-left: 1px;
    }
    .btn-icon .pause {
      position: relative;
      width: 7px;
      height: 8px;
    }
    .btn-icon .pause::before,
    .btn-icon .pause::after {
      content: "";
      position: absolute;
      top: 0;
      width: 2px;
      height: 8px;
      background: #777;
    }
    .btn-icon .pause::before { left: 0; }
    .btn-icon .pause::after  { right: 0; }

    .btn-camera {
      position: absolute;
      right: 22px;
      bottom: 14px;
      width: 42px;
      height: 30px;
      border-radius: 8px;
      border: none;
      background: #111;
      color: #777;
      cursor: pointer;
      box-shadow: 0 3px 0 #0a0a0a;
      -webkit-tap-highlight-color: transparent;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .btn-camera:active, .btn-camera.pressed {
      box-shadow: 0 1px 0 #0a0a0a;
      transform: translateY(2px);
      background: #222;
    }
    .camera-icon {
      position: relative;
      width: 20px;
      height: 14px;
      border: 2px solid #777;
      border-radius: 3px;
      box-sizing: border-box;
    }
    .camera-icon::before {
      content: "";
      position: absolute;
      left: 3px;
      top: -5px;
      width: 8px;
      height: 4px;
      border-radius: 2px 2px 0 0;
      background: #777;
    }
    .camera-icon::after {
      content: "";
      position: absolute;
      left: 5px;
      top: 2px;
      width: 6px;
      height: 6px;
      border: 2px solid #777;
      border-radius: 50%;
      box-sizing: border-box;
    }
  `;
  document.head.appendChild(style);

  // canvas を screen-wrap で包む
  const canvas = document.getElementById("c");
  const wrap = document.createElement("div");
  wrap.id = "screen-wrap";
  canvas.parentNode.insertBefore(wrap, canvas);
  wrap.appendChild(canvas);

  const ctrl = document.createElement("div");
  ctrl.id = "mobile-ctrl";
  ctrl.innerHTML = `
    <div class="row-main">
      <div class="stick-wrap" id="stick-wrap">
        <div class="stick-base"></div>
        <div class="stick-knob" id="stick-knob"></div>
      </div>
      <div class="ab-group">
        <button class="btn-ab btn-a" data-key="z">A</button>
        <button class="btn-ab btn-b" data-key="x">B</button>
        <button class="btn-ab btn-c" data-key="c">C</button>
      </div>
    </div>
    <div class="row-bottom">
      <button class="btn-small" data-key-tap="s">SAVE</button>
      <button class="btn-small" data-key-tap="l">LOAD</button>
    </div>
    <button class="btn-camera" id="mobile-capture" aria-label="screenshot">
      <span class="camera-icon" aria-hidden="true"></span>
    </button>
  `;
  document.body.appendChild(ctrl);

  // ---- 振動 ----
  function vibrate(ms = 10) {
    try { navigator.vibrate?.(ms); } catch (_) {}
  }
  function wakeAudio() {
    if (typeof onUserGesture === "function") onUserGesture();
  }

  // ---- スティック ロジック ----
  const stickWrap = ctrl.querySelector("#stick-wrap");
  const stickKnob = ctrl.querySelector("#stick-knob");
  const RADIUS    = 65;   // ベース半径 (px)
  const DEAD      = 18;   // デッドゾーン (px)
  const CLAMP     = 38;   // ノブの最大移動量 (px)

  let stickActive = false;
  let stickTouchId = null;
  let currentKeys = new Set();

  function setKeys(keys) {
    // 新しく押すキー
    for (const k of keys) {
      if (!currentKeys.has(k)) input.press(k);
    }
    // 離すキー
    for (const k of currentKeys) {
      if (!keys.has(k)) input.release(k);
    }
    currentKeys = new Set(keys);
  }

  function onStickMove(cx, cy, touch) {
    const rect = stickWrap.getBoundingClientRect();
    const ox   = rect.left + rect.width  / 2;
    const oy   = rect.top  + rect.height / 2;
    const dx   = touch.clientX - ox;
    const dy   = touch.clientY - oy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // ノブ位置
    const clampedDist = Math.min(dist, CLAMP);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    stickKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

    // 方向判定（8方向）
    const keys = new Set();
    if (dist >= DEAD) {
      const deg = (angle * 180 / Math.PI + 360) % 360;
      if (deg >= 337.5 || deg < 22.5)   keys.add("ArrowRight");
      else if (deg < 67.5)               { keys.add("ArrowRight"); keys.add("ArrowDown"); }
      else if (deg < 112.5)              keys.add("ArrowDown");
      else if (deg < 157.5)              { keys.add("ArrowLeft");  keys.add("ArrowDown"); }
      else if (deg < 202.5)              keys.add("ArrowLeft");
      else if (deg < 247.5)              { keys.add("ArrowLeft");  keys.add("ArrowUp"); }
      else if (deg < 292.5)              keys.add("ArrowUp");
      else if (deg < 337.5)              { keys.add("ArrowRight"); keys.add("ArrowUp"); }
    }
    setKeys(keys);
  }

  function onStickEnd() {
    stickKnob.style.transform = "translate(-50%, -50%)";
    setKeys(new Set());
    stickActive = false;
    stickTouchId = null;
  }

  function findTouchById(touchList, id) {
    for (let i = 0; i < touchList.length; i++) {
      if (touchList[i].identifier === id) return touchList[i];
    }
    return null;
  }

  stickWrap.addEventListener("touchstart", e => {
    e.preventDefault();
    if (stickTouchId != null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    stickTouchId = t.identifier;
    stickActive = true;
    wakeAudio();
    vibrate(8);
    onStickMove(0, 0, t);
  }, { passive: false });

  stickWrap.addEventListener("touchmove", e => {
    e.preventDefault();
    wakeAudio();
    if (!stickActive || stickTouchId == null) return;
    const t = findTouchById(e.touches, stickTouchId);
    if (t) onStickMove(0, 0, t);
  }, { passive: false });

  function endStickIfMatched(e) {
    e.preventDefault();
    if (stickTouchId == null) return;
    if (findTouchById(e.changedTouches, stickTouchId)) onStickEnd();
  }
  stickWrap.addEventListener("touchend",    endStickIfMatched, { passive: false });
  stickWrap.addEventListener("touchcancel", endStickIfMatched, { passive: false });

  // マウスフォールバック
  stickWrap.addEventListener("mousedown", e => {
    stickActive = true;
    wakeAudio();
    onStickMove(0, 0, e);
    const move = ev => { if (stickActive) onStickMove(0, 0, ev); };
    const up   = ()  => { onStickEnd(); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup",   up);
  });

  // ---- A/B/C ボタン ----
  ctrl.querySelectorAll("[data-key]").forEach(btn => {
    const key = btn.dataset.key;
    const press   = e => { e.preventDefault(); wakeAudio(); btn.classList.add("pressed"); vibrate(12); input.press(key); };
    const release = e => { e.preventDefault(); btn.classList.remove("pressed"); input.release(key); };
    btn.addEventListener("touchstart",  press,   { passive: false });
    btn.addEventListener("touchend",    release, { passive: false });
    btn.addEventListener("touchcancel", release, { passive: false });
    btn.addEventListener("mousedown",  press);
    btn.addEventListener("mouseup",    release);
    btn.addEventListener("mouseleave", release);
  });

  // ---- SAVE/LOAD ----
  ctrl.querySelectorAll("[data-key-tap]").forEach(btn => {
    const key = btn.dataset.keyTap;
    const tap = e => {
      e.preventDefault();
      wakeAudio();
      btn.classList.add("pressed");
      vibrate(15);
      input.press(key);
      setTimeout(() => { input.release(key); btn.classList.remove("pressed"); }, 80);
    };
    btn.addEventListener("touchstart", tap, { passive: false });
    btn.addEventListener("mousedown",  tap);
  });

  const captureBtn = ctrl.querySelector("#mobile-capture");
  if (captureBtn) {
    const capture = e => {
      e.preventDefault();
      wakeAudio();
      captureBtn.classList.add("pressed");
      vibrate(12);
      if (typeof onCapture === "function") onCapture();
      setTimeout(() => { captureBtn.classList.remove("pressed"); }, 90);
    };
    captureBtn.addEventListener("touchstart", capture, { passive: false });
    captureBtn.addEventListener("mousedown", capture);
  }
}
