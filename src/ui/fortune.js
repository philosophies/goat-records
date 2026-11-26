// Choices with odds, on the page (T79): options show how bold they are but not what they do; once
// chosen, the outcome is revealed with a short animation. A testing switch shows outcomes before
// choosing. The switch is kept in this browser, not in the save.
"use strict";

const OUTCOMES_KEY = "goat-records-show-outcomes";
/** Whether outcomes show before choosing (testing). */
function outcomesShown() {
  try {
    return localStorage.getItem(OUTCOMES_KEY) === "1";
  } catch {
    return false;
  }
}
function setOutcomesShown(on) {
  try {
    localStorage.setItem(OUTCOMES_KEY, on ? "1" : "0");
  } catch {}
}
/** "Bold: 30% a triumph (gains ×2.8), 35% as planned, 35% it backfired (gains ×−0.3, losses ×2)." */
function oddsText(risk) {
  const F = G.FORTUNE;
  return `${F.riskNames[risk]}: ${F.risks[risk]
    .map(
      (t) =>
        `${t.weight}% ${F.outcomeNames[t.id].toLowerCase()}${t.id === "planned" ? "" : ` (gains ×${t.gain}, losses ×${t.loss})`}`,
    )
    .join(", ")}.`;
}
/** The switch on a decision card. */
function outcomeSwitch() {
  const on = outcomesShown();
  return `<button class="link outcome-switch" data-action="toggleOutcomes" aria-pressed="${on}">${on ? "Hide outcomes" : "Show outcomes"} (testing)</button>`;
}
const signedNum = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toLocaleString("en-US");
/** The card that reveals what the last choice did. */
function outcomeReveal() {
  const x = state.company?.lastOutcome;
  if (!x || x.seen) return "";
  const lines = x.effects.length
    ? x.effects
        .map(
          (e, i) =>
            `<li style="--i:${i}" class="${e.delta > 0 ? "up" : e.delta < 0 ? "down" : "news"}">${esc(e.name)}${e.delta ? ` <b>${e.money ? (e.delta < 0 ? "−" : "+") + money(Math.abs(e.delta)) : signedNum(e.delta)}</b>` : ""}</li>`,
        )
        .join("")
    : `<li class="news">Nothing changed.</li>`;
  return `<div class="event outcome-reveal tier-${x.tier} risk-${x.risk}"><span class="tag">${G.FORTUNE.riskNames[x.risk].toUpperCase()} CALL · THE OUTCOME</span><h2>${esc(x.title)}</h2><p class="outcome-choice">You chose: <b>${esc(x.label)}</b></p><div class="outcome-stamp" aria-live="polite">${esc(x.name)}</div><ul class="outcome-effects">${lines}</ul><div class="actions"><button class="primary" data-action="outcomeSeen">Continue</button></div></div>`;
}

GoatUI.pauses.push({
  reason: () => (state.company?.lastOutcome && !state.company.lastOutcome.seen ? "outcome" : ""),
});
GoatUI.click.push((b) => {
  const d = b.dataset;
  if (d.action === "toggleOutcomes") {
    setOutcomesShown(!outcomesShown());
    render();
    return true;
  }
  if (d.action === "outcomeSeen") {
    if (state.company?.lastOutcome) state.company.lastOutcome.seen = true;
    save();
    render();
    return true;
  }
  return false;
});
