// Delegation (CEO runs, from phase 3): what the label runs by itself, its limits, and last month's
// delegated steps with undo where possible. Never story, superstar or board decisions.
"use strict";

function delegationPanel() {
  const d = G.delegationSummary?.(state);
  if (!d) return '<div class="empty">No delegation in this run.</div>';
  const X = G.DELEGATION,
    S = d.settings,
    locked = blocked();
  const row = (key, title, body) =>
    `<article class="card delegate ${d.open[key] ? "" : "locked"}"><span class="tag">${d.open[key] ? "OPEN" : `OPENS AT PHASE ${X[key].phase}`}</span><h3>${title}</h3>${d.open[key] ? body : `<p class="muted">${esc(LOCKED_TEXT[key])}</p>`}</article>`;
  const toggle = (key) =>
    `<button data-action="delegateToggle" data-key="${key}" aria-pressed="${S[key].on}" ${disable(locked)}>${S[key].on ? "On" : "Off"}</button>`;
  const number = (key, field, label, step) =>
    `<label class="delegate-field">${label}<input type="number" min="0" step="${step}" data-delegate="${key}" data-field="${field}" value="${S[key][field]}" ${disable(locked)} /></label>`;
  const policies = Object.entries(X.autopilot.policies)
    .map(
      ([id, p]) =>
        `<button data-action="delegatePolicy" data-policy="${id}" aria-pressed="${S.autopilot.policy === id}" ${disable(locked)}>${esc(p.name)}<small>${p.actions} step${p.actions === 1 ? "" : "s"} a month · keeps ${p.reserveWeeks} weeks of overhead${p.staff ? "" : " · trains heads only"}</small></button>`,
    )
    .join("");
  const month = d.month.length
    ? `<ul class="delegate-log">${d.month
        .map(
          (x) =>
            `<li><span>W${x.week}: ${esc(x.text[0].toUpperCase() + x.text.slice(1))}</span>${x.undo && !x.undone ? `<button data-action="delegateUndo" data-id="${x.id}" ${disable(locked)}>Undo</button>` : x.undone ? "<small>Undone</small>" : ""}</li>`,
        )
        .join("")}</ul>`
    : '<div class="empty">Nothing delegated in the last four weeks.</div>';
  return `<p class="place-intro">Delegation handles chores, never stories, superstars or the board.</p>${row(
    "renew",
    "Contract renewals",
    `<p class="muted">Renew a finished contract for ${X.renew.term} albums when the artist's average album quality and new wage meet your limits.</p><div class="row">${toggle("renew")}${number("renew", "minQuality", "Lowest average quality", 1)}${number("renew", "maxWage", "Highest weekly wage", 50)}</div>`,
  )}${row(
    "tours",
    "Tour booking",
    `<p class="muted">The head of Live books a solo tour when an album qualifies: the biggest one whose upfront cost fits the cap.</p><div class="row">${toggle("tours")}${number("tours", "cap", "Upfront cap", 500)}</div>`,
  )}${row(
    "autopilot",
    "Department autopilot",
    `<p class="muted">Every ${X.autopilot.every} weeks: train heads, add juniors and develop artists, keeping cash in reserve.</p><div class="policy-row">${policies}<button data-action="delegatePolicy" data-policy="" aria-pressed="${S.autopilot.policy === null}" ${disable(locked)}>Off</button></div>`,
  )}${row(
    "coo",
    "Chief operating officer",
    `<p class="muted">Settles company events within a cash limit. Board matters and superstar events always come to you.</p><div class="row">${toggle("coo")}${number("coo", "limit", "Cash limit", 500)}</div>`,
  )}<h4>Last four weeks</h4>${month}`;
}
const LOCKED_TEXT = {
  renew: "Renew contracts by rule.",
  tours: "Let the head of Live book tours within a budget.",
  autopilot: "Let departments train, hire and develop on a policy.",
  coo: "Let a chief operating officer settle small company events.",
};

GoatUI.registerPanel({ id: "delegation", label: "Delegation", order: 64, render: delegationPanel });
GoatUI.click.push((b) => {
  const d = b.dataset;
  if (d.action === "delegateToggle")
    act(() => G.setDelegation(state, d.key, { on: !state.company.delegation[d.key].on }));
  else if (d.action === "delegatePolicy")
    act(() => G.setDelegation(state, "autopilot", { policy: d.policy || null }));
  else if (d.action === "delegateUndo") act(() => G.undoDelegated(state, d.id));
  else return false;
  return true;
});
GoatUI.change.push((e) => {
  const d = e.target?.dataset;
  if (!d?.delegate) return false;
  act(() => G.setDelegation(state, d.delegate, { [d.field]: Math.max(0, Number(e.target.value) || 0) }));
  return true;
});
