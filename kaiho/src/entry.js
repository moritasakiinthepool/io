const EVENT_MONTH = 6;
const EVENT_DAY = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function getJstDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function getEventState() {
  const today = getJstDateParts();
  const isEventDay = today.month === EVENT_MONTH && today.day === EVENT_DAY;
  let eventYear = today.year;

  if (
    today.month > EVENT_MONTH
    || (today.month === EVENT_MONTH && today.day > EVENT_DAY)
  ) {
    eventYear += 1;
  }

  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const eventUtc = Date.UTC(eventYear, EVENT_MONTH - 1, EVENT_DAY);
  const daysLeft = Math.max(0, Math.round((eventUtc - todayUtc) / DAY_MS));

  return { isEventDay, daysLeft };
}

function showCountdown(daysLeft) {
  const canvas = document.querySelector("#c");
  const context = canvas.getContext("2d");
  const message = `大阪ワンマンまであと${daysLeft}日`;

  document.body.classList.add("countdown-mode");
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fff";
  context.font = "10px PixelMplus10, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    message,
    Math.round(canvas.width / 2),
    Math.round(canvas.height / 2),
  );
}

const state = getEventState();
if (state.isEventDay) {
  import("./main.js?v=20260609-3");
} else {
  showCountdown(state.daysLeft);
}
