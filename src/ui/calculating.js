// Calculating (T83): in a CEO run, after each album decision (a stage choice or a reshuffle) the result
// is worked out on screen for five seconds before it shows: the parts of the score come in one by one
// while the number rolls. The clock holds meanwhile. "Skip" shows the result at once.
"use strict";

const GoatCalc = {
  ms: 5000,
  run: null, // { id, until }
  timer: 0,
  ticker: 0,
};
/** Starts the calculation for an album whose result was just decided. */
function startCalculating(p) {
  if (!state.company || !(GoatCalc.ms > 0)) return;
  stopCalculating(false);
  GoatCalc.run = { id: p.id, until: Date.now() + GoatCalc.ms };
  GoatCalc.timer = setTimeout(() => stopCalculating(true), GoatCalc.ms);
  if (typeof setInterval === "function")
    GoatCalc.ticker = setInterval(() => {
      const n = typeof document.getElementById === "function" && document.getElementById("calc-roll");
      if (n && "textContent" in n) n.textContent = String(30 + Math.floor(Math.random() * 70));
    }, 90);
}
function stopCalculating(repaint) {
  if (typeof clearTimeout === "function") clearTimeout(GoatCalc.timer);
  if (GoatCalc.ticker && typeof clearInterval === "function") clearInterval(GoatCalc.ticker);
  GoatCalc.ticker = 0;
  const was = !!GoatCalc.run;
  GoatCalc.run = null;
  if (repaint && was) render();
}
/** Whether an album's result is still being calculated. */
function calculating(id) {
  const c = GoatCalc.run;
  return !!c && c.id === id && Date.now() < c.until;
}
/** The card shown while a result is calculated: the parts arrive in turn, the score is hidden. */
function calculatingCard(p, r, tag) {
  const rows = r.parts
    .map(
      (row, i) =>
        `<li style="--i:${i};--n:${r.parts.length}"><span>${esc(row.name)}</span><b>${row.value >= 0 ? "+" : "−"}··</b></li>`,
    )
    .join("");
  return `<div class="calculating" role="status" aria-live="polite" style="--ms:${GoatCalc.ms}ms"><span class="tag">${tag} · CALCULATING</span><h2>${esc(p.title)} / ${esc(r.name)}</h2><div class="calc-dial"><span class="calc-spin" aria-hidden="true"></span><b id="calc-roll">··</b><small>/100</small></div><ul class="calc-parts">${rows}</ul><div class="calc-bar"><span></span></div><button class="link" data-action="calcSkip">Skip</button></div>`;
}

GoatUI.pauses.push({ reason: () => (GoatCalc.run && Date.now() < GoatCalc.run.until ? "calculating" : "") });
GoatUI.click.push((b) => {
  if (b.dataset.action !== "calcSkip") return false;
  stopCalculating(true);
  return true;
});
