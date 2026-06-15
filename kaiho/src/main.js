import { createChoice } from "./choice.js?v=20260609-3";
import { createDialog } from "./dialog.js?v=20260609-3";
import { createInput } from "./input.js?v=20260609-3";
import { setupMobileController } from "./mobile_controller.js?v=20260609-3";
import { playPuyoStep, unlockAudio } from "./se.js?v=20260609-3";

const canvas = document.querySelector("#c");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const WIDTH = 192;
const HEIGHT = 180;
const SPRITE_SIZE = 16;
const CHARACTER_SCALE = 2;
const CHARACTER_SIZE = SPRITE_SIZE * CHARACTER_SCALE;
const FONT_SIZE = 10;
const WAIT_MS = 2000;
const FRAME_MS = 180;
const SPEED = 60;
const DIALOG_WAIT_MS = 1000;
const EXIT_WAIT_MS = 1000;
const START_X = -CHARACTER_SIZE;
const STOP_X = Math.floor((WIDTH - CHARACTER_SIZE) / 2);
const STOP_Y = Math.floor((HEIGHT - CHARACTER_SIZE) / 2) + 8;
const EXIT_X = WIDTH + CHARACTER_SIZE;

const input = createInput();
const dialog = createDialog({ width: WIDTH, height: HEIGHT, input });
const choice = createChoice({ width: WIDTH, height: HEIGHT, input });
const p4 = new Image();
p4.src = "./assets/sprites/p4.png";

let startedAt = null;
let previousAt = null;
let p4X = START_X;
let walkFrame = 0;
let stepCount = 0;
let lastFrameAt = 0;
let messageStarted = false;
let arrivedAt = null;
let audioStarted = false;
let exitAt = null;
let exiting = false;
let finished = false;

function scheduleExit() {
  exitAt = performance.now() + EXIT_WAIT_MS;
}

function startExperience() {
  unlockAudio();
  if (audioStarted) return;
  audioStarted = true;
  startedAt = performance.now();
  previousAt = startedAt;
  lastFrameAt = startedAt;
}

function update(now, deltaMs) {
  if (!audioStarted) return;

  if (now - startedAt < WAIT_MS) return;

  if (!messageStarted && p4X < STOP_X) {
    p4X = Math.min(STOP_X, p4X + SPEED * deltaMs / 1000);
    if (now - lastFrameAt > FRAME_MS) {
      walkFrame ^= 1;
      playPuyoStep(stepCount);
      stepCount += 1;
      lastFrameAt = now;
    }
    return;
  }

  if (exitAt !== null && now >= exitAt) {
    exiting = true;
    exitAt = null;
    lastFrameAt = now;
  }

  if (exiting) {
    p4X = Math.min(EXIT_X, p4X + SPEED * deltaMs / 1000);
    if (now - lastFrameAt > FRAME_MS) {
      walkFrame ^= 1;
      playPuyoStep(stepCount);
      stepCount += 1;
      lastFrameAt = now;
    }
    if (p4X >= EXIT_X) {
      exiting = false;
      finished = true;
      walkFrame = 0;
    }
    return;
  }

  walkFrame = 0;
  if (!messageStarted && arrivedAt === null) {
    arrivedAt = now;
    return;
  }

  if (!messageStarted && now - arrivedAt < DIALOG_WAIT_MS) return;

  if (!messageStarted) {
    messageStarted = true;
    dialog.open("よ！オマエ！", () => {
      dialog.open("今日は東京ワンマンの日だ！", () => {
        setTimeout(() => {
          choice.open("遊びに来るのか？", (index) => {
            if (index === 0) {
              dialog.open("そうか！ありがとう！", () => {
                dialog.open("きてくれて心強いよ！", () => {
                  dialog.open("チケットは忘れずにな！", scheduleExit);
                });
              });
            } else {
              dialog.open("そっかそっか！", () => {
                dialog.open("遠かったり、予定あったり、大変だ\nろ？", () => {
                  dialog.open("そんな中、ここにアクセスしてくれ\nてありがとう。", () => {
                    dialog.open("楽しい１日にしてくれよ。", () => {
                      dialog.open("こっちも頑張ってるからさ。", () => {
                        dialog.open("じゃあまたな！", scheduleExit);
                      });
                    });
                  });
                });
              });
            }
          });
        }, 300);
      });
    });
  }
  if (choice.isActive()) choice.update(now);
  else dialog.update(now);
}

function drawP4() {
  if (!p4.complete || !p4.naturalWidth) return;
  ctx.drawImage(
    p4,
    walkFrame * SPRITE_SIZE,
    0,
    SPRITE_SIZE,
    SPRITE_SIZE,
    Math.round(p4X),
    STOP_Y,
    CHARACTER_SIZE,
    CHARACTER_SIZE,
  );
}

function draw(now) {
  const deltaMs = previousAt === null ? 0 : Math.min(50, now - previousAt);
  if (audioStarted) previousAt = now;

  update(now, deltaMs);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (!audioStarted) {
    ctx.fillStyle = "#fff";
    ctx.font = `${FONT_SIZE}px PixelMplus10, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "PRESS ANY BUTTON",
      Math.round(WIDTH / 2),
      Math.round(HEIGHT / 2),
    );
  } else if (now - startedAt >= WAIT_MS) {
    if (!finished) drawP4();
    if (choice.isActive()) choice.draw(ctx);
    else dialog.draw(ctx);
  }

  requestAnimationFrame(draw);
}

canvas.addEventListener("pointerdown", startExperience);
canvas.addEventListener("touchstart", startExperience, { passive: true });
setupMobileController(input, { onUserGesture: startExperience });
requestAnimationFrame(draw);
