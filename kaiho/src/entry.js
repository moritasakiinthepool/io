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
  document.body.classList.add("countdown-mode");

  const message = document.createElement("p");
  message.className = "countdown-message";
  message.textContent = `大阪ワンマンまであと${daysLeft}日`;
  document.body.append(message);
}

const state = getEventState();
if (state.isEventDay) {
  import("./main.js?v=20260609-3");
} else {
  showCountdown(state.daysLeft);
}
