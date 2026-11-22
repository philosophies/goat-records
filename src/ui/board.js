// The boardroom (CEO runs): directors and what moves them, lobbying, funding, and the review scene.
"use strict";

const DIRECTOR_COLORS = {
  accountant: "#6fa8dc",
  visionary: "#c27ba0",
  friend: "#93c47d",
  oldGuard: "#b4a7a0",
  investor: "#e6b84a",
};
/** Which step of the review scene is showing. Reset when a new review arrives. */
const boardScene = { week: null, step: 0 };

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function directorPortrait(type, size = 28) {
  return pixelSvg(STAFF_SPRITE, DIRECTOR_COLORS[type] || "#999", size);
}
function meter(value) {
  return `<span class="meter ${value < 35 ? "low" : value >= 70 ? "high" : ""}"><i style="--pct:${Math.max(0, Math.min(100, value))}%"></i></span>`;
}
function freedomName(id) {
  return G.REVIEW.freedom.find((f) => f.id === id)?.name || "—";
}
function perkNames(ids) {
  return ids.length ? ids.map((id) => G.REVIEW.perks.find((p) => p.id === id).name).join(", ") : "None";
}

/* ---------------- Funding ---------------- */

function fundingCard() {
  const c = state.company,
    offers = G.fundingOffers(state),
    terms = {};
  const rows = offers
    .map((o) => {
      const term = (terms[o.kind] = (terms[o.kind] ?? -1) + 1);
      const what =
        o.kind === "loan"
          ? `${money(o.amount)} · ${money(o.payment)}/week for ${o.weeks} weeks · no seats`
          : `${money(o.amount)} for ${Math.round(o.equity * 100)}% · ${o.seats} board seat${o.seats === 1 ? "" : "s"}`;
      return `<li class="fund-offer"><div><b>${esc(o.name)}</b><small>${what}</small></div><button data-action="fundTake" data-kind="${o.kind}" data-term="${term}" ${disable(blocked())}>Take it</button></li>`;
    })
    .join("");
  const loan = c.loan
    ? `<p>Bank loan: ${money(c.loan.balance)} left at ${money(c.loan.payment)}/week. <button data-action="loanRepay" ${disable(blocked() || state.cash < c.loan.balance)}>Repay ${money(c.loan.balance)}</button></p>`
    : "";
  return `<h2>Funding</h2><p class="muted">You own ${Math.round(c.ownership * 100)}% of the company, valued at ${money(G.valuation(state))}. ${G.board(state) ? "" : "Taking investor money brings a board; a loan does not."}</p>${loan}<ul class="fund-list">${rows || '<li class="empty">No new deals this phase.</li>'}</ul>`;
}

/* ---------------- Directors and lobbying ---------------- */

function reasonsList(reasons) {
  if (!reasons.length) return '<li class="muted">On target</li>';
  return reasons
    .slice(0, 4)
    .map(
      (r) =>
        `<li class="${r.points >= 0 ? "up" : "down"}"><span>${esc(r.name)}</span><b>${r.points > 0 ? "+" : ""}${r.points}</b></li>`,
    )
    .join("");
}
function lobbyControls(d) {
  const promise = d.promise
    ? `<p class="muted">Promised: ${esc(G.METRICS[d.promise.metric].name.toLowerCase())} ${d.promise.metric === "scandals" ? "stays clean" : "reaches " + d.promise.value.toLocaleString("en-US")} by the review.</p>`
    : `<label>Promise<select id="promise-${d.id}">${G.promiseOptions(state, d.id)
        .map((o) => `<option value="${o.metric}">${esc(o.text)}</option>`)
        .join(
          "",
        )}</select></label><button data-action="boardPromise" data-director="${d.id}" ${disable(blocked())}>Promise</button>`;
  const favors = G.favorOptions(state, d.id)
    .map((f) => {
      let targets = [];
      if (f.kind === "candidate")
        targets = G.DEPARTMENTS.filter(
          (x) => G.departmentOpen(state, x.id) && !state.company.departments[x.id].head,
        ).map((x) => [x.id, x.head]);
      else if (f.kind === "shelve")
        targets = state.albums
          .filter((p) => !p.released && (p.themes || []).some((t) => G.APPROVAL.riskyThemes.includes(t)))
          .map((p) => [p.id, p.title]);
      else if (f.kind === "perk")
        targets = state.company.board.perks.map((id) => [id, G.REVIEW.perks.find((p) => p.id === id).name]);
      if (!targets.length) return "";
      return `<label>${esc(f.name)} (+${f.relationship})<select id="favor-${d.id}-${f.kind}">${targets
        .map(([v, name]) => `<option value="${esc(v)}">${esc(name)}</option>`)
        .join(
          "",
        )}</select></label><button data-action="boardFavor" data-director="${d.id}" data-kind="${f.kind}" ${disable(blocked())}>Trade</button>`;
    })
    .join("");
  const met = state.company.board.meetingWeek === state.week;
  return `<div class="lobby"><button data-action="boardMeet" data-director="${d.id}" ${disable(blocked() || met)}>${met ? "Met this week" : `Meet (+${G.LOBBY.meet})`}</button>${promise}${favors}</div>`;
}
function directorCard(d) {
  return `<article class="card director"><div class="director-head">${directorPortrait(d.type)}<div><b>${esc(d.name)}</b><small>${esc(d.archetype)} · relationship ${d.relationship > 0 ? "+" : ""}${d.relationship}</small></div><span class="score">${d.value}</span></div>${castBlurb(
    state.company.board.directors.find((x) => x.id === d.id),
    "p",
  )}${storyLines(`director:${d.id}`, 2)}${meter(d.value)}<details class="decision-details"><summary>Score and lobbying</summary><ul class="reasons">${reasonsList(d.reasons)}</ul>${lobbyControls(d)}</details></article>`;
}
function boardScreen() {
  if (!state.company) return '<div class="empty">The boardroom is part of a CEO run.</div>';
  const report = G.boardReport(state);
  if (!report)
    return `<p class="place-intro">No board yet. You answer to nobody until you take an angel or venture money. With no board there are no reviews, and nobody can fire you.</p>${section("sec-funding", fundingCard())}`;
  const b = state.company.board,
    budgetUsed = b.budget ? Math.min(100, Math.round(((b.spent || 0) / b.budget) * 100)) : 0;
  return `<p class="place-intro">${report.directors.length} director${report.directors.length === 1 ? "" : "s"} · next review week ${b.nextReview}${b.probation ? ' · <b class="warn">on probation</b>' : ""}</p>${section(
    "sec-confidence",
    `<h2>Confidence ${report.confidence}/100</h2>${meter(report.confidence)}<ul class="board-terms"><li><span>Budget left</span><b>${money(b.budgetLeft)} of ${money(b.budget)} · ${budgetUsed}% spent</b></li><li><span>Creative freedom</span><b>${freedomName(b.freedom)}</b></li><li><span>Perks</span><b>${esc(perkNames(b.perks))}</b></li>${floorRow()}</ul>${floorOffer()}${whyToggle("company", ["vote"], "How the last vote went")}`,
  )}${section("sec-directors", `<h2>Directors</h2><div class="directors">${report.directors.map(directorCard).join("")}</div>`)}${section("sec-funding", fundingCard())}`;
}
/** The album floor: album budgets the board lets through whatever it thinks of you. */
function floorRow() {
  const f = G.albumFloor(state);
  return f
    ? `<li><span>Album floor</span><b>${money(f.left)} of ${money(f.amount)} left${f.level ? ` · negotiated ×${G.ALBUM_FLOOR.levels[f.level - 1].mult}` : ""}</b></li>`
    : "";
}
function floorOffer() {
  const f = G.albumFloor(state);
  if (!f?.offer) return "";
  const c = state.company.board.confidence;
  return `<div class="card floor-offer"><p>The board is in a good mood after the review. Ask for a bigger album floor: ${money(f.next.amount)} a period, at ${f.next.at}+ confidence (now ${c}). It takes your week with the board; you can ask once.</p><button class="primary" data-action="negotiateFloor" ${disable(blocked())}>Negotiate the album floor</button></div>`;
}
/** The office's boardroom card. */
function boardSummary() {
  const report = G.boardReport(state);
  return `<article class="card board-summary"><span class="tag">BOARDROOM</span><h3>${report ? `Confidence ${report.confidence}/100` : "No board yet"}</h3><p class="muted">${report ? `Next review week ${state.company.board.nextReview}. Budget left ${money(state.company.board.budgetLeft)}.` : "Funding and the board live here."}</p><button data-tab="board">Open the boardroom</button></article>`;
}

/* ---------------- The review scene ---------------- */

function reviewScene() {
  const b = state.company?.board;
  if (!b?.scene || !b.reviews.length || state.finished) return "";
  const r = b.reviews.at(-1);
  if (boardScene.week !== r.week) Object.assign(boardScene, { week: r.week, step: 0 });
  const last = r.directors.length + 1,
    step = reducedMotion() ? last : Math.min(boardScene.step, last),
    shown = r.directors.slice(0, step),
    scores = shown
      .map(
        (d, i) =>
          `<li class="scene-score ${i === step - 1 && step <= r.directors.length ? "fresh" : ""}">${directorPortrait(d.type, 22)}<span>${esc(d.name)}${d.why?.length ? `<small class="scene-why">${d.why.map((r) => `${esc(r.name)} ${r.value > 0 ? "+" : ""}${r.value}`).join(" · ")}</small>` : ""}</span>${meter(d.satisfaction)}<b>${d.satisfaction}</b></li>`,
      )
      .join(""),
    vote =
      step === last
        ? `<div class="scene-vote ${reducedMotion() ? "" : "fresh"}"><h3>Confidence ${r.confidence}/100</h3>${r.vote ? `<p class="warn">No-confidence vote: ${r.vote.against} of ${r.vote.seats} against. ${r.vote.protectedByShares ? "Your majority stake held." : "You survived."}</p>` : ""}${r.probation ? '<p class="warn">You are on probation for the next period.</p>' : ""}<ul class="board-terms"><li><span>Budget</span><b>${money(r.budget)}</b></li><li><span>Creative freedom</span><b>${freedomName(r.freedom)}</b></li><li><span>Perks</span><b>${esc(perkNames(r.perks))}</b></li>${r.floor ? `<li><span>Album floor</span><b>${money(r.floor.amount)}${r.floor.offer ? " · open to negotiation" : ""}</b></li>` : ""}</ul>${(r.promises || []).length ? `<p class="muted">${r.promises.filter((p) => p.kept).length} of ${r.promises.length} promises kept.</p>` : ""}</div>`
        : "",
    button =
      step === last
        ? '<button class="primary" data-action="boardSceneDone">Back to work</button>'
        : `<button class="primary" data-action="boardSceneNext">${step === 0 ? "Hear the board" : step === r.directors.length ? "The vote" : "Next director"}</button>`;
  return `<div class="chart-alert board-scene" role="dialog" aria-label="Board review"><div class="chart-award">♜</div><div><span class="tag">WEEK ${r.week} · BOARD REVIEW</span><h2>The board reviews the year</h2><ol class="scene-scores">${scores}</ol>${vote}${button}</div></div>`;
}

GoatUI.click.push((b) => {
  const d = b.dataset;
  switch (d.action) {
    case "boardSceneNext":
      boardScene.step++;
      render();
      return true;
    case "boardSceneDone":
      act(() => G.ackReview(state));
      return true;
    case "boardMeet":
      act(() => G.meetDirector(state, d.director));
      return true;
    case "negotiateFloor":
      act(() => G.negotiateFloor(state));
      return true;
    case "boardPromise":
      act(() => G.makePromise(state, d.director, $("promise-" + d.director).value));
      return true;
    case "boardFavor":
      act(() => G.tradeFavor(state, d.director, d.kind, $(`favor-${d.director}-${d.kind}`).value));
      return true;
    case "fundTake":
      act(() => G.takeFunding(state, d.kind, Number(d.term)));
      return true;
    case "loanRepay":
      act(() => G.repayLoan(state));
      return true;
  }
  return false;
});
GoatUI.banners.push({ render: reviewScene });
GoatUI.registerPanel({ id: "board", label: "Boardroom", order: 6, render: boardScreen });

const GoatBoard = { screen: boardScreen, summary: boardSummary, scene: reviewScene };
