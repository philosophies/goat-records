// Campaign screen, goal chip, yearly and final review banners, and the New Game+ legacy picker.
// Uses the page globals set up in app.js (G, state, tab, esc, money, act, render) at render time.
"use strict";

const campaignView = { picks: new Set() };

const CAMPAIGN_STATUS = {
  met: "Achieved",
  missed: "Missed",
  untracked: "Not tracked",
  none: "No goal",
  active: "In progress",
  upcoming: "Upcoming",
};

function campaignStars(n) {
  return `<span class="campaign-stars" aria-label="${n} of 5 stars">${"★".repeat(n)}<span>${"★".repeat(5 - n)}</span></span>`;
}
function campaignValue(r) {
  if (typeof r.value !== "number") return esc(r.value);
  if (/^cash change/i.test(r.name)) return (r.value > 0 ? "+" : "") + money(r.value);
  return (r.value > 0 && /gained|change|·/.test(r.name) ? "+" : "") + r.value.toLocaleString("en-US");
}
/** Calculation rows in the same style as the album and award breakdowns. */
function campaignRows(rows) {
  return `<div class="formula">${rows
    .map(
      (r, i) =>
        `<div class="component" style="--delay:${i * 90}ms"><span>${esc(r.name)}</span><b>${campaignValue(r)}</b></div>`,
    )
    .join("")}</div>`;
}

/* ---------------- Status chip and goal banner ---------------- */

function campaignChip() {
  if (state.finished) return `<span class="campaign-chip">Run ${state.campaign.run} · final review</span>`;
  const g = G.currentGoal(state);
  if (!g) return `<span class="campaign-chip">Run ${state.campaign.run} · final year</span>`;
  return `<button class="campaign-chip ${g.met ? "met" : ""}" data-tab="campaign" title="Reward: ${esc(g.reward)} · goals are kept in the office">Y${g.year} goal · ${esc(g.goal.name)} · ${esc(g.text)}${g.met ? " ✓" : ""}</button>`;
}
function yearlyReview(r) {
  const met = r.status === "met";
  return `<div class="chart-alert campaign-review ${met ? "goal-met" : "goal-missed"}" role="status"><div class="chart-award">Y${r.year}</div><div><span class="tag">YEAR ${r.year} REVIEW · ${r.goal ? (met ? "GOAL ACHIEVED" : "GOAL MISSED") : "NO GOAL"}</span><h2>${esc(r.goal || "Year complete")}</h2>${r.goal ? `<p>${esc(r.progress || "")}${met ? " · Reward: " + esc(r.reward) : ""}</p>` : ""}${campaignRows(r.rows)}<p>${r.next ? `Next goal: <b>${esc(r.next.name)}</b> · reward ${esc(r.next.reward)}` : "The run ends after this year's awards."}</p></div><button data-action="campaignAck">Continue</button></div>`;
}
function campaignBanner() {
  if (state.finished) {
    const f = G.finalReview(state);
    return `<div class="chart-alert campaign-review" role="status"><div class="chart-award">★${f.score.stars}</div><div><span class="tag">RUN ${f.run} · ${f.bankrupt ? "OUT OF CASH" : "CAMPAIGN COMPLETE"}</span><h2>${f.score.total.toLocaleString("en-US")} points · ${campaignStars(f.score.stars)}</h2><p>${f.canNewGamePlus ? `${f.points} legacy points to spend on New Game+.` : "Start a new label to play again."}</p></div><div class="actions"><button data-tab="campaign">Final review →</button>${f.canNewGamePlus ? "" : '<button data-action="newLabel">Start a new label</button>'}</div></div>`;
  }
  const r = state.campaign.reviews.find((x) => !x.seen);
  return r ? yearlyReview(r) : "";
}

/* ---------------- Final review and New Game+ ---------------- */

function campaignHighlights(h) {
  const items = [
    [
      "Best album",
      h.bestAlbum
        ? `${h.bestAlbum.title} · ${h.bestAlbum.artist} · ${h.bestAlbum.quality}/100 (year ${h.bestAlbum.year})`
        : "none released",
    ],
    ["#1 albums", h.numberOnes.length ? h.numberOnes.join(", ") : "none"],
    [
      "Awards",
      h.awards
        ? `${h.awards}${h.awardTitles.length ? " · " + h.awardTitles.slice(0, 6).join(", ") : ""}`
        : "none",
    ],
    ["Top rank reached", h.topRank],
    ["Peak cash", money(h.peakCash)],
    ["Artists developed", h.developed.length ? h.developed.join(", ") : "none yet"],
    ["Yearly goals met", h.goalsMet],
  ];
  return `<ul class="campaign-highlights">${items.map(([k, v]) => `<li><small>${esc(k)}</small><b>${esc(v)}</b></li>`).join("")}</ul>`;
}
function legacyPicker(f) {
  if (!f.canNewGamePlus)
    return `<p class="muted">New Game+ opens when a run reaches the end of year ${state.campaign.years}, or runs out of cash after year one. Use New label to start over.</p>`;
  for (const id of [...campaignView.picks])
    if (!G.LEGACY_BONUSES.some((b) => b.id === id)) campaignView.picks.delete(id);
  const spent = G.LEGACY_BONUSES.filter((b) => campaignView.picks.has(b.id)).reduce((n, b) => n + b.cost, 0),
    left = f.points - spent;
  return `<h3>New Game+ · legacy bonuses</h3><p class="muted">Every ${G.LEGACY.scorePerPoint} points of final score earn one legacy point. Unspent points are kept for the next New Game+.</p><p class="legacy-points"><b>${left}</b> of ${f.points} legacy points left</p><div class="legacy-options">${G.LEGACY_BONUSES.map(
    (b) => {
      const on = campaignView.picks.has(b.id);
      return `<label class="legacy-option ${on ? "picked" : ""}"><input type="checkbox" data-legacy="${b.id}" ${on ? "checked" : ""} ${!on && b.cost > left ? "disabled" : ""}><span><b>${esc(b.name)} · ${b.cost} pt${b.cost > 1 ? "s" : ""}</b><small>${esc(b.text)}</small></span></label>`;
    },
  ).join(
    "",
  )}</div><button class="primary" data-action="campaignNewGamePlus">Start run ${f.run + 1} with these bonuses →</button>`;
}
function finalReviewCard() {
  const f = G.finalReview(state);
  return `<section class="campaign-final"><span class="tag">RUN ${f.run} · FINAL REVIEW · ${f.bankrupt ? `OUT OF CASH IN YEAR ${G.operatingYear(state.week)}` : `${f.yearsPlayed} YEARS`}</span><h2>${campaignStars(f.score.stars)} ${f.score.total.toLocaleString("en-US")} points</h2><article class="calculation"><h3>Final score</h3>${campaignRows(f.score.rows)}<div class="rating-total"><span>TOTAL <small>stars at ${G.CAMPAIGN_STARS.slice(1).join(" / ")}</small></span><strong>${f.score.total}</strong><span>${f.score.stars}★</span></div></article>${campaignHighlights(f.highlights)}${legacyPicker(f)}</section>`;
}

/* ---------------- Campaign screen ---------------- */

function campaignScreen() {
  const st = G.campaignStatus(state),
    g = st.current;
  const head = state.finished
    ? finalReviewCard()
    : `<div class="card campaign-current"><span class="tag">YEAR ${st.year} OF ${st.years}</span>${g ? `<h3>${esc(g.goal.name)}</h3><p>${esc(g.text)}${g.met ? " · met, the reward is paid at year end" : ""}</p><p class="muted">Reward: ${esc(g.reward)} · checked after the year's awards</p>` : "<h3>Final year</h3>"}<details><summary>Score so far</summary>${campaignRows(G.finalScore(state).rows)}<p>Total <b>${G.finalScore(state).total}</b> · ${campaignStars(G.finalScore(state).stars)}</p></details></div>`;
  const rows = st.goals
    .map(
      (y) =>
        `<tr class="goal-${y.status}"><td>${y.year}</td><td>${esc(y.name)}</td><td>${esc(y.reward)}</td><td><b>${CAMPAIGN_STATUS[y.status]}</b>${y.progress ? `<small>${esc(y.progress)}</small>` : ""}${y.earned ? `<small>${esc(y.earned)}</small>` : ""}</td></tr>`,
    )
    .join("");
  const legacy = st.legacy.length
    ? `<p class="muted">Legacy bonuses this run: ${st.legacy.map((b) => esc(b.name)).join(", ")}.${st.bank ? ` ${st.bank} legacy points banked.` : ""}</p>`
    : "";
  const history = st.history.length
    ? `<h3>Earlier runs</h3><ul class="campaign-history">${st.history.map((h) => `<li>Run ${h.run} · ${h.score.toLocaleString("en-US")} points · ${campaignStars(h.stars)} · ${h.bankrupt ? "out of cash" : h.years + " years"}</li>`).join("")}</ul>`
    : "";
  return `<div class="sectionhead"><h2>Campaign · run ${st.run}</h2><span class="muted">${st.met} of ${st.years} yearly goals met</span></div><p class="muted">Run the label for ${st.years} operating years. Each year has a goal; meeting it by the year's awards pays a reward. After year ${st.years} the run is scored and graded one to five stars, and the score buys legacy bonuses for the next run. A label that stays below $0 for four weeks folds and ends the run early.</p>${head}${legacy}<table class="campaign-goals"><thead><tr><th>Year</th><th>Goal</th><th>Reward</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>${history}`;
}

/* ---------------- Handlers ---------------- */

function campaignClick(b) {
  if (b.dataset.action === "campaignAck") {
    act(() => G.acknowledgeCampaignReview(state));
    return true;
  }
  if (b.dataset.action === "campaignNewGamePlus") {
    act(() => {
      state = G.newGamePlus(state, [...campaignView.picks]);
      campaignView.picks.clear();
      resetView();
    });
    return true;
  }
  return false;
}
function campaignChange(e) {
  const id = e.target?.dataset?.legacy;
  if (!id) return false;
  if (e.target.checked) campaignView.picks.add(id);
  else campaignView.picks.delete(id);
  render();
  return true;
}

GoatUI.registerPanel({ id: "campaign", label: "Campaign", order: 85, render: campaignScreen });
GoatUI.hud.push({ render: campaignChip });
GoatUI.banners.push({ render: campaignBanner });
GoatUI.click.push(campaignClick);
GoatUI.change.push(campaignChange);
