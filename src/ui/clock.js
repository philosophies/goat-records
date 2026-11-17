// Live clock: Pause / 1× / 2× / 4×. Each tick runs the same step as the Next week button.
// clockState() is pure so it can be checked outside the page; GoatClock drives the page.
"use strict";

const CLOCK_SPEEDS = [0, 1, 2, 4];
/** Milliseconds per tick at 1×. */
const CLOCK_TICK_MS = 4000;
const CLOCK_STORAGE_KEY = "goat-records-clock-speed";

/** Reasons the game state needs the player before time can pass, most urgent first. */
function clockReasons(state, ui = {}) {
  const out = [];
  if (state.finished) out.push("run complete");
  if (state.event)
    out.push(
      state.event.type === "tourDay"
        ? "tour decision"
        : state.event.type === "awards"
          ? "awards night"
          : "industry event",
    );
  for (const p of state.albums || []) {
    const d = p.production;
    if (p.launchReview) out.push("release results");
    else if (!p.released && d) {
      if (d.review) out.push("stage results ready");
      else if (d.releaseReady) out.push("album ready to release");
      else if (d.cooldown === 0) out.push("album decision ready");
    }
  }
  if (state.notifications?.length) out.push("chart milestone");
  if ((state.rankUps || []).some((r) => !r.seen)) out.push("rank up");
  if (ui.productionBlock && !out.length) out.push("album decision ready");
  for (const r of ui.blockers || []) if (r) out.push(r);
  return [...new Set(out)];
}

/**
 * Decides whether the clock runs. ui: { speed, blockers: [text], productionBlock }.
 * Returns { run, reason, held, speed, interval }: held means the player chose a speed but
 * something is waiting, so time resumes by itself once it clears.
 */
function clockState(state, ui = {}) {
  const speed = CLOCK_SPEEDS.includes(ui.speed) ? ui.speed : 0,
    reasons = clockReasons(state, ui);
  if (reasons.length) return { run: false, reason: reasons[0], held: speed > 0, speed, interval: 0 };
  if (!speed) return { run: false, reason: "paused", held: false, speed, interval: 0 };
  return { run: true, reason: "", held: false, speed, interval: CLOCK_TICK_MS / speed };
}

/** Text for the top bar: "Paused · album decision ready". */
function clockLabel(c, hint) {
  if (c.run) return `${c.speed}× · time is running`;
  if (c.reason === "paused") return hint ? "Paused · press 1× to start the clock" : "Paused";
  return "Paused · " + c.reason;
}

const GoatClock = {
  speed: 0,
  progress: 0,
  hint: false,
  blockers: [],
  timer: null,
  last: 0,
  /** Restores the saved speed. A brand-new label always starts paused with a hint. */
  init(fresh) {
    let saved = 0;
    try {
      saved = Number(localStorage.getItem(CLOCK_STORAGE_KEY)) || 0;
    } catch {}
    this.speed = fresh || !CLOCK_SPEEDS.includes(saved) ? 0 : saved;
    this.hint = !!fresh;
    this.progress = 0;
    if (!this.timer && typeof setInterval === "function" && typeof window !== "undefined") {
      this.last = Date.now();
      this.timer = setInterval(() => this.frame(), 100);
    }
  },
  setSpeed(n) {
    this.speed = CLOCK_SPEEDS.includes(n) ? n : 0;
    if (this.speed) this.hint = false;
    try {
      localStorage.setItem(CLOCK_STORAGE_KEY, String(this.speed));
    } catch {}
    this.update();
  },
  /** A new label starts paused. */
  reset() {
    this.speed = 0;
    this.hint = true;
    this.progress = 0;
    try {
      localStorage.setItem(CLOCK_STORAGE_KEY, "0");
    } catch {}
  },
  ui() {
    return { speed: this.speed, blockers: this.blockers, productionBlock: G.productionBlock(state) };
  },
  current() {
    return clockState(state, this.ui());
  },
  /** Day of the label week shown in the top bar: the tour day on the road, else clock progress. */
  day() {
    if (state.tours.some((t) => t.status === "active"))
      return Math.min(7, state.event?.type === "tourDay" ? state.tourDayInWeek : state.tourDayInWeek + 1);
    return Math.min(7, 1 + Math.floor(this.progress * 7));
  },
  /** Called after every render with the page's own reasons to hold time. */
  update(blockers) {
    if (blockers) this.blockers = blockers;
    const c = this.current(),
      buttons = [
        [0, "❚❚", "Pause"],
        [1, "1×", "Normal speed"],
        [2, "2×", "Double speed"],
        [4, "4×", "Fast speed"],
      ];
    paintHTML(
      "clock",
      buttons
        .map(
          ([n, text, label]) =>
            `<button data-action="clockSpeed" data-id="${n}" class="${n === this.speed ? "on" : ""} ${n === this.speed && c.held ? "held" : ""}" aria-pressed="${n === this.speed}" aria-label="${label}" title="${label}">${text}</button>`,
        )
        .join(""),
    );
    const reason = $("clockReason");
    reason.textContent = clockLabel(c, this.hint);
    reason.className = "clock-reason " + (c.run ? "running" : c.reason === "paused" ? "idle" : "waiting");
    this.paint();
  },
  /** Updates the progress bar and the day without a full render. */
  paint() {
    const bar = $("clockProgress");
    if (bar && bar.style) bar.style.width = Math.round(this.progress * 1000) / 10 + "%";
    const day = $("dateDay");
    if (day) day.textContent = "DAY " + this.day();
  },
  frame() {
    const now = Date.now(),
      dt = Math.min(500, now - this.last);
    this.last = now;
    if (typeof document !== "undefined" && document.hidden) return;
    const c = this.current();
    if (!c.run) return;
    this.progress += dt / c.interval;
    if (this.progress >= 1) {
      this.progress = 0;
      this.tick();
    } else this.paint();
  },
  /** One step of time, exactly as the Next week button. Stops the clock if the step fails. */
  tick() {
    advanceOnce();
    if ($("message").textContent) this.setSpeed(0);
  },
};

if (typeof module !== "undefined" && module.exports)
  module.exports = { clockState, clockReasons, clockLabel, CLOCK_SPEEDS, CLOCK_TICK_MS };
