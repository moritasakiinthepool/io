import { playConfirm, playTypingVoice } from "./se.js?v=20260609-3";

const CHAR_MS = 60;
const PUNCT_MS = 360;
const FONT_SIZE = 10;

export function createDialog({ width, height, input }) {
  const rect = {
    x: 8,
    y: height - 55 - 8,
    w: width - 16,
    h: 55,
  };

  let active = false;
  let text = "";
  let charIndex = 0;
  let lastCharMs = 0;
  let onClose = null;

  function open(message, callback = null) {
    active = true;
    text = String(message);
    charIndex = 0;
    lastCharMs = performance.now();
    onClose = typeof callback === "function" ? callback : null;
    input.clear();
  }

  function isActive() {
    return active;
  }

  function isTypingDone() {
    return charIndex >= text.length;
  }

  function charDelay(character) {
    return "、。？！".includes(character) ? PUNCT_MS : CHAR_MS;
  }

  function update(now) {
    if (!active) return;

    let added = 0;
    while (!isTypingDone()) {
      const previous = charIndex > 0 ? text[charIndex - 1] : "";
      const delay = charDelay(previous);
      if (now - lastCharMs < delay) break;
      charIndex += 1;
      lastCharMs += delay;
      added += 1;
    }
    if (added > 0 && !isTypingDone()) playTypingVoice();

    if (input.consume("z")) {
      playConfirm();
      if (!isTypingDone()) charIndex = text.length;
      else {
        active = false;
        const callback = onClose;
        onClose = null;
        input.clear();
        if (callback) callback();
      }
    }
  }

  function draw(ctx) {
    if (!active) return;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(rect.x + 3, rect.y + 3, rect.w, rect.h);

    ctx.fillStyle = "#000";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillRect(rect.x - 1, rect.y - 1, rect.w + 2, 1);
    ctx.fillRect(rect.x - 1, rect.y + rect.h, rect.w + 2, 1);
    ctx.fillRect(rect.x - 1, rect.y - 1, 1, rect.h + 2);
    ctx.fillRect(rect.x + rect.w, rect.y - 1, 1, rect.h + 2);

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);

    ctx.fillStyle = "#fff";
    ctx.font = `${FONT_SIZE}px PixelMplus10, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const textX = Math.round(rect.x + 10);
    const textY = Math.round(rect.y + 9);
    const visibleLines = text.slice(0, charIndex).split("\n");
    visibleLines.forEach((line, index) => {
      ctx.fillText(line, textX, Math.round(textY + index * 14));
    });

    if (isTypingDone()) {
      const tx = rect.x + rect.w - 10;
      const ty = rect.y + rect.h - 10;
      ctx.beginPath();
      ctx.moveTo(tx - 4, ty);
      ctx.lineTo(tx + 4, ty);
      ctx.lineTo(tx, ty + 5);
      ctx.closePath();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    ctx.restore();
  }

  return { open, isActive, update, draw };
}
