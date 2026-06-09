import { playConfirm, playCursor, playTypingVoice } from "./se.js?v=20260609-3";

const FONT_SIZE = 10;
const CHAR_MS = 60;

export function createChoice({ width, height, input }) {
  const rect = {
    x: 8,
    y: height - 55 - 8,
    w: width - 16,
    h: 55,
  };

  let active = false;
  let cursor = 0;
  let onSelect = null;
  let question = "";
  let charIndex = 0;
  let lastCharMs = 0;
  const options = ["はい", "いいえ"];

  function open(questionText, callback) {
    active = true;
    cursor = 0;
    question = String(questionText);
    charIndex = 0;
    lastCharMs = performance.now();
    onSelect = typeof callback === "function" ? callback : null;
    input.clear();
  }

  function close(index) {
    active = false;
    question = "";
    charIndex = 0;
    const callback = onSelect;
    onSelect = null;
    input.clear();
    if (callback) callback(index);
  }

  function isActive() {
    return active;
  }

  function isTypingDone() {
    return charIndex >= question.length;
  }

  function update(now) {
    if (!active) return;

    if (!isTypingDone()) {
      const add = Math.floor((now - lastCharMs) / CHAR_MS);
      if (add > 0) {
        charIndex = Math.min(question.length, charIndex + add);
        lastCharMs += add * CHAR_MS;
        if (!isTypingDone()) playTypingVoice();
      }
      if (input.consume("z")) {
        playConfirm();
        charIndex = question.length;
      }
      return;
    }

    const previous = cursor;
    if (input.consume("ArrowLeft") || input.consume("ArrowUp")) cursor = 0;
    if (input.consume("ArrowRight") || input.consume("ArrowDown")) cursor = 1;
    if (cursor !== previous) playCursor();

    if (input.consume("z")) {
      playConfirm();
      close(cursor);
    } else if (input.consume("x")) {
      playConfirm();
      close(1);
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

    ctx.font = `${FONT_SIZE}px PixelMplus10, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#fff";
    ctx.fillText(
      question.slice(0, charIndex),
      Math.round(rect.x + 10),
      Math.round(rect.y + 9),
    );

    if (!isTypingDone()) {
      ctx.restore();
      return;
    }

    const padding = 6;
    const gap = 16;
    const widths = options.map((option) => Math.ceil(ctx.measureText(option).width));
    const boxWidths = widths.map((widthValue) => widthValue + padding * 2);
    const totalWidth = boxWidths[0] + gap + boxWidths[1];
    let x = Math.round(rect.x + (rect.w - totalWidth) / 2);
    const y = Math.round(rect.y + 27);

    options.forEach((option, index) => {
      if (index === cursor) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(x, y - 1, boxWidths[index], 13);
        ctx.fillStyle = "#000";
      } else {
        ctx.fillStyle = "#fff";
      }
      ctx.fillText(option, Math.round(x + padding), y);
      x += boxWidths[index] + gap;
    });
    ctx.restore();
  }

  return { open, isActive, update, draw };
}
