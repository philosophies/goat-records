// The company's growth phases (CEO runs): a top bar chip and the Company panel, which the office
// also shows. Nothing renders in a classic run.
"use strict";

function companyGoalValue(key, n) {
  return key === "revenue" ? money(n) : Math.round(n).toLocaleString("en-US");
}

function companyChip() {
  const phase = G.companyPhase(state);
  if (!phase) return "";
  const pr = G.phaseProgress(state),
    met = pr ? pr.goals.filter((g) => g.met).length : 0;
  return `<button class="company-chip" data-tab="company" title="Company growth: goals for the next phase">Phase ${phase.id} · ${esc(phase.name)}${pr ? ` · ${met}/${pr.goals.length} goals` : ""}</button>`;
}

function companyScreen() {
  const phase = G.companyPhase(state);
  if (!phase) return '<div class="empty">Company phases are part of a CEO run.</div>';
  const pr = G.phaseProgress(state);
  const ladder = G.PHASES.map((p) => {
    const status = p.id < phase.id ? "done" : p.id === phase.id ? "now" : p.id === phase.id + 1 ? "next" : "";
    const reached = state.company.history.find((h) => h.phase === p.id);
    return `<li class="phase-step ${status}"><b>${p.id}</b><span><strong>${esc(p.name)}</strong><small>Scouts ${esc(G.REACH_SCOUTING[p.reach].name)}${p.boardSeats ? ` · ${p.boardSeats}-seat board with investors` : ""}${reached ? ` · reached week ${reached.week}` : ""}</small></span></li>`;
  }).join("");
  const goals = pr
    ? `<h3>Goals for phase ${pr.next.id}, ${esc(pr.next.name)}</h3><ul class="phase-goals">${pr.goals
        .map((g) => {
          const pct = g.need ? Math.min(100, Math.round((g.have / g.need) * 100)) : 100;
          return `<li class="${g.met ? "met" : ""}"><span>${g.met ? "✓" : "○"} ${esc(g.name)}</span><span>${companyGoalValue(g.key, g.have)} / ${companyGoalValue(g.key, g.need)}</span><i style="--pct:${pct}%"></i></li>`;
        })
        .join(
          "",
        )}</ul><p class="muted">The label moves up at the weekly settlement once every goal is met. A phase is never lost.</p>`
    : '<p class="muted">The label has reached its final phase.</p>';
  return `<h2>Phase ${phase.id} · ${esc(phase.name)}</h2><p class="muted">Since week ${state.company.since}. Scouting reaches ${esc(G.REACH_SCOUTING[phase.reach].name)}.</p>${goals}<h3>The road to a public company</h3><ol class="phase-ladder">${ladder}</ol>`;
}

/** The office's name card: works in every run. */
function companyNameCard() {
  return `<article class="card company-name"><span class="tag">COMPANY NAME</span><h3>${esc(G.labelName(state))}</h3><label>New name<input id="labelNameInput" maxlength="${G.RENAME.maxLength}" value="${esc(G.labelName(state))}"></label><p class="muted">The name shows on the roof sign, the charts, the awards and the news. A rename costs ${G.RENAME.fame} fame while fans catch up.</p><button data-action="renameLabel" ${disable(blocked())}>Rename the label</button></article>`;
}
function companyClick(b) {
  if (b.dataset.action !== "renameLabel") return false;
  act(() => G.renameLabel(state, $("labelNameInput").value));
  return true;
}

GoatUI.registerPanel({ id: "company", label: "Company", order: 5, render: companyScreen });
GoatUI.click.push(companyClick);
GoatUI.hud.push({ render: companyChip });
